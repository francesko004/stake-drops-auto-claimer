/**
 * Controller script for Stake Auto-Claim Popup Dashboard.
 */

import { STORAGE_KEYS } from '../shared/constants.js';
import {
  ClearHistoryMessage,
  GetStateMessage,
  ManualClaimMessage,
  NavigateToOffersMessage,
  ResumeSecurityChallengeMessage,
  SetExtensionStateMessage
} from '../shared/messages.js';
import {
  ActivityLogItem,
  CoordinatorState,
  ExtensionState
} from '../shared/types.js';

class PopupController {
  private currentState: CoordinatorState | null = null;
  private refreshTimer: number | null = null;

  // DOM element references
  private statusDot!: HTMLElement;
  private statusText!: HTMLElement;
  private connStakePill!: HTMLElement;
  private connStakeVal!: HTMLElement;
  private connCruncherPill!: HTMLElement;
  private connCruncherVal!: HTMLElement;
  private challengeBanner!: HTMLElement;
  private btnResumeChallenge!: HTMLButtonElement;
  private totalEarningsVal!: HTMLElement;

  private latestCodeText!: HTMLElement;
  private latestTimeAgo!: HTMLElement;
  private latestAmountBadge!: HTMLElement;
  private latestStatusBadge!: HTMLElement;
  private latestReqRow!: HTMLElement;
  private latestReqText!: HTMLElement;
  private btnCopyCode!: HTMLButtonElement;

  private formManualClaim!: HTMLFormElement;
  private inputManualCode!: HTMLInputElement;
  private btnManualSubmit!: HTMLButtonElement;
  private btnOpenOffers!: HTMLButtonElement;
  private btnDismissDialog!: HTMLButtonElement;

  private statDetected!: HTMLElement;
  private statAttempted!: HTMLElement;
  private statSuccessful!: HTMLElement;
  private statExpired!: HTMLElement;
  private statClaimed!: HTMLElement;
  private statFailed!: HTMLElement;

  private activityList!: HTMLElement;

  private btnToggleActive!: HTMLButtonElement;
  private btnToggleText!: HTMLElement;
  private btnPause!: HTMLButtonElement;
  private btnClearHistory!: HTMLButtonElement;
  private btnClearStats!: HTMLButtonElement;
  private btnOptions!: HTMLButtonElement;

