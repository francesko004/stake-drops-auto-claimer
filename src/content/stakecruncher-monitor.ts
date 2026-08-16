/**
 * Content script injected into StakeCruncher (https://stakecruncher.com/bonus-codes).
 * Monitors bonus code list mutations and immediately reports newly appeared codes.
 */

import { STAKECRUNCHER_SELECTORS } from '../shared/constants.js';
import { Logger } from '../shared/logger.js';
import { NewCodeMessage, StakecruncherPongMessage } from '../shared/messages.js';
import { isNewCode, parseBonusCodeElement } from '../shared/parser.js';
import { BonusCode } from '../shared/types.js';

const logger = new Logger('StakeCruncherMonitor');

class StakeCruncherMonitor {
  private seenNormalizedCodes: Set<string> = new Set();
  private observer: MutationObserver | null = null;
  private isInitialized: boolean = false;
  private isLiveReportingReady: boolean = false;
  private isDestroyed: boolean = false;
  private hydrationTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Validates if the extension runtime context is still alive.
   */
  private isContextValid(): boolean {
    try {
      return typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined' && Boolean(chrome.runtime?.id);
    } catch {
      return false;
    }
  }

  /**
   * Safely detaches observers and cleans up when orphaned or destroyed.
   */
  public destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    if (this.observer) {
      try {
        this.observer.disconnect();
      } catch { /* ignore */ }
      this.observer = null;
    }

    if (this.hydrationTimer !== null) {
      clearTimeout(this.hydrationTimer);
      this.hydrationTimer = null;
    }

    logger.debug('StakeCruncher monitor cleanly detached and destroyed.');
  }

  public init(): void {
    if (this.isInitialized || this.isDestroyed) return;
    if (!this.isContextValid()) {
      this.destroy();
      return;
    }

    this.isInitialized = true;
    logger.info('Initializing StakeCruncher bonus code monitor on:', window.location.href);

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }

    this.listenForMessages();
  }

  private setup(): void {
    if (this.isDestroyed || !this.isContextValid()) {
      this.destroy();
      return;
    }

    // 1. Initial baseline sweep
    this.recordBaselineCodes();

    // 2. Attach observer to document root to never miss asynchronous container mount
    this.attachObserver();

    // 3. Keep updating baseline during the initial 1.5s page hydration window
    this.hydrationTimer = setTimeout(() => {
      if (this.isDestroyed || !this.isContextValid()) {
        this.destroy();
        return;
      }
      this.recordBaselineCodes();
      this.isLiveReportingReady = true;
      logger.info(`Live reporting armed. Baseline contains ${this.seenNormalizedCodes.size} codes.`);
    }, 1500);
  }

  /**
   * Identifies all codes currently rendered in the DOM and marks them as seen baseline.
   */
  private recordBaselineCodes(): void {
    const items = document.querySelectorAll(STAKECRUNCHER_SELECTORS.ITEM);
    items.forEach((el) => {
      const parsed = parseBonusCodeElement(el);
      if (parsed && parsed.normalizedCode) {
        this.seenNormalizedCodes.add(parsed.normalizedCode);
      }
    });
  }

  /**
   * Sets up MutationObserver to detect new .bonus-code-item elements as soon as they appear.
   */
  private attachObserver(): void {
    if (this.isDestroyed || !this.isContextValid()) {
      this.destroy();
      return;
    }

    const target = document.documentElement || document.body;

    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    this.observer.observe(target, {
      childList: true,
      subtree: true
    });

    logger.info('MutationObserver active on document root');
  }

  /**
   * Processes DOM mutation records for newly added bonus codes.
   */
  private handleMutations(mutations: MutationRecord[]): void {
    if (this.isDestroyed) return;
    if (!this.isContextValid()) {
      this.destroy();
      return;
    }

    for (const mutation of mutations) {
      if (mutation.type !== 'childList' || mutation.addedNodes.length === 0) {
        continue;
      }

      for (let i = 0; i < mutation.addedNodes.length; i++) {
        const node = mutation.addedNodes[i];
        if (!(node instanceof Element)) continue;

        if (node.matches && node.matches(STAKECRUNCHER_SELECTORS.ITEM)) {
          this.processCodeElement(node);
        } else if (node.querySelectorAll) {
          const nestedItems = node.querySelectorAll(STAKECRUNCHER_SELECTORS.ITEM);
          nestedItems.forEach((nestedEl) => this.processCodeElement(nestedEl));
        }
      }
    }
  }

  /**
   * Parses an element and sends a NEW_CODE message if genuinely new.
   */
  private processCodeElement(element: Element): void {
    if (this.isDestroyed || !this.isContextValid()) {
      this.destroy();
      return;
    }

    const parsed: BonusCode | null = parseBonusCodeElement(element);
    if (!parsed || !parsed.normalizedCode) return;

    if (!this.isLiveReportingReady) {
      // Still in baseline hydration window
      this.seenNormalizedCodes.add(parsed.normalizedCode);
      return;
    }

    if (isNewCode(parsed, this.seenNormalizedCodes)) {
      this.seenNormalizedCodes.add(parsed.normalizedCode);
      logger.info(`🔥 Genuinely new bonus code detected: ${parsed.code}`);
      this.sendNewCode(parsed);
    }
  }

  /**
   * Dispatches NEW_CODE message to background service worker.
   */
  private sendNewCode(code: BonusCode): void {
    if (this.isDestroyed) return;
    if (!this.isContextValid()) {
      this.destroy();
      return;
    }

    const msg: NewCodeMessage = {
      type: 'NEW_CODE',
      payload: { code }
    };

    try {
      chrome.runtime.sendMessage(msg, (response) => {
        const lastErr = chrome.runtime.lastError;
        if (lastErr) {
          if (lastErr.message && /Extension context invalidated/i.test(lastErr.message)) {
            this.destroy();
            return;
          }
          logger.warn('Error sending NEW_CODE to service worker:', lastErr.message);
        } else {
          logger.debug('NEW_CODE acknowledged by service worker:', response);
        }
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (/Extension context invalidated/i.test(errMsg)) {
        this.destroy();
      } else {
        logger.error('Failed to dispatch NEW_CODE message:', err);
      }
    }
  }

  /**
   * Listens for ping/heartbeat messages from the extension.
   */
  private listenForMessages(): void {
    try {
      if (!this.isContextValid()) return;
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (!this.isContextValid()) {
          this.destroy();
          return false;
        }
        if (message && message.type === 'STAKECRUNCHER_PING') {
          const pong: StakecruncherPongMessage = {
            type: 'STAKECRUNCHER_PONG',
            payload: {
              monitoring: this.observer !== null,
              codeCount: this.seenNormalizedCodes.size,
              url: window.location.href
            }
          };
          sendResponse(pong.payload);
        }
        return false;
      });
    } catch {
      // Ignored if runtime context is unavailable
    }
  }
}

// Instantiate and start
const monitor = new StakeCruncherMonitor();
monitor.init();
