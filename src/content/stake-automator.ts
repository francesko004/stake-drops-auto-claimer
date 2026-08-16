/**
 * Content script injected into Stake (https://stake.com/*).
 * Interacts with the visible DOM UI to submit bonus codes and observe responses.
 *
 * Key discovery: Stake uses Svelte 5 (not React). Input state is managed via
 * $state() runes and bind:value, so we need Svelte-compatible event dispatch.
 * The bonus code form is under Settings > Offers, header "Claim Bonus Drop",
 * with a "Submit" button.
 */

import { DISMISS_KEYWORDS, DISMISS_SELECTORS, RESULT_PATTERNS, SECURITY_CHALLENGE_SELECTORS, STAKE_SELECTORS, TIMING } from '../shared/constants.js';
import { Logger } from '../shared/logger.js';
import {
  ExecuteClaimMessage,
  SecurityChallengeDetectedMessage,
  StakePongMessage
} from '../shared/messages.js';
import { BonusCode, ClaimResult, ClaimStatus } from '../shared/types.js';

const logger = new Logger('StakeAutomator');

class StakeDetectorInline {
  static isElementVisible(el: Element | null): boolean {
    if (!el || !(el instanceof HTMLElement)) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = window.getComputedStyle(el);
    return !(style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0' || style.pointerEvents === 'none');
  }

  static isElementEnabled(el: HTMLElement): boolean {
    return !(!el || (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true' || el.classList.contains('disabled'));
  }

  static detectSecurityChallenge(): { hasChallenge: boolean; details?: string } {
    for (const selector of SECURITY_CHALLENGE_SELECTORS) {
      const el = document.querySelector(selector);
      if (el && this.isElementVisible(el)) {
        return { hasChallenge: true, details: `Found security element: ${selector}` };
      }
    }
    const title = (document.title || '').toLowerCase();
    if (title.includes('just a moment') || title.includes('attention required') || title.includes('security check') || title.includes('cloudflare')) {
      return { hasChallenge: true, details: `Challenge title: ${document.title}` };
    }
    return { hasChallenge: false };
  }

  /**
   * Opens the Offers modal/tab. On Stake's Svelte 5 SPA, tries clicking
   * navigation links first, then falls back to SPA pushState.
   */
  static openOffersModal(): boolean {
    for (const selector of STAKE_SELECTORS.NAVIGATION_TRIGGERS) {
      const el = document.querySelector<HTMLElement>(selector);
      if (el && this.isElementVisible(el)) {
        el.click();
        logger.info(`Clicked navigation trigger: ${selector}`);
        return true;
      }
    }

    // Try direct SPA navigation
    try {
      if (!window.location.pathname.includes('/settings/offers')) {
        window.history.pushState(null, '', '/settings/offers');
        window.dispatchEvent(new PopStateEvent('popstate'));
        logger.info('SPA-navigated to /settings/offers via pushState');
        return true;
      }
    } catch { /* ignored */ }

    return false;
  }

  /**
   * Finds the bonus code input using broad heuristics.
   * Stake's "Claim Bonus Drop" section has a text input for the code.
   */
  static findBonusCodeInput(): HTMLInputElement | null {
    // 1. Check modals/dialogs first
    const modals = document.querySelectorAll(STAKE_SELECTORS.MODAL_CONTAINER.join(','));
    for (const modal of modals) {
      if (this.isElementVisible(modal)) {
        const inputs = modal.querySelectorAll('input');
        for (const input of inputs) {
          if (this.isBonusInputCandidate(input)) return input;
        }
      }
    }

    // 2. Direct selector match
    for (const selector of STAKE_SELECTORS.INPUT_SELECTORS) {
      const inputs = document.querySelectorAll<HTMLInputElement>(selector);
      for (const input of inputs) {
        if (this.isBonusInputCandidate(input)) return input;
      }
    }

    // 3. Context-based: find heading "Claim Bonus Drop" or "Bonus Drop" and look for nearby input
    const allHeadings = document.querySelectorAll('h1, h2, h3, h4, h5, h6, [class*="title"], [class*="heading"], span, p, div');
    for (const heading of allHeadings) {
      const text = (heading.textContent || '').trim().toLowerCase();
      if (text.includes('bonus drop') || text.includes('claim bonus') || text.includes('redeem') || text.includes('bonus code')) {
        // Look for input in same parent container
        const container = heading.closest('section') || heading.closest('div') || heading.parentElement;
        if (container) {
          const inputs = container.querySelectorAll<HTMLInputElement>('input');
          for (const input of inputs) {
            if (this.isElementVisible(input) && this.isElementEnabled(input)) {
              const type = (input.getAttribute('type') || 'text').toLowerCase();
              if (type !== 'password' && type !== 'email' && type !== 'search' && type !== 'checkbox' && type !== 'radio' && type !== 'hidden') {
                logger.info(`Found input near "${text}" heading`);
                return input;
              }
            }
          }
        }
      }
    }

    // 4. Broad fallback: scan all visible text inputs
    const allInputs = document.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])');
    for (const input of allInputs) {
      if (this.isBonusInputCandidate(input)) return input;
    }

    return null;
  }

  static isBonusInputCandidate(input: HTMLInputElement): boolean {
    if (!this.isElementVisible(input) || !this.isElementEnabled(input)) return false;
    const type = (input.getAttribute('type') || 'text').toLowerCase();
    if (type === 'password' || type === 'email' || type === 'search' || type === 'number' || type === 'checkbox' || type === 'radio' || type === 'hidden') return false;

    const name = (input.getAttribute('name') || '').toLowerCase();
    const id = (input.getAttribute('id') || '').toLowerCase();
    const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
    const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
    const testId = (input.getAttribute('data-testid') || '').toLowerCase();
    const className = (input.className || '').toLowerCase();

    const keywords = ['bonus', 'code', 'coupon', 'promo', 'drop', 'redeem', 'voucher', 'offer'];
    if (keywords.some(kw => name.includes(kw) || id.includes(kw) || placeholder.includes(kw) || ariaLabel.includes(kw) || testId.includes(kw) || className.includes(kw))) {
      return true;
    }

    // Check parent/ancestor labels or nearby text
    const parentLabel = input.closest('label');
    if (parentLabel?.textContent) {
      const labelText = parentLabel.textContent.toLowerCase();
      if (keywords.some(kw => labelText.includes(kw))) return true;
    }

    // Check if ancestor has relevant text (Svelte components often wrap in divs)
    let ancestor: HTMLElement | null = input.parentElement;
    for (let depth = 0; depth < 4 && ancestor; depth++) {
      const ancestorText = (ancestor.textContent || '').toLowerCase().substring(0, 200);
      if ((ancestorText.includes('bonus drop') || ancestorText.includes('bonus code') || ancestorText.includes('claim bonus') || ancestorText.includes('redeem code')) && !ancestorText.includes('deposit')) {
        return true;
      }
      ancestor = ancestor.parentElement;
    }

    return false;
  }

  /**
   * Finds the Submit/Claim button. Stake uses "Submit" as the button text.
   */
  static findClaimButton(inputElement?: HTMLElement | null): HTMLButtonElement | null {
    if (inputElement) {
      // Walk up to find the containing form or section
      let container: Element | null = inputElement.closest('form')
        || inputElement.closest('[role="dialog"]')
        || inputElement.closest('.modal-content')
        || inputElement.closest('section');

      // Also try walking up parent divs (Svelte wraps in nested divs)
      if (!container) {
        let parent: HTMLElement | null = inputElement.parentElement;
        for (let i = 0; i < 6 && parent; i++) {
          const buttons = parent.querySelectorAll<HTMLButtonElement>('button');
          for (const btn of buttons) {
            if (this.isClaimButtonCandidate(btn)) return btn;
          }
          parent = parent.parentElement;
        }
      }

      if (container) {
        const buttons = container.querySelectorAll<HTMLButtonElement>('button');
        for (const btn of buttons) {
          if (this.isClaimButtonCandidate(btn)) return btn;
        }
      }
    }

    // Direct selector search
    for (const selector of STAKE_SELECTORS.BUTTON_SELECTORS) {
      const buttons = document.querySelectorAll<HTMLButtonElement>(selector);
      for (const btn of buttons) {
        if (this.isClaimButtonCandidate(btn)) return btn;
      }
    }

    // Broad scan
    const all = document.querySelectorAll<HTMLButtonElement>('button');
    for (const btn of all) {
      if (this.isClaimButtonCandidate(btn)) return btn;
    }

    return null;
  }

  static isClaimButtonCandidate(button: HTMLButtonElement): boolean {
    if (!this.isElementVisible(button) || !this.isElementEnabled(button)) return false;
    const text = (button.textContent || '').trim().toLowerCase();
    const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
    const testId = (button.getAttribute('data-testid') || '').toLowerCase();

    // Stake's actual button text is "Submit"
    const claimKeywords = ['claim', 'redeem', 'apply', 'submit', 'claim bonus', 'submit drop', 'activate'];
    const isCandidate = claimKeywords.some(kw => text === kw || text.includes(kw) || ariaLabel.includes(kw) || testId.includes(kw));

    const forbidden = ['deposit', 'withdraw', 'chat', 'logout', 'search', 'close', 'cancel', 'sign', 'register', 'login', 'tip', 'send', 'swap', 'dismiss'];
    const isForbidden = forbidden.some(kw => text.includes(kw));

    return isCandidate && !isForbidden;
  }

  /**
   * Locates visible Dismiss / Close / OK buttons on active outcome dialogs or toasts.
   */
  static findDismissButton(container?: Element | null): HTMLButtonElement | null {
    // 1. Check specified container first
    if (container) {
      for (const sel of DISMISS_SELECTORS) {
        const btn = container.querySelector<HTMLButtonElement>(sel);
        if (btn && this.isElementVisible(btn) && this.isElementEnabled(btn)) {
          return btn;
        }
      }
      const buttons = container.querySelectorAll<HTMLButtonElement>('button');
      for (const btn of buttons) {
        if (this.isDismissButtonCandidate(btn)) {
          return btn;
        }
      }
    }

    // 2. Direct selector search in active dialogs/modals/toasts
    for (const sel of DISMISS_SELECTORS) {
      const candidates = document.querySelectorAll<HTMLButtonElement>(sel);
      for (const btn of candidates) {
        if (this.isElementVisible(btn) && this.isElementEnabled(btn)) {
          return btn;
        }
      }
    }

    // 3. Scan all visible buttons across modals / dialogs / toasts
    const dialogs = document.querySelectorAll('[role="dialog"], .modal-content, .toast, .notification, [class*="modal"], [class*="popup"]');
    for (const dialog of dialogs) {
      if (this.isElementVisible(dialog)) {
        const buttons = dialog.querySelectorAll<HTMLButtonElement>('button');
        for (const btn of buttons) {
          if (this.isDismissButtonCandidate(btn)) {
            return btn;
          }
        }
      }
    }

    return null;
  }

  static isDismissButtonCandidate(button: HTMLButtonElement): boolean {
    if (!this.isElementVisible(button) || !this.isElementEnabled(button)) {
      return false;
    }
    if (button.getAttribute('type') === 'submit') {
      return false;
    }
    const text = (button.textContent || '').trim().toLowerCase();
    const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
    const testId = (button.getAttribute('data-testid') || '').toLowerCase();

    return DISMISS_KEYWORDS.some((kw) => text === kw || text.includes(kw) || ariaLabel.includes(kw) || testId.includes(kw));
  }

  static dismissActiveDialog(container?: Element | null): boolean {
    const btn = this.findDismissButton(container);
    if (btn) {
      try {
        btn.click();
        logger.info('Dismissed modal/toast dialog.');
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Classifies text into a ClaimStatus based on regex patterns.
   */
  static classifyTextResult(text: string): { status: ClaimStatus; message?: string } {
    if (!text) return { status: 'UNKNOWN' };
    for (const p of RESULT_PATTERNS.SUCCESS) if (p.test(text)) return { status: 'CLAIM_SUCCESS', message: text };
    for (const p of RESULT_PATTERNS.ALREADY_CLAIMED) if (p.test(text)) return { status: 'ALREADY_CLAIMED', message: text };
    for (const p of RESULT_PATTERNS.EXPIRED) if (p.test(text)) return { status: 'EXPIRED', message: text };
    for (const p of RESULT_PATTERNS.CLAIM_LIMIT_REACHED) if (p.test(text)) return { status: 'CLAIM_LIMIT_REACHED', message: text };
    for (const p of RESULT_PATTERNS.INVALID_CODE) if (p.test(text)) return { status: 'INVALID_CODE', message: text };
    for (const p of RESULT_PATTERNS.REQUIREMENT_NOT_MET) if (p.test(text)) return { status: 'REQUIREMENT_NOT_MET', message: text };
    for (const p of RESULT_PATTERNS.LOGIN_REQUIRED) if (p.test(text)) return { status: 'LOGIN_REQUIRED', message: text };
    for (const p of RESULT_PATTERNS.RATE_LIMITED) if (p.test(text)) return { status: 'RATE_LIMITED', message: text };
    return { status: 'UNKNOWN' };
  }
}

class StakeAutomator {
  private isClaiming: boolean = false;
  private challengeObserver: MutationObserver | null = null;
  private isDestroyed: boolean = false;

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

    if (this.challengeObserver) {
      try {
        this.challengeObserver.disconnect();
      } catch { /* ignore */ }
      this.challengeObserver = null;
    }

    logger.debug('Stake automator cleanly detached and destroyed.');
  }

  public init(): void {
    if (this.isDestroyed) return;
    if (!this.isContextValid()) {
      this.destroy();
      return;
    }

    logger.info('Stake Automator content script initialized on:', window.location.href);
    this.listenForMessages();
    this.monitorForChallenges();
  }

  private listenForMessages(): void {
    try {
      if (!this.isContextValid()) return;
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (!this.isContextValid()) {
          this.destroy();
          return false;
        }

        if (!message || !message.type) return false;

        if (message.type === 'STAKE_PING') {
          const hasInput = StakeDetectorInline.findBonusCodeInput() !== null;
          const challenge = StakeDetectorInline.detectSecurityChallenge();
          const pong: StakePongMessage = {
            type: 'STAKE_PONG',
            payload: { ready: true, hasInput, hasChallenge: challenge.hasChallenge, url: window.location.href }
          };
          sendResponse(pong.payload);
          return false;
        }

        if (message.type === 'NAVIGATE_TO_OFFERS') {
          const opened = StakeDetectorInline.openOffersModal();
          sendResponse({ success: opened });
          return false;
        }

        if (message.type === 'DISMISS_DIALOG') {
          const dismissed = StakeDetectorInline.dismissActiveDialog();
          sendResponse({ success: dismissed });
          return false;
        }

        if (message.type === 'EXECUTE_CLAIM') {
          const claimMsg = message as ExecuteClaimMessage;
          this.executeClaim(claimMsg.payload.code)
            .then((result) => sendResponse(result))
            .catch((err) => {
              logger.error('Claim execution error:', err);
              sendResponse({
                code: claimMsg.payload.code.code,
                status: 'UNKNOWN',
                message: err instanceof Error ? err.message : 'Execution error',
                timestamp: Date.now()
              });
            });
          return true; // Keep channel open for async
        }

        return false;
      });
    } catch {
      // Ignored if runtime context is unavailable
    }
  }

  private monitorForChallenges(): void {
    if (this.isDestroyed || !this.isContextValid()) {
      this.destroy();
      return;
    }

    if (this.challengeObserver) {
      try {
        this.challengeObserver.disconnect();
      } catch { /* ignore */ }
    }

    this.challengeObserver = new MutationObserver(() => {
      if (this.isDestroyed) return;
      if (!this.isContextValid()) {
        this.destroy();
        return;
      }

      const challenge = StakeDetectorInline.detectSecurityChallenge();
      if (challenge.hasChallenge && !this.isClaiming) {
        logger.warn('Security challenge observed:', challenge.details);
        const msg: SecurityChallengeDetectedMessage = {
          type: 'SECURITY_CHALLENGE_DETECTED',
          payload: { sourceUrl: window.location.href, details: challenge.details }
        };
        try {
          chrome.runtime.sendMessage(msg, () => {
            const err = chrome.runtime.lastError;
            if (err && /Extension context invalidated/i.test(err.message || '')) {
              this.destroy();
            }
          });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          if (/Extension context invalidated/i.test(errMsg)) {
            this.destroy();
          }
        }
      }
    });

    const target = document.documentElement || document.body;
    if (target) {
      this.challengeObserver.observe(target, { childList: true, subtree: true });
    }
  }

  public async executeClaim(code: BonusCode): Promise<ClaimResult> {
    if (this.isClaiming) {
      return { code: code.code, status: 'UNKNOWN', message: 'Concurrent claim in progress.', timestamp: Date.now() };
    }

    this.isClaiming = true;
    const startTime = Date.now();
    logger.info(`⚡ Fast-Claim triggered for code: "${code.code}"`);

    try {
      // 1. Security check
      const challenge = StakeDetectorInline.detectSecurityChallenge();
      if (challenge.hasChallenge) {
        return { code: code.code, status: 'SECURITY_CHALLENGE', message: challenge.details, timestamp: Date.now(), executionTimeMs: Date.now() - startTime };
      }

      // 2. High-speed input detection
      let input = StakeDetectorInline.findBonusCodeInput();
      if (!input) {
        logger.info('Input not visible. Auto-navigating to Offers tab...');
        StakeDetectorInline.openOffersModal();

        // Rapid polling: check every 50ms up to 20 times (1s max)
        for (let t = 0; t < 20; t++) {
          await this.delay(50);
          input = StakeDetectorInline.findBonusCodeInput();
          if (input) {
            logger.info(`Input ready in ${(t + 1) * 50}ms`);
            break;
          }
        }
      }

      if (!input) {
        logger.warn('Bonus code input not found after rapid polling.');
        return {
          code: code.code,
          status: 'BONUS_INPUT_NOT_FOUND',
          message: 'Input not found. Open Settings > Offers manually on Stake.',
          timestamp: Date.now(),
          executionTimeMs: Date.now() - startTime
        };
      }

      // 3. Lightning code insertion into Svelte 5 / React state
      this.enterBonusCode(input, code.code);
      await this.delay(TIMING.BUTTON_CLICK_DELAY_MS);

      // 4. Find & Click Submit button with minimal latency
      let claimButton = StakeDetectorInline.findClaimButton(input);
      if (!claimButton) {
        for (let b = 0; b < 6; b++) {
          await this.delay(30);
          claimButton = StakeDetectorInline.findClaimButton(input);
          if (claimButton) break;
        }
      }

      if (!claimButton) {
        return {
          code: code.code,
          status: 'CLAIM_BUTTON_NOT_FOUND',
          message: 'Submit button not found near the code input.',
          timestamp: Date.now(),
          executionTimeMs: Date.now() - startTime
        };
      }

      // 5. Mid-check security
      const mid = StakeDetectorInline.detectSecurityChallenge();
      if (mid.hasChallenge) {
        return { code: code.code, status: 'SECURITY_CHALLENGE', message: mid.details, timestamp: Date.now(), executionTimeMs: Date.now() - startTime };
      }

      // 6. Click Submit and observe result with high-frequency MutationObserver
      logger.info('⚡ Clicking Submit button...');
      claimButton.click();

      const outcome = await this.observeClaimOutcome(code.code, TIMING.RESULT_OBSERVE_TIMEOUT_MS);

      // 7. Auto-dismiss popup/modal after claim outcome
      setTimeout(() => {
        StakeDetectorInline.dismissActiveDialog();
      }, TIMING.AUTO_DISMISS_DELAY_MS);

      return {
        code: code.code,
        status: outcome.status,
        message: outcome.message,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        amount: code.amount,
        amountValue: code.amountValue
      };
    } finally {
      this.isClaiming = false;
    }
  }

  /**
   * Sets value in input using high-speed Svelte 5 & React compatible techniques.
   */
  private enterBonusCode(input: HTMLInputElement, value: string): boolean {
    try {
      input.focus();
      input.select();

      // Reset React _valueTracker if present
      const tracker = (input as unknown as { _valueTracker?: { setValue: (v: string) => void } })._valueTracker;
      if (tracker) tracker.setValue('');

      // Native prototype setter override for Svelte 5 / React reactivity
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (nativeSetter) {
        nativeSetter.call(input, value);
      } else {
        input.value = value;
      }

      // Synchronous event dispatch
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: value, inputType: 'insertText' }));
      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', code: 'Enter' }));
      input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter', code: 'Enter' }));

