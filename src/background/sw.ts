/**
 * Service worker — message bus between newtab/options UI and TickTick adapter.
 *
 * M2 messages:
 *   - { type: 'auth/connect' } → run OAuth flow
 *   - { type: 'auth/revoke' }  → clear tokens
 *   - { type: 'tasks/refresh' } → fetch today's tasks, write cache
 *   - { type: 'tasks/complete', projectId, taskId } → mark completed
 *
 * Replies are { ok: true, ...data } | { ok: false, error: { code, message } }.
 *
 * chrome.alarms periodic refresh (P1-lite): registered on both onInstalled and
 * onStartup with period from settings.refreshIntervalMin; the onAlarm listener
 * is at top-level module scope so it survives SW re-wake.
 */

import { connect, revoke } from '@/core/oauth';
import { completeTask, getTodaySnapshot } from '@/adapters/ticktick/connector';
import { setCached } from '@/core/cache';
import { recordToday } from '@/core/ledger';
import { fetchFeedXml, FeedFetchError } from '@/adapters/feed/fetcher';
import type { FeedFetchFailure, FeedItem } from '@/adapters/feed/types';
import { getAll as getAllSources } from '@/core/subscriptions';
import {
  fetchRecommendFeed as fetchJuejinFeed,
  fetchCateFeed,
} from '@/adapters/juejin/connector';
import { readJuejinCookies } from '@/adapters/juejin/cookieReader';
import { getCreds as getJuejinCreds } from '@/core/juejinCreds';
import { fetchTrending } from '@/adapters/github/connector';
import type { GithubConfig } from '@/adapters/github/types';
import { getConfig as getGithubConfig, setConfig as setGithubConfig } from '@/core/githubConfig';

interface RawFeedEntry {
  sourceId: string;
  sourceLabel: string;
  xml: string;
  fetchedAt: number;
}

interface OkReply<T> {
  ok: true;
  data: T;
}
interface ErrReply {
  ok: false;
  error: { code: string; message: string };
}
type Reply<T> = OkReply<T> | ErrReply;

function err(code: string, message: string): ErrReply {
  return { ok: false, error: { code, message } };
}

interface PreparsedFeedEntry {
  sourceId: string;
  sourceLabel: string;
  items: FeedItem[];
  fetchedAt: number;
}

async function refreshFeeds(): Promise<{ totalItems: number; failed: FeedFetchFailure[] }> {
  const sources = await getAllSources();
  const enabled = sources.filter((s) => s.enabled);
  console.log('[AIRSS feed] refresh start. enabled sources:', enabled.map((s) => `${s.type}:${s.label}`));

  const xmlSources = enabled.filter((s) => s.type !== 'juejin');
  const juejinSources = enabled.filter((s) => s.type === 'juejin');

  const raw: Record<string, RawFeedEntry> = {};
  const preparsed: Record<string, PreparsedFeedEntry> = {};
  const failed: FeedFetchFailure[] = [];
  let count = 0;

  // RSS-family sources: fetch raw XML, foreground re-parses (no DOMParser in SW).
  if (xmlSources.length > 0) {
    const results = await Promise.allSettled(
      xmlSources.map(async (s) => ({ source: s, xml: await fetchFeedXml(s) })),
    );
    for (let i = 0; i < results.length; i++) {
      const r = results[i]!;
      const src = xmlSources[i]!;
      if (r.status === 'fulfilled') {
        raw[src.id] = {
          sourceId: src.id,
          sourceLabel: src.label,
          xml: r.value.xml,
          fetchedAt: Date.now(),
        };
        count++;
        console.log(`[AIRSS feed] ${src.type} OK: ${src.label} (${r.value.xml.length} bytes)`);
      } else {
        const reason = describeError(r.reason);
        console.error(`[AIRSS feed] ${src.type} FAILED: ${src.label} —`, reason, r.reason);
        failed.push({ id: src.id, label: src.label, reason });
      }
    }
  }

  // Juejin: fetch JSON and pre-normalize (no XML pipeline). Cookie probe is
  // best-effort for all_feed personalization. cate_feed uses manually pasted
  // curl credentials (uuid + x-secsdk-csrf-token) loaded from storage.
  if (juejinSources.length > 0) {
    const cookieStatus = await readJuejinCookies();
    const withCookie = cookieStatus.connected;
    console.log(
      '[AIRSS feed] juejin cookie connected:',
      withCookie,
      'uuid:',
      cookieStatus.uuid ?? '<none>',
    );
    const creds = await getJuejinCreds();
    const results = await Promise.allSettled(
      juejinSources.map((s) => {
        if (s.meta?.cateId !== undefined && s.meta?.sortType !== undefined) {
          if (!creds) {
            return Promise.reject(
              new FeedFetchError(
                'juejin cate: no creds — paste a curl on the options page',
                'no-creds',
              ),
            );
          }
          console.log(
            `[AIRSS feed] juejin cate via creds: cate=${s.meta.cateId} sort=${s.meta.sortType}`,
          );
          return fetchCateFeed({
            cateId: s.meta.cateId,
            sortType: s.meta.sortType,
            withCookie,
            defaultSourceLabel: s.label,
            uuid: creds.uuid,
            csrfToken: creds.csrfToken,
            limit: 20,
          });
        }
        return fetchJuejinFeed({ withCookie });
      }),
    );
    for (let i = 0; i < results.length; i++) {
      const r = results[i]!;
      const src = juejinSources[i]!;
      if (r.status === 'fulfilled') {
        const items = r.value.map((it) => ({ ...it, sourceId: src.id }));
        preparsed[src.id] = {
          sourceId: src.id,
          sourceLabel: src.label,
          items,
          fetchedAt: Date.now(),
        };
        count++;
        console.log(`[AIRSS feed] juejin ${src.label} OK (${items.length} items)`);
      } else {
        const reason = describeError(r.reason);
        console.error(`[AIRSS feed] juejin ${src.label} FAILED:`, reason, r.reason);
        failed.push({ id: src.id, label: src.label, reason });
      }
    }
  }

  await setCached('feed.rawXml', raw);
  await setCached('feed.preparsed', preparsed);
  console.log(`[AIRSS feed] refresh done. total ${count}, failed ${failed.length}`);
  return { totalItems: count, failed };
}