  public init(): void {
    this.bindElements();
    this.attachEventListeners();
    this.fetchState();
    this.loadActivityLogs();

    // Refresh state every second while popup is active
    this.refreshTimer = window.setInterval(() => {
      this.fetchState();
    }, 1000);

    window.addEventListener('unload', () => {
      if (this.refreshTimer !== null) {
        clearInterval(this.refreshTimer);
      }
    });

    // Reactively update on storage change
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        if (changes[STORAGE_KEYS.ACTIVITY_LOG]) {
          this.renderActivityLogs(changes[STORAGE_KEYS.ACTIVITY_LOG].newValue || []);
        }
        if (changes[STORAGE_KEYS.STATS] || changes[STORAGE_KEYS.LATEST_CODE] || changes[STORAGE_KEYS.EXTENSION_STATE]) {
          this.fetchState();
        }
      }
    });
  }

  private bindElements(): void {
    this.statusDot = document.getElementById('status-dot')!;
    this.statusText = document.getElementById('status-text')!;
    this.connStakePill = document.getElementById('conn-stake')!;
    this.connStakeVal = document.getElementById('conn-stake-val')!;
    this.connCruncherPill = document.getElementById('conn-cruncher')!;
    this.connCruncherVal = document.getElementById('conn-cruncher-val')!;
    this.challengeBanner = document.getElementById('challenge-banner')!;
    this.btnResumeChallenge = document.getElementById('btn-resume-challenge') as HTMLButtonElement;
    this.totalEarningsVal = document.getElementById('total-earnings-val')!;

    this.latestCodeText = document.getElementById('latest-code-text')!;
    this.latestTimeAgo = document.getElementById('latest-time-ago')!;
    this.latestAmountBadge = document.getElementById('latest-amount-badge')!;
    this.latestStatusBadge = document.getElementById('latest-status-badge')!;
    this.latestReqRow = document.getElementById('latest-req-row')!;
    this.latestReqText = document.getElementById('latest-req-text')!;
    this.btnCopyCode = document.getElementById('btn-copy-code') as HTMLButtonElement;

    this.formManualClaim = document.getElementById('form-manual-claim') as HTMLFormElement;
    this.inputManualCode = document.getElementById('input-manual-code') as HTMLInputElement;
    this.btnManualSubmit = document.getElementById('btn-manual-submit') as HTMLButtonElement;
    this.btnOpenOffers = document.getElementById('btn-open-offers') as HTMLButtonElement;
    this.btnDismissDialog = document.getElementById('btn-dismiss-dialog') as HTMLButtonElement;

    this.statDetected = document.getElementById('stat-detected')!;
    this.statAttempted = document.getElementById('stat-attempted')!;
    this.statSuccessful = document.getElementById('stat-successful')!;
    this.statExpired = document.getElementById('stat-expired')!;
    this.statClaimed = document.getElementById('stat-claimed')!;
    this.statFailed = document.getElementById('stat-failed')!;

    this.activityList = document.getElementById('activity-list')!;

    this.btnToggleActive = document.getElementById('btn-toggle-active') as HTMLButtonElement;
    this.btnToggleText = document.getElementById('btn-toggle-text')!;
    this.btnPause = document.getElementById('btn-pause') as HTMLButtonElement;
    this.btnClearHistory = document.getElementById('btn-clear-history') as HTMLButtonElement;
    this.btnClearStats = document.getElementById('btn-clear-stats') as HTMLButtonElement;
    this.btnOptions = document.getElementById('btn-options') as HTMLButtonElement;
  }

  private attachEventListeners(): void {
    this.btnToggleActive.addEventListener('click', () => this.handleToggleActive());
    this.btnPause.addEventListener('click', () => this.handleTogglePause());
    this.btnResumeChallenge.addEventListener('click', () => this.handleResumeChallenge());
    this.btnClearHistory.addEventListener('click', () => this.handleClearHistory());
    this.btnClearStats.addEventListener('click', () => this.handleClearHistory());

    if (this.btnDismissDialog) {
      this.btnDismissDialog.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'DISMISS_DIALOG' }, (res: { success?: boolean }) => {
          this.btnDismissDialog.style.transform = 'scale(1.2) rotate(90deg)';
          setTimeout(() => {
            this.btnDismissDialog.style.transform = '';
          }, 300);
        });
      });
    }

    this.btnOpenOffers.addEventListener('click', () => {
      const msg: NavigateToOffersMessage = { type: 'NAVIGATE_TO_OFFERS' };
      chrome.runtime.sendMessage(msg, (res: { success?: boolean }) => {
        if (res && res.success) {
          this.btnOpenOffers.style.transform = 'scale(1.2)';
          setTimeout(() => { this.btnOpenOffers.style.transform = ''; }, 300);
        }
      });
    });

    this.formManualClaim.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = this.inputManualCode.value.trim();
      if (!code) return;

      this.btnManualSubmit.disabled = true;
      this.btnManualSubmit.textContent = '...';

      const msg: ManualClaimMessage = {
        type: 'MANUAL_CLAIM',
        payload: { code }
      };

      chrome.runtime.sendMessage(msg, (state: CoordinatorState) => {
        this.btnManualSubmit.disabled = false;
        this.btnManualSubmit.textContent = 'Claim';
        this.inputManualCode.value = '';
        if (state) {
          this.currentState = state;
          this.renderState(state);
        }
      });
    });

    this.btnOptions.addEventListener('click', () => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL('options/options.html'));
      }
    });

    this.btnCopyCode.addEventListener('click', () => {
      const code = this.latestCodeText.textContent;
      if (code && code !== '--') {
        navigator.clipboard.writeText(code);
        this.btnCopyCode.style.color = '#00e599';
        setTimeout(() => {
          this.btnCopyCode.style.color = '';
        }, 1200);
      }
    });
  }

  private fetchState(): void {
    const msg: GetStateMessage = { type: 'GET_STATE' };
    chrome.runtime.sendMessage(msg, (state: CoordinatorState) => {
      if (chrome.runtime.lastError || !state) return;
      this.currentState = state;
      this.renderState(state);
    });
  }

  private renderState(state: CoordinatorState): void {
    // 1. Status rendering
    this.renderStatus(state.extensionState);

    // 2. Tab Connections rendering
    this.renderConnections(state);

    // 3. Challenge Banner
    if (state.extensionState === 'PAUSED_SECURITY_CHALLENGE') {
      this.challengeBanner.classList.remove('hidden');
    } else {
      this.challengeBanner.classList.add('hidden');
    }

    // 4. Latest Code Card
    this.renderLatestCode(state);

    // 5. Total Earnings & Statistics
    this.renderStats(state);
  }

  private renderStatus(extState: ExtensionState): void {
    this.statusDot.className = 'status-dot';

    switch (extState) {
      case 'ACTIVE':
        this.statusDot.classList.add('active');
        this.statusText.textContent = 'AUTO-CLAIM ACTIVE';
        this.statusText.style.color = 'var(--accent-neon)';
        this.btnToggleActive.className = 'btn-primary deactivate';
        this.btnToggleText.textContent = 'DEACTIVATE';
        this.btnPause.textContent = 'PAUSE';
        break;
      case 'PAUSED_USER':
        this.statusDot.classList.add('paused');
        this.statusText.textContent = 'AUTO-CLAIM PAUSED';
        this.statusText.style.color = 'var(--accent-amber)';
        this.btnToggleActive.className = 'btn-primary';
        this.btnToggleText.textContent = 'RESUME AUTO-CLAIM';
        this.btnPause.textContent = 'RESUME';
        break;
      case 'PAUSED_SECURITY_CHALLENGE':
        this.statusDot.classList.add('challenge');
        this.statusText.textContent = 'SECURITY PAUSE';
        this.statusText.style.color = 'var(--accent-red)';
        this.btnToggleActive.className = 'btn-primary';
        this.btnToggleText.textContent = 'RESUME AFTER VERIFICATION';
        this.btnPause.textContent = 'PAUSED';
        break;
      case 'OFF':
      default:
        this.statusDot.classList.add('off');
        this.statusText.textContent = 'OFF';
        this.statusText.style.color = 'var(--text-muted)';
        this.btnToggleActive.className = 'btn-primary';
        this.btnToggleText.textContent = 'ACTIVATE AUTO-CLAIM';
        this.btnPause.textContent = 'PAUSE';
        break;
    }
  }

  private renderConnections(state: CoordinatorState): void {
    const conn = state.connection || {
      stakeStatus: 'NOT_FOUND',
      stakecruncherStatus: 'NOT_FOUND'
    };

    // Stake tab
    this.connStakePill.className = 'conn-pill';
    if (conn.stakeStatus === 'CONNECTED') {
      this.connStakePill.classList.add('connected');
      this.connStakeVal.textContent = 'CONNECTED';
    } else {
      this.connStakePill.classList.add('error');
      this.connStakeVal.textContent = 'NOT FOUND';
    }

    // StakeCruncher tab
    this.connCruncherPill.className = 'conn-pill';
    if (conn.stakecruncherStatus === 'MONITORING') {
      this.connCruncherPill.classList.add('monitoring');
      this.connCruncherVal.textContent = 'MONITORING';
    } else {
      this.connCruncherPill.classList.add('error');
      this.connCruncherVal.textContent = 'INACTIVE';
    }
  }

  private renderLatestCode(state: CoordinatorState): void {
    const info = state.latestCode;
    if (!info || !info.code) {
      this.latestCodeText.textContent = '--';
      this.latestTimeAgo.textContent = 'No codes detected';
      this.btnCopyCode.style.display = 'none';
      this.latestAmountBadge.classList.add('hidden');
      this.latestReqRow.classList.add('hidden');
      this.latestStatusBadge.textContent = 'IDLE';
      this.latestStatusBadge.className = 'badge badge-status badge-idle';
      return;
    }

    this.latestCodeText.textContent = info.code.code;
    this.btnCopyCode.style.display = 'inline-flex';

    // Time ago
    const secondsAgo = Math.max(0, Math.floor((Date.now() - info.code.detectedAt) / 1000));
    if (secondsAgo < 60) {
      this.latestTimeAgo.textContent = `${secondsAgo}s ago`;
    } else {
      this.latestTimeAgo.textContent = `${Math.floor(secondsAgo / 60)}m ago`;
    }

    // Amount badge
    if (info.code.amount) {
      this.latestAmountBadge.textContent = info.code.amount;
      this.latestAmountBadge.classList.remove('hidden');
    } else {
      this.latestAmountBadge.classList.add('hidden');
    }

    // Requirement row
    if (info.code.requirement) {
      this.latestReqText.textContent = info.code.requirement;
      this.latestReqRow.classList.remove('hidden');
    } else {
      this.latestReqRow.classList.add('hidden');
    }

    // Status badge
    this.latestStatusBadge.className = 'badge badge-status';
    switch (info.processingState) {
      case 'PROCESSING':
        this.latestStatusBadge.classList.add('badge-processing');
        this.latestStatusBadge.textContent = 'PROCESSING...';
        break;
      case 'QUEUED':
        this.latestStatusBadge.classList.add('badge-queued');
        this.latestStatusBadge.textContent = 'QUEUED';
        break;
      case 'CLAIMED':
        this.latestStatusBadge.classList.add('badge-claimed');
        this.latestStatusBadge.textContent = 'CLAIMED';
        break;
      case 'FAILED':
        this.latestStatusBadge.classList.add('badge-failed');
        this.latestStatusBadge.textContent = info.result?.status || 'FAILED';
        break;
      case 'IDLE':
      default:
        this.latestStatusBadge.classList.add('badge-idle');
        this.latestStatusBadge.textContent = 'RECORDED';
        break;
    }
  }

  private renderStats(state: CoordinatorState): void {
    const s = state.stats;
    const earned = (s.totalEarnedUsd || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    this.totalEarningsVal.textContent = `$${earned}`;

    this.statDetected.textContent = `${s.codesDetected}`;
    this.statAttempted.textContent = `${s.claimsAttempted}`;
    this.statSuccessful.textContent = `${s.successful}`;
    this.statExpired.textContent = `${s.expired}`;
    this.statClaimed.textContent = `${s.alreadyClaimed}`;
    this.statFailed.textContent = `${s.failed}`;
  }

  private async loadActivityLogs(): Promise<void> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.ACTIVITY_LOG);
    const logs: ActivityLogItem[] = result[STORAGE_KEYS.ACTIVITY_LOG] || [];
    this.renderActivityLogs(logs);
  }

  private renderActivityLogs(logs: ActivityLogItem[]): void {
    if (!logs || logs.length === 0) {
      this.activityList.innerHTML = '<div class="activity-empty">No activity recorded yet</div>';
      return;
    }

    const html = logs
      .slice(0, 50)
      .map((item) => {
        const date = new Date(item.timestamp);
        const timeStr = date.toTimeString().substring(0, 8);
        return `
          <div class="activity-item ${item.level}">
            <span class="activity-time">${timeStr}</span>
            <span class="activity-msg">${this.escapeHtml(item.message)}</span>
          </div>
        `;
      })
      .join('');

    this.activityList.innerHTML = html;
  }

  private handleToggleActive(): void {
    if (!this.currentState) return;

    if (this.currentState.extensionState === 'ACTIVE') {
      this.setExtensionState('OFF');
    } else {
      this.setExtensionState('ACTIVE');
    }
  }

  private handleTogglePause(): void {
    if (!this.currentState) return;

    if (this.currentState.extensionState === 'ACTIVE') {
      this.setExtensionState('PAUSED_USER');
    } else if (this.currentState.extensionState === 'PAUSED_USER') {
      this.setExtensionState('ACTIVE');
    }
  }

  private handleResumeChallenge(): void {
    const msg: ResumeSecurityChallengeMessage = { type: 'RESUME_SECURITY_CHALLENGE' };
    chrome.runtime.sendMessage(msg, (state: CoordinatorState) => {
      if (state) {
        this.currentState = state;
        this.renderState(state);
      }
    });
  }

  private handleClearHistory(): void {
    if (confirm('Clear all code history, session metrics, and activity logs?')) {
      const msg: ClearHistoryMessage = { type: 'CLEAR_HISTORY' };
      chrome.runtime.sendMessage(msg, (state: CoordinatorState) => {
        if (state) {
          this.currentState = state;
          this.renderState(state);
        }
        this.renderActivityLogs([]);
      });
    }
  }

  private setExtensionState(state: ExtensionState): void {
    const msg: SetExtensionStateMessage = {
      type: 'SET_EXTENSION_STATE',
      payload: { state }
    };
    chrome.runtime.sendMessage(msg, (newState: CoordinatorState) => {
      if (newState) {
        this.currentState = newState;
        this.renderState(newState);
      }
    });
  }

  private escapeHtml(unsafe: string): string {
    return (unsafe || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
  const controller = new PopupController();
  controller.init();
});
