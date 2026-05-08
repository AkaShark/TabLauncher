<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useSubscriptionsStore } from '@/stores/subscriptions';
import { readJuejinCookies } from '@/adapters/juejin/cookieReader';
import { JUEJIN_CATEGORIES } from '@/adapters/juejin/categories';
import { parseJuejinCurl } from '@/adapters/juejin/curlParser';
import {
  clearCreds as clearJuejinCreds,
  getCreds as getJuejinCreds,
  setCreds as setJuejinCreds,
} from '@/core/juejinCreds';

const subs = useSubscriptionsStore();

const cookieConnected = ref(false);
const cookieExpiresAt = ref<number | null>(null);
const probing = ref(false);
const busy = ref(false);
const errorMsg = ref<string | null>(null);

// Category add busy state: key = `${cateId}-${sortType}`
const cateBusy = ref<Record<string, boolean>>({});

// Curl-paste credentials state.
const curlInput = ref('');
const curlSavedAt = ref<number | null>(null);
const curlBusy = ref(false);
const curlError = ref<string | null>(null);
const curlSavedTick = ref(0); // re-trigger relative-time computed

const subscribed = computed(() => subs.sources.some((s) => s.type === 'juejin' && !s.meta?.cateId));

function isCateSubscribed(cateId: string, sortType: 200 | 300): boolean {
  return subs.sources.some(
    (s) => s.meta?.cateId === cateId && s.meta?.sortType === sortType,
  );
}

async function probe(): Promise<void> {
  probing.value = true;
  try {
    const status = await readJuejinCookies();
    cookieConnected.value = status.connected;
    cookieExpiresAt.value = status.details?.expiresAt ?? null;
  } catch {
    cookieConnected.value = false;
    cookieExpiresAt.value = null;
  } finally {
    probing.value = false;
  }
}

async function addSource(): Promise<void> {
  busy.value = true;
  errorMsg.value = null;
  try {
    const o = await subs.addJuejin();
    if (!o.ok) errorMsg.value = o.message;
  } finally {
    busy.value = false;
  }
}

async function connectCookie(): Promise<void> {
  busy.value = true;
  errorMsg.value = null;
  try {
    // Origin permission for juejin.cn (manifest declares api.juejin.cn at install
    // time, but cookie reads / cross-origin login also benefit from juejin.cn/*).
    const origins = ['https://*.juejin.cn/*'];
    const granted = await new Promise<boolean>((resolve) => {
      try {
        chrome.permissions.request({ origins }, (g) => resolve(Boolean(g)));
      } catch {
        resolve(false);
      }
    });
    if (!granted) {
      errorMsg.value = '用户拒绝授予 juejin.cn 权限';
      return;
    }
    // Open juejin.cn so the user can log in; cookies are read on next probe.
    try {
      chrome.tabs?.create?.({ url: 'https://juejin.cn/' });
    } catch {
      // tabs API may be unavailable; ignore — user can navigate manually.
    }
    await probe();
  } finally {
    busy.value = false;
  }
}

async function disconnectCookie(): Promise<void> {
  // We don't actually delete cookies (could break user's logged-in browsing);
  // re-probing reflects the latest state. Provide a manual hint if still connected.
  await probe();
}

async function addCategory(cateId: string, sortType: 200 | 300, categoryLabel: string): Promise<void> {
  const key = `${cateId}-${sortType}`;
  cateBusy.value = { ...cateBusy.value, [key]: true };
  errorMsg.value = null;
  try {
    const o = await subs.addJuejinCategory(cateId, sortType, categoryLabel);
    if (!o.ok) errorMsg.value = o.message;
  } finally {
    cateBusy.value = { ...cateBusy.value, [key]: false };
  }
}

const expiresPretty = computed(() => {
  if (!cookieExpiresAt.value) return '';
  return new Date(cookieExpiresAt.value).toLocaleString();
});

const curlSavedRelative = computed(() => {
  // Read tick so the value re-evaluates after a manual refresh.
  void curlSavedTick.value;
  if (!curlSavedAt.value) return '';
  const diffMs = Date.now() - curlSavedAt.value;
  const mins = Math.max(0, Math.floor(diffMs / 60_000));
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
});

