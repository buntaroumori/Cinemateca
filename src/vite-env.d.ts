/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly BASE_URL: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_BUILD_STAMP?: string;
  readonly VITE_TMDB_API_KEY?: string;
  readonly VITE_TMDB_READ_TOKEN?: string;
  readonly VITE_CORS_PROXY_URL?: string;
  readonly VITE_LLM_PROVIDER?: string;
  readonly VITE_LLM_API_KEY?: string;
  readonly VITE_LLM_MODEL?: string;
  readonly VITE_LLM_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.css" {
  const content: string;
  export default content;
}
