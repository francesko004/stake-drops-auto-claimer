/**
 * Central automation coordinator and state machine for Stake Auto-Claim.
 */

import { TIMING } from '../shared/constants.js';
import { Logger } from '../shared/logger.js';
import {
  ExecuteClaimMessage,
  NavigateToOffersMessage,
  StakePingMessage,
  StakePongMessage,
  StakecruncherPingMessage,
  StakecruncherPongMessage
} from '../shared/messages.js';
import {
  isCodeAllowedByFilters,
  normalizeCode,
  parseAmountValue,
  parseWagerRequirementValue
} from '../shared/parser.js';
import {
  BonusCode,
  ClaimResult,
  CoordinatorState,
  ExtensionState,
  LatestCodeInfo,
  TabConnectionInfo
} from '../shared/types.js';
import { NotificationService } from './notifications.js';
import { StorageService } from './storage.js';

const logger = new Logger('Coordinator');

export class Coordinator {
  private static instance: Coordinator;

  private extensionState: ExtensionState = 'OFF';
  private claimQueue: BonusCode[] = [];
  private isProcessing: boolean = false;
  private latestCodeInfo: LatestCodeInfo | null = null;
  private connectionInfo: TabConnectionInfo = {
    stakeTabId: null,
    stakeTabUrl: null,
    stakeStatus: 'NOT_FOUND',
    stakecruncherTabId: null,
    stakecruncherStatus: 'NOT_FOUND',
    lastPingTimestamp: 0
  };

  private constructor() {}

  public static getInstance(): Coordinator {
    if (!Coordinator.instance) {
      Coordinator.instance = new Coordinator();
    }
    return Coordinator.instance;
  }

  /**
   * Initializes the coordinator, restores state from storage and starts tab monitors.
   */
  public async init(): Promise<void> {
    this.extensionState = await StorageService.getExtensionState();
    this.latestCodeInfo = await StorageService.getLatestCode();

    await NotificationService.updateBadge(this.extensionState, this.claimQueue.length);
    await this.scanStakeTabs();
    logger.info(`Coordinator initialized. State: ${this.extensionState}`);
  }

  /**
   * Returns current coordinator state snapshot for popup/options.
   */
  public async getState(): Promise<CoordinatorState> {
    await this.scanStakeTabs();
    const stats = await StorageService.getStats();

    return {
      extensionState: this.extensionState,
      connection: { ...this.connectionInfo },
      latestCode: this.latestCodeInfo,
      stats,
      queueLength: this.claimQueue.length,
      isProcessing: this.isProcessing
    };
  }

