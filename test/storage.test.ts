import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageService } from '../src/background/storage.js';
import { ClaimResult } from '../src/shared/types.js';

// Setup chrome.storage mock
const storageMock: Record<string, unknown> = {};

globalThis.chrome = {
  storage: {
    local: {
      get: vi.fn((keys: string | string[]) => {
        if (typeof keys === 'string') {
          return Promise.resolve({ [keys]: storageMock[keys] });
        }
        const res: Record<string, unknown> = {};
        for (const k of keys) {
          res[k] = storageMock[k];
        }
        return Promise.resolve(res);
      }),
      set: vi.fn((items: Record<string, unknown>) => {
        Object.assign(storageMock, items);
        return Promise.resolve();
      })
    }
  }
} as unknown as typeof chrome;

describe('StorageService', () => {
  beforeEach(() => {
    for (const key of Object.keys(storageMock)) {
      delete storageMock[key];
    }
    vi.clearAllMocks();
  });

  it('should return default settings when storage is empty', async () => {
    const settings = await StorageService.getSettings();
    expect(settings.autoClaim).toBe(true);
    expect(settings.notifications).toBe(true);
    expect(settings.historySize).toBe(500);
  });

  it('should save and update partial settings', async () => {
    await StorageService.saveSettings({ autoClaim: false, sound: true });
    const settings = await StorageService.getSettings();
    expect(settings.autoClaim).toBe(false);
    expect(settings.sound).toBe(true);
    expect(settings.notifications).toBe(true); // default preserved
  });

  it('should add seen codes without duplicates', async () => {
    await StorageService.addSeenCode('code1');
    await StorageService.addSeenCode('code2');
    await StorageService.addSeenCode('code1');

    const seen = await StorageService.getSeenCodes();
    expect(seen).toEqual(['code1', 'code2']);
  });

  it('should update stats correctly on claim success and accumulate earnings', async () => {
    const result: ClaimResult = {
      code: 'TEST10',
      status: 'CLAIM_SUCCESS',
      amountValue: 12.50,
      timestamp: Date.now()
    };

    const stats = await StorageService.recordClaimResult(result);
    expect(stats.claimsAttempted).toBe(1);
    expect(stats.successful).toBe(1);
    expect(stats.totalEarnedUsd).toBe(12.50);
    expect(stats.failed).toBe(0);
  });

  it('should update stats correctly on expired code', async () => {
    const result: ClaimResult = {
      code: 'EXPIRED1',
      status: 'EXPIRED',
      timestamp: Date.now()
    };

    const stats = await StorageService.recordClaimResult(result);
    expect(stats.claimsAttempted).toBe(1);
    expect(stats.expired).toBe(1);
    expect(stats.successful).toBe(0);
  });

  it('should clear history and reset metrics', async () => {
    await StorageService.addSeenCode('code1');
    await StorageService.addClaimedCode('code1');
    await StorageService.clearHistory();

    const seen = await StorageService.getSeenCodes();
    const claimed = await StorageService.getClaimedCodes();
    const stats = await StorageService.getStats();

    expect(seen).toEqual([]);
    expect(claimed).toEqual([]);
    expect(stats.claimsAttempted).toBe(0);
  });
});