function describeError(e: unknown): string {
  if (e instanceof FeedFetchError) return `${e.code}: ${e.message}`;
  if (e instanceof Error) return e.message;
  return String(e);
}

async function refreshGithub(): Promise<{ totalItems: number }> {
  const cfg = await getGithubConfig();
  console.log('[AIRSS github] refresh start.', cfg);
  const items = await fetchTrending({
    period: cfg.period,
    lang: cfg.lang,
    limit: cfg.limit,
  });
  await setCached('github.items', items);
  console.log(`[AIRSS github] refresh done. total ${items.length}`);
  return { totalItems: items.length };
}

async function handle(msg: unknown): Promise<Reply<unknown>> {
  if (!msg || typeof msg !== 'object') return err('bad-msg', 'no msg');
  const m = msg as {
    type?: string;
    projectId?: string;
    taskId?: string;
    patch?: Partial<GithubConfig>;
  };
  try {
    switch (m.type) {
      case 'auth/connect': {
        const tokens = await connect();
        return { ok: true, data: { expiresAt: tokens.expiresAt } };
      }
      case 'auth/revoke': {
        await revoke();
        return { ok: true, data: null };
      }
      case 'tasks/refresh': {
        const { pending, completed, completedCount } = await getTodaySnapshot();
        const today = [...pending, ...completed];
        await setCached('ticktick.today', today);
        await recordToday(completedCount);
        return { ok: true, data: today };
      }
      case 'tasks/complete': {
        if (!m.projectId || !m.taskId) return err('bad-args', 'projectId/taskId required');
        await completeTask(m.projectId, m.taskId);
        return { ok: true, data: null };
      }
      case 'feed/refresh': {
        const stats = await refreshFeeds();
        return { ok: true, data: stats };
      }
      case 'github/refresh': {
        const stats = await refreshGithub();
        return { ok: true, data: stats };
      }
      case 'github/setConfig': {
        const patch = m.patch ?? {};
        const config = await setGithubConfig(patch);
        // Best-effort refresh after config change; don't block reply on it.
        try {
          await refreshGithub();
        } catch (e) {
          console.warn('[AIRSS github] refresh after setConfig failed:', e);
        }
        return { ok: true, data: { config } };
      }
      default:
        return err('unknown-type', `unknown message type: ${String(m.type)}`);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const code =
      e && typeof e === 'object' && 'code' in e ? String((e as { code: unknown }).code) : 'failed';
    return err(code, message);
  }
}

// ----- chrome.alarms periodic feed refresh (P1-lite, A' §3) -----

const REFRESH_ALARM_NAME = 'airss.refresh';
const SETTINGS_KEY = 'airss.settings.v1';
const DEFAULT_REFRESH_MIN = 120;

async function readRefreshMinutes(): Promise<number> {
  try {
    const out = await chrome.storage.local.get(SETTINGS_KEY);
    const raw = out[SETTINGS_KEY] as { refreshIntervalMin?: unknown } | undefined;
    const v = raw?.refreshIntervalMin;
    if (typeof v === 'number' && Number.isFinite(v) && v >= 15 && v <= 1440) {
      return Math.floor(v);
    }
  } catch (e) {
    console.warn('[AIRSS alarms] read settings failed:', e);
  }
  return DEFAULT_REFRESH_MIN;
}

async function ensureRefreshAlarm(): Promise<void> {
  const min = await readRefreshMinutes();
  try {
    await chrome.alarms.create(REFRESH_ALARM_NAME, {
      periodInMinutes: min,
      delayInMinutes: min,
    });
    console.log(`[AIRSS alarms] registered ${REFRESH_ALARM_NAME} every ${min}min`);
  } catch (e) {
    console.warn('[AIRSS alarms] create failed:', e);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('[AIRSS] installed');
  void ensureRefreshAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[AIRSS] startup');
  void ensureRefreshAlarm();
});

// Top-level so the listener is bound on every SW wake-up.
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== REFRESH_ALARM_NAME) return;
  console.log('[AIRSS alarms] tick → feed/refresh');
  refreshFeeds().catch((e) => {
    console.error('[AIRSS alarms] refreshFeeds failed:', e);
  });
});

// Re-register the alarm whenever refreshIntervalMin changes.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  const ch = changes[SETTINGS_KEY];
  if (!ch) return;
  const oldVal = (ch.oldValue as { refreshIntervalMin?: number } | undefined)?.refreshIntervalMin;
  const newVal = (ch.newValue as { refreshIntervalMin?: number } | undefined)?.refreshIntervalMin;
  if (oldVal === newVal) return;
  void ensureRefreshAlarm();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only accept messages from this extension's own contexts (content scripts,
  // options page, newtab). External senders are rejected.
  if (sender.id && sender.id !== chrome.runtime.id) {
    sendResponse(err('forbidden', 'sender id mismatch'));
    return false;
  }
  handle(message)
    .then(sendResponse)
    .catch((e: unknown) => {
      sendResponse(err('handler-throw', e instanceof Error ? e.message : String(e)));
    });
  return true; // keep channel open for async sendResponse
});
