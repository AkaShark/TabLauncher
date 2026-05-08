/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TICKTICK_CLIENT_ID: string;
  readonly VITE_TICKTICK_CLIENT_SECRET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;
  export default component;
}
