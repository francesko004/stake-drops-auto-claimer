/**
 * Background Service Worker entry point for Stake Auto-Claim.
 */

import { Logger } from '../shared/logger.js';
import { ExtensionMessage } from '../shared/messages.js';
import { Coordinator } from './coordinator.js';
import { StorageService } from './storage.js';

const logger = new Logger('ServiceWorker');
const coordinator = Coordinator.getInstance();

// Keep-Alive Alarm Configuration (prevents MV3 service worker premature suspension during active sessions)
const ALARM_KEEP_ALIVE = 'stake_ac_keep_alive';

function setupKeepAliveAlarm(): void {
  chrome.alarms.get(ALARM_KEEP_ALIVE, (existing) => {
    if (!existing) {
      chrome.alarms.create(ALARM_KEEP_ALIVE, { periodInMinutes: 0.4 }); // Every 24 seconds
      logger.debug('Keep-alive alarm scheduled');
    }
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_KEEP_ALIVE) {
    logger.debug('Keep-alive heartbeat tick.');
    coordinator.scanStakeTabs();
  }
});

// Initialize coordinator on install/startup
chrome.runtime.onInstalled.addListener(async (details) => {
  logger.info(`Extension installed/updated. Reason: ${details.reason}`);
  const settings = await StorageService.getSettings();
  Logger.setDebug(settings.debugLogging);
  setupKeepAliveAlarm();
  await coordinator.init();
});

chrome.runtime.onStartup.addListener(async () => {
  logger.info('Browser started. Initializing coordinator...');
  setupKeepAliveAlarm();
  await coordinator.init();
});

// Tab listeners to refresh connection status dynamically
chrome.tabs.onActivated.addListener(async () => {
  await coordinator.scanStakeTabs();
});

chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    await coordinator.scanStakeTabs();
  }
});

chrome.tabs.onRemoved.addListener(async () => {
  await coordinator.scanStakeTabs();
});

// Central message listener
chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => {
    // Process async messages
    (async () => {
      try {
        switch (message.type) {
          case 'GET_STATE': {
            const state = await coordinator.getState();
            sendResponse(state);
            break;
          }

          case 'SET_EXTENSION_STATE': {
            await coordinator.setExtensionState(message.payload.state);
            const state = await coordinator.getState();
            sendResponse(state);
            break;
          }

          case 'RESUME_SECURITY_CHALLENGE': {
            await coordinator.resumeFromSecurityChallenge();
            const state = await coordinator.getState();
            sendResponse(state);
            break;
          }

          case 'NEW_CODE': {
            await coordinator.handleNewCode(message.payload.code);
            sendResponse({ success: true });
            break;
          }

          case 'MANUAL_CLAIM': {
            await coordinator.handleManualClaim(message.payload.code);
            const state = await coordinator.getState();
            sendResponse(state);
            break;
          }

          case 'NAVIGATE_TO_OFFERS': {
            const success = await coordinator.navigateToOffersTab();
            sendResponse({ success });
            break;
          }

          case 'DISMISS_DIALOG': {
            const success = await coordinator.dismissStakeDialogs();
            sendResponse({ success });
            break;
          }

          case 'SECURITY_CHALLENGE_DETECTED': {
            await coordinator.reportSecurityChallenge(
              message.payload.sourceUrl,
              message.payload.details
            );
            sendResponse({ success: true });
            break;
          }

          case 'CLEAR_HISTORY': {
            await StorageService.clearHistory();
            const state = await coordinator.getState();
            sendResponse(state);
            break;
          }

          case 'GET_SETTINGS': {
            const settings = await StorageService.getSettings();
            sendResponse(settings);
            break;
          }

          case 'UPDATE_SETTINGS': {
            const updated = await StorageService.saveSettings(message.payload);
            sendResponse(updated);
            break;
          }

          default:
            logger.debug('Unhandled background message:', message);
            sendResponse({ status: 'unhandled' });
            break;
        }
      } catch (err) {
        logger.error('Error handling message in service worker:', err);
        sendResponse({ error: err instanceof Error ? err.message : 'Internal error' });
      }
    })();

    // Return true to indicate asynchronous response
    return true;
  }
);

// Initial bootstrap
setupKeepAliveAlarm();
coordinator.init().catch((err) => {
  logger.error('Failed to initialize coordinator:', err);
});