  /**
   * Sets new extension state (ACTIVE, OFF, PAUSED_USER).
   */
  public async setExtensionState(newState: ExtensionState): Promise<void> {
    const previousState = this.extensionState;
    this.extensionState = newState;
    await StorageService.setExtensionState(newState);
    await NotificationService.updateBadge(this.extensionState, this.claimQueue.length);

    await StorageService.addActivityLog({
      level: newState === 'ACTIVE' ? 'success' : 'info',
      message: `State changed from ${previousState} to ${newState}`
    });

    logger.info(`Extension state changed to: ${newState}`);

    if (newState === 'ACTIVE' && this.claimQueue.length > 0 && !this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Resumes automation after human verification / security challenge pause.
   */
  public async resumeFromSecurityChallenge(): Promise<void> {
    if (this.extensionState === 'PAUSED_SECURITY_CHALLENGE') {
      logger.info('Resuming from security challenge pause...');
      await this.setExtensionState('ACTIVE');
    }
  }

  /**
   * Handles newly detected bonus codes from StakeCruncher monitor.
   */
  public async handleNewCode(code: BonusCode): Promise<void> {
    logger.info(`New bonus code detected: ${code.code} (${code.normalizedCode})`);

    const seenCodes = await StorageService.getSeenCodes();
    const claimedCodes = await StorageService.getClaimedCodes();

    if (claimedCodes.includes(code.normalizedCode)) {
      logger.info(`Code ${code.code} already successfully claimed in history. Skipping.`);
      return;
    }

    const isDuplicate = seenCodes.includes(code.normalizedCode);
    if (isDuplicate) {
      logger.info(`Code ${code.code} already seen in history. Skipping.`);
      return;
    }

    // Record as seen
    await StorageService.addSeenCode(code.normalizedCode);
    await StorageService.incrementDetectedCount();

    const amountStr = code.amount ? ` [${code.amount}]` : '';
    await StorageService.addActivityLog({
      level: 'info',
      code: code.code,
      message: `New code detected: ${code.code}${amountStr}`,
      details: code.requirement ? `Requirement: ${code.requirement}` : undefined
    });

    // Update latest code state
    this.latestCodeInfo = {
      code,
      processingState: this.extensionState === 'ACTIVE' ? 'QUEUED' : 'IDLE'
    };
    await StorageService.setLatestCode(this.latestCodeInfo);

    // Smart Threshold Filter Check
    const settings = await StorageService.getSettings();
    const filterResult = isCodeAllowedByFilters(code, settings);
    if (!filterResult.allowed) {
      logger.info(`Code ${code.code} filtered out: ${filterResult.reason}`);
      await StorageService.addActivityLog({
        level: 'warning',
        code: code.code,
        message: `Filter skipped code: ${filterResult.reason}`
      });
      return;
    }

    // If extension is not ACTIVE, do not enqueue for claim
    if (this.extensionState !== 'ACTIVE') {
      logger.info(`Extension is ${this.extensionState}. Code recorded but not queued.`);
      return;
    }

    if (!settings.autoClaim) {
      logger.info('Auto-claim disabled in settings. Skipping execution.');
      return;
    }

    // Queue for sequential processing
    this.claimQueue.push(code);
    await NotificationService.updateBadge(this.extensionState, this.claimQueue.length);
    await NotificationService.notifyNewCode(code, settings);

    this.processQueue();
  }

  /**
   * Handles user-triggered manual claim entry from popup.
   */
  public async handleManualClaim(rawCode: string): Promise<void> {
    const clean = rawCode.trim();
    if (!clean) return;

    const codeObj: BonusCode = {
      code: clean,
      normalizedCode: normalizeCode(clean),
      detectedAt: Date.now(),
      amountValue: parseAmountValue(clean),
      wagerValue: parseWagerRequirementValue(clean)
    };

    logger.info(`Manual claim requested for: ${codeObj.code}`);
    await StorageService.addActivityLog({
      level: 'info',
      code: codeObj.code,
      message: `Manual claim initiated: ${codeObj.code}`
    });

    this.latestCodeInfo = {
      code: codeObj,
      processingState: 'QUEUED'
    };
    await StorageService.setLatestCode(this.latestCodeInfo);

    // Put at front of queue for immediate execution
    this.claimQueue.unshift(codeObj);
    await NotificationService.updateBadge(this.extensionState, this.claimQueue.length);
    this.processQueue();
  }

  /**
   * Requests the Stake tab to navigate to /settings/offers or open redemption dialog.
   */
  public async navigateToOffersTab(): Promise<boolean> {
    await this.scanStakeTabs();
    const tabId = this.connectionInfo.stakeTabId;
    if (!tabId) {
      logger.warn('Cannot navigate to offers: No active Stake tab found.');
      return false;
    }

    const msg: NavigateToOffersMessage = { type: 'NAVIGATE_TO_OFFERS' };
    const response = await this.sendTabMessageWithTimeout<{ success: boolean }>(tabId, msg, 3000);
    return Boolean(response && response.success);
  }

  /**
   * Scans browser tabs to find open Stake tab and StakeCruncher tab.
   * Auto-injects content scripts if tabs are missing injected handlers.
   */
  public async scanStakeTabs(): Promise<void> {
    try {
      const settings = await StorageService.getSettings();
      const domains = settings.customStakeDomains || ['stake.com', 'stake.us', 'stake.bet', 'stake.games'];
      
      const patterns: string[] = [];
      for (const d of domains) {
        patterns.push(`*://${d}/*`);
        patterns.push(`*://*.${d}/*`);
      }

      const cruncherPatterns = [
        '*://stakecruncher.com/*',
        '*://*.stakecruncher.com/*'
      ];

      const stakeTabs = await chrome.tabs.query({ url: patterns });
      const cruncherTabs = await chrome.tabs.query({ url: cruncherPatterns });

      if (stakeTabs.length > 0) {
        const activeTab = stakeTabs.find((t) => t.active) || stakeTabs[0];
        this.connectionInfo.stakeTabId = activeTab.id || null;
        this.connectionInfo.stakeTabUrl = activeTab.url || null;
        this.connectionInfo.stakeStatus = 'CONNECTED';

        // Check if content script is responding, otherwise auto-inject
        if (activeTab.id) {
          const ready = await this.verifyStakeTabReady(activeTab.id);
          if (!ready) {
            await this.ensureScriptInjected(activeTab.id, 'content/stake-automator.js');
          }
        }
      } else {
        this.connectionInfo.stakeTabId = null;
        this.connectionInfo.stakeTabUrl = null;
        this.connectionInfo.stakeStatus = 'NOT_FOUND';
      }

      if (cruncherTabs.length > 0) {
        const cruncherTab = cruncherTabs.find((t) => t.active) || cruncherTabs[0];
        this.connectionInfo.stakecruncherTabId = cruncherTab.id || null;
        this.connectionInfo.stakecruncherStatus = 'MONITORING';

        // Verify StakeCruncher script responding, otherwise auto-inject
        if (cruncherTab.id) {
          const cruncherReady = await this.verifyCruncherTabReady(cruncherTab.id);
          if (!cruncherReady) {
            await this.ensureScriptInjected(cruncherTab.id, 'content/stakecruncher-monitor.js');
          }
        }
      } else {
        this.connectionInfo.stakecruncherTabId = null;
        this.connectionInfo.stakecruncherStatus = 'NOT_FOUND';
      }

      this.connectionInfo.lastPingTimestamp = Date.now();
    } catch (err) {
      logger.debug('Error scanning tabs:', err);
    }
  }

  /**
   * Programmatically injects a content script into an active tab if not already present.
   */
  private async ensureScriptInjected(tabId: number, scriptPath: string): Promise<void> {
    try {
      if (chrome.scripting && chrome.scripting.executeScript) {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: [scriptPath]
        });
        logger.info(`Auto-injected ${scriptPath} into Tab #${tabId}`);
      }
    } catch (err) {
      logger.debug(`Could not auto-inject ${scriptPath} into Tab #${tabId}:`, err);
    }
  }

