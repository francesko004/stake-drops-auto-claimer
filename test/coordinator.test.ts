import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Coordinator } from '../src/background/coordinator.js';
import { StorageService } from '../src/background/storage.js';
import { BonusCode, ClaimResult } from '../src/shared/types.js';

// Mock storage
const mockStorage: Record<string, unknown> = {};
globalThis.chrome = {
  storage: {
    local: {
      get: vi.fn((keys: string | string[]) => {
        if (typeof keys === 'string') return Promise.resolve({ [keys]: mockStorage[keys] });
        const res: Record<string, unknown> = {};
        for (const k of keys) res[k] = mockStorage[k];
        return Promise.resolve(res);
      }),
      set: vi.fn((items: Record<string, unknown>) => {
        Object.assign(mockStorage, items);
        return Promise.resolve();
      })
    }
  },
  action: {
    setBadgeText: vi.fn(() => Promise.resolve()),
    setBadgeBackgroundColor: vi.fn(() => Promise.resolve())
  },
  tabs: {
    query: vi.fn(() => Promise.resolve([])),
    sendMessage: vi.fn()
  },
  notifications: {
    create: vi.fn(() => Promise.resolve('notif-id'))
  },
  runtime: {
    getURL: vi.fn((path) => `chrome-extension://id/${path}`)
  }
} as unknown as typeof chrome;

describe('Coordinator', () => {
  let coordinator: Coordinator;

  beforeEach(async () => {
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    vi.clearAllMocks();
    coordinator = Coordinator.getInstance();
    await coordinator.init();
  });

  it('should transition extension state properly', async () => {
    await coordinator.setExtensionState('ACTIVE');
    let state = await coordinator.getState();
    expect(state.extensionState).toBe('ACTIVE');

    await coordinator.setExtensionState('PAUSED_USER');
    state = await coordinator.getState();
    expect(state.extensionState).toBe('PAUSED_USER');
  });

  it('should ignore duplicate codes when handleNewCode is called', async () => {
    await coordinator.setExtensionState('ACTIVE');

    const code: BonusCode = {
      code: 'TESTCODE1',
      normalizedCode: 'testcode1',
      amount: '$10.00',
      detectedAt: Date.now()
    };

    await coordinator.handleNewCode(code);
    const seen = await StorageService.getSeenCodes();
    expect(seen).toContain('testcode1');

    // Second arrival of same code
    await coordinator.handleNewCode(code);
    const stats = await StorageService.getStats();
    expect(stats.codesDetected).toBe(1); // not incremented twice
  });

  it('should handle security challenge by setting PAUSED_SECURITY_CHALLENGE state', async () => {
    const code: BonusCode = {
      code: 'CHALLENGE_CODE',
      normalizedCode: 'challenge_code',
      detectedAt: Date.now()
    };

    const challengeResult: ClaimResult = {
      code: code.code,
      status: 'SECURITY_CHALLENGE',
      message: 'Cloudflare Turnstile active',
      timestamp: Date.now()
    };

    await coordinator.handleClaimResult(challengeResult, code);
    const state = await coordinator.getState();
    expect(state.extensionState).toBe('PAUSED_SECURITY_CHALLENGE');

    // Resume
    await coordinator.resumeFromSecurityChallenge();
    const resumedState = await coordinator.getState();
    expect(resumedState.extensionState).toBe('ACTIVE');
  });

  it('should support manual claim submission', async () => {
    await coordinator.handleManualClaim('MANUAL_BONUS_100');
    const state = await coordinator.getState();
    expect(state.latestCode).not.toBeNull();
    expect(state.latestCode?.code.code).toBe('MANUAL_BONUS_100');
  });
});
