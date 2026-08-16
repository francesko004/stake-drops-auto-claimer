/**
 * Shared constants, selectors, defaults, and configuration for Stake Auto-Claim.
 */

import { ExtensionSettings, ExtensionStats } from './types.js';

export const DEFAULT_SETTINGS: ExtensionSettings = {
  autoClaim: true,
  notifications: true,
  sound: false,
  soundVolume: 0.7,
  monitorStakeCruncher: true,
  pauseOnSecurityChallenge: true,
  maxAttemptsPerCode: 1,
  historySize: 500,
  debugLogging: true,
  customStakeDomains: ['stake.com', 'stake.us', 'stake.bet', 'stake.games'],
  
  // New Filter & Navigation Defaults
  minAmountThreshold: 0,
  maxWagerThreshold: 0,
  autoOpenOffersModal: true,
  clipboardAutoClaim: false,
  autoDismissDialogs: true,
  ultraFastMode: true
};

export const INITIAL_STATS: ExtensionStats = {
  codesDetected: 0,
  claimsAttempted: 0,
  successful: 0,
  expired: 0,
  alreadyClaimed: 0,
  failed: 0,
  totalEarnedUsd: 0,
  lastResetTimestamp: Date.now()
};

export const STORAGE_KEYS = {
  SETTINGS: 'stake_ac_settings',
  EXTENSION_STATE: 'stake_ac_state',
  SEEN_CODES: 'stake_ac_seen_codes',
  CLAIMED_CODES: 'stake_ac_claimed_codes',
  FAILED_CODES: 'stake_ac_failed_codes',
  LATEST_CODE: 'stake_ac_latest_code',
  STATS: 'stake_ac_stats',
  ACTIVITY_LOG: 'stake_ac_activity_log'
} as const;

export const STAKECRUNCHER_SELECTORS = {
  LIST_CONTAINER: '.bonus-codes-list, [data-testid="bonus-codes-list"], #bonus-codes-list, .codes-container, table tbody, .table-responsive',
  ITEM: '.bonus-code-item, [data-testid="bonus-code-item"], .code-item, tr.code-row, .card-body, div[class*="bonus-code"]',
  CODE_VALUE: '.bonus-code-value, [data-testid="bonus-code-value"], .code-text, .code-value, strong, code, .code, td:first-child',
  AMOUNT: '.bonus-code-amount, [data-testid="bonus-code-amount"], .code-amount, .amount, .badge-success, td:nth-child(2)',
  REQUIREMENT: '.bonus-code-req, [data-testid="bonus-code-req"], .code-req, .requirement, .wager-req, td:nth-child(3)',
  CLAIM_LIMIT: '.bonus-code-limit, [data-testid="bonus-code-limit"], .code-limit, .limit, td:nth-child(4)',
  TIME: '.bonus-code-time, [data-testid="bonus-code-time"], .code-time, .timestamp, time, td:last-child',
  AUTO_REFRESH_BADGE: '.auto-refreshing, [data-testid="auto-refreshing"], .refresh-status'
} as const;

export const STAKE_SELECTORS = {
  // Input selectors with priority
  INPUT_SELECTORS: [
    'input[name="code"]',
    'input[name="bonusCode"]',
    'input[name="coupon"]',
    'input[name="promoCode"]',
    'input[data-testid="bonus-code-input"]',
    'input[data-testid="redeem-bonus-input"]',
    'input[data-testid="redeem-input"]',
    'input[id="bonus-code"]',
    'input[id="coupon-code"]',
    'input[placeholder*="bonus" i]',
    'input[placeholder*="drop" i]',
    'input[placeholder*="redeem" i]',
    'input[placeholder*="promo" i]',
    'input[placeholder*="coupon" i]',
    'input[placeholder*="code" i]',
    'input[aria-label*="bonus" i]',
    'input[aria-label*="redeem" i]',
    'input[aria-label*="code" i]'
  ],
  // Buttons with priority
  BUTTON_SELECTORS: [
    'button[data-testid="claim-button"]',
    'button[data-testid="redeem-button"]',
    'button[data-testid="submit-bonus-code"]',
    'button[data-testid="submit-button"]',
    'button[type="submit"]',
    'form button'
  ],
  // Modal / container for bonus codes
  MODAL_CONTAINER: [
    '[data-testid="bonus-modal"]',
    '[data-testid="redeem-modal"]',
    '[role="dialog"]',
    '.modal-content',
    '.dialog-content',
    'form[action*="bonus" i]',
    'form[action*="redeem" i]'
  ],
  // Navigation elements to reach Settings > Offers
  NAVIGATION_TRIGGERS: [
    'a[href*="/settings/offers"]',
    'button[data-testid="tab-offers"]',
    'a[data-testid="navigation-settings-offers"]',
    'a[href*="/vip/bonus-drop"]',
    'a[href*="/settings"]',
    'button[data-testid="settings-button"]'
  ]
} as const;

