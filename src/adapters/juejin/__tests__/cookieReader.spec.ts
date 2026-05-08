import { describe, it, expect, afterEach } from 'vitest';
import { readJuejinCookies } from '../cookieReader';

interface FakeCookie {
  name: string;
  value?: string;
  expirationDate?: number;
}

function installCookiesMock(cookies: FakeCookie[] | (() => Promise<FakeCookie[]>)): void {
  const g = globalThis as unknown as { chrome?: { cookies?: unknown } };
  if (!g.chrome) g.chrome = {};
  g.chrome.cookies = {
    async getAll(_q: { domain: string }): Promise<FakeCookie[]> {
      return Array.isArray(cookies) ? cookies : await cookies();
    },
  };
}

function clearCookiesApi(): void {
  const g = globalThis as unknown as { chrome?: { cookies?: unknown } };
  if (g.chrome) delete g.chrome.cookies;
}

describe('readJuejinCookies', () => {
  afterEach(() => {
    clearCookiesApi();
  });

  it('case 1: sessionid present → connected:true', async () => {
    installCookiesMock([
      { name: 'sessionid', value: 'abc123', expirationDate: 1730000000 },
      { name: '_ga', value: 'whatever' },
    ]);
    const status = await readJuejinCookies();
    expect(status.connected).toBe(true);
    expect(status.details?.sessionidPresent).toBe(true);
    expect(status.details?.expiresAt).toBe(1730000000 * 1000);
  });

  it('case 2: no sessionid → connected:false', async () => {
    installCookiesMock([{ name: '_ga', value: 'foo' }]);
    const status = await readJuejinCookies();
    expect(status.connected).toBe(false);
    expect(status.details?.sessionidPresent).toBe(false);
  });

  it('case 3: chrome.cookies.getAll throws → connected:false (no rethrow)', async () => {
    installCookiesMock(async () => {
      throw new Error('permission denied');
    });
    const status = await readJuejinCookies();
    expect(status.connected).toBe(false);
  });

  it('case 4: chrome.cookies API missing → connected:false', async () => {
    clearCookiesApi();
    const status = await readJuejinCookies();
    expect(status.connected).toBe(false);
  });

  it('case 5: sessionid present but empty value → connected:false', async () => {
    installCookiesMock([{ name: 'sessionid', value: '' }]);
    const status = await readJuejinCookies();
    expect(status.connected).toBe(false);
  });
});
