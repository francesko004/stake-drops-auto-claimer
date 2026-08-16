/**
 * Controller script for Stake Auto-Claim Options / Preferences.
 */

import { DEFAULT_SETTINGS } from '../shared/constants.js';
import {
  GetSettingsMessage,
  UpdateSettingsMessage
} from '../shared/messages.js';
import { ExtensionSettings } from '../shared/types.js';

class OptionsController {
  private form!: HTMLFormElement;
  private autoClaimInput!: HTMLInputElement;
  private ultraFastInput!: HTMLInputElement;
  private autoDismissInput!: HTMLInputElement;
  private autoOffersInput!: HTMLInputElement;
  private cruncherInput!: HTMLInputElement;
  private pauseChallengeInput!: HTMLInputElement;
  private maxAttemptsSelect!: HTMLSelectElement;
  private minAmountInput!: HTMLInputElement;
  private maxWagerInput!: HTMLInputElement;
  private notificationsInput!: HTMLInputElement;
  private soundInput!: HTMLInputElement;
  private historySizeInput!: HTMLInputElement;
  private domainsInput!: HTMLInputElement;
  private debugInput!: HTMLInputElement;
  private saveIndicator!: HTMLElement;
  private btnReset!: HTMLButtonElement;
  private btnTestSound!: HTMLButtonElement;

  public init(): void {
    this.bindElements();
    this.attachEventListeners();
    this.loadSettings();
  }

  private bindElements(): void {
    this.form = document.getElementById('settings-form') as HTMLFormElement;
    this.autoClaimInput = document.getElementById('setting-autoclaim') as HTMLInputElement;
    this.ultraFastInput = document.getElementById('setting-ultra-fast') as HTMLInputElement;
    this.autoDismissInput = document.getElementById('setting-auto-dismiss') as HTMLInputElement;
    this.autoOffersInput = document.getElementById('setting-auto-offers') as HTMLInputElement;
    this.cruncherInput = document.getElementById('setting-cruncher') as HTMLInputElement;
    this.pauseChallengeInput = document.getElementById('setting-pause-challenge') as HTMLInputElement;
    this.maxAttemptsSelect = document.getElementById('setting-max-attempts') as HTMLSelectElement;
    this.minAmountInput = document.getElementById('setting-min-amount') as HTMLInputElement;
    this.maxWagerInput = document.getElementById('setting-max-wager') as HTMLInputElement;
    this.notificationsInput = document.getElementById('setting-notifications') as HTMLInputElement;
    this.soundInput = document.getElementById('setting-sound') as HTMLInputElement;
    this.historySizeInput = document.getElementById('setting-history-size') as HTMLInputElement;
    this.domainsInput = document.getElementById('setting-domains') as HTMLInputElement;
    this.debugInput = document.getElementById('setting-debug') as HTMLInputElement;
    this.saveIndicator = document.getElementById('save-indicator')!;
    this.btnReset = document.getElementById('btn-reset-defaults') as HTMLButtonElement;
    this.btnTestSound = document.getElementById('btn-test-sound') as HTMLButtonElement;
  }

  private attachEventListeners(): void {
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveCurrentSettings();
    });

    this.btnReset.addEventListener('click', () => {
      if (confirm('Reset all settings to default values?')) {
        this.populateForm(DEFAULT_SETTINGS);
        this.saveCurrentSettings();
      }
    });

    this.btnTestSound.addEventListener('click', () => {
      this.playTestAudioChime();
    });
  }

  private loadSettings(): void {
    const msg: GetSettingsMessage = { type: 'GET_SETTINGS' };
    chrome.runtime.sendMessage(msg, (settings: ExtensionSettings) => {
      if (settings) {
        this.populateForm(settings);
      }
    });
  }

  private populateForm(settings: ExtensionSettings): void {
    this.autoClaimInput.checked = settings.autoClaim;
    if (this.ultraFastInput) this.ultraFastInput.checked = settings.ultraFastMode ?? true;
    if (this.autoDismissInput) this.autoDismissInput.checked = settings.autoDismissDialogs ?? true;
    this.autoOffersInput.checked = settings.autoOpenOffersModal ?? true;
    this.cruncherInput.checked = settings.monitorStakeCruncher;
    this.pauseChallengeInput.checked = settings.pauseOnSecurityChallenge;
    this.maxAttemptsSelect.value = String(settings.maxAttemptsPerCode || 1);
    this.minAmountInput.value = String(settings.minAmountThreshold || 0);
    this.maxWagerInput.value = String(settings.maxWagerThreshold || 0);
    this.notificationsInput.checked = settings.notifications;
    this.soundInput.checked = settings.sound;
    this.historySizeInput.value = String(settings.historySize || 500);
    this.domainsInput.value = (settings.customStakeDomains || []).join(', ');
    this.debugInput.checked = settings.debugLogging;
  }

  private saveCurrentSettings(): void {
    const domains = this.domainsInput.value
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter((d) => d.length > 0);

    const updated: Partial<ExtensionSettings> = {
      autoClaim: this.autoClaimInput.checked,
      ultraFastMode: this.ultraFastInput ? this.ultraFastInput.checked : true,
      autoDismissDialogs: this.autoDismissInput ? this.autoDismissInput.checked : true,
      autoOpenOffersModal: this.autoOffersInput.checked,
      monitorStakeCruncher: this.cruncherInput.checked,
      pauseOnSecurityChallenge: this.pauseChallengeInput.checked,
      maxAttemptsPerCode: parseInt(this.maxAttemptsSelect.value, 10) || 1,
      minAmountThreshold: parseFloat(this.minAmountInput.value) || 0,
      maxWagerThreshold: parseFloat(this.maxWagerInput.value) || 0,
      notifications: this.notificationsInput.checked,
      sound: this.soundInput.checked,
      historySize: Math.max(50, parseInt(this.historySizeInput.value, 10) || 500),
      customStakeDomains: domains.length > 0 ? domains : DEFAULT_SETTINGS.customStakeDomains,
      debugLogging: this.debugInput.checked
    };

    const msg: UpdateSettingsMessage = {
      type: 'UPDATE_SETTINGS',
      payload: updated
    };

    chrome.runtime.sendMessage(msg, () => {
      this.showSaveIndicator();
    });
  }

  private showSaveIndicator(): void {
    this.saveIndicator.classList.remove('hidden');
    setTimeout(() => {
      this.saveIndicator.classList.add('hidden');
    }, 2000);
  }

  /**
   * Synthesizes a clean audio chime alert using Web Audio API (bundled locally, no remote asset required).
   */
  private playTestAudioChime(): void {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {
      console.warn('AudioContext playback error:', e);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const controller = new OptionsController();
  controller.init();
});
