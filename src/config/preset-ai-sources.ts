/**
 * Curated AI feed sources, grouped by editorial tier.
 *
 * Shape mirrors what the subscription store expects on input:
 *   - kind:'rss'      -> pass `input` to subscriptions.addRss(url, label)
 *   - kind:'substack' -> pass `input` to subscriptions.addSubstack(handle)
 *
 * RSSHub URLs default to the public instance. To use a self-hosted instance,
 * call `withRsshubBase(base, presets)` at import time to rewrite the host.
 */

export type PresetCategory = 'lab' | 'research' | 'media' | 'china';

export interface PresetSource {
  kind: 'rss' | 'substack';
  /** URL for kind:'rss', or substack handle/host for kind:'substack'. */
  input: string;
  label: string;
  category: PresetCategory;
  /** True when the URL points to a public RSSHub instance (consider self-hosting). */
  viaRsshub?: boolean;
  /** Marked when the feed is high-volume; defaults to disabled-on-import. */
  highVolume?: boolean;
  /** Whether the row is checked by default in the bulk-import UI. Default true. */
  defaultEnabled?: boolean;
  note?: string;
}

export const RSSHUB_BASE = 'https://rsshub.app';

export const PRESET_AI_SOURCES: PresetSource[] = [
  // Tier 1 — official labs
  { kind: 'rss', input: `${RSSHUB_BASE}/openai/blog`, label: 'OpenAI News', category: 'lab', viaRsshub: true },
  { kind: 'rss', input: `${RSSHUB_BASE}/anthropic/news`, label: 'Anthropic News', category: 'lab', viaRsshub: true },
  { kind: 'rss', input: `${RSSHUB_BASE}/deepmind/blog`, label: 'Google DeepMind Blog', category: 'lab', viaRsshub: true },
  { kind: 'rss', input: `${RSSHUB_BASE}/meta/ai`, label: 'Meta AI Blog', category: 'lab', viaRsshub: true },
  { kind: 'rss', input: 'https://www.microsoft.com/en-us/research/feed/', label: 'Microsoft Research', category: 'lab', note: 'site-wide; filter by AI tag if too noisy' },
  { kind: 'rss', input: 'https://developer.nvidia.com/blog/feed/', label: 'NVIDIA Technical Blog', category: 'lab' },

  // Tier 2 — papers & code
  { kind: 'rss', input: `${RSSHUB_BASE}/huggingface/daily-papers`, label: 'Hugging Face Daily Papers', category: 'research', viaRsshub: true },
  { kind: 'rss', input: 'https://rss.arxiv.org/rss/cs.AI', label: 'arXiv cs.AI', category: 'research', highVolume: true, defaultEnabled: false },
  { kind: 'rss', input: 'https://rss.arxiv.org/rss/cs.CL', label: 'arXiv cs.CL', category: 'research', highVolume: true, defaultEnabled: false },
  { kind: 'rss', input: 'https://rss.arxiv.org/rss/cs.LG', label: 'arXiv cs.LG', category: 'research', highVolume: true, defaultEnabled: false },
  { kind: 'rss', input: 'https://rss.arxiv.org/rss/cs.CV', label: 'arXiv cs.CV', category: 'research', highVolume: true, defaultEnabled: false },
  { kind: 'rss', input: 'https://hai.stanford.edu/news/rss.xml', label: 'Stanford HAI', category: 'research' },
  { kind: 'rss', input: 'https://bair.berkeley.edu/blog/feed.xml', label: 'Berkeley BAIR Blog', category: 'research' },

  // Tier 3 — media & newsletters
  { kind: 'rss', input: 'https://techcrunch.com/category/artificial-intelligence/feed/', label: 'TechCrunch AI', category: 'media' },
  { kind: 'rss', input: 'https://www.technologyreview.com/topic/artificial-intelligence/feed', label: 'MIT Technology Review — AI', category: 'media' },
  { kind: 'rss', input: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', label: 'The Verge — AI', category: 'media' },
  { kind: 'rss', input: `${RSSHUB_BASE}/arstechnica/tag/artificial-intelligence`, label: 'Ars Technica — AI', category: 'media', viaRsshub: true },
  { kind: 'rss', input: 'https://venturebeat.com/category/ai/feed/', label: 'VentureBeat AI', category: 'media' },
  { kind: 'substack', input: 'latent.space', label: 'Latent Space', category: 'media' },
  { kind: 'rss', input: 'https://semianalysis.com/feed/', label: 'SemiAnalysis', category: 'media', note: 'self-hosted feed (migrated from Substack)' },

  // Tier 4 — China
  { kind: 'rss', input: `${RSSHUB_BASE}/jiqizhixin/latest`, label: '机器之心', category: 'china', viaRsshub: true },
  { kind: 'rss', input: 'https://www.qbitai.com/feed', label: '量子位', category: 'china' },
  { kind: 'rss', input: `${RSSHUB_BASE}/baai/news`, label: '智源社区', category: 'china', viaRsshub: true },
  { kind: 'rss', input: `${RSSHUB_BASE}/aiera/home`, label: '新智元', category: 'china', viaRsshub: true },
];

/**
 * Rewrite RSSHub-backed presets to use the given base URL. Pure: returns a new
 * array, leaves the input untouched.
 *
 * Only entries with `viaRsshub:true` are touched. The leading scheme + host of
 * the original `input` is replaced with the trimmed `base`; the path/query are
 * preserved.
 */
export function withRsshubBase(
  base: string,
  presets: PresetSource[] = PRESET_AI_SOURCES,
): PresetSource[] {
  const trimmedBase = base.trim().replace(/\/+$/, '');
  let baseUrl: URL;
  try {
    baseUrl = new URL(trimmedBase);
  } catch {
    return presets.map((p) => ({ ...p }));
  }
  const baseOrigin = `${baseUrl.protocol}//${baseUrl.host}`;
  return presets.map((p) => {
    if (!p.viaRsshub || p.kind !== 'rss') return { ...p };
    let originalUrl: URL;
    try {
      originalUrl = new URL(p.input);
    } catch {
      return { ...p };
    }
    const rewritten = `${baseOrigin}${originalUrl.pathname}${originalUrl.search}${originalUrl.hash}`;
    return { ...p, input: rewritten };
  });
}

/**
 * Excluded from the seed (intentional):
 *   - The Information         — paywalled
 *   - Papers with Code        — no usable feed, low signal as a stream
 *   - 中国人工智能学会         — no RSS
 *   - The Batch (DeepLearning.AI) — no public RSS endpoint as of 2026-05
 */
