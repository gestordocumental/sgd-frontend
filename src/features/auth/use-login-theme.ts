import { useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

/** Clave compartida con las demás apps Helisa. */
export const LOGIN_THEME_KEY = 'helisa-theme-gestor';

export type LoginTheme = 'light' | 'dark';

function readTheme(): LoginTheme {
  try {
    return localStorage.getItem(LOGIN_THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function writeTheme(theme: LoginTheme): void {
  try {
    localStorage.setItem(LOGIN_THEME_KEY, theme);
  } catch {
    // almacenamiento no disponible (modo privado / cuota): el tema sólo vive en memoria
  }
}

/**
 * Modo claro/oscuro SOLO de la pantalla de login.
 *
 * No toca `document.documentElement`: el resto de la app aún no tiene modo
 * oscuro, así que la preferencia termina al salir del login. Se persiste bajo
 * la clave compartida con las otras apps Helisa.
 */
export function useLoginTheme() {
  const [theme, setTheme] = useState<LoginTheme>(readTheme);

  // Si otra pestaña/app cambia la preferencia, la seguimos.
  useEffect(() => {
    const sync = () => setTheme(readTheme());
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  /**
   * Alterna el tema. Si el navegador soporta View Transitions (y no se pidió
   * reducir el movimiento) el cambio se revela como un círculo que crece desde
   * el botón que se pulsó.
   */
  const toggle = useCallback(
    (trigger?: HTMLElement | null) => {
      const next: LoginTheme = theme === 'dark' ? 'light' : 'dark';
      writeTheme(next);

      const reduce =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const doc = document as Document & {
        startViewTransition?: (cb: () => void) => {
          ready: Promise<void>;
          finished: Promise<void>;
        };
      };

      if (!doc.startViewTransition || reduce) {
        setTheme(next);
        return;
      }

      const rect = trigger?.getBoundingClientRect();
      const x = rect ? rect.left + rect.width / 2 : window.innerWidth;
      const y = rect ? rect.top + rect.height / 2 : 0;
      const radius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      );
      const root = document.documentElement;
      root.classList.add('gd-vt-run');

      const vt = doc.startViewTransition(() => {
        flushSync(() => setTheme(next));
      });
      vt.ready
        .then(() => {
          root.animate(
            {
              clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
            },
            {
              duration: 750,
              easing: 'cubic-bezier(.65,0,.25,1)',
              pseudoElement: '::view-transition-new(root)',
            },
          );
        })
        .catch(() => {});
      void vt.finished.finally(() => root.classList.remove('gd-vt-run'));
    },
    [theme],
  );

  return { theme, isDark: theme === 'dark', toggle };
}
