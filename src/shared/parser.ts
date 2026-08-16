/**
 * DOM parsing and text normalization utilities for StakeCruncher bonus codes.
 */

import { STAKECRUNCHER_SELECTORS } from './constants.js';
import { BonusCode, ExtensionSettings } from './types.js';

/**
 * Normalizes a bonus code string for consistent deduplication and lookups.
 * Lowercases and removes whitespace and wrapping punctuation.
 */
export function normalizeCode(rawCode: string): string {
  if (!rawCode) return '';
  return rawCode
    .trim()
    .toLowerCase()
    .replace(/^["'`]|["'`]$/g, '')
    .replace(/\s+/g, '');
}

/**
 * Cleans up and standardizes an amount string.
 */
export function cleanAmount(rawAmount?: string | null): string | undefined {
  if (!rawAmount) return undefined;
  const trimmed = rawAmount.trim().replace(/\s+/g, ' ');
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Extracts a numerical float value from an amount string (e.g. "$12.50" -> 12.50, "10 USDT" -> 10.00).
 */
export function parseAmountValue(amountStr?: string | null): number | undefined {
  if (!amountStr) return undefined;
  const match = amountStr.replace(/,/g, '').match(/[\d]+(?:\.[\d]+)?/);
  if (match) {
    const val = parseFloat(match[0]);
    return isNaN(val) ? undefined : val;
  }
  return undefined;
}

/**
 * Cleans up requirement string (e.g. "Wager: $3,000 in 7 days").
 */
export function cleanRequirement(rawReq?: string | null): string | undefined {
  if (!rawReq) return undefined;
  const trimmed = rawReq.trim().replace(/\s+/g, ' ');
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Extracts the numeric wagering requirement from a requirement string (e.g. "$3,000 in 7 days" -> 3000).
 */
export function parseWagerRequirementValue(reqStr?: string | null): number | undefined {
  if (!reqStr) return undefined;
  const match = reqStr.replace(/,/g, '').match(/(?:wager[:\s]*)?\$?([\d]+(?:\.[\d]+)?)/i);
  if (match && match[1]) {
    const val = parseFloat(match[1]);
    return isNaN(val) ? undefined : val;
  }
  return undefined;
}

/**
 * Cleans up claimant limit string (e.g. "5000 users").
 */
export function cleanClaimLimit(rawLimit?: string | null): string | undefined {
  if (!rawLimit) return undefined;
  const trimmed = rawLimit.trim().replace(/\s+/g, ' ');
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Cleans up age indicator string (e.g. "2m ago", "Just now").
 */
export function cleanAge(rawAge?: string | null): string | undefined {
  if (!rawAge) return undefined;
  const trimmed = rawAge.trim().replace(/\s+/g, ' ');
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Parses a single DOM element (such as `.bonus-code-item`) into a typed BonusCode object.
 */
export function parseBonusCodeElement(element: Element): BonusCode | null {
  if (!element) return null;

  // 1. Locate the code text
  let rawCode = '';
  const codeEl = element.querySelector(STAKECRUNCHER_SELECTORS.CODE_VALUE);
  if (codeEl && codeEl.textContent) {
    rawCode = codeEl.textContent.trim();
  } else {
    // Fallback: check data attributes or direct text
    const dataCode = element.getAttribute('data-code') || element.getAttribute('data-bonus-code');
    if (dataCode) {
      rawCode = dataCode.trim();
    } else {
      // Direct text inspection
      const firstLine = (element.textContent || '').trim().split('\n')[0] || '';
      rawCode = firstLine.trim();
    }
  }

  // Filter out headers, placeholders or empty strings
  if (!rawCode || rawCode.length < 2 || rawCode.toLowerCase().includes('bonus code')) {
    return null;
  }

  // Sanitize code (strip copy icons or extra whitespace while preserving original casing)
  const cleanCode = rawCode.replace(/^(Code:\s*)/i, '').trim();
  const normalized = normalizeCode(cleanCode);
  if (!normalized) return null;

  // 2. Extract metadata
  const amountEl = element.querySelector(STAKECRUNCHER_SELECTORS.AMOUNT);
  const reqEl = element.querySelector(STAKECRUNCHER_SELECTORS.REQUIREMENT);
  const limitEl = element.querySelector(STAKECRUNCHER_SELECTORS.CLAIM_LIMIT);
  const timeEl = element.querySelector(STAKECRUNCHER_SELECTORS.TIME);

  const amount = cleanAmount(amountEl ? amountEl.textContent : element.getAttribute('data-amount'));
  const requirement = cleanRequirement(reqEl ? reqEl.textContent : element.getAttribute('data-req'));
  const claimLimit = cleanClaimLimit(limitEl ? limitEl.textContent : element.getAttribute('data-limit'));
  const age = cleanAge(timeEl ? timeEl.textContent : element.getAttribute('data-time'));

  return {
    code: cleanCode,
    normalizedCode: normalized,
    amount,
    amountValue: parseAmountValue(amount),
    requirement,
    wagerValue: parseWagerRequirementValue(requirement),
    claimLimit,
    age,
    detectedAt: Date.now()
  };
}

/**
 * Validates whether a detected bonus code satisfies user-configured smart threshold filters.
 */
export function isCodeAllowedByFilters(
  code: BonusCode,
  settings: ExtensionSettings
): { allowed: boolean; reason?: string } {
  // Check Minimum Bonus Amount Filter
  if (settings.minAmountThreshold > 0 && code.amountValue !== undefined) {
    if (code.amountValue < settings.minAmountThreshold) {
      return {
        allowed: false,
        reason: `Bonus value ($${code.amountValue}) is below configured minimum threshold ($${settings.minAmountThreshold})`
      };
    }
  }

  // Check Maximum Wager Requirement Filter
  if (settings.maxWagerThreshold > 0 && code.wagerValue !== undefined) {
    if (code.wagerValue > settings.maxWagerThreshold) {
      return {
        allowed: false,
        reason: `Wager requirement ($${code.wagerValue}) exceeds configured maximum threshold ($${settings.maxWagerThreshold})`
      };
    }
  }

  return { allowed: true };
}

/**
 * Checks if a code is new given a collection of seen normalized codes.
 */
export function isNewCode(
  code: BonusCode | string,
  seenNormalizedCodes: Set<string> | string[]
): boolean {
  const norm = typeof code === 'string' ? normalizeCode(code) : code.normalizedCode;
  if (!norm) return false;

  if (seenNormalizedCodes instanceof Set) {
    return !seenNormalizedCodes.has(norm);
  }
  return !seenNormalizedCodes.includes(norm);
}

/**
 * Deduplicates an array of BonusCode objects preserving the first occurrence.
 */
export function deduplicateCodes(codes: BonusCode[]): BonusCode[] {
  const seen = new Set<string>();
  const unique: BonusCode[] = [];

  for (const item of codes) {
    if (!seen.has(item.normalizedCode)) {
      seen.add(item.normalizedCode);
      unique.push(item);
    }
  }

  return unique;
}
