/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" → Mock-API, sonst echte Tauri-Commands. */
  readonly VITE_USE_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
