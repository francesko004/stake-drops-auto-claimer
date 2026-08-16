/**
 * Message types and definitions for internal Chrome extension messaging.
 */

import {
  BonusCode,
  ClaimResult,
  CoordinatorState,
  ExtensionSettings,
  ExtensionState
} from './types.js';

export type MessageType =
  | 'NEW_CODE'
  | 'EXECUTE_CLAIM'
  | 'MANUAL_CLAIM'
  | 'CLAIM_RESULT'
  | 'SECURITY_CHALLENGE_DETECTED'
  | 'GET_STATE'
  | 'STATE_UPDATE'
  | 'SET_EXTENSION_STATE'
  | 'RESUME_SECURITY_CHALLENGE'
  | 'CLEAR_HISTORY'
  | 'GET_SETTINGS'
  | 'UPDATE_SETTINGS'
  | 'PLAY_TEST_SOUND'
  | 'NAVIGATE_TO_OFFERS'
  | 'STAKE_PING'
  | 'STAKE_PONG'
  | 'STAKECRUNCHER_PING'
  | 'STAKECRUNCHER_PONG';

export interface NewCodeMessage {
  type: 'NEW_CODE';
  payload: {
    code: BonusCode;
  };
}

export interface ExecuteClaimMessage {
  type: 'EXECUTE_CLAIM';
  payload: {
    code: BonusCode;
  };
}

export interface ManualClaimMessage {
  type: 'MANUAL_CLAIM';
  payload: {
    code: string;
  };
}

export interface NavigateToOffersMessage {
  type: 'NAVIGATE_TO_OFFERS';
}

export interface ClaimResultMessage {
  type: 'CLAIM_RESULT';
  payload: {
    result: ClaimResult;
  };
}

export interface SecurityChallengeDetectedMessage {
  type: 'SECURITY_CHALLENGE_DETECTED';
  payload: {
    sourceUrl: string;
    details?: string;
  };
}

export interface GetStateMessage {
  type: 'GET_STATE';
}

export interface StateUpdateMessage {
  type: 'STATE_UPDATE';
  payload: CoordinatorState;
}

export interface SetExtensionStateMessage {
  type: 'SET_EXTENSION_STATE';
  payload: {
    state: ExtensionState;
  };
}

export interface ResumeSecurityChallengeMessage {
  type: 'RESUME_SECURITY_CHALLENGE';
}

export interface ClearHistoryMessage {
  type: 'CLEAR_HISTORY';
}

export interface GetSettingsMessage {
  type: 'GET_SETTINGS';
}

export interface UpdateSettingsMessage {
  type: 'UPDATE_SETTINGS';
  payload: Partial<ExtensionSettings>;
}

export interface PlayTestSoundMessage {
  type: 'PLAY_TEST_SOUND';
}

export interface StakePingMessage {
  type: 'STAKE_PING';
}

export interface StakePongMessage {
  type: 'STAKE_PONG';
  payload: {
    ready: boolean;
    hasInput: boolean;
    hasChallenge: boolean;
    url: string;
  };
}

export interface StakecruncherPingMessage {
  type: 'STAKECRUNCHER_PING';
}

export interface StakecruncherPongMessage {
  type: 'STAKECRUNCHER_PONG';
  payload: {
    monitoring: boolean;
    codeCount: number;
    url: string;
  };
}

export type ExtensionMessage =
  | NewCodeMessage
  | ExecuteClaimMessage
  | ManualClaimMessage
  | NavigateToOffersMessage
  | ClaimResultMessage
  | SecurityChallengeDetectedMessage
  | GetStateMessage
  | StateUpdateMessage
  | SetExtensionStateMessage
  | ResumeSecurityChallengeMessage
  | ClearHistoryMessage
  | GetSettingsMessage
  | UpdateSettingsMessage
  | PlayTestSoundMessage
  | StakePingMessage
  | StakePongMessage
  | StakecruncherPingMessage
  | StakecruncherPongMessage;
