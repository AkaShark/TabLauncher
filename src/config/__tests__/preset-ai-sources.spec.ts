import { describe, it, expect } from 'vitest';
import {
  PRESET_AI_SOURCES,
  RSSHUB_BASE,
  withRsshubBase,
  type PresetSource,
} from '../preset-ai-sources';

describe('preset-ai-sources', () => {
  it('arXiv and highVolume presets are defaultEnabled:false; others are not', () => {
    const arxiv = PRESET_AI_SOURCES.filter((p) => p.label.startsWith('arXiv'));
    expect(arxiv).toHaveLength(4);
    for (const p of arxiv) {
      expect(p.defaultEnabled).toBe(false);
      expect(p.highVolume).toBe(true);
    }
    // Non-arxiv non-highVolume presets should not be marked false.
    const others = PRESET_AI_SOURCES.filter((p) => !p.highVolume);
    for (const p of others) {
      expect(p.defaultEnabled).not.toBe(false);
    }
  });

  it('every highVolume preset is also defaultEnabled:false', () => {
    const hv = PRESET_AI_SOURCES.filter((p) => p.highVolume);
    expect(hv.length).toBeGreaterThan(0);
    for (const p of hv) expect(p.defaultEnabled).toBe(false);
  });

  it('withRsshubBase rewrites only viaRsshub entries; preserves path & query', () => {
    const rewritten = withRsshubBase('https://my.rsshub.test', PRESET_AI_SOURCES);
    for (let i = 0; i < PRESET_AI_SOURCES.length; i++) {
      const orig = PRESET_AI_SOURCES[i]!;
      const next = rewritten[i]!;
      if (orig.viaRsshub) {
        expect(next.input.startsWith('https://my.rsshub.test/')).toBe(true);
        // path preserved
        const origPath = new URL(orig.input).pathname;
        expect(next.input.endsWith(origPath)).toBe(true);
      } else {
        expect(next.input).toBe(orig.input);
      }
    }
  });

  it('withRsshubBase trims trailing slashes on base', () => {
    const a = withRsshubBase('https://my.rsshub.test', PRESET_AI_SOURCES);
    const b = withRsshubBase('https://my.rsshub.test///', PRESET_AI_SOURCES);
    expect(a).toEqual(b);
  });

  it('withRsshubBase is idempotent when re-applying the default base', () => {
    const once = withRsshubBase(RSSHUB_BASE, PRESET_AI_SOURCES);
    const twice = withRsshubBase(RSSHUB_BASE, once);
    expect(twice).toEqual(once);
    // And matches the originals (since they already use RSSHUB_BASE).
    for (let i = 0; i < PRESET_AI_SOURCES.length; i++) {
      expect(once[i]!.input).toBe(PRESET_AI_SOURCES[i]!.input);
    }
  });

  it('withRsshubBase falls back to identity when base is not a valid URL', () => {
    const garbage: PresetSource[] = [
      { kind: 'rss', input: 'https://rsshub.app/foo', label: 'X', category: 'lab', viaRsshub: true },
    ];
    const out = withRsshubBase('not-a-url', garbage);
    expect(out[0]!.input).toBe('https://rsshub.app/foo');
  });

  it('withRsshubBase does not mutate the input array', () => {
    const before = PRESET_AI_SOURCES.map((p) => p.input);
    withRsshubBase('https://other.host', PRESET_AI_SOURCES);
    const after = PRESET_AI_SOURCES.map((p) => p.input);
    expect(after).toEqual(before);
  });
});
