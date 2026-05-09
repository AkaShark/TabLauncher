<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useSubscriptionsStore } from '@/stores/subscriptions';
import type { AddOutcome } from '@/stores/subscriptions';
import { useShortcutsStore } from '@/stores/shortcuts';
import { useSettingsStore } from '@/stores/settings';
import {
  PRESET_AI_SOURCES,
  withRsshubBase,
  type PresetCategory,
  type PresetSource,
} from '@/config/preset-ai-sources';
import JuejinAuthSection from './components/JuejinAuthSection.vue';

const auth = useAuthStore();
const subs = useSubscriptionsStore();
const shortcuts = useShortcutsStore();
const settings = useSettingsStore();

// ----- General settings -----
const gsBase = ref('');
const gsRefresh = ref(120);
const gsBusy = ref(false);
const gsError = ref<string | null>(null);
const gsSaved = ref(false);

async function saveGeneral(): Promise<void> {
  gsBusy.value = true;
  gsError.value = null;
  gsSaved.value = false;
  try {
    const ok = await settings.setRsshubBase(gsBase.value.trim());
    if (!ok) {
      gsError.value = 'RSSHub Base 必须是 http(s) URL';
      return;
    }
    await settings.setRefreshInterval(Number(gsRefresh.value));
    // Reflect any clamping back into the input.
    gsRefresh.value = settings.refreshIntervalMin;
    gsBase.value = settings.rsshubBase;
    gsSaved.value = true;
  } finally {
    gsBusy.value = false;
  }
}

// ----- Bulk preset import -----
const PRESET_CATEGORIES: { id: PresetCategory; label: string }[] = [
  { id: 'lab', label: '官方实验室' },
  { id: 'research', label: '论文 & 研究' },
  { id: 'media', label: '媒体 & Newsletter' },
  { id: 'china', label: '中文社区' },
];

interface ImportRow {
  preset: PresetSource;
  /** Computed input URL after applying current rsshubBase. */
  url: string;
  checked: boolean;
}

const presetSelection = reactive<Record<string, ImportRow>>({});
const presetBusy = ref(false);
const presetSummary = ref<{
  added: number;
  skipped: number;
  failed: { label: string; reason: string }[];
} | null>(null);

function presetKey(p: PresetSource): string {
  return `${p.kind}::${p.input}`;
}

function rebuildPresetRows(): void {
  const rewritten = withRsshubBase(settings.rsshubBase, PRESET_AI_SOURCES);
  for (const key of Object.keys(presetSelection)) delete presetSelection[key];
  rewritten.forEach((p, idx) => {
    const orig = PRESET_AI_SOURCES[idx]!;
    const k = presetKey(orig);
    presetSelection[k] = {
      preset: p,
      url: p.kind === 'rss' ? p.input : `https://${p.input}`,
      checked: p.defaultEnabled !== false,
    };
  });
}

function rowsByCategory(cat: PresetCategory): ImportRow[] {
  return Object.values(presetSelection).filter((r) => r.preset.category === cat);
}

function selectAllInCategory(cat: PresetCategory, value: boolean): void {
  for (const r of rowsByCategory(cat)) r.checked = value;
}

function invertCategory(cat: PresetCategory): void {
  for (const r of rowsByCategory(cat)) r.checked = !r.checked;
}

function selectedRows(): ImportRow[] {
  return Object.values(presetSelection).filter((r) => r.checked);
}

function originPattern(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return `${u.protocol}//${u.host}/*`;
  } catch {
    return null;
  }
}

