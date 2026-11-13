/**
 * Escena animada del login: un archivo de documentos que se organiza.
 *
 * Los documentos reposan en abanico (como las hojas del logo); a medida que el
 * usuario completa el formulario se clasifican uno a uno y se alinean como lomos
 * de carpeta; al ingresar se abren en cuadrícula, como una biblioteca.
 *
 * Este módulo es PURO (sin DOM ni React): `buildSceneMarkup` recibe el estado de
 * la escena y devuelve el markup SVG de un fotograma. El componente
 * `LoginScene.tsx` se encarga del bucle de animación.
 */

export const SCENE_VIEWBOX = { width: 1440, height: 900 } as const;

export const DEFAULT_DOC_LABELS = [
  'Contrato',
  'Factura',
  'Acta',
  'Nómina',
  'Póliza',
  'Informe',
  'Certificado',
  'Orden de compra',
  'Hoja de vida',
] as const;

const BLUES = [
  '#004FBD',
  '#0061C5',
  '#0073CD',
  '#0088D6',
  '#009EE0',
  '#00AEE6',
  '#00BFEE',
  '#00CDF5',
  '#00DCFB',
] as const;

export interface SceneDoc {
  i: number;
  label: string;
  color: string;
  ink: string;
  /** 0 = en abanico, 1 = clasificado (lomo). Se anima hacia el objetivo. */
  mix: number;
  phase: number;
  lines: number[];
}

export interface SceneFrameInput {
  dark: boolean;
  /** 0..1 — qué tan completo está el formulario. */
  progress: number;
  /** Reloj de la animación en segundos (flotación y barrido de escaneo). */
  tt: number;
  /** Milisegundos desde que empezó el ingreso, o -1 si no está ingresando. */
  entering: number;
  /** delta del fotograma / 16.67 ms — hace la suavización independiente del fps. */
  dtScale: number;
  /** Salta directo al estado objetivo, sin transiciones (prefers-reduced-motion). */
  snap: boolean;
}

/** Etiqueta segura para ir dentro de un nodo <text> de SVG. */
function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

/** PRNG determinista: la escena se ve igual en cada carga (capturas estables). */
function makeRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function createSceneDocs(labels: readonly string[] = DEFAULT_DOC_LABELS): SceneDoc[] {
  const rnd = makeRandom(11);
  return BLUES.map((color, i) => ({
    i,
    label: labels[i] ?? DEFAULT_DOC_LABELS[i],
    color,
    ink: i >= 6 ? '#08305F' : '#FFFFFF',
    mix: 0,
    phase: rnd() * 6.28,
    lines: [0, 1, 2, 3, 4, 5, 6].map(() => 0.45 + rnd() * 0.55),
  }));
}

/** Progreso (0..1) a partir de lo escrito en el formulario. */
export function computeSceneProgress(email: string, password: string, complete: boolean): number {
  if (complete) return 1;
  return Math.min(email.trim().length / 16, 1) * 0.5 + Math.min(password.length / 8, 1) * 0.5;
}

const clamp = (v: number): number => Math.max(0, Math.min(1, v));
const ease = (u: number): number => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
const fmt = (v: number): string => v.toFixed(1);

function hexToRgb(x: string): [number, number, number] {
  return [parseInt(x.slice(1, 3), 16), parseInt(x.slice(3, 5), 16), parseInt(x.slice(5, 7), 16)];
}

