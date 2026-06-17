import { describe, it, expect, beforeEach } from 'vitest';
import {
  readState,
  recordFailure,
  recordSuccess,
  isLocked,
  secondsRemaining,
  FAIL_LOCK_THRESHOLD,
  WARN_THRESHOLD,
  LOCK_DURATION_MS,
} from '../login-throttle';

const STORAGE_KEY = 'sgd-login-throttle';

describe('login-throttle', () => {
  beforeEach(() => sessionStorage.clear());

  // ── readState ──────────────────────────────────────────────────────────────

  describe('readState', () => {
    it('returns zeroed state when storage is empty', () => {
      expect(readState()).toEqual({ count: 0, lockedUntil: 0 });
    });

    it('returns stored state when valid and not locked', () => {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ count: 3, lockedUntil: 0 }));
      expect(readState()).toEqual({ count: 3, lockedUntil: 0 });
    });

    it('returns stored state when currently locked', () => {
      const lockedUntil = Date.now() + 30_000;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ count: 5, lockedUntil }));
      const state = readState();
      expect(state.count).toBe(5);
      expect(state.lockedUntil).toBe(lockedUntil);
    });

    it('auto-resets and persists the reset when lockout has expired', () => {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ count: 5, lockedUntil: Date.now() - 1_000 }),
      );
      expect(readState()).toEqual({ count: 0, lockedUntil: 0 });
      // The reset must also be written back to sessionStorage
      expect(JSON.parse(sessionStorage.getItem(STORAGE_KEY)!)).toEqual({
        count: 0,
        lockedUntil: 0,
      });
    });

    it('returns zeroed state for malformed JSON in storage', () => {
      sessionStorage.setItem(STORAGE_KEY, 'not-valid-json');
      expect(readState()).toEqual({ count: 0, lockedUntil: 0 });
    });

    it('fills missing fields with defaults when the stored object is incomplete', () => {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({}));
      expect(readState()).toEqual({ count: 0, lockedUntil: 0 });
    });
  });

  // ── recordFailure ──────────────────────────────────────────────────────────

  describe('recordFailure', () => {
    it('increments count from 0 to 1 on first failure', () => {
      const state = recordFailure();
      expect(state.count).toBe(1);
      expect(state.lockedUntil).toBe(0);
    });

    it('accumulates consecutive failures without locking', () => {
      recordFailure();
      recordFailure();
      const state = recordFailure();
      expect(state.count).toBe(3);
      expect(state.lockedUntil).toBe(0);
    });

    it(`sets lockedUntil ~${LOCK_DURATION_MS / 1000}s ahead when count reaches ${FAIL_LOCK_THRESHOLD}`, () => {
      for (let i = 0; i < FAIL_LOCK_THRESHOLD - 1; i++) recordFailure();
      const before = Date.now();
      const state = recordFailure();
      const after = Date.now();

      expect(state.count).toBe(FAIL_LOCK_THRESHOLD);
      expect(state.lockedUntil).toBeGreaterThanOrEqual(before + LOCK_DURATION_MS - 5);
      expect(state.lockedUntil).toBeLessThanOrEqual(after + LOCK_DURATION_MS + 5);
    });

    it('persists the new state to sessionStorage after each call', () => {
      recordFailure();
      recordFailure();
      const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY)!) as { count: number };
      expect(stored.count).toBe(2);
    });
  });

  // ── recordSuccess ──────────────────────────────────────────────────────────

  describe('recordSuccess', () => {
    it('resets count to 0 after failures', () => {
      recordFailure();
      recordFailure();
      recordSuccess();
      expect(readState()).toEqual({ count: 0, lockedUntil: 0 });
    });

    it('clears an active lockout', () => {
      for (let i = 0; i < FAIL_LOCK_THRESHOLD; i++) recordFailure();
      expect(isLocked(readState())).toBe(true);
      recordSuccess();
      expect(readState()).toEqual({ count: 0, lockedUntil: 0 });
    });
  });

  // ── isLocked ───────────────────────────────────────────────────────────────

  describe('isLocked', () => {
    it('returns false when lockedUntil is 0', () => {
      expect(isLocked({ count: 3, lockedUntil: 0 })).toBe(false);
    });

    it('returns true when lockedUntil is in the future', () => {
      expect(isLocked({ count: 5, lockedUntil: Date.now() + 10_000 })).toBe(true);
    });

    it('returns false when lockedUntil is in the past', () => {
      expect(isLocked({ count: 5, lockedUntil: Date.now() - 1 })).toBe(false);
    });
  });

  // ── secondsRemaining ───────────────────────────────────────────────────────

  describe('secondsRemaining', () => {
    it('returns 0 when not locked', () => {
      expect(secondsRemaining({ count: 0, lockedUntil: 0 })).toBe(0);
    });

    it('returns the ceiling of remaining seconds when locked', () => {
      const remaining = secondsRemaining({ count: 5, lockedUntil: Date.now() + 30_000 });
      expect(remaining).toBeGreaterThan(29);
      expect(remaining).toBeLessThanOrEqual(30);
    });

    it('returns 0 when lockout has just expired', () => {
      expect(secondsRemaining({ count: 5, lockedUntil: Date.now() - 1 })).toBe(0);
    });
  });

  // ── constants ──────────────────────────────────────────────────────────────

  describe('exported constants', () => {
    it(`FAIL_LOCK_THRESHOLD is ${FAIL_LOCK_THRESHOLD}`, () => expect(FAIL_LOCK_THRESHOLD).toBe(5));
    it(`WARN_THRESHOLD is ${WARN_THRESHOLD}`, () => expect(WARN_THRESHOLD).toBe(3));
    it(`LOCK_DURATION_MS is ${LOCK_DURATION_MS}`, () => expect(LOCK_DURATION_MS).toBe(30_000));
  });
});
