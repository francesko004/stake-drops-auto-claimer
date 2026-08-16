/**
 * Data structures and types for Stake Auto-Claim extension.
 */

export interface BonusCode {
  /** The raw bonus code string to enter on Stake */
  code: string;
  /** Normalized code used for duplicate comparison (lowercase/trimmed) */
  normalizedCode: string;
  /** Estimated or stated cash/crypto amount (e.g. "$12.50") */
  amount?: string;
  /** Numeric parsed amount in USD if available */
  amountValue?: number;
  /** Stated wagering requirement (e.g. "$3,000 in 7 days") */
  requirement?: string;
  /** Numeric parsed wager requirement in USD if available */
  wagerValue?: number;
  /** Stated claimant limit (e.g. "5000 users") */
  claimLimit?: string;
  /** Age indicator on page (e.g. "2m ago", "Just now") */
  age?: string;
  /** Timestamp in milliseconds when detected */
  detectedAt: number;
}

export type ClaimStatus =
  | 'CLAIM_SUCCESS'
  | 'ALREADY_CLAIMED'
  | 'EXPIRED'
  | 'CLAIM_LIMIT_REACHED'
  | 'INVALID_CODE'
  | 'REQUIREMENT_NOT_MET'
  | 'LOGIN_REQUIRED'
  | 'SECURITY_CHALLENGE'
  | 'BONUS_INPUT_NOT_FOUND'
  | 'CLAIM_BUTTON_NOT_FOUND'
  | 'SKIPPED_FILTER'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'UNKNOWN';

export interface ClaimResult {
  code: string;
  status: ClaimStatus;
  message?: string;
  timestamp: number;
  executionTimeMs?: number;
  amount?: string;
  amountValue?: number;
}

export type ExtensionState =
  | 'ACTIVE'
  | 'OFF'
  | 'PAUSED_USER'
  | 'PAUSED_SECURITY_CHALLENGE';

export type TabStatus =
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'NOT_FOUND'
  | 'LOADING'
  | 'READY';

export interface TabConnectionInfo {
  stakeTabId: number | null;
  stakeTabUrl: string | null;
  stakeStatus: TabStatus;
  stakecruncherTabId: number | null;
  stakecruncherStatus: 'MONITORING' | 'DISCONNECTED' | 'NOT_FOUND';
  lastPingTimestamp: number;
}

export interface ExtensionSettings {
  autoClaim: boolean;
  notifications: boolean;
  sound: boolean;
  soundVolume: number;
  monitorStakeCruncher: boolean;
  pauseOnSecurityChallenge: boolean;
  maxAttemptsPerCode: number;
  historySize: number;
  debugLogging: boolean;
  customStakeDomains: string[];
  
  // Smart Filters & Automation rules
  minAmountThreshold: number;       // e.g. 0 (no minimum) or 2.50
  maxWagerThreshold: number;        // e.g. 0 (unlimited) or 5000
  autoOpenOffersModal: boolean;     // Automatically open /settings/offers if closed
  clipboardAutoClaim: boolean;      // Automatically claim codes copied to clipboard
  autoDismissDialogs: boolean;      // Automatically click Dismiss / Close on result modals
  ultraFastMode: boolean;           // Ultra-low latency mode for lightning claims
}

export interface ExtensionStats {
  codesDetected: number;
  claimsAttempted: number;
  successful: number;
  expired: number;
  alreadyClaimed: number;
  failed: number;
  totalEarnedUsd: number;
  lastResetTimestamp: number;
}

export interface ActivityLogItem {
  id: string;
  timestamp: number;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  details?: string;
  code?: string;
}

export interface LatestCodeInfo {
  code: BonusCode;
  result?: ClaimResult;
  processingState: 'IDLE' | 'QUEUED' | 'PROCESSING' | 'CLAIMED' | 'FAILED';
}

export interface CoordinatorState {
  extensionState: ExtensionState;
  connection: TabConnectionInfo;
  latestCode: LatestCodeInfo | null;
  stats: ExtensionStats;
  queueLength: number;
  isProcessing: boolean;
}
