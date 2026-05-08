<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { LedgerPoint } from '@/core/ledger';

const props = defineProps<{
  data: LedgerPoint[];
  range: 7 | 30;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
let plot: uPlot | null = null;
let resizeObs: ResizeObserver | null = null;

function readVar(name: string): string {
  if (typeof window === 'undefined') return '0 0 0';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function rgb(name: string, alpha?: number): string {
  const v = readVar(name) || '107 104 98';
  return alpha === undefined ? `rgb(${v})` : `rgb(${v} / ${alpha})`;
}

function toSeries(points: LedgerPoint[]): uPlot.AlignedData {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of points) {
    const [y, m, d] = p.date.split('-').map((s) => Number.parseInt(s, 10));
    const ts = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).getTime() / 1000;
    xs.push(ts);
    ys.push(p.count);
  }
  return [xs, ys];
}

function makeOpts(width: number): uPlot.Options {
  return {
    width,
    height: 120,
    padding: [10, 4, 4, 4],
    cursor: { show: false },
    legend: { show: false },
    scales: {
      x: { time: true },
      y: { range: (_u, _min, max) => [0, Math.max(1, Math.ceil(max))] },
    },
    axes: [
      {
        stroke: rgb('--muted'),
        grid: { show: false },
        ticks: { show: false },
        font: '9px "JetBrains Mono", ui-monospace, monospace',
        size: 18,
        space: props.range === 7 ? 40 : 60,
      },
      {
        stroke: rgb('--muted'),
        grid: { stroke: rgb('--hair'), width: 1 },
        ticks: { show: false },
        font: '9px "JetBrains Mono", ui-monospace, monospace',
        size: 22,
        splits: (_u, _ax, _scaleMin, scaleMax) => {
          const mx = Math.max(1, Math.ceil(scaleMax));
          return [0, Math.ceil(mx / 2), mx];
        },
      },
    ],
    series: [
      {},
      {
        label: 'done',
        stroke: rgb('--accent'),
        fill: rgb('--accent', 0.18),
        width: 1.5,
        points: { show: true, size: 3.5, fill: rgb('--accent'), stroke: rgb('--accent') },
      },
    ],
  };
}

function init(): void {
  if (!containerRef.value) return;
  const width = containerRef.value.clientWidth || 320;
  plot = new uPlot(makeOpts(width), toSeries(props.data), containerRef.value);

  resizeObs = new ResizeObserver(() => {
    if (!plot || !containerRef.value) return;
    plot.setSize({ width: containerRef.value.clientWidth, height: 120 });
  });
  resizeObs.observe(containerRef.value);
}

function destroy(): void {
  resizeObs?.disconnect();
  resizeObs = null;
  plot?.destroy();
  plot = null;
}

onMounted(init);
onBeforeUnmount(destroy);

watch(
  () => props.data,
  (next) => {
    if (plot) plot.setData(toSeries(next));
  },
  { deep: true },
);

watch(
  () => props.range,
  () => {
    if (!containerRef.value) return;
    destroy();
    init();
  },
);
</script>

<template>
  <div
    ref="containerRef"
    class="w-full"
    :aria-label="`最近 ${range} 天完成趋势`"
    role="img"
  ></div>
</template>
