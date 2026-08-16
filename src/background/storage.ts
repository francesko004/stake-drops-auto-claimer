/**
 * Type-safe storage service for Chrome extension local storage.
 */

import { DEFAULT_SETTINGS, INITIAL_STATS, STORAGE_KEYS } from '../shared/constants.js';
import { Logger } from '../shared/logger.js';
import {
  ActivityLogItem,
  ClaimResult,
  ExtensionSettings,
  ExtensionState,
  ExtensionStats,
  LatestCodeInfo
} from '../shared/types.js';

const logger = new Logger('Storage');

export class StorageService {
  /**
   * Retrieves user settings with fallback to defaults.
   */
  public static async getSettings(): Promise<ExtensionSettings> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
      const settings = { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.SETTINGS] || {}) };
      Logger.setDebug(settings.debugLogging);
      return settings;
    } catch (err) {
      logger.error('Failed to get settings from storage:', err);
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * Updates partial user settings.
   */
  public static async saveSettings(
    newSettings: Partial<ExtensionSettings>
  ): Promise<ExtensionSettings> {
    const current = await this.getSettings();
    const updated: ExtensionSettings = { ...current, ...newSettings };
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated });
    Logger.setDebug(updated.debugLogging);
    return updated;
  }

  /**
   * Gets current extension active/pause state.
   */
  public static async getExtensionState(): Promise<ExtensionState> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.EXTENSION_STATE);
      return (result[STORAGE_KEYS.EXTENSION_STATE] as ExtensionState) || 'OFF';
    } catch (err) {
      logger.error('Failed to get extension state:', err);
      return 'OFF';
    }
  }

  /**
   * Sets current extension active/pause state.
   */
  public static async setExtensionState(state: ExtensionState): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.EXTENSION_STATE]: state });
  }

  /**
   * Gets list of seen normalized codes.
   */
  public static async getSeenCodes(): Promise<string[]> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.SEEN_CODES);
      return result[STORAGE_KEYS.SEEN_CODES] || [];
    } catch (err) {
      logger.error('Failed to get seen codes:', err);
      return [];
    }
  }

  /**
   * Adds normalized code to seen list, respecting max history capacity.
   */
  public static async addSeenCode(normalizedCode: string): Promise<void> {
    const seen = await this.getSeenCodes();
    if (!seen.includes(normalizedCode)) {
      const settings = await this.getSettings();
      seen.push(normalizedCode);
      const trimmed = seen.slice(-settings.historySize);
      await chrome.storage.local.set({ [STORAGE_KEYS.SEEN_CODES]: trimmed });
    }
  }

  /**
   * Bulk adds seen codes (e.g. for baseline initialization).
   */
  public static async addSeenCodes(normalizedCodes: string[]): Promise<void> {
    const seen = new Set(await this.getSeenCodes());
    for (const code of normalizedCodes) {
      seen.add(code);
    }
    const settings = await this.getSettings();
    const array = Array.from(seen).slice(-settings.historySize);
    await chrome.storage.local.set({ [STORAGE_KEYS.SEEN_CODES]: array });
  }

  /**
   * Gets list of successfully claimed codes.
   */
  public static async getClaimedCodes(): Promise<string[]> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.CLAIMED_CODES);
      return result[STORAGE_KEYS.CLAIMED_CODES] || [];
    } catch (err) {
      logger.error('Failed to get claimed codes:', err);
      return [];
    }
  }

  /**
   * Adds code to claimed list.
   */
  public static async addClaimedCode(normalizedCode: string): Promise<void> {
    const claimed = await this.getClaimedCodes();
    if (!claimed.includes(normalizedCode)) {
      const settings = await this.getSettings();
      claimed.push(normalizedCode);
      const trimmed = claimed.slice(-settings.historySize);
      await chrome.storage.local.set({ [STORAGE_KEYS.CLAIMED_CODES]: trimmed });
    }
  }

  /**
   * Gets list of failed/expired codes.
   */
  public static async getFailedCodes(): Promise<string[]> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.FAILED_CODES);
      return result[STORAGE_KEYS.FAILED_CODES] || [];
    } catch (err) {
      logger.error('Failed to get failed codes:', err);
      return [];
    }
  }

  /**
   * Adds code to failed list.
   */
  public static async addFailedCode(normalizedCode: string): Promise<void> {
    const failed = await this.getFailedCodes();
    if (!failed.includes(normalizedCode)) {
      const settings = await this.getSettings();
      failed.push(normalizedCode);
      const trimmed = failed.slice(-settings.historySize);
      await chrome.storage.local.set({ [STORAGE_KEYS.FAILED_CODES]: trimmed });
    }
  }

  /**
   * Gets the latest detected code information.
   */
  public static async getLatestCode(): Promise<LatestCodeInfo | null> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.LATEST_CODE);
      return result[STORAGE_KEYS.LATEST_CODE] || null;
    } catch (err) {
      logger.error('Failed to get latest code:', err);
      return null;
    }
  }

  /**
   * Sets the latest detected code information.
   */
  public static async setLatestCode(latest: LatestCodeInfo | null): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.LATEST_CODE]: latest });
  }

  /**
   * Gets statistics.
   */
  public static async getStats(): Promise<ExtensionStats> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.STATS);
      return { ...INITIAL_STATS, ...(result[STORAGE_KEYS.STATS] || {}) };
    } catch (err) {
      logger.error('Failed to get stats:', err);
      return INITIAL_STATS;
    }
  }

  /**
   * Increments code detected counter.
   */
  public static async incrementDetectedCount(): Promise<ExtensionStats> {
    const stats = await this.getStats();
    stats.codesDetected += 1;
    await chrome.storage.local.set({ [STORAGE_KEYS.STATS]: stats });
    return stats;
  }

  /**
   * Records claim result and updates statistics accordingly.
   */
  public static async recordClaimResult(result: ClaimResult): Promise<ExtensionStats> {
    const stats = await this.getStats();
    stats.claimsAttempted += 1;

    switch (result.status) {
      case 'CLAIM_SUCCESS':
        stats.successful += 1;
        if (result.amountValue && result.amountValue > 0) {
          stats.totalEarnedUsd = Number(((stats.totalEarnedUsd || 0) + result.amountValue).toFixed(2));
        }
        break;
      case 'ALREADY_CLAIMED':
        stats.alreadyClaimed += 1;
        break;
      case 'EXPIRED':
        stats.expired += 1;
        break;
      case 'CLAIM_LIMIT_REACHED':
      case 'INVALID_CODE':
      case 'REQUIREMENT_NOT_MET':
      case 'SECURITY_CHALLENGE':
      case 'LOGIN_REQUIRED':
      case 'TIMEOUT':
      case 'RATE_LIMITED':
      case 'BONUS_INPUT_NOT_FOUND':
      case 'CLAIM_BUTTON_NOT_FOUND':
      case 'SKIPPED_FILTER':
      case 'UNKNOWN':
      default:
        stats.failed += 1;
        break;
    }

    await chrome.storage.local.set({ [STORAGE_KEYS.STATS]: stats });
    return stats;
  }

  /**
   * Retrieves the activity log items.
   */
  public static async getActivityLog(): Promise<ActivityLogItem[]> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.ACTIVITY_LOG);
      return result[STORAGE_KEYS.ACTIVITY_LOG] || [];
    } catch (err) {
      logger.error('Failed to get activity log:', err);
      return [];
    }
  }

  /**
   * Adds an entry to the live activity feed.
   */
  public static async addActivityLog(
    entry: Omit<ActivityLogItem, 'id' | 'timestamp'>
  ): Promise<void> {
    try {
      const logs = await this.getActivityLog();
      const settings = await this.getSettings();

      const newItem: ActivityLogItem = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: Date.now(),
        ...entry
      };

      // Keep recent logs at the beginning (newest first)
      logs.unshift(newItem);
      const trimmed = logs.slice(0, settings.historySize);
      await chrome.storage.local.set({ [STORAGE_KEYS.ACTIVITY_LOG]: trimmed });
    } catch (err) {
      logger.error('Failed to add activity log:', err);
    }
  }

  /**
   * Clears history, reset stats, and wipe seen codes.
   */
  public static async clearHistory(): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEYS.SEEN_CODES]: [],
      [STORAGE_KEYS.CLAIMED_CODES]: [],
      [STORAGE_KEYS.FAILED_CODES]: [],
      [STORAGE_KEYS.LATEST_CODE]: null,
      [STORAGE_KEYS.STATS]: { ...INITIAL_STATS, lastResetTimestamp: Date.now() },
      [STORAGE_KEYS.ACTIVITY_LOG]: []
    });
    logger.info('History, logs, and statistics cleared');
  }
}