function truncateMid(s: string, n = 64): string {
  if (s.length <= n) return s;
  const head = Math.ceil(n / 2) - 1;
  const tail = Math.floor(n / 2) - 2;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

async function importSelected(): Promise<void> {
  const rows = selectedRows();
  if (rows.length === 0) return;
  presetBusy.value = true;
  presetSummary.value = null;

  // CRITICAL (Architect §4): collect ALL host origins BEFORE any await,
  // then call chrome.permissions.request once inside this click handler.
  const origins = new Set<string>();
  for (const r of rows) {
    if (r.preset.kind === 'rss') {
      const o = originPattern(r.preset.input);
      if (o) origins.add(o);
    } else {
      const handle = r.preset.input;
      const host = handle.includes('.') ? handle : `${handle}.substack.com`;
      origins.add(`https://${host}/*`);
    }
  }
  const originsArr = Array.from(origins);

  let permissionGranted = true;
  try {
    permissionGranted = await new Promise<boolean>((resolve) => {
      try {
        chrome.permissions.request({ origins: originsArr }, (granted) => {
          resolve(Boolean(granted));
        });
      } catch (e) {
        console.warn('[AIRSS] bulk permissions.request failed', e);
        resolve(false);
      }
    });
  } catch {
    permissionGranted = false;
  }

  if (!permissionGranted) {
    presetSummary.value = {
      added: 0,
      skipped: 0,
      failed: rows.map((r) => ({ label: r.preset.label, reason: '用户拒绝授予权限' })),
    };
    presetBusy.value = false;
    return;
  }

  let added = 0;
  let skipped = 0;
  const failed: { label: string; reason: string }[] = [];

  // Snapshot existing URLs for dedupe accounting (store auto-dedupes by URL).
  const existingUrls = new Set(subs.sources.map((s) => s.url));

  for (const r of rows) {
    const enabled = r.preset.defaultEnabled !== false;
    let outcome: AddOutcome;
    let canonicalUrl: string | null = null;
    try {
      if (r.preset.kind === 'rss') {
        canonicalUrl = r.preset.input;
        outcome = await subs.addRss(r.preset.input, r.preset.label, { enabled });
      } else {
        outcome = await subs.addSubstack(r.preset.input, r.preset.label, { enabled });
        if (outcome.ok) canonicalUrl = outcome.source.url;
      }
    } catch (e) {
      failed.push({
        label: r.preset.label,
        reason: e instanceof Error ? e.message : String(e),
      });
      continue;
    }
    if (!outcome.ok) {
      failed.push({ label: r.preset.label, reason: outcome.message || outcome.reason });
      continue;
    }
    const url = canonicalUrl ?? outcome.source.url;
    if (existingUrls.has(url)) {
      skipped++;
    } else {
      added++;
      existingUrls.add(url);
    }
  }

  presetSummary.value = { added, skipped, failed };
  presetBusy.value = false;
}

const scLabel = ref('');
const scUrl = ref('');
const scBusy = ref(false);
const scError = ref<string | null>(null);

async function submitShortcut(): Promise<void> {
  const url = scUrl.value.trim();
  if (!url) return;
  scBusy.value = true;
  scError.value = null;
  try {
    await shortcuts.add(scLabel.value.trim(), url);
    scLabel.value = '';
    scUrl.value = '';
  } catch (e) {
    scError.value = e instanceof Error ? e.message : String(e);
  } finally {
    scBusy.value = false;
  }
}

async function removeShortcut(id: string): Promise<void> {
  await shortcuts.remove(id);
}
const busy = ref(false);
const lastError = ref<string | null>(null);
const redirectUrl = ref<string>('');

const rssUrl = ref('');
const rssLabel = ref('');
const rssBusy = ref(false);
const rssError = ref<string | null>(null);

const substackHandle = ref('');
const substackBusy = ref(false);
const substackError = ref<string | null>(null);

const mediumInput = ref('');
const mediumBusy = ref(false);
const mediumError = ref<string | null>(null);

function reportOutcome(o: AddOutcome, target: 'rss' | 'substack' | 'medium'): boolean {
  if (o.ok) {
    if (target === 'rss') rssError.value = null;
    if (target === 'substack') substackError.value = null;
    if (target === 'medium') mediumError.value = null;
    return true;
  }
  const msg = o.message || o.reason;
  if (target === 'rss') rssError.value = msg;
  if (target === 'substack') substackError.value = msg;
  if (target === 'medium') mediumError.value = msg;
  return false;
}

async function submitRss(): Promise<void> {
  if (!rssUrl.value.trim()) return;
  rssBusy.value = true;
  try {
    const o = await subs.addRss(rssUrl.value.trim(), rssLabel.value.trim() || undefined);
    if (reportOutcome(o, 'rss')) {
      rssUrl.value = '';
      rssLabel.value = '';
    }
  } finally {
    rssBusy.value = false;
  }
}

async function submitSubstack(): Promise<void> {
  if (!substackHandle.value.trim()) return;
  substackBusy.value = true;
  try {
    const o = await subs.addSubstack(substackHandle.value.trim());
    if (reportOutcome(o, 'substack')) substackHandle.value = '';
  } finally {
    substackBusy.value = false;
  }
}

async function submitMedium(): Promise<void> {
  if (!mediumInput.value.trim()) return;
  mediumBusy.value = true;
  try {
    const o = await subs.addMedium(mediumInput.value.trim());
    if (reportOutcome(o, 'medium')) mediumInput.value = '';
  } finally {
    mediumBusy.value = false;
  }
}

async function removeSource(id: string): Promise<void> {
  await subs.remove(id);
}

async function toggleSource(id: string): Promise<void> {
  await subs.toggle(id);
}

const expiresPretty = computed(() => {
  if (!auth.tokens) return '';
  return new Date(auth.tokens.expiresAt).toLocaleString();
});

async function connect(): Promise<void> {
  busy.value = true;
  lastError.value = null;
  try {
    const reply = (await chrome.runtime.sendMessage({ type: 'auth/connect' })) as
      | { ok: true; data: unknown }
      | { ok: false; error: { code: string; message: string } }
      | undefined;
    if (!reply || reply.ok === false) {
      lastError.value = reply && reply.ok === false ? reply.error.message : 'no reply';
    }
    await auth.hydrate();
  } catch (e) {
    lastError.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

async function disconnect(): Promise<void> {
  busy.value = true;
  try {
    await chrome.runtime.sendMessage({ type: 'auth/revoke' });
    await auth.hydrate();
  } finally {
    busy.value = false;
  }
}

onMounted(async () => {
  await Promise.all([auth.hydrate(), subs.load(), shortcuts.load(), settings.load()]);
  subs.bindStorage();
  shortcuts.bindStorage();
  settings.bindStorage();
  gsBase.value = settings.rsshubBase;
  gsRefresh.value = settings.refreshIntervalMin;
  rebuildPresetRows();
  try {
    redirectUrl.value = chrome.identity.getRedirectURL();
  } catch {
    redirectUrl.value = '';
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes['airss.tokens']) void auth.hydrate();
  });
});
</script>

<template>
  <main class="mx-auto min-h-screen max-w-2xl p-6">
    <h1 class="mb-4 text-2xl font-semibold">AIRSS Settings</h1>

    <section class="mb-6 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <h2 class="text-lg font-medium">通用设置</h2>
      <p class="mt-1 text-xs text-neutral-500">
        RSSHub 实例与周期刷新间隔。公共 <code class="font-mono">rsshub.app</code>
        经常被限流（导入后看到 <code class="font-mono">blocked by upstream (HTTP 403)</code>
        多半就是它），建议改成自托管或可用的镜像。
      </p>
      <form class="mt-3 space-y-3" @submit.prevent="saveGeneral">
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label class="text-xs text-neutral-300">
            <span class="block">RSSHub Base</span>
            <input
              v-model="gsBase"
              class="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
              placeholder="https://rsshub.app"
              :disabled="gsBusy"
            />
          </label>
          <label class="text-xs text-neutral-300">
            <span class="block">刷新间隔（分钟，15–1440）</span>
            <input
              v-model.number="gsRefresh"
              type="number"
              min="15"
              max="1440"
              class="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
              :disabled="gsBusy"
            />
          </label>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="rounded bg-indigo-500 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
            :disabled="gsBusy"
            type="submit"
          >
            {{ gsBusy ? '保存中…' : '保存' }}
          </button>
          <span v-if="gsError" class="text-xs text-red-400">{{ gsError }}</span>
          <span v-else-if="gsSaved" class="text-xs text-emerald-400">已保存</span>
        </div>
      </form>
    </section>

    <section class="mb-6 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <h2 class="text-lg font-medium">AI 推荐源</h2>
      <p class="mt-1 text-xs text-neutral-500">
        勾选后一键导入。RSSHub 项会按上方"通用设置"的 Base 重写。高噪源（arXiv 等）默认关闭。
      </p>

      <div
        v-for="cat in PRESET_CATEGORIES"
        :key="cat.id"
        class="mt-4 rounded border border-neutral-800/60 bg-neutral-950/40 p-3"
      >
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-sm font-medium text-neutral-200">{{ cat.label }}</h3>
          <div class="flex items-center gap-1">
            <button
              type="button"
              class="rounded bg-neutral-800 px-2 py-0.5 text-[11px] hover:bg-neutral-700"
              :disabled="presetBusy"
              @click="selectAllInCategory(cat.id, true)"
            >
              全选
            </button>
            <button
              type="button"
              class="rounded bg-neutral-800 px-2 py-0.5 text-[11px] hover:bg-neutral-700"
              :disabled="presetBusy"
              @click="selectAllInCategory(cat.id, false)"
            >
              清空
            </button>
            <button
              type="button"
              class="rounded bg-neutral-800 px-2 py-0.5 text-[11px] hover:bg-neutral-700"
              :disabled="presetBusy"
              @click="invertCategory(cat.id)"
            >
              反选
            </button>
          </div>
        </div>
        <ul class="mt-2 space-y-1">
          <li
            v-for="row in rowsByCategory(cat.id)"
            :key="row.preset.label"
            class="flex items-center gap-2 text-xs"
          >
            <input
              :id="'preset-' + row.preset.label"
              v-model="row.checked"
              type="checkbox"
              :disabled="presetBusy"
            />
            <label :for="'preset-' + row.preset.label" class="min-w-0 flex-1 cursor-pointer">
              <span class="text-neutral-100">{{ row.preset.label }}</span>
              <span
                v-if="row.preset.defaultEnabled === false"
                class="ml-1 rounded bg-amber-900/50 px-1 py-0.5 text-[10px] text-amber-300"
              >默认关闭</span>
              <span
                v-if="row.preset.viaRsshub"
                class="ml-1 rounded bg-neutral-800 px-1 py-0.5 text-[10px] text-neutral-400"
              >RSSHub</span>
              <span class="block truncate text-[11px] text-neutral-500">{{ truncateMid(row.url) }}</span>
            </label>
          </li>
        </ul>
      </div>

      <div class="mt-4 flex items-center gap-2">
        <button
          class="rounded bg-indigo-500 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
          :disabled="presetBusy || selectedRows().length === 0"
          @click="importSelected"
        >
          {{ presetBusy ? '导入中…' : `导入选中（${selectedRows().length}）` }}
        </button>
      </div>

      <div
        v-if="presetSummary"
        class="mt-3 rounded border border-neutral-800 bg-neutral-950/60 p-3 text-xs"
      >
        <p class="text-neutral-300">
          已添加 <span class="text-emerald-400">{{ presetSummary.added }}</span> ·
          重复 <span class="text-neutral-400">{{ presetSummary.skipped }}</span> ·
          失败 <span class="text-red-400">{{ presetSummary.failed.length }}</span>
        </p>
        <ul v-if="presetSummary.failed.length" class="mt-2 space-y-0.5">
          <li
            v-for="f in presetSummary.failed"
            :key="f.label"
            class="text-[11px] text-red-300"
          >
            · {{ f.label }} — {{ f.reason }}
          </li>
        </ul>
      </div>
    </section>

    <section class="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <h2 class="text-lg font-medium">TickTick</h2>

      <div v-if="auth.connected" class="mt-3 space-y-2 text-sm">
        <p class="text-neutral-200">
          已连接 · 过期时间 <span class="tabular-nums">{{ expiresPretty }}</span>
        </p>
        <button
          class="rounded bg-neutral-800 px-3 py-1 text-sm hover:bg-neutral-700 disabled:opacity-50"
          :disabled="busy"
          @click="disconnect"
        >
          断开连接
        </button>
      </div>

      <div v-else class="mt-3 space-y-2 text-sm">
        <p class="text-neutral-400">尚未连接 TickTick。</p>
        <button
          class="rounded bg-indigo-500 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
          :disabled="busy"
          @click="connect"
        >
          {{ busy ? '连接中…' : 'Connect TickTick' }}
        </button>
        <p v-if="lastError" class="text-xs text-red-400">错误：{{ lastError }}</p>
      </div>

      <div class="mt-4 rounded border border-neutral-800 bg-neutral-950/60 p-3 text-xs">
        <p class="text-neutral-400">
          后台需要登记的 Redirect URL（用于 TickTick 开发者后台 OAuth 配置）：
        </p>
        <code class="mt-1 block break-all text-neutral-200">{{ redirectUrl || '(unavailable)' }}</code>
      </div>
    </section>

    <section class="mt-6 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <h2 class="text-lg font-medium">Feed 订阅源</h2>

      <form
        class="mt-3 space-y-2 rounded border border-neutral-800/60 bg-neutral-950/40 p-3"
        @submit.prevent="submitRss"
      >
        <div class="text-xs font-medium text-neutral-300">RSS</div>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            v-model="rssUrl"
            class="col-span-2 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
            placeholder="https://example.com/feed.xml"
            :disabled="rssBusy"
          />
          <input
            v-model="rssLabel"
            class="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
            placeholder="自定义名称（可选）"
            :disabled="rssBusy"
          />
        </div>
        <div class="flex items-center gap-2">
          <button
            class="rounded bg-indigo-500 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
            :disabled="rssBusy || !rssUrl.trim()"
            type="submit"
          >
            {{ rssBusy ? '添加中…' : '添加 RSS' }}
          </button>
          <span v-if="rssError" class="text-xs text-red-400">{{ rssError }}</span>
        </div>
      </form>

      <form
        class="mt-3 space-y-2 rounded border border-neutral-800/60 bg-neutral-950/40 p-3"
        @submit.prevent="submitSubstack"
      >
        <div class="text-xs font-medium text-neutral-300">Substack</div>
        <input
          v-model="substackHandle"
          class="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
          placeholder="例如 stratechery 或 myname.substack.com"
          :disabled="substackBusy"
        />
        <div class="flex items-center gap-2">
          <button
            class="rounded bg-indigo-500 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
            :disabled="substackBusy || !substackHandle.trim()"
            type="submit"
          >
            {{ substackBusy ? '添加中…' : '添加 Substack' }}
          </button>
          <span v-if="substackError" class="text-xs text-red-400">{{ substackError }}</span>
        </div>
      </form>

      <form
        class="mt-3 space-y-2 rounded border border-neutral-800/60 bg-neutral-950/40 p-3"
        @submit.prevent="submitMedium"
      >
        <div class="text-xs font-medium text-neutral-300">Medium</div>
        <input
          v-model="mediumInput"
          class="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
          placeholder="@username 或 publication-name 或 tag/foo"
          :disabled="mediumBusy"
        />
        <div class="flex items-center gap-2">
          <button
            class="rounded bg-indigo-500 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
            :disabled="mediumBusy || !mediumInput.trim()"
            type="submit"
          >
            {{ mediumBusy ? '添加中…' : '添加 Medium' }}
          </button>
          <span v-if="mediumError" class="text-xs text-red-400">{{ mediumError }}</span>
        </div>
      </form>

      <div class="mt-3">
        <JuejinAuthSection />
      </div>

      <div class="mt-4">
        <h3 class="mb-2 text-sm font-medium text-neutral-300">已添加</h3>
        <ul v-if="subs.sources.length" class="space-y-2">
          <li
            v-for="src in subs.sources"
            :key="src.id"
            class="flex items-center gap-3 rounded border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-xs"
          >
            <span
              class="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-300"
            >
              {{ src.type }}
            </span>
            <div class="min-w-0 flex-1">
              <div class="truncate text-neutral-100">{{ src.label }}</div>
              <div class="truncate text-[11px] text-neutral-500">{{ src.url }}</div>
            </div>
            <label class="flex items-center gap-1 text-[11px] text-neutral-400">
              <input
                type="checkbox"
                :checked="src.enabled"
                @change="toggleSource(src.id)"
              />
              启用
            </label>
            <button
              class="rounded bg-neutral-800 px-2 py-1 text-[11px] hover:bg-red-700/50"
              @click="removeSource(src.id)"
            >
              删除
            </button>
          </li>
        </ul>
        <p v-else class="text-xs text-neutral-500">尚未添加订阅源。</p>
      </div>
    </section>

    <section class="mt-6 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <h2 class="text-lg font-medium">快捷入口（Quick Links）</h2>
      <p class="mt-1 text-xs text-neutral-500">
        在任务清单上方显示的快速跳转链接。仅 http(s) 协议。
      </p>

      <form
        class="mt-3 space-y-2 rounded border border-neutral-800/60 bg-neutral-950/40 p-3"
        @submit.prevent="submitShortcut"
      >
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            v-model="scLabel"
            class="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
            placeholder="名称（可选，默认取域名）"
            :disabled="scBusy"
          />
          <input
            v-model="scUrl"
            class="col-span-2 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
            placeholder="https://example.com"
            :disabled="scBusy"
          />
        </div>
        <div class="flex items-center gap-2">
          <button
            class="rounded bg-indigo-500 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
            :disabled="scBusy || !scUrl.trim()"
            type="submit"
          >
            {{ scBusy ? '添加中…' : '添加快捷入口' }}
          </button>
          <span v-if="scError" class="text-xs text-red-400">{{ scError }}</span>
        </div>
      </form>

      <div class="mt-4">
        <h3 class="mb-2 text-sm font-medium text-neutral-300">已添加</h3>
        <ul v-if="shortcuts.items.length" class="space-y-2">
          <li
            v-for="s in shortcuts.items"
            :key="s.id"
            class="flex items-center gap-3 rounded border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-xs"
          >
            <div class="min-w-0 flex-1">
              <div class="truncate text-neutral-100">{{ s.label }}</div>
              <div class="truncate text-[11px] text-neutral-500">{{ s.url }}</div>
            </div>
            <a
              :href="s.url"
              target="_blank"
              rel="noopener noreferrer"
              class="rounded bg-neutral-800 px-2 py-1 text-[11px] hover:bg-neutral-700"
            >
              打开 ↗
            </a>
            <button
              class="rounded bg-neutral-800 px-2 py-1 text-[11px] hover:bg-red-700/50"
              @click="removeShortcut(s.id)"
            >
              删除
            </button>
          </li>
        </ul>
        <p v-else class="text-xs text-neutral-500">尚未添加快捷入口。</p>
      </div>
    </section>
  </main>
</template>
