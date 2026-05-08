/**
 * Thumbnail extraction with fallback chain (plan §M4 AC-F5):
 *   1. <media:thumbnail url="...">
 *   2. <enclosure type="image/*" url="...">
 *   3. First <img src="..."> in description HTML
 *   4. og:image fetch — TODO M5+ (too heavy for M4; placeholder hook below)
 */

const IMG_SRC_RE = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/i;

function getAttr(el: Element | null, name: string): string | null {
  if (!el) return null;
  const v = el.getAttribute(name);
  return v && v.trim() ? v.trim() : null;
}

/**
 * Best-effort thumbnail extraction from a parsed RSS/Atom <item>/<entry>.
 * Returns null when nothing matches.
 */
export function extractThumbnail(item: Element, descriptionHtml: string): string | null {
  // 1) media:thumbnail (namespaced — try both qualified and local-name).
  const mediaThumb =
    item.getElementsByTagName('media:thumbnail')[0] ??
    item.getElementsByTagNameNS('*', 'thumbnail')[0] ??
    null;
  const mediaUrl = getAttr(mediaThumb, 'url');
  if (mediaUrl) return mediaUrl;

  // media:content with image medium / type
  const mediaContents =
    Array.from(item.getElementsByTagName('media:content')).concat(
      Array.from(item.getElementsByTagNameNS('*', 'content')),
    );
  for (const mc of mediaContents) {
    const type = mc.getAttribute('type') ?? '';
    const medium = mc.getAttribute('medium') ?? '';
    if (type.startsWith('image/') || medium === 'image') {
      const u = getAttr(mc, 'url');
      if (u) return u;
    }
  }

  // 2) enclosure type="image/*"
  const enclosures = item.getElementsByTagName('enclosure');
  for (const enc of Array.from(enclosures)) {
    const type = enc.getAttribute('type') ?? '';
    if (type.startsWith('image/')) {
      const u = getAttr(enc, 'url');
      if (u) return u;
    }
  }

  // 3) first <img> in description HTML
  if (descriptionHtml) {
    const m = IMG_SRC_RE.exec(descriptionHtml);
    if (m && m[1]) return m[1];
  }

  // 4) og:image — TODO M5+: fetch article page and parse <meta property="og:image">.
  return null;
}
