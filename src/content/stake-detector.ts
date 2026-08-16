/**
 * Stake DOM element detection, challenge scanning, and result heuristics.
 */

import { DISMISS_KEYWORDS, DISMISS_SELECTORS, RESULT_PATTERNS, SECURITY_CHALLENGE_SELECTORS, STAKE_SELECTORS } from '../shared/constants.js';
import { ClaimStatus } from '../shared/types.js';

export class StakeDetector {
  /**
   * Checks whether an HTML element is genuinely visible to the user.
   */
  public static isElementVisible(element: Element | null): element is HTMLElement {
    if (!element || !(element instanceof HTMLElement)) return false;

    // Check dimensions
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;

    // Check style visibility
    const style = window.getComputedStyle(element);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0' ||
      style.pointerEvents === 'none'
    ) {
      return false;
    }

    return true;
  }

  /**
   * Checks whether an element is enabled and interactable.
   */
  public static isElementEnabled(element: Element | null): boolean {
    if (!element || !(element instanceof HTMLElement)) return false;

    if ((element as HTMLInputElement | HTMLButtonElement).disabled) return false;
    if (element.getAttribute('aria-disabled') === 'true') return false;
    if (element.classList.contains('disabled')) return false;

    return true;
  }

  /**
   * Detects if any CAPTCHA, Cloudflare verification, or security challenge is visible.
   */
  public static detectSecurityChallenge(): { hasChallenge: boolean; details?: string } {
    for (const selector of SECURITY_CHALLENGE_SELECTORS) {
      const el = document.querySelector(selector);
      if (el && this.isElementVisible(el)) {
        return {
          hasChallenge: true,
          details: `Found security element matching selector: ${selector}`
        };
      }
    }

    // Check page title or prominent heading
    const title = (document.title || '').toLowerCase();
    if (
      title.includes('just a moment') ||
      title.includes('attention required') ||
      title.includes('security check') ||
      title.includes('cloudflare')
    ) {
      return {
        hasChallenge: true,
        details: `Security challenge page title detected: ${document.title}`
      };
    }

    return { hasChallenge: false };
  }

  /**
   * Attempts to open the Settings > Offers modal / redemption dialog automatically if not visible.
   */
  public static openOffersModal(): boolean {
    // 1. Look for explicit offer navigation links / buttons
    for (const selector of STAKE_SELECTORS.NAVIGATION_TRIGGERS) {
      const el = document.querySelector<HTMLElement>(selector);
      if (el && this.isElementVisible(el)) {
        el.click();
        return true;
      }
    }

    // 2. SPA client-side route trigger fallback
    try {
      if (!window.location.pathname.includes('/settings/offers')) {
        window.history.pushState(null, '', '/settings/offers');
        window.dispatchEvent(new PopStateEvent('popstate'));
        return true;
      }
    } catch {
      // Ignored if restricted
    }

    return false;
  }

  /**
   * Locates the visible bonus code redemption input field using multi-tier fallback heuristics.
   */
  public static findBonusCodeInput(): HTMLInputElement | null {
    // 1. Check open modal dialogs first (most likely place for Bonus Drop / Redeem)
    const modals = document.querySelectorAll(STAKE_SELECTORS.MODAL_CONTAINER.join(','));
    for (const modal of modals) {
      if (this.isElementVisible(modal)) {
        const modalInputs = modal.querySelectorAll('input');
        for (const input of modalInputs) {
          if (this.isBonusInputCandidate(input)) {
            return input;
          }
        }
      }
    }

    // 2. Direct selector search
    for (const selector of STAKE_SELECTORS.INPUT_SELECTORS) {
      const inputs = document.querySelectorAll<HTMLInputElement>(selector);
      for (const input of inputs) {
        if (this.isBonusInputCandidate(input)) {
          return input;
        }
      }
    }

    // 3. Fallback: scan all visible text inputs for contextual labels or nearby text
    const allInputs = document.querySelectorAll<HTMLInputElement>(
      'input[type="text"], input:not([type])'
    );
    for (const input of allInputs) {
      if (this.isBonusInputCandidate(input)) {
        return input;
      }
    }

    return null;
  }

  /**
   * Validates whether a specific input element matches bonus code characteristics.
   */
  private static isBonusInputCandidate(input: HTMLInputElement): boolean {
    if (!this.isElementVisible(input) || !this.isElementEnabled(input)) {
      return false;
    }

    // Exclude search inputs, chat inputs, username, password, email inputs
    const type = (input.getAttribute('type') || 'text').toLowerCase();
    if (type === 'password' || type === 'email' || type === 'search' || type === 'number') {
      return false;
    }

    const name = (input.getAttribute('name') || '').toLowerCase();
    const id = (input.getAttribute('id') || '').toLowerCase();
    const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
    const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
    const testId = (input.getAttribute('data-testid') || '').toLowerCase();

    // Positive indicators
    const bonusKeywords = ['bonus', 'code', 'coupon', 'promo', 'drop', 'redeem', 'voucher'];
    const hasKeyword = bonusKeywords.some(
      (kw) =>
        name.includes(kw) ||
        id.includes(kw) ||
        placeholder.includes(kw) ||
        ariaLabel.includes(kw) ||
        testId.includes(kw)
    );

    if (hasKeyword) return true;

    // Check parent labels or nearby text
    const parentLabel = input.closest('label');
    if (parentLabel && parentLabel.textContent) {
      const labelText = parentLabel.textContent.toLowerCase();
      if (bonusKeywords.some((kw) => labelText.includes(kw))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Identifies the normal visible Claim / Redeem button associated with the redemption input.
   */
  public static findClaimButton(inputElement?: HTMLElement | null): HTMLButtonElement | null {
    // 1. Search within the input's parent form or modal container
    if (inputElement) {
      const container =
        inputElement.closest('form') ||
        inputElement.closest('[role="dialog"]') ||
        inputElement.closest('.modal-content') ||
        inputElement.parentElement?.parentElement;

      if (container) {
        const buttons = container.querySelectorAll<HTMLButtonElement>('button');
        for (const btn of buttons) {
          if (this.isClaimButtonCandidate(btn)) {
            return btn;
          }
        }
      }
    }

    // 2. Direct selector search
    for (const selector of STAKE_SELECTORS.BUTTON_SELECTORS) {
      const buttons = document.querySelectorAll<HTMLButtonElement>(selector);
      for (const btn of buttons) {
        if (this.isClaimButtonCandidate(btn)) {
          return btn;
        }
      }
    }

    // 3. Scan all visible buttons on the page for text matching
    const allButtons = document.querySelectorAll<HTMLButtonElement>('button');
    for (const btn of allButtons) {
      if (this.isClaimButtonCandidate(btn)) {
        return btn;
      }
    }

    return null;
  }

  /**
   * Validates whether a button matches Claim / Redeem characteristics.
   */
  private static isClaimButtonCandidate(button: HTMLButtonElement): boolean {
    if (!this.isElementVisible(button) || !this.isElementEnabled(button)) {
      return false;
    }

    const text = (button.textContent || '').trim().toLowerCase();
    const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
    const testId = (button.getAttribute('data-testid') || '').toLowerCase();

    const claimKeywords = ['claim', 'redeem', 'apply', 'submit drop', 'claim bonus', 'submit'];
    const isCandidate = claimKeywords.some(
      (kw) => text === kw || text.includes(kw) || ariaLabel.includes(kw) || testId.includes(kw)
    );

    // Negative filters (avoid clicking search, deposit, chat, logout, etc.)
    const forbidden = ['deposit', 'withdraw', 'chat', 'logout', 'search', 'close', 'cancel', 'dismiss'];
    const isForbidden = forbidden.some((kw) => text.includes(kw));

    return isCandidate && !isForbidden;
  }

  /**
   * Locates visible Dismiss / Close / OK buttons on active outcome dialogs or toasts.
   */
  public static findDismissButton(container?: Element | null): HTMLButtonElement | null {
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

  /**
   * Validates whether a button matches Dismiss / Close / Got it characteristics.
   */
  public static isDismissButtonCandidate(button: HTMLButtonElement): boolean {
    if (!this.isElementVisible(button) || !this.isElementEnabled(button)) {
      return false;
    }

    // Avoid submit or deposit buttons
    if (button.getAttribute('type') === 'submit') {
      return false;
    }

    const text = (button.textContent || '').trim().toLowerCase();
    const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
    const testId = (button.getAttribute('data-testid') || '').toLowerCase();

    return DISMISS_KEYWORDS.some((kw) => text === kw || text.includes(kw) || ariaLabel.includes(kw) || testId.includes(kw));
  }

  /**
   * Automatically clicks the dismiss button on any active confirmation/toast dialog.
   */
  public static dismissActiveDialog(container?: Element | null): boolean {
    const btn = this.findDismissButton(container);
    if (btn) {
      try {
        btn.click();
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Scans DOM for visible outcome messages (toasts, alerts, modals) and classifies result.
   */
  public static parseClaimResultFromDOM(): { status: ClaimStatus; message?: string } {
    // Check security challenges first
    const challenge = this.detectSecurityChallenge();
    if (challenge.hasChallenge) {
      return { status: 'SECURITY_CHALLENGE', message: challenge.details };
    }

    // Look at active toasts, alerts, banners, and status text
    const potentialAlerts = document.querySelectorAll(
      '[role="alert"], [role="status"], .toast, .notification, .alert, .message, [data-testid="toast-message"], .snackbar'
    );

    for (const alertEl of potentialAlerts) {
      if (this.isElementVisible(alertEl)) {
        const text = (alertEl.textContent || '').trim();
        const classified = this.classifyTextResult(text);
        if (classified.status !== 'UNKNOWN') {
          return { status: classified.status, message: text };
        }
      }
    }

    // Also check entire body text for prominent results
    const bodyText = (document.body.innerText || '').substring(0, 5000);
    return this.classifyTextResult(bodyText);
  }

  /**
   * Classifies a text snippet into a ClaimStatus based on regular expressions.
   */
  public static classifyTextResult(text: string): { status: ClaimStatus; message?: string } {
    if (!text) return { status: 'UNKNOWN' };

    for (const pattern of RESULT_PATTERNS.SUCCESS) {
      if (pattern.test(text)) return { status: 'CLAIM_SUCCESS', message: text };
    }
    for (const pattern of RESULT_PATTERNS.ALREADY_CLAIMED) {
      if (pattern.test(text)) return { status: 'ALREADY_CLAIMED', message: text };
    }
    for (const pattern of RESULT_PATTERNS.EXPIRED) {
      if (pattern.test(text)) return { status: 'EXPIRED', message: text };
    }
    for (const pattern of RESULT_PATTERNS.CLAIM_LIMIT_REACHED) {
      if (pattern.test(text)) return { status: 'CLAIM_LIMIT_REACHED', message: text };
    }
    for (const pattern of RESULT_PATTERNS.INVALID_CODE) {
      if (pattern.test(text)) return { status: 'INVALID_CODE', message: text };
    }
    for (const pattern of RESULT_PATTERNS.REQUIREMENT_NOT_MET) {
      if (pattern.test(text)) return { status: 'REQUIREMENT_NOT_MET', message: text };
    }
    for (const pattern of RESULT_PATTERNS.LOGIN_REQUIRED) {
      if (pattern.test(text)) return { status: 'LOGIN_REQUIRED', message: text };
    }
    for (const pattern of RESULT_PATTERNS.RATE_LIMITED) {
      if (pattern.test(text)) return { status: 'RATE_LIMITED', message: text };
    }

    return { status: 'UNKNOWN' };
  }
}
