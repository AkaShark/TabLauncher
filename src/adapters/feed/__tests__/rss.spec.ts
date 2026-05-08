/**
 * Tests for parseRssXml (RSS 2.0 + Atom 1.0).
 *
 * happy-dom 14's DOMParser returns `html` as documentElement for XML MIME
 * types due to a known limitation. We stub DOMParser via vi.stubGlobal using
 * happy-dom's internal XMLParser, which correctly preserves localName.
 *
 * Note: happy-dom parses `<link>` as an HTML void element (no textContent).
 * Fixtures therefore use `<guid>` for item URLs (rss.ts falls back to guid).
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as PropertySymbol from 'happy-dom/lib/PropertySymbol.js';
import XMLParser from 'happy-dom/lib/xml-parser/XMLParser.js';
import { Window } from 'happy-dom';
import { parseRssXml, RssParseError } from '../rss';

// ── DOMParser stub ────────────────────────────────────────────────────────────

const _win = new Window();

class XmlDOMParser {
  parseFromString(xml: string, _mime: string): { documentElement: Element | null; getElementsByTagName(tag: string): HTMLCollectionOf<Element> } {
    const doc = new (_win as unknown as { HTMLDocument: new () => Document }).HTMLDocument();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sym = PropertySymbol as unknown as Record<string, symbol>;
    (doc as unknown as Record<symbol, unknown>)[sym['childNodes']!] = { length: 0 };
    (doc as unknown as Record<symbol, unknown>)[sym['children']!] = { length: 0 };

    const root = (XMLParser as unknown as { parse(doc: Document, xml: string, opts: object): Document }).parse(doc, xml, { evaluateScripts: false });

    let xmlRoot: Element | null = null;
    const rootNodes = (root as unknown as Record<symbol, ArrayLike<Node>>)[sym['childNodes']!] ?? [];
    for (let i = 0; i < (rootNodes as ArrayLike<Node>).length; i++) {
      const n = (rootNodes as ArrayLike<Node>)[i]!;
      if (n.nodeType === 1) {
        xmlRoot = n as Element;
        break;
      }
    }

    if (!xmlRoot) {
      // Simulate parsererror so rss.ts throws RssParseError
      const errEl = Object.assign(Object.create(null), {
        textContent: 'xml parse error',
      }) as unknown as Element;
      return {
        documentElement: null,
        getElementsByTagName: (tag: string) =>
          (tag === 'parsererror' ? [errEl] : []) as unknown as HTMLCollectionOf<Element>,
      };
    }

    return {
      documentElement: xmlRoot,
      getElementsByTagName: (tag: string) =>
        xmlRoot!.getElementsByTagName(tag) as HTMLCollectionOf<Element>,
    };
  }
}

beforeAll(() => {
  vi.stubGlobal('DOMParser', XmlDOMParser);
});

// ── helpers ───────────────────────────────────────────────────────────────────

const SOURCE_ID = 'src-1';
const SOURCE_LABEL = 'Test Source';

function rss2(items: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Test Feed</title>
    <link>https://example.com</link>
    ${items}
  </channel>
</rss>`;
}

function atom1(entries: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <id>https://example.com/</id>
  ${entries}
</feed>`;
}

// ── test suites ───────────────────────────────────────────────────────────────

describe('parseRssXml — RSS 2.0', () => {
  it('case 1: parses RSS 2.0 item with title/guid(url)/pubDate/description', () => {
    const xml = rss2(`
      <item>
        <title>Hello World</title>
        <guid isPermaLink="true">https://example.com/hello</guid>
        <pubDate>Wed, 01 Jan 2025 12:00:00 GMT</pubDate>
        <description>A short description.</description>
      </item>
    `);
    const items = parseRssXml(xml, SOURCE_ID, SOURCE_LABEL);
    expect(items).toHaveLength(1);
    const item = items[0]!;
    expect(item.title).toBe('Hello World');
    expect(item.url).toBe('https://example.com/hello');
    expect(item.publishedAt).toBe(Date.parse('Wed, 01 Jan 2025 12:00:00 GMT'));
    expect(item.summary).toBe('A short description.');
    expect(item.sourceId).toBe(SOURCE_ID);
    expect(item.sourceLabel).toBe(SOURCE_LABEL);
    expect(item.isRead).toBe(false);
  });

  it('case 3: filters out items missing title or guid/link', () => {
    const xml = rss2(`
      <item>
        <guid>https://example.com/no-title</guid>
      </item>
      <item>
        <title>No URL Item</title>
      </item>
      <item>
        <title>Valid Item</title>
        <guid>https://example.com/valid</guid>
      </item>
    `);
    const items = parseRssXml(xml, SOURCE_ID, SOURCE_LABEL);
    expect(items).toHaveLength(1);
    expect(items[0]!.title).toBe('Valid Item');
  });

  it('case 4: strips HTML tags from description', () => {
    const xml = rss2(`
      <item>
        <title>HTML Test</title>
        <guid>https://example.com/html</guid>
        <description>&lt;p&gt;hello&lt;/p&gt;</description>
      </item>
    `);
    const items = parseRssXml(xml, SOURCE_ID, SOURCE_LABEL);
    expect(items[0]!.summary).toBe('hello');
  });

  it('case 5: truncates summary > 280 chars with ellipsis', () => {
    const longText = 'a'.repeat(300);
    const xml = rss2(`
      <item>
        <title>Long Summary</title>
        <guid>https://example.com/long</guid>
        <description>${longText}</description>
      </item>
    `);
    const items = parseRssXml(xml, SOURCE_ID, SOURCE_LABEL);
    const summary = items[0]!.summary;
    // 280 chars content + 1 ellipsis char = 281 max
    expect(summary.length).toBeLessThanOrEqual(281);
    expect(summary.endsWith('…')).toBe(true);
  });

  it('case 6: parses multiple items', () => {
    const xml = rss2(`
      <item>
        <title>Item 1</title>
        <guid>https://example.com/1</guid>
      </item>
      <item>
        <title>Item 2</title>
        <guid>https://example.com/2</guid>
      </item>
      <item>
        <title>Item 3</title>
        <guid>https://example.com/3</guid>
      </item>
    `);
    const items = parseRssXml(xml, SOURCE_ID, SOURCE_LABEL);
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.title)).toEqual(['Item 1', 'Item 2', 'Item 3']);
  });
});

describe('parseRssXml — Atom 1.0', () => {
  it('case 2: parses Atom 1.0 entry with title/link/published/summary', () => {
    const xml = atom1(`
      <entry>
        <title>Atom Entry</title>
        <link rel="alternate" href="https://example.com/atom-entry"/>
        <published>2025-06-15T09:00:00Z</published>
        <summary>Atom summary text.</summary>
      </entry>
    `);
    const items = parseRssXml(xml, SOURCE_ID, SOURCE_LABEL);
    expect(items).toHaveLength(1);
    const item = items[0]!;
    expect(item.title).toBe('Atom Entry');
    expect(item.url).toBe('https://example.com/atom-entry');
    expect(item.publishedAt).toBe(Date.parse('2025-06-15T09:00:00Z'));
    expect(item.summary).toBe('Atom summary text.');
    expect(item.sourceId).toBe(SOURCE_ID);
    expect(item.isRead).toBe(false);
  });
});

describe('parseRssXml — error handling', () => {
  it('throws RssParseError when XML has no valid root element', () => {
    // Passing an empty string causes XMLParser to produce no element children → parsererror path
    expect(() => parseRssXml('', SOURCE_ID, SOURCE_LABEL)).toThrow(RssParseError);
  });
});