/** Mezcla dos colores hex; k=0 → a, k=1 → b. */
export function mixColors(a: string, b: string, k: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`;
}

const PALETTE = {
  dark: {
    page: '#141E33',
    edge: '#253350',
    line: '#253350',
    lineHi: '#00CDF5',
    spine: '#1B2740',
    ring: 'rgba(234,241,255,.07)',
    fill: 'rgba(234,241,255,.025)',
    shadow: 'rgba(0,0,0,.45)',
    fold: '#1B3156',
  },
  light: {
    page: '#FFFFFF',
    edge: '#DCE4F0',
    line: '#E3EAF5',
    lineHi: '#00B8EC',
    spine: '#EEF3FA',
    ring: 'rgba(15,30,58,.07)',
    fill: 'rgba(15,30,58,.025)',
    shadow: 'rgba(11,42,91,.16)',
    fold: '#E9EFF8',
  },
} as const;

/**
 * Construye el SVG de un fotograma. Muta `doc.mix` (la suavización entre
 * abanico y lomo) — el estado entre fotogramas vive en los propios documentos.
 */
export function buildSceneMarkup(docs: SceneDoc[], input: SceneFrameInput): string {
  const { dark, progress, tt, entering: et, dtScale, snap } = input;
  const n = docs.length;
  const mag = progress * n;
  const C = dark ? PALETTE.dark : PALETTE.light;

  // posiciones: abanico (reposo), lomos ordenados (clasificados) y cuadrícula (ingreso)
  const PX = 1000;
  const PY = 900;
  const ge = et >= 0 ? ease(clamp(et / 900)) : 0;
  const smoothing = 1 - Math.pow(1 - 0.07, Math.max(dtScale, 0));

  const items = docs.map((d) => {
    const target = d.i < mag ? 1 : 0;
    d.mix = snap ? target : d.mix + (target - d.mix) * smoothing;
    const k = clamp(d.mix);

    const ang = -34 + d.i * 8.5 + 1.6 * Math.sin(tt * 0.6 + d.phase);
    const r = 470;
    const a = (ang * Math.PI) / 180;
    const fan = {
      x: PX + Math.sin(a) * r,
      y: PY - Math.cos(a) * r + 6 * Math.sin(tt * 0.8 + d.phase),
      rot: ang * 0.9,
      s: 0.92,
    };
    const spine = {
      x: 812 + d.i * 46,
      y: 470 - d.i * 9 + 3 * Math.sin(tt * 0.7 + d.phase),
      rot: 0,
      s: 1,
    };
    const col = d.i % 3;
    const row = Math.floor(d.i / 3);
    const grid = { x: 800 + col * 196, y: 250 + row * 210, rot: 0, s: 0.66 };

    const e = ease(k);
    let p = {
      x: lerp(fan.x, spine.x, e),
      y: lerp(fan.y, spine.y, e),
      rot: lerp(fan.rot, spine.rot, e),
      s: lerp(fan.s, spine.s, e),
    };
    const gk = et >= 0 ? ease(clamp((et - d.i * 40) / 760)) : 0;
    if (gk > 0) {
      p = {
        x: lerp(p.x, grid.x, gk),
        y: lerp(p.y, grid.y, gk),
        rot: lerp(p.rot, grid.rot, gk),
        s: lerp(p.s, grid.s, gk),
      };
    }
    const z = lerp(lerp(-Math.abs(d.i - 4), d.i, e), d.i, gk);
    return { d, k, p, z };
  });
  items.sort((x, y) => x.z - y.z);

  let out =
    `<defs><filter id="gs" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="${C.shadow}" flood-opacity="1"/></filter>` +
    '<linearGradient id="scan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#00D6F9" stop-opacity="0"/><stop offset="1" stop-color="#00D6F9" stop-opacity=".35"/></linearGradient></defs>';

  // círculo del logo, detrás del archivo
  const ringO = 1 - ge;
  out += `<circle cx="1010" cy="470" r="360" fill="${C.fill}" opacity="${fmt(ringO)}"/>`;
  out += `<circle cx="1010" cy="470" r="360" fill="none" stroke="${C.ring}" stroke-width="2" opacity="${fmt(ringO)}"/>`;

  // haz de escaneo: recorre la hoja frontal mientras está en reposo
  const scanY = (tt * 0.32) % 1;
  const W = 190;
  const H = 250;
  const x0 = -W / 2;
  const y0 = -H / 2;
  const sw = 40;

  for (const { d, k, p } of items) {
    let g = `<g transform="translate(${fmt(p.x)} ${fmt(p.y)}) rotate(${fmt(p.rot)}) scale(${p.s.toFixed(3)})" filter="url(#gs)">`;
    g += `<rect x="${x0}" y="${y0}" width="${W}" height="${H}" rx="14" fill="${C.page}" stroke="${C.edge}"/>`;

    // lomo: se colorea al clasificarse
    const spineCol = k > 0.02 ? mixColors(C.spine, d.color, k) : C.spine;
    g += `<path d="M${x0 + 14} ${y0} H${x0 + sw} V${y0 + H} H${x0 + 14} A14 14 0 0 1 ${x0} ${y0 + H - 14} V${y0 + 14} A14 14 0 0 1 ${x0 + 14} ${y0} Z" fill="${spineCol}"/>`;
    if (k > 0.05) {
      g += `<text transform="translate(${x0 + sw / 2 + 5} ${y0 + H - 18}) rotate(-90)" font-family="Poppins, sans-serif" font-size="13" font-weight="600" letter-spacing="1" fill="${d.ink}" opacity="${fmt(clamp((k - 0.3) / 0.5))}">${escapeXml(d.label.toUpperCase())}</text>`;
    }

    // esquina doblada
    g += `<path d="M${W / 2 - 30} ${y0} L${W / 2} ${y0 + 30} L${W / 2 - 30} ${y0 + 30} Z" fill="${C.fold}"/>`;

    // título y líneas de texto
    const front = d.i === 4 && k < 0.05 && et < 0;
    const sy = y0 + 30 + scanY * (H - 60);
    g += `<rect x="${x0 + sw + 16}" y="${y0 + 26}" width="${W - sw - 66}" height="10" rx="5" fill="${k > 0.5 ? d.color : C.line}" opacity="${k > 0.5 ? 0.9 : 1}"/>`;
    d.lines.forEach((w, li) => {
      const ly = y0 + 58 + li * 24;
      const lw = (W - sw - 34) * w;
      const hi = front && ly < sy;
      g += `<rect x="${x0 + sw + 16}" y="${ly}" width="${fmt(lw)}" height="7" rx="3.5" fill="${hi ? C.lineHi : C.line}" opacity="${hi ? 0.7 : 1}"/>`;
    });
    if (front) {
      g += `<rect x="${x0 + sw}" y="${fmt(sy - 40)}" width="${W - sw}" height="40" fill="url(#scan)"/><rect x="${x0 + sw + 4}" y="${fmt(sy - 1.5)}" width="${W - sw - 8}" height="3" rx="1.5" fill="#00D6F9"/>`;
    }

    // sello de clasificado
    if (k > 0.05) {
      const o = clamp((k - 0.4) / 0.6);
      g += `<g transform="translate(${W / 2 - 28} ${y0 + H - 28}) scale(${fmt(0.6 + 0.4 * o)})" opacity="${fmt(o)}"><circle r="13" fill="${d.color}"/><path d="M-5.5 0.5 L-1.5 4.5 L6 -4" fill="none" stroke="${d.ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g>`;
    }
    g += '</g>';
    out += g;
  }
  return out;
}
