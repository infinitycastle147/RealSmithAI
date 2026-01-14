/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_CLERK_PUBLISHABLE_KEY: string;
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    readonly VITE_API_URL?: string; // Backend API URL (optional - uses proxy in dev if not set)
    // Add other env variables as needed
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
