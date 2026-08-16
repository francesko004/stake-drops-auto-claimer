import { beforeEach, describe, expect, it } from 'vitest';
import { StakeDetector } from '../src/content/stake-detector.js';

describe('StakeDetector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.title = 'Stake Casino';
  });

  describe('detectSecurityChallenge', () => {
    it('should detect Cloudflare turnstile element', () => {
      const challengeEl = document.createElement('div');
      challengeEl.className = 'cf-turnstile';
      // Mock dimensions
      Object.defineProperty(challengeEl, 'getBoundingClientRect', {
        value: () => ({ width: 300, height: 65 })
      });
      document.body.appendChild(challengeEl);

      const res = StakeDetector.detectSecurityChallenge();
      expect(res.hasChallenge).toBe(true);
    });

    it('should detect challenge by page title', () => {
      document.title = 'Just a moment... | Cloudflare';
      const res = StakeDetector.detectSecurityChallenge();
      expect(res.hasChallenge).toBe(true);
    });

    it('should return false for normal page', () => {
      const normalDiv = document.createElement('div');
      normalDiv.innerHTML = '<p>Welcome to Stake</p>';
      document.body.appendChild(normalDiv);

      const res = StakeDetector.detectSecurityChallenge();
      expect(res.hasChallenge).toBe(false);
    });
  });

  describe('findBonusCodeInput', () => {
    it('should find input by data-testid or placeholder', () => {
      const form = document.createElement('div');
      form.innerHTML = `
        <div role="dialog">
          <input type="text" placeholder="Enter Bonus Code" data-testid="bonus-code-input" />
        </div>
      `;
      document.body.appendChild(form);

      const input = form.querySelector('input')!;
      Object.defineProperty(input, 'getBoundingClientRect', {
        value: () => ({ width: 200, height: 40 })
      });

      const found = StakeDetector.findBonusCodeInput();
      expect(found).not.toBeNull();
      expect(found).toBe(input);
    });

    it('should ignore password or number inputs', () => {
      const form = document.createElement('div');
      form.innerHTML = `
        <input type="password" placeholder="bonus code" />
        <input type="number" placeholder="bonus amount" />
      `;
      document.body.appendChild(form);

      const found = StakeDetector.findBonusCodeInput();
      expect(found).toBeNull();
    });
  });

  describe('findClaimButton', () => {
    it('should find Claim button within modal or form', () => {
      const modal = document.createElement('div');
      modal.setAttribute('role', 'dialog');
      modal.innerHTML = `
        <input type="text" data-testid="bonus-code-input" />
        <button data-testid="claim-button">Claim</button>
      `;
      document.body.appendChild(modal);

      const btn = modal.querySelector('button')!;
      Object.defineProperty(btn, 'getBoundingClientRect', {
        value: () => ({ width: 100, height: 35 })
      });

      const found = StakeDetector.findClaimButton();
      expect(found).not.toBeNull();
      expect(found?.textContent).toBe('Claim');
    });
  });

  describe('classifyTextResult', () => {
    it('should identify CLAIM_SUCCESS', () => {
      expect(StakeDetector.classifyTextResult('Bonus has been claimed successfully!').status).toBe('CLAIM_SUCCESS');
      expect(StakeDetector.classifyTextResult('Congratulations, reward credited').status).toBe('CLAIM_SUCCESS');
    });

    it('should identify ALREADY_CLAIMED', () => {
      expect(StakeDetector.classifyTextResult('You have already claimed this bonus').status).toBe('ALREADY_CLAIMED');
      expect(StakeDetector.classifyTextResult('Code already used on your account').status).toBe('ALREADY_CLAIMED');
    });

    it('should identify EXPIRED', () => {
      expect(StakeDetector.classifyTextResult('This bonus drop has expired').status).toBe('EXPIRED');
    });

    it('should identify CLAIM_LIMIT_REACHED', () => {
      expect(StakeDetector.classifyTextResult('Claim limit reached. All bonuses claimed.').status).toBe('CLAIM_LIMIT_REACHED');
    });

    it('should identify INVALID_CODE', () => {
      expect(StakeDetector.classifyTextResult('Bonus code not found').status).toBe('INVALID_CODE');
    });

    it('should identify REQUIREMENT_NOT_MET', () => {
      expect(StakeDetector.classifyTextResult('Wager requirement not met ($3,000 required in past 7 days)').status).toBe('REQUIREMENT_NOT_MET');
    });

    it('should identify LOGIN_REQUIRED', () => {
      expect(StakeDetector.classifyTextResult('Please log in to claim this drop').status).toBe('LOGIN_REQUIRED');
    });
  });

  describe('findDismissButton & dismissActiveDialog', () => {
    it('should find dismiss button by data-testid or text', () => {
      const modal = document.createElement('div');
      modal.setAttribute('role', 'dialog');
      modal.innerHTML = `
        <p>Bonus Claimed!</p>
        <button data-testid="modal-close">Close</button>
      `;
      document.body.appendChild(modal);

      const btn = modal.querySelector('button')!;
      Object.defineProperty(btn, 'getBoundingClientRect', {
        value: () => ({ width: 80, height: 30 })
      });

      const found = StakeDetector.findDismissButton();
      expect(found).not.toBeNull();
      expect(found).toBe(btn);

      let clicked = false;
      btn.onclick = () => { clicked = true; };
      const dismissed = StakeDetector.dismissActiveDialog();
      expect(dismissed).toBe(true);
      expect(clicked).toBe(true);
    });

    it('should recognize dismiss button candidates by keywords', () => {
      const btn = document.createElement('button');
      btn.textContent = 'Got it';
      Object.defineProperty(btn, 'getBoundingClientRect', {
        value: () => ({ width: 80, height: 30 })
      });
      document.body.appendChild(btn);

      expect(StakeDetector.isDismissButtonCandidate(btn)).toBe(true);
    });
  });
});