      logger.info(`⚡ Set code "${value}" into input (${input.value === value ? 'OK' : 'fallback'})`);
      return input.value === value;
    } catch (err) {
      logger.error('Error entering bonus code:', err);
      return false;
    }
  }

  /**
   * Observes DOM mutations with high frequency after clicking Submit.
   */
  private observeClaimOutcome(code: string, timeoutMs: number): Promise<{ status: ClaimStatus; message?: string }> {
    return new Promise((resolve) => {
      let resolved = false;

      const finish = (status: ClaimStatus, message?: string) => {
        if (resolved) return;
        resolved = true;
        observer.disconnect();
        clearTimeout(timer);
        clearInterval(poller);
        logger.info(`Outcome for ${code}: ${status} — "${message || 'no message'}"`);

        // Automatically trigger dismiss after observing outcome
        setTimeout(() => {
          StakeDetectorInline.dismissActiveDialog();
        }, TIMING.AUTO_DISMISS_DELAY_MS);

        resolve({ status, message });
      };

      const scanElement = (el: Element): boolean => {
        const text = (el.textContent || '').trim();
        if (!text || text.length < 3 || text.length > 2000) return false;
        const result = StakeDetectorInline.classifyTextResult(text);
        if (result.status !== 'UNKNOWN') {
          finish(result.status, text);
          return true;
        }
        return false;
      };

      // Real-time MutationObserver catches new toasts/popups immediately
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (!(node instanceof Element)) continue;
            if (scanElement(node)) return;
            const children = node.querySelectorAll('*');
            for (const child of children) {
              if (scanElement(child)) return;
            }
          }

          if (mutation.type === 'attributes' && mutation.target instanceof Element) {
            if (StakeDetectorInline.isElementVisible(mutation.target)) {
              if (scanElement(mutation.target)) return;
            }
          }
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden', 'aria-hidden']
      });

      // Rapid 30ms poller for transient elements
      const poller = setInterval(() => {
        if (resolved) return;

        const challenge = StakeDetectorInline.detectSecurityChallenge();
        if (challenge.hasChallenge) {
          finish('SECURITY_CHALLENGE', challenge.details);
          return;
        }

        const candidates = document.querySelectorAll(
          '[role="alert"], [role="status"], .toast, .notification, .alert, .message, ' +
          '[data-testid*="toast"], [data-testid*="notification"], [data-testid*="alert"], ' +
          '.snackbar, [class*="toast"], [class*="notification"], [class*="snack"], ' +
          '[class*="popup"], [class*="modal-body"], [class*="dialog-body"], ' +
          '[class*="success"], [class*="error"], [class*="warning"]'
        );

        for (const el of candidates) {
          if (StakeDetectorInline.isElementVisible(el) && scanElement(el)) return;
        }
      }, TIMING.POLL_INTERVAL_MS);

      const timer = setTimeout(() => {
        if (!resolved) {
          const bodyText = (document.body.innerText || '').substring(0, 8000);
          const lastChance = StakeDetectorInline.classifyTextResult(bodyText);
          if (lastChance.status !== 'UNKNOWN') {
            finish(lastChance.status, lastChance.message);
          } else {
            finish('UNKNOWN', 'Submit clicked but no result toast detected within timeout.');
          }
        }
      }, timeoutMs);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Instantiate and initialize
const automator = new StakeAutomator();
automator.init();