async function loadSavedCreds(): Promise<void> {
  const c = await getJuejinCreds();
  curlSavedAt.value = c?.capturedAt ?? null;
  curlSavedTick.value++;
}

async function saveCurl(): Promise<void> {
  curlBusy.value = true;
  curlError.value = null;
  try {
    const parsed = parseJuejinCurl(curlInput.value);
    if (!parsed.ok) {
      curlError.value = parsed.error;
      return;
    }
    await setJuejinCreds(parsed.uuid, parsed.csrfToken);
    curlInput.value = '';
    await loadSavedCreds();
  } finally {
    curlBusy.value = false;
  }
}

async function clearCurl(): Promise<void> {
  curlBusy.value = true;
  try {
    await clearJuejinCreds();
    curlSavedAt.value = null;
    curlError.value = null;
  } finally {
    curlBusy.value = false;
  }
}

onMounted(async () => {
  await probe();
  await loadSavedCreds();
});
</script>

<template>
  <div class="space-y-2 rounded border border-neutral-800/60 bg-neutral-950/40 p-3">
    <div class="flex items-center justify-between">
      <div class="text-xs font-medium text-neutral-300">掘金（中文技术社区）</div>
      <span
        v-if="subscribed && cookieConnected"
        class="flex items-center gap-1 text-[11px] text-emerald-400"
      >
        <span class="inline-block h-2 w-2 rounded-full bg-emerald-400"></span>
        已连接（推荐内容已个性化）
      </span>
      <span
        v-else-if="subscribed"
        class="flex items-center gap-1 text-[11px] text-neutral-500"
      >
        <span class="inline-block h-2 w-2 rounded-full bg-neutral-600"></span>
        未连接（公开推荐流）
      </span>
    </div>

    <!-- 状态 1: 未订阅全站推荐流 -->
    <div v-if="!subscribed" class="space-y-1">
      <button
        class="rounded bg-indigo-500 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
        :disabled="busy"
        @click="addSource"
      >
        {{ busy ? '添加中…' : 'Add 掘金推荐流（公开内容，无需登录）' }}
      </button>
      <p class="text-[11px] text-neutral-500">
        v1 默认走公开推荐流，无需任何 cookie 也能拉到 30 条文章。
      </p>
    </div>

    <!-- 状态 2: 已订阅 + 未连接 cookie -->
    <div v-else-if="!cookieConnected" class="space-y-1">
      <div class="flex items-center gap-2">
        <button
          class="rounded bg-neutral-800 px-3 py-1 text-xs font-medium text-neutral-100 hover:bg-neutral-700 disabled:opacity-50"
          :disabled="busy || probing"
          @click="connectCookie"
        >
          {{ busy ? '连接中…' : 'Connect 掘金（可选，用于个性化推荐）' }}
        </button>
        <button
          class="rounded bg-neutral-800 px-2 py-1 text-[11px] hover:bg-neutral-700 disabled:opacity-50"
          :disabled="probing"
          @click="probe"
        >
          {{ probing ? '检测中…' : '重新检测' }}
        </button>
      </div>
      <p class="text-[11px] text-neutral-500">未连接也能看推荐流；登录后内容更个性化。</p>
    </div>

    <!-- 状态 3: 已订阅 + 已连接 cookie -->
    <div v-else class="space-y-1">
      <div class="flex items-center gap-2">
        <button
          class="rounded bg-neutral-800 px-3 py-1 text-xs hover:bg-red-700/50 disabled:opacity-50"
          :disabled="busy"
          @click="disconnectCookie"
        >
          断开连接
        </button>
        <button
          class="rounded bg-neutral-800 px-2 py-1 text-[11px] hover:bg-neutral-700 disabled:opacity-50"
          :disabled="probing"
          @click="probe"
        >
          {{ probing ? '检测中…' : '刷新状态' }}
        </button>
      </div>
      <p v-if="expiresPretty" class="text-[11px] text-neutral-500">
        sessionid 过期时间：<span class="tabular-nums">{{ expiresPretty }}</span>
      </p>
    </div>

    <!-- 分类订阅 sub-section -->
    <!-- v1.1 hook: 可加 Android / 前端 / 后端 等更多分类 -->
    <div class="mt-2 border-t border-neutral-800/60 pt-2">
      <div class="mb-1 flex items-center justify-between">
        <div class="text-[11px] font-medium text-neutral-400">分类订阅</div>
      </div>
      <p
        class="mb-2 rounded bg-neutral-800/40 px-2 py-1 text-[11px] text-neutral-400"
      >
        iOS 分类 feed 需要从已登录的 juejin.cn 复制一个 curl。凭证一般几小时过期；过期后重新粘贴。
      </p>
      <div
        v-for="(cate, key) in JUEJIN_CATEGORIES"
        :key="key"
        class="mb-2"
      >
        <div class="mb-1 text-[11px] text-neutral-400">{{ cate.label }}</div>
        <div class="flex flex-wrap gap-2">
          <!-- 推荐 (sort_type=200) -->
          <button
            v-if="!isCateSubscribed(cate.id, 200)"
            class="rounded bg-indigo-500/80 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
            :disabled="cateBusy[`${cate.id}-200`]"
            @click="addCategory(cate.id, 200, cate.label)"
          >
            {{ cateBusy[`${cate.id}-200`] ? '添加中…' : `Add ${cate.label} 推荐` }}
          </button>
          <span
            v-else
            class="flex items-center gap-1 rounded bg-neutral-800 px-2 py-1 text-[11px] text-emerald-400"
          >
            <span class="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            {{ cate.label }} 推荐 已添加
          </span>

          <!-- 最新 (sort_type=300) -->
          <button
            v-if="!isCateSubscribed(cate.id, 300)"
            class="rounded bg-indigo-500/80 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
            :disabled="cateBusy[`${cate.id}-300`]"
            @click="addCategory(cate.id, 300, cate.label)"
          >
            {{ cateBusy[`${cate.id}-300`] ? '添加中…' : `Add ${cate.label} 最新` }}
          </button>
          <span
            v-else
            class="flex items-center gap-1 rounded bg-neutral-800 px-2 py-1 text-[11px] text-emerald-400"
          >
            <span class="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            {{ cate.label }} 最新 已添加
          </span>
        </div>
      </div>
    </div>

    <!-- 粘贴 curl 凭证 sub-section -->
    <div class="mt-2 border-t border-neutral-800/60 pt-2">
      <div class="mb-1 text-[11px] font-medium text-neutral-400">粘贴 curl 凭证</div>
      <p class="mb-2 text-[11px] text-neutral-500">
        DevTools Network 面板 → 找一次 cate_feed 调用 → 右键 Copy as cURL → 粘贴到下方。
      </p>
      <textarea
        v-model="curlInput"
        rows="4"
        class="mb-2 w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-[11px] text-neutral-100 placeholder-neutral-600 focus:border-indigo-500 focus:outline-none"
        placeholder="右键 Network 复制 curl，粘贴这里"
        :disabled="curlBusy"
      ></textarea>
      <div class="flex flex-wrap items-center gap-2">
        <button
          class="rounded bg-indigo-500 px-3 py-1 text-[11px] font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
          :disabled="curlBusy || curlInput.trim().length === 0"
          @click="saveCurl"
        >
          {{ curlBusy ? '保存中…' : '保存' }}
        </button>
        <span
          v-if="curlSavedAt"
          class="text-[11px] text-emerald-400"
        >
          ✅ 凭证已保存（更新于 {{ curlSavedRelative }}）
        </span>
        <button
          v-if="curlSavedAt"
          class="rounded bg-neutral-800 px-2 py-1 text-[11px] hover:bg-red-700/50 disabled:opacity-50"
          :disabled="curlBusy"
          @click="clearCurl"
        >
          清除
        </button>
      </div>
      <p v-if="curlError" class="mt-2 text-[11px] text-red-400">解析失败：{{ curlError }}</p>
    </div>

    <p v-if="errorMsg" class="text-[11px] text-red-400">错误：{{ errorMsg }}</p>
  </div>
</template>