  /**
   * Processes the next claim in the sequential claim queue.
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      logger.debug('Claim processing already in progress. Waiting for completion.');
      return;
    }

    if (this.claimQueue.length === 0) {
      logger.debug('Claim queue is empty.');
      await NotificationService.updateBadge(this.extensionState, 0);
      return;
    }

    this.isProcessing = true;
    const currentCode = this.claimQueue.shift()!;
    await NotificationService.updateBadge(this.extensionState, this.claimQueue.length);

    try {
      this.latestCodeInfo = {
        code: currentCode,
        processingState: 'PROCESSING'
      };
      await StorageService.setLatestCode(this.latestCodeInfo);

      await StorageService.addActivityLog({
        level: 'info',
        code: currentCode.code,
        message: `Sending code to Stake: ${currentCode.code}`
      });

      // Find Stake tab
      await this.scanStakeTabs();
      const stakeTabId = this.connectionInfo.stakeTabId;

      if (!stakeTabId) {
        const msg = 'Stake tab not found. Please open Stake.com to claim.';
        logger.warn(msg);
        await StorageService.addActivityLog({
          level: 'warning',
          code: currentCode.code,
          message: 'Stake.com tab not found. Claim deferred.'
        });

        const failedResult: ClaimResult = {
          code: currentCode.code,
          status: 'UNKNOWN',
          message: msg,
          timestamp: Date.now()
        };
        await this.handleClaimResult(failedResult, currentCode);
        return;
      }

      // Check if Stake content script is ready
      const isReady = await this.verifyStakeTabReady(stakeTabId);
      if (!isReady) {
        logger.warn(`Stake tab #${stakeTabId} is not ready or content script is initializing.`);
        await this.ensureScriptInjected(stakeTabId, 'content/stake-automator.js');
      }

      // Send execute claim command to content script
      const claimMsg: ExecuteClaimMessage = {
        type: 'EXECUTE_CLAIM',
        payload: { code: currentCode }
      };

      const startTime = Date.now();
      const response = await this.sendTabMessageWithTimeout<ClaimResult>(
        stakeTabId,
        claimMsg,
        TIMING.RESULT_OBSERVE_TIMEOUT_MS + 4000
      );

      const executionTimeMs = Date.now() - startTime;
      const result: ClaimResult = response || {
        code: currentCode.code,
        status: 'TIMEOUT',
        message: 'No response from Stake tab within timeout.',
        timestamp: Date.now(),
        executionTimeMs
      };

      // Populate parsed amount value if missing
      if (!result.amountValue && currentCode.amountValue) {
        result.amountValue = currentCode.amountValue;
      }

      await this.handleClaimResult(result, currentCode);
    } catch (err: unknown) {
      logger.error('Unexpected error processing claim:', err);
      const errResult: ClaimResult = {
        code: currentCode.code,
        status: 'UNKNOWN',
        message: err instanceof Error ? err.message : 'Unknown execution error',
        timestamp: Date.now()
      };
      await this.handleClaimResult(errResult, currentCode);
    } finally {
      this.isProcessing = false;
      if (this.claimQueue.length > 0) {
        setTimeout(() => this.processQueue(), 30);
      }
    }
  }

  /**
   * Sends a dismiss command to the Stake tab to close any active modal or dialog.
   */
  public async dismissStakeDialogs(): Promise<boolean> {
    await this.scanStakeTabs();
    const tabId = this.connectionInfo.stakeTabId;
    if (!tabId) return false;

    const msg = { type: 'DISMISS_DIALOG' };
    const response = await this.sendTabMessageWithTimeout<{ success: boolean }>(tabId, msg, 1500);
    return Boolean(response && response.success);
  }

