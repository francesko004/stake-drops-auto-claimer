/**
 * Chrome notification and badge management.
 */

import { Logger } from '../shared/logger.js';
import { BonusCode, ClaimResult, ExtensionSettings, ExtensionState } from '../shared/types.js';
import { StorageService } from './storage.js';

const logger = new Logger('Notifications');

export class NotificationService {
  /**
   * Updates Chrome extension action badge text and background color according to status.
   */
  public static async updateBadge(state: ExtensionState, queueCount: number = 0): Promise<void> {
    try {
      if (!chrome.action) return;

      switch (state) {
        case 'ACTIVE':
          if (queueCount > 0) {
            await chrome.action.setBadgeText({ text: `${queueCount}` });
            await chrome.action.setBadgeBackgroundColor({ color: '#10B981' }); // Emerald Green
          } else {
            await chrome.action.setBadgeText({ text: 'ON' });
            await chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
          }
          break;
        case 'PAUSED_SECURITY_CHALLENGE':
          await chrome.action.setBadgeText({ text: '!' });
          await chrome.action.setBadgeBackgroundColor({ color: '#EF4444' }); // Red
          break;
        case 'PAUSED_USER':
          await chrome.action.setBadgeText({ text: 'PAUS' });
          await chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' }); // Amber
          break;
        case 'OFF':
        default:
          await chrome.action.setBadgeText({ text: '' });
          break;
      }
    } catch (err) {
      logger.debug('Failed to update extension badge:', err);
    }
  }

  /**
   * Shows a notification when a new code is detected and claim is being attempted.
   */
  public static async notifyNewCode(code: BonusCode, settings?: ExtensionSettings): Promise<void> {
    const currentSettings = settings || (await StorageService.getSettings());
    if (!currentSettings.notifications) return;

    const amountStr = code.amount ? ` • ${code.amount}` : '';
    const reqStr = code.requirement ? `\nReq: ${code.requirement}` : '';

    try {
      const notifId = `claim-attempt-${code.normalizedCode}-${Date.now()}`;
      await chrome.notifications.create(notifId, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: `⚡ New Stake Code${amountStr}`,
        message: `Attempting claim for code: ${code.code}${reqStr}`,
        priority: 1
      });
    } catch (err) {
      logger.error('Failed to create attempt notification:', err);
    }
  }

  /**
   * Shows a notification when a claim result is determined.
   */
  public static async notifyClaimResult(
    result: ClaimResult,
    code: BonusCode,
    settings?: ExtensionSettings
  ): Promise<void> {
    const currentSettings = settings || (await StorageService.getSettings());
    if (!currentSettings.notifications) return;

    try {
      const notifId = `claim-result-${result.code}-${Date.now()}`;
      let title = '';
      let message = '';

      switch (result.status) {
        case 'CLAIM_SUCCESS':
          title = '✓ Stake Code Claimed!';
          message = `Successfully claimed ${code.code}${code.amount ? ` (${code.amount})` : ''}!`;
          break;
        case 'ALREADY_CLAIMED':
          title = 'ℹ Already Claimed';
          message = `Code ${code.code} was already claimed on your account.`;
          break;
        case 'EXPIRED':
          title = '✕ Code Expired';
          message = `Bonus code ${code.code} has already expired.`;
          break;
        case 'CLAIM_LIMIT_REACHED':
          title = '✕ Limit Reached';
          message = `All drops for ${code.code} have been claimed.`;
          break;
        case 'REQUIREMENT_NOT_MET':
          title = '⚠ Requirement Not Met';
          message = `Wager requirements for ${code.code} not satisfied.`;
          break;
        case 'SECURITY_CHALLENGE':
          title = '⚠ Human Verification Required';
          message = 'Stake security verification detected. Automation paused.';
          break;
        default:
          title = '✕ Claim Failed';
          message = `Claim failed for ${code.code}: ${result.message || result.status}`;
          break;
      }

      await chrome.notifications.create(notifId, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title,
        message,
        priority: result.status === 'CLAIM_SUCCESS' ? 2 : 1
      });
    } catch (err) {
      logger.error('Failed to create result notification:', err);
    }
  }

  /**
   * Shows a high-priority notification when human verification is required.
   */
  public static async notifySecurityChallenge(): Promise<void> {
    try {
      await chrome.notifications.create(`challenge-${Date.now()}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: '⚠ Stake Human Verification Required',
        message: 'Security verification or CAPTCHA detected on Stake. Auto-Claim has paused.',
        priority: 2
      });
    } catch (err) {
      logger.error('Failed to create security challenge notification:', err);
    }
  }
}
