import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/shared/constants.js';
import {
  cleanAmount,
  cleanClaimLimit,
  cleanRequirement,
  deduplicateCodes,
  isCodeAllowedByFilters,
  isNewCode,
  normalizeCode,
  parseAmountValue,
  parseBonusCodeElement,
  parseWagerRequirementValue
} from '../src/shared/parser.js';
import { BonusCode } from '../src/shared/types.js';

describe('Parser Utilities', () => {
  describe('normalizeCode', () => {
    it('should lowercase, trim and remove whitespace', () => {
      expect(normalizeCode('  StakeComBonus123  ')).toBe('stakecombonus123');
      expect(normalizeCode('STAKE DROP 2026')).toBe('stakedrop2026');
      expect(normalizeCode('"stake_quote"')).toBe('stake_quote');
      expect(normalizeCode("'single_quote'")).toBe('single_quote');
    });

    it('should handle empty or nullish strings gracefully', () => {
      expect(normalizeCode('')).toBe('');
      expect(normalizeCode('   ')).toBe('');
    });
  });

  describe('parseAmountValue & parseWagerRequirementValue', () => {
    it('should parse numeric float from amount strings', () => {
      expect(parseAmountValue('$12.50')).toBe(12.50);
      expect(parseAmountValue('10 USDT')).toBe(10);
      expect(parseAmountValue('$1,250.00')).toBe(1250);
      expect(parseAmountValue(undefined)).toBeUndefined();
    });

    it('should parse numeric float from wager requirement strings', () => {
      expect(parseWagerRequirementValue('Wager: $3,000 in 7 days')).toBe(3000);
      expect(parseWagerRequirementValue('$10,000 in past 7 days')).toBe(10000);
      expect(parseWagerRequirementValue(undefined)).toBeUndefined();
    });
  });

  describe('isCodeAllowedByFilters', () => {
    it('should allow all codes when thresholds are 0', () => {
      const code: BonusCode = {
        code: 'TEST',
        normalizedCode: 'test',
        amountValue: 0.5,
        wagerValue: 20000,
        detectedAt: Date.now()
      };
      const check = isCodeAllowedByFilters(code, DEFAULT_SETTINGS);
      expect(check.allowed).toBe(true);
    });

    it('should reject code if below minAmountThreshold', () => {
      const code: BonusCode = {
        code: 'SMALL',
        normalizedCode: 'small',
        amountValue: 1.0,
        detectedAt: Date.now()
      };
      const settings = { ...DEFAULT_SETTINGS, minAmountThreshold: 2.50 };
      const check = isCodeAllowedByFilters(code, settings);
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('below configured minimum threshold');
    });

    it('should reject code if above maxWagerThreshold', () => {
      const code: BonusCode = {
        code: 'HIGHROLLER',
        normalizedCode: 'highroller',
        wagerValue: 15000,
        detectedAt: Date.now()
      };
      const settings = { ...DEFAULT_SETTINGS, maxWagerThreshold: 5000 };
      const check = isCodeAllowedByFilters(code, settings);
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('exceeds configured maximum threshold');
    });
  });

  describe('cleanAmount & metadata', () => {
    it('should clean amount strings', () => {
      expect(cleanAmount('  $12.50  ')).toBe('$12.50');
      expect(cleanAmount(' 10   USDT ')).toBe('10 USDT');
      expect(cleanAmount(null)).toBeUndefined();
      expect(cleanAmount('')).toBeUndefined();
    });

    it('should clean requirement strings', () => {
      expect(cleanRequirement('  Wager: $3,000 in 7 days ')).toBe('Wager: $3,000 in 7 days');
      expect(cleanRequirement(null)).toBeUndefined();
    });

    it('should clean claim limit strings', () => {
      expect(cleanClaimLimit('  5000 users ')).toBe('5000 users');
      expect(cleanClaimLimit('')).toBeUndefined();
    });
  });

  describe('parseBonusCodeElement', () => {
    it('should parse standard bonus code item DOM element', () => {
      const container = document.createElement('div');
      container.className = 'bonus-code-item';
      container.innerHTML = `
        <div class="code-main">
          <span class="bonus-code-value">StakeComDrop50</span>
          <span class="bonus-code-amount">$25.00</span>
        </div>
        <div class="code-meta">
          <span class="bonus-code-req">Wager: $5,000 in 7 days</span>
          <span class="bonus-code-limit">2000 users</span>
          <span class="bonus-code-time">2m ago</span>
        </div>
      `;

      const parsed = parseBonusCodeElement(container);
      expect(parsed).not.toBeNull();
      expect(parsed?.code).toBe('StakeComDrop50');
      expect(parsed?.normalizedCode).toBe('stakecomdrop50');
      expect(parsed?.amount).toBe('$25.00');
      expect(parsed?.amountValue).toBe(25);
      expect(parsed?.requirement).toBe('Wager: $5,000 in 7 days');
      expect(parsed?.wagerValue).toBe(5000);
      expect(parsed?.claimLimit).toBe('2000 users');
      expect(parsed?.age).toBe('2m ago');
      expect(parsed?.detectedAt).toBeTypeOf('number');
    });

    it('should handle elements with missing metadata', () => {
      const container = document.createElement('div');
      container.className = 'bonus-code-item';
      container.innerHTML = `<span class="bonus-code-value">SparseCode99</span>`;

      const parsed = parseBonusCodeElement(container);
      expect(parsed).not.toBeNull();
      expect(parsed?.code).toBe('SparseCode99');
      expect(parsed?.normalizedCode).toBe('sparsecode99');
      expect(parsed?.amount).toBeUndefined();
      expect(parsed?.requirement).toBeUndefined();
    });

    it('should return null for non-code elements or invalid strings', () => {
      const emptyDiv = document.createElement('div');
      expect(parseBonusCodeElement(emptyDiv)).toBeNull();

      const headerDiv = document.createElement('div');
      headerDiv.innerHTML = `<span class="bonus-code-value">Bonus Code</span>`;
      expect(parseBonusCodeElement(headerDiv)).toBeNull();
    });
  });

  describe('isNewCode', () => {
    it('should correctly identify unseen codes', () => {
      const seen = new Set(['code1', 'code2']);
      const newCode: BonusCode = {
        code: 'CODE3',
        normalizedCode: 'code3',
        detectedAt: Date.now()
      };
      const oldCode: BonusCode = {
        code: 'Code1',
        normalizedCode: 'code1',
        detectedAt: Date.now()
      };

      expect(isNewCode(newCode, seen)).toBe(true);
      expect(isNewCode(oldCode, seen)).toBe(false);
    });

    it('should work with string arrays', () => {
      const seen = ['code1', 'code2'];
      expect(isNewCode('code3', seen)).toBe(true);
      expect(isNewCode('CODE1', seen)).toBe(false);
    });
  });

  describe('deduplicateCodes', () => {
    it('should remove duplicate codes preserving order', () => {
      const items: BonusCode[] = [
        { code: 'CodeA', normalizedCode: 'codea', detectedAt: 1 },
        { code: 'CodeB', normalizedCode: 'codeb', detectedAt: 2 },
        { code: 'codea', normalizedCode: 'codea', detectedAt: 3 },
        { code: 'CodeC', normalizedCode: 'codec', detectedAt: 4 }
      ];

      const result = deduplicateCodes(items);
      expect(result).toHaveLength(3);
      expect(result.map((i) => i.code)).toEqual(['CodeA', 'CodeB', 'CodeC']);
    });
  });
});
