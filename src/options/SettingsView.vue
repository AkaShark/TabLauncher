<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useSubscriptionsStore } from '@/stores/subscriptions';
import type { AddOutcome } from '@/stores/subscriptions';
import { useShortcutsStore } from '@/stores/shortcuts';
import JuejinAuthSection from './components/JuejinAuthSection.vue';

const auth = useAuthStore();
const subs = useSubscriptionsStore();
const shortcuts = useShortcutsStore();

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
  await Promise.all([auth.hydrate(), subs.load(), shortcuts.load()]);
  subs.bindStorage();
  shortcuts.bindStorage();
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
