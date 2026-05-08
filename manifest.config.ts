/**
 * AIRSS Dashboard Chrome Extension Manifest.
 *
 * NOTE on `key` field:
 *   M0 decision: this project pins the extension public key so the extension-id
 *   stays stable across reinstalls (required for chrome.identity OAuth redirect_uri).
 *   The `key` field is currently DISABLED for M1 dev mode — Chrome will generate
 *   a stable per-load-path ID. After you obtain your own pubkey (see docs/self-host.md),
 *   uncomment the line below and replace with your base64 pubkey.
 */
import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

export default defineManifest({
  manifest_version: 3,
  name: 'AIRSS Dashboard',
  version: pkg.version,
  description:
    'AIRSS Dashboard - replace your new tab with TickTick tasks and curated RSS feeds.',
  // key: '<YOUR_BASE64_PUBKEY>', // M2+ restore: lock extension-id for stable OAuth redirect
  permissions: [
    'storage',
    'alarms',
    'identity',
    'cookies',
    'declarativeNetRequest',
  ],
  declarative_net_request: {
    rule_resources: [
      {
        id: 'header_rewrites',
        enabled: true,
        path: 'rules.json',
      },
    ],
  },
  optional_host_permissions: ['<all_urls>'],
  host_permissions: [
    // TickTick (intl) — keep for fork users overriding VITE_TICKTICK_*_HOST.
    'https://ticktick.com/*',
    'https://api.ticktick.com/*',
    // dida365 (CN, default).
    'https://dida365.com/*',
    'https://api.dida365.com/*',
    // Feed sources. Wildcards required because:
    // - juejin.cn root is needed for chrome.cookies (api.juejin.cn isn't where login cookies live)
    // - substack publications live at <pub>.substack.com (per-publication subdomain)
    // - medium publications live at <pub>.medium.com sometimes
    'https://*.juejin.cn/*',
    'https://juejin.cn/*',
    // GitHub Trending widget — relayed via juejin's e.* endpoint.
    'https://e.juejin.cn/*',
    'https://*.medium.com/*',
    'https://medium.com/*',
    'https://*.substack.com/*',
    'https://substack.com/*',
  ],
  chrome_url_overrides: {
    newtab: 'src/newtab/index.html',
  },
  options_page: 'src/options/index.html',
  background: {
    service_worker: 'src/background/sw.ts',
    type: 'module',
  },
  icons: {
    '16': 'public/icons/icon-16.png',
    '32': 'public/icons/icon-32.png',
    '48': 'public/icons/icon-48.png',
    '128': 'public/icons/icon-128.png',
  },
  action: {
    default_title: 'AIRSS Dashboard',
  },
});
