/**
 * chrome.permissions wrapper — MUST be invoked from a foreground user gesture
 * (newtab or options page). The service worker NEVER calls these helpers; doing
 * so triggers the "user gesture required" failure path.
 *
 * Plan §M4 sequence diagram pins this contract.
 */

function originPattern(rawUrl: string): string {
  const u = new URL(rawUrl);
  return `${u.protocol}//${u.host}/*`;
}

/**
 * Request the host permission needed to fetch the given URL.
 * Returns true on grant. Must be called from a user gesture.
 */
export async function requestForUrl(url: string): Promise<boolean> {
  const origins = [originPattern(url)];
  return new Promise<boolean>((resolve) => {
    try {
      chrome.permissions.request({ origins }, (granted) => {
        resolve(Boolean(granted));
      });
    } catch (e) {
      console.warn('[AIRSS] permissions.request failed', e);
      resolve(false);
    }
  });
}

export async function hasPermission(url: string): Promise<boolean> {
  const origins = [originPattern(url)];
  return new Promise<boolean>((resolve) => {
    try {
      chrome.permissions.contains({ origins }, (granted) => {
        resolve(Boolean(granted));
      });
    } catch {
      resolve(false);
    }
  });
}
