import { useEffect, useMemo, useRef } from 'react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { SCENE_VIEWBOX, buildSceneMarkup, createSceneDocs, type SceneDoc } from './login-scene';

interface LoginSceneProps {
  /** 0..1 — qué tan completo está el formulario. */
  progress: number;
  /** `true` cuando el login ya fue aceptado y se está abriendo el espacio de trabajo. */
  entering: boolean;
  dark: boolean;
  /** Etiquetas de los lomos (traducidas). Si faltan, se usan las de por defecto. */
  labels?: readonly string[];
}

/** Por debajo de este ancho la escena está oculta por CSS: no se anima. */
const SCENE_MIN_WIDTH = 900;

/**
 * Fondo animado del login. Decorativo (`aria-hidden`).
 *
 * Con `prefers-reduced-motion` se dibuja UN fotograma estático que sólo se
 * redibuja cuando cambian los datos (progreso, ingreso, tema) — sin bucle.
 */
export function LoginScene({ progress, entering, dark, labels }: LoginSceneProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const reduced = usePrefersReducedMotion();
  const live = useRef({ progress, entering, dark });

  // El bucle lee siempre el último valor sin reiniciarse en cada tecla.
  useEffect(() => {
    live.current = { progress, entering, dark };
  }, [progress, entering, dark]);

  const labelsKey = labels?.join('|') ?? '';
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `labelsKey` representa el contenido de `labels`
  const docs: SceneDoc[] = useMemo(() => createSceneDocs(labels), [labelsKey]);

  // Modo animado
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || reduced) return;

    let raf = 0;
    let last = 0;
    let tt = 0;
    let enterStart: number | null = null;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (window.innerWidth <= SCENE_MIN_WIDTH) return;

      const dt = last ? Math.min(now - last, 64) : 16;
      last = now;
      tt += dt / 1000;

      const cur = live.current;
      if (cur.entering) enterStart ??= now;
      else enterStart = null;

      try {
        svg.innerHTML = buildSceneMarkup(docs, {
          dark: cur.dark,
          progress: cur.progress,
          tt,
          entering: enterStart === null ? -1 : now - enterStart,
          dtScale: dt / 16.67,
          snap: false,
        });
      } catch {
        // un fotograma fallido no debe matar el bucle de animación
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [docs, reduced]);

  // Modo reducido: un fotograma estático, redibujado sólo al cambiar los datos.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !reduced) return;
    svg.innerHTML = buildSceneMarkup(docs, {
      dark,
      progress,
      tt: 0,
      entering: entering ? 10_000 : -1,
      dtScale: 1,
      snap: true,
    });
  }, [docs, reduced, dark, progress, entering]);

  return (
    <div className="gd-login-stage" aria-hidden="true">
      <svg
        ref={svgRef}
        className="gd-login-scene"
        viewBox={`0 0 ${SCENE_VIEWBOX.width} ${SCENE_VIEWBOX.height}`}
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      />
    </div>
  );
}
