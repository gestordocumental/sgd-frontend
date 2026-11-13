import { describe, it, expect } from 'vitest';
import {
  buildSceneMarkup,
  computeSceneProgress,
  createSceneDocs,
  mixColors,
  type SceneFrameInput,
} from '../login-scene';

const base: SceneFrameInput = {
  dark: false,
  progress: 0,
  tt: 0,
  entering: -1,
  dtScale: 1,
  snap: true,
};

describe('computeSceneProgress', () => {
  it('is 0 for an empty form', () => {
    expect(computeSceneProgress('', '', false)).toBe(0);
  });

  it('grows with what the user types and caps each field at its own half', () => {
    expect(computeSceneProgress('a'.repeat(16), '', false)).toBeCloseTo(0.5);
    expect(computeSceneProgress('', 'x'.repeat(8), false)).toBeCloseTo(0.5);
    expect(computeSceneProgress('a'.repeat(100), 'x'.repeat(100), false)).toBeCloseTo(1);
  });

  it('ignores surrounding whitespace in the email', () => {
    expect(computeSceneProgress('   ', '', false)).toBe(0);
  });

  it('is 1 once the form is complete, whatever was typed', () => {
    expect(computeSceneProgress('a@b.co', 'x', true)).toBe(1);
  });
});

describe('createSceneDocs', () => {
  it('creates 9 documents and is deterministic between calls', () => {
    const a = createSceneDocs();
    const b = createSceneDocs();
    expect(a).toHaveLength(9);
    expect(a.map((d) => d.phase)).toEqual(b.map((d) => d.phase));
    expect(a.map((d) => d.lines)).toEqual(b.map((d) => d.lines));
  });

  it('uses the supplied labels and falls back to the defaults for missing ones', () => {
    const docs = createSceneDocs(['Uno', 'Dos']);
    expect(docs[0].label).toBe('Uno');
    expect(docs[1].label).toBe('Dos');
    expect(docs[2].label).toBe('Acta');
  });
});

describe('buildSceneMarkup', () => {
  it('draws one group per document plus the defs', () => {
    const svg = buildSceneMarkup(createSceneDocs(), base);
    expect(svg.startsWith('<defs>')).toBe(true);
    expect(svg.match(/filter="url\(#gs\)"/g)).toHaveLength(9);
  });

  it('is deterministic for the same input (stable screenshots)', () => {
    const a = buildSceneMarkup(createSceneDocs(), { ...base, progress: 0.4 });
    const b = buildSceneMarkup(createSceneDocs(), { ...base, progress: 0.4 });
    expect(a).toBe(b);
  });

  it('uses the dark palette in dark mode', () => {
    const light = buildSceneMarkup(createSceneDocs(), base);
    const dark = buildSceneMarkup(createSceneDocs(), { ...base, dark: true });
    expect(light).toContain('fill="#FFFFFF"');
    expect(dark).toContain('fill="#141E33"');
    expect(dark).not.toContain('fill="#FFFFFF"');
  });

  it('only labels the spines of documents that have been classified', () => {
    const idle = buildSceneMarkup(createSceneDocs(), { ...base, progress: 0 });
    expect(idle).not.toContain('<text');

    const half = buildSceneMarkup(createSceneDocs(), { ...base, progress: 0.5 });
    // 0.5 * 9 = 4.5 → documents 0..4 are classified
    expect(half.match(/<text /g)).toHaveLength(5);

    const full = buildSceneMarkup(createSceneDocs(), { ...base, progress: 1 });
    expect(full.match(/<text /g)).toHaveLength(9);
    expect(full).toContain('CONTRATO');
  });

  it('escapes XML special characters in translated labels', () => {
    const docs = createSceneDocs(['<b>&"x"</b>']);
    const svg = buildSceneMarkup(docs, { ...base, progress: 1 });
    expect(svg).toContain('&lt;B&gt;&amp;&quot;X&quot;&lt;/B&gt;');
    expect(svg).not.toContain('<b>');
  });

  it('moves the documents to the grid and fades the logo ring while entering', () => {
    const resting = buildSceneMarkup(createSceneDocs(), { ...base, progress: 1 });
    const entered = buildSceneMarkup(createSceneDocs(), { ...base, progress: 1, entering: 10_000 });
    expect(entered).not.toBe(resting);
    // el círculo del logo desaparece una vez abierta la cuadrícula
    expect(entered).toContain('opacity="0.0"');
    expect(resting).toContain('opacity="1.0"');
  });

  it('eases `mix` towards the target when not snapping, and jumps when snapping', () => {
    const eased = createSceneDocs();
    buildSceneMarkup(eased, { ...base, progress: 1, snap: false, dtScale: 1 });
    expect(eased[0].mix).toBeGreaterThan(0);
    expect(eased[0].mix).toBeLessThan(1);

    const snapped = createSceneDocs();
    buildSceneMarkup(snapped, { ...base, progress: 1, snap: true });
    expect(snapped.every((d) => d.mix === 1)).toBe(true);
  });
});

describe('mixColors', () => {
  it('returns the endpoints at k=0 and k=1', () => {
    expect(mixColors('#000000', '#ffffff', 0)).toBe('rgb(0,0,0)');
    expect(mixColors('#000000', '#ffffff', 1)).toBe('rgb(255,255,255)');
    expect(mixColors('#000000', '#ffffff', 0.5)).toBe('rgb(128,128,128)');
  });
});