export const DISMISS_SELECTORS = [
  'button[data-testid="modal-close"]',
  'button[data-testid="close-button"]',
  'button[data-testid="dismiss-button"]',
  'button[data-testid="dialog-close"]',
  'button[aria-label*="close" i]',
  'button[aria-label*="dismiss" i]',
  'button.modal-close',
  'button.close-btn',
  'button.dismiss-btn',
  '.toast button',
  '.notification button',
  '[role="dialog"] button:not([type="submit"])',
  '.modal-content button:not([type="submit"])'
];

export const DISMISS_KEYWORDS = [
  'dismiss',
  'close',
  'got it',
  'done',
  'okay',
  'ok',
  'continue',
  'understood',
  'back',
  'cancel'
];

export const SECURITY_CHALLENGE_SELECTORS = [
  '#challenge-running',
  '#challenge-form',
  '#cf-challenge-running',
  '.cf-turnstile',
  'iframe[src*="challenges.cloudflare.com"]',
  'iframe[src*="recaptcha"]',
  'iframe[src*="hcaptcha"]',
  'iframe[title*="reCAPTCHA" i]',
  'iframe[title*="hCaptcha" i]',
  'iframe[title*="Cloudflare" i]',
  '[data-testid="security-challenge"]',
  '[data-testid="captcha-container"]',
  '.geetest_holder',
  '.arkose-frame'
];

export const RESULT_PATTERNS = {
  SUCCESS: [
    /bonus\s*(has\s*been\s*|is\s*)?claimed/i,
    /claimed\s*successfully/i,
    /congratulations/i,
    /reward\s*(has\s*been\s*)?credited/i,
    /bonus\s*added/i,
    /redeemed\s*successfully/i,
    /you\s*(have\s*)?received/i,
    /code\s*(has\s*been\s*)?applied/i,
    /bonus\s*drop\s*(has\s*been\s*)?activated/i,
    /credited\s*to\s*your\s*(balance|account)/i,
    /successfully\s*submitted/i,
    /drop\s*claimed/i,
    /your\s*bonus\s*has\s*been/i,
    /bonus\s*activated/i
  ],
  ALREADY_CLAIMED: [
    /already\s*claimed/i,
    /already\s*redeemed/i,
    /you\s*have\s*already\s*claimed/i,
    /previously\s*claimed/i,
    /code\s*already\s*used/i,
    /already\s*activated/i,
    /already\s*been\s*claimed/i,
    /you\s*already\s*have/i
  ],
  EXPIRED: [
    /(code|bonus|drop|promotion|offer)\s*(has\s*|is\s*)?expired/i,
    /bonus\s*(is)?\s*no\s*longer\s*active/i,
    /has\s*expired/i,
    /promotion\s*ended/i,
    /offer\s*ended/i,
    /drop\s*(has\s*)?expired/i,
    /no\s*longer\s*available/i,
    /code\s*has\s*expired/i
  ],
  CLAIM_LIMIT_REACHED: [
    /claim\s*limit\s*reached/i,
    /fully\s*claimed/i,
    /all\s*bonuses\s*(have\s*been)?\s*claimed/i,
    /maximum\s*(number\s*of)?\s*claimants\s*reached/i,
    /quota\s*full/i,
    /all\s*claimed/i,
    /no\s*more\s*claims/i,
    /limit\s*has\s*been\s*reached/i
  ],
  INVALID_CODE: [
    /invalid\s*code/i,
    /bonus\s*code\s*not\s*found/i,
    /code\s*does\s*not\s*exist/i,
    /incorrect\s*code/i,
    /unknown\s*code/i,
    /not\s*a\s*valid\s*(bonus\s*)?code/i,
    /code\s*is\s*invalid/i,
    /code\s*not\s*recognized/i,
    /unable\s*to\s*find/i
  ],
  REQUIREMENT_NOT_MET: [
    /wager(ing)?\s*requirement\s*not\s*met/i,
    /eligibility\s*requirement\s*not\s*met/i,
    /insufficient\s*wager/i,
    /not\s*eligible/i,
    /you\s*do\s*not\s*meet\s*the\s*requirements/i,
    /need\s*to\s*wager/i
  ],
  LOGIN_REQUIRED: [
    /please\s*log\s*in/i,
    /login\s*required/i,
    /must\s*be\s*logged\s*in/i,
    /session\s*expired/i
  ],
  RATE_LIMITED: [
    /too\s*many\s*requests/i,
    /slow\s*down/i,
    /rate\s*limited/i,
    /temporary\s*restriction/i
  ]
};

export const TIMING = {
  RESULT_OBSERVE_TIMEOUT_MS: 7000,
  POLL_INTERVAL_MS: 30,
  TAB_PING_INTERVAL_MS: 2000,
  MAX_QUEUE_WAIT_MS: 12000,
  BUTTON_CLICK_DELAY_MS: 30,
  INPUT_DISPATCH_DELAY_MS: 15,
  AUTO_DISMISS_DELAY_MS: 150
} as const;
