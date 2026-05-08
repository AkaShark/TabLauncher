import { describe, it, expect } from 'vitest';
import { mediumUrl } from '../medium';

describe('mediumUrl', () => {
  it('case 1: @user handle → medium.com/feed/@user', () => {
    expect(mediumUrl('@yegor256')).toBe('https://medium.com/feed/@yegor256');
  });

  it('case 2: tag/slug path → medium.com/feed/tag/slug', () => {
    expect(mediumUrl('tag/javascript')).toBe('https://medium.com/feed/tag/javascript');
  });

  it('case 3: bare slug → publication feed', () => {
    expect(mediumUrl('pub-name')).toBe('https://medium.com/feed/pub-name');
  });

  it('case 4: full URL with @user is normalized', () => {
    expect(mediumUrl('https://medium.com/@user')).toBe('https://medium.com/feed/@user');
  });

  it('normalizes URL with /feed/ prefix', () => {
    expect(mediumUrl('https://medium.com/feed/@writer')).toBe('https://medium.com/feed/@writer');
  });

  it('throws on empty input', () => {
    expect(() => mediumUrl('')).toThrow();
  });
});
