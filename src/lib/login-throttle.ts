const STORAGE_KEY = 'sgd-login-throttle';

export const FAIL_LOCK_THRESHOLD = 5;
export const WARN_THRESHOLD = 3;
export const LOCK_DURATION_MS = 30_000;

export interface LoginThrottleState {
  count: number;
  lockedUntil: number; // epoch ms; 0 = not locked
}

function writeState(state: LoginThrottleState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // unavailable (private mode / quota) — best effort
  }
}

export function readState(): LoginThrottleState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { count: 0, lockedUntil: 0 };
    const parsed = JSON.parse(raw) as LoginThrottleState;
    const state: LoginThrottleState = {
      count: parsed.count ?? 0,
      lockedUntil: parsed.lockedUntil ?? 0,
    };
    // Auto-reset after lockout period passes so users get a clean slate
    if (state.lockedUntil > 0 && state.lockedUntil <= Date.now()) {
      const reset = { count: 0, lockedUntil: 0 };
      writeState(reset);
      return reset;
    }
    return state;
  } catch {
    return { count: 0, lockedUntil: 0 };
  }
}

export function recordFailure(): LoginThrottleState {
  const current = readState();
  const count = current.count + 1;
  const lockedUntil = count >= FAIL_LOCK_THRESHOLD ? Date.now() + LOCK_DURATION_MS : 0;
  const next: LoginThrottleState = { count, lockedUntil };
  writeState(next);
  return next;
}

export function recordSuccess(): void {
  writeState({ count: 0, lockedUntil: 0 });
}

export function isLocked(state: LoginThrottleState): boolean {
  return state.lockedUntil > Date.now();
}

export function secondsRemaining(state: LoginThrottleState): number {
  if (!isLocked(state)) return 0;
  return Math.ceil((state.lockedUntil - Date.now()) / 1000);
}