  /**
   * Verifies whether the Stake tab responds to ping.
   */
  private async verifyStakeTabReady(tabId: number): Promise<boolean> {
    try {
      const pingMsg: StakePingMessage = { type: 'STAKE_PING' };
      const response = await this.sendTabMessageWithTimeout<StakePongMessage['payload']>(
        tabId,
        pingMsg,
        1500
      );
      return Boolean(response && response.ready);
    } catch {
      return false;
    }
  }

  /**
   * Verifies whether the StakeCruncher tab responds to ping.
   */
  private async verifyCruncherTabReady(tabId: number): Promise<boolean> {
    try {
      const pingMsg: StakecruncherPingMessage = { type: 'STAKECRUNCHER_PING' };
      const response = await this.sendTabMessageWithTimeout<StakecruncherPongMessage['payload']>(
        tabId,
        pingMsg,
        1500
      );
      return Boolean(response && response.monitoring);
    } catch {
      return false;
    }
  }

  /**
   * Dispatches message to a tab with timeout.
   */
  private sendTabMessageWithTimeout<T>(
    tabId: number,
    message: unknown,
    timeoutMs: number
  ): Promise<T | null> {
    return new Promise((resolve) => {
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      }, timeoutMs);

      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          if (chrome.runtime.lastError) {
            logger.debug(`Tab message error (#${tabId}):`, chrome.runtime.lastError.message);
            resolve(null);
          } else {
            resolve(response as T);
          }
        }
      });
    });
  }

  /**
   * Handles the completed claim result, updates stats, records storage and alerts user.
   */
  public async handleClaimResult(result: ClaimResult, code: BonusCode): Promise<void> {
    logger.info(`Claim result for ${result.code}: ${result.status} (${result.message || 'No msg'})`);

    const settings = await StorageService.getSettings();
    await StorageService.recordClaimResult(result);

    if (result.status === 'SECURITY_CHALLENGE') {
      await this.setExtensionState('PAUSED_SECURITY_CHALLENGE');
      await StorageService.addActivityLog({
        level: 'error',
        code: code.code,
        message: '⚠ Human verification required — automation paused.',
        details: 'Complete verification on Stake.com, then click Resume.'
      });
      await NotificationService.notifySecurityChallenge();

      this.latestCodeInfo = {
        code,
        result,
        processingState: 'FAILED'
      };
      await StorageService.setLatestCode(this.latestCodeInfo);
      return;
    }

    if (result.status === 'CLAIM_SUCCESS') {
      await StorageService.addClaimedCode(code.normalizedCode);
      const earnedText = code.amount ? ` • Earned ${code.amount}` : '';
      await StorageService.addActivityLog({
        level: 'success',
        code: code.code,
        message: `✓ Bonus claimed successfully: ${code.code}${earnedText}`
      });

      this.latestCodeInfo = {
        code,
        result,
        processingState: 'CLAIMED'
      };
    } else {
      await StorageService.addFailedCode(code.normalizedCode);
      await StorageService.addActivityLog({
        level: 'warning',
        code: code.code,
        message: `✕ Claim outcome for ${code.code}: ${result.status}`,
        details: result.message
      });

      this.latestCodeInfo = {
        code,
        result,
        processingState: 'FAILED'
      };
    }

    await StorageService.setLatestCode(this.latestCodeInfo);
    await NotificationService.notifyClaimResult(result, code, settings);
  }

  /**
   * Reports a security challenge detected directly from a content script.
   */
  public async reportSecurityChallenge(sourceUrl: string, details?: string): Promise<void> {
    logger.warn(`Security challenge detected on ${sourceUrl}: ${details || 'Challenge active'}`);
    await this.setExtensionState('PAUSED_SECURITY_CHALLENGE');
    await StorageService.addActivityLog({
      level: 'error',
      message: '⚠ Human verification / CAPTCHA detected on page. Automation paused.',
      details
    });
    await NotificationService.notifySecurityChallenge();
  }
}
