import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';

export const IDLE_TIMEOUT_MS = 30 * 60 * 1_000; // 30 minutes
export const WARN_BEFORE_MS = 2 * 60 * 1_000; // warn 2 min before logout

const WARN_TOAST_ID = 'sgd-idle-warning';
const IDLE_FLAG_KEY = 'sgd-idle-logout';

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'pointerdown', 'touchstart', 'scroll'] as const;

/**
 * Monitors user inactivity and performs an automatic logout after IDLE_TIMEOUT_MS.
 * A dismissable warning toast appears WARN_BEFORE_MS before the cutoff.
 * Any user activity (mouse, keyboard, touch, scroll) resets the timer.
 * Logout is broadcast to other open tabs via BroadcastChannel('sgd-session').
 *
 * Mount this hook in the authenticated layout so it is active only while the
 * user has an active session and is automatically cleaned up on logout.
 */
export function useIdleTimeout() {
  const { t } = useTranslation();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();

  // Keep the latest `t` reference accessible inside timer callbacks without
  // forcing those callbacks to be recreated on every language change.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const warningTimerId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningVisible = useRef(false);
  const scheduleRef = useRef<(() => void) | null>(null);

  const doLogout = useCallback(() => {
    toast.dismiss(WARN_TOAST_ID);
    warningVisible.current = false;
    try {
      localStorage.setItem(IDLE_FLAG_KEY, '1');
    } catch {
      // storage unavailable — login page banner is best-effort
    }
    clearAuth();
    void navigate({ to: '/login', replace: true });
  }, [clearAuth, navigate]);

  const schedule = useCallback(() => {
    if (warningTimerId.current) clearTimeout(warningTimerId.current);
    if (logoutTimerId.current) clearTimeout(logoutTimerId.current);

    if (warningVisible.current) {
      toast.dismiss(WARN_TOAST_ID);
      warningVisible.current = false;
    }

    warningTimerId.current = setTimeout(() => {
      warningVisible.current = true;
      toast.warning(tRef.current('session.idleWarning'), {
        id: WARN_TOAST_ID,
        duration: Infinity,
        description: tRef.current('session.idleWarningDescription'),
        action: {
          label: tRef.current('session.stayLoggedIn'),
          onClick: () => scheduleRef.current?.(),
        },
      });

      logoutTimerId.current = setTimeout(() => {
        // Notify other open tabs so they log out too
        try {
          const bc = new BroadcastChannel('sgd-session');
          bc.postMessage({ type: 'sgd:idle-logout' });
          bc.close();
        } catch {
          // BroadcastChannel not supported — logout is local only
        }
        doLogout();
      }, WARN_BEFORE_MS);
    }, IDLE_TIMEOUT_MS - WARN_BEFORE_MS);
  }, [doLogout]);

  useEffect(() => {
    scheduleRef.current = schedule;
  }, [schedule]);

  useEffect(() => {
    schedule();

    const handleActivity = () => schedule();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));

    // Handle idle-logout sent from another tab
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('sgd-session');
      bc.onmessage = (e: MessageEvent<{ type: string }>) => {
        if (e.data.type === 'sgd:idle-logout') doLogout();
      };
    } catch {
      // BroadcastChannel not supported (Safari < 15.4, some WebViews)
    }

    return () => {
      if (warningTimerId.current) clearTimeout(warningTimerId.current);
      if (logoutTimerId.current) clearTimeout(logoutTimerId.current);
      toast.dismiss(WARN_TOAST_ID);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, handleActivity));
      bc?.close();
    };
  }, [schedule, doLogout]);
}
