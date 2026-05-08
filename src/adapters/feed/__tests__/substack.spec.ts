import { describe, it, expect } from 'vitest';
import { substackUrl } from '../substack';

describe('substackUrl', () => {
  it('case 1: bare handle → https://<handle>.substack.com/feed', () => {
    expect(substackUrl('stratechery')).toBe('https://stratechery.substack.com/feed');
  });

  it('case 2: handle.substack.com host form', () => {
    expect(substackUrl('foo.substack.com')).toBe('https://foo.substack.com/feed');
  });

  it('case 3: full URL https://foo.substack.com/', () => {
    expect(substackUrl('https://foo.substack.com/')).toBe('https://foo.substack.com/feed');
  });

  it('case 4: normalizes case (Foo → foo)', () => {
    expect(substackUrl('Foo')).toBe('https://foo.substack.com/feed');
  });

  it('case 4b: mixed case URL also normalized', () => {
    expect(substackUrl('https://Bar.substack.com/')).toBe('https://bar.substack.com/feed');
  });

  it('throws on empty input', () => {
    expect(() => substackUrl('')).toThrow();
  });
});
