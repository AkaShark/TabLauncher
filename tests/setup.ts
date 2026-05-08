/**
 * Global vitest setup.
 * jest-webextension-mock historically expects a `jest` global. We bridge it to
 * vitest's `vi` so the bundled Chrome stubs load without complaint, then any
 * test that needs richer behavior installs its own helpers from
 * `tests/helpers/chromeMock.ts` (which fully replaces chrome.* with our impls).
 */
import { vi } from 'vitest';

(globalThis as unknown as { jest: typeof vi }).jest = vi;

// eslint-disable-next-line @typescript-eslint/no-var-requires
await import('jest-webextension-mock' as string);
