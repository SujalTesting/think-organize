import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;
const persistenceKey = "learning-lab-auth-persistence";
const expiryKey = "learning-lab-auth-expiry";

export function setAuthPersistence(rememberMe: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(persistenceKey, rememberMe ? "remember" : "session");
  if (rememberMe) window.localStorage.setItem(expiryKey, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
  else window.localStorage.removeItem(expiryKey);
}

export function getSupabaseClient(): SupabaseClient | null {
  if (client !== undefined) return client;

  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  // Keep the app usable before credentials are configured.
  if (!url || !key) {
    client = null;
    return client;
  }

  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: {
        getItem(key: string) {
          const mode = window.localStorage.getItem(persistenceKey);
          if (mode === "session") return window.sessionStorage.getItem(key);
          const expiresAt = Number(window.localStorage.getItem(expiryKey) || 0);
          if (expiresAt && Date.now() >= expiresAt) {
            window.localStorage.removeItem(key);
            window.sessionStorage.removeItem(key);
            window.localStorage.removeItem(expiryKey);
            return null;
          }
          return window.localStorage.getItem(key);
        },
        setItem(key: string, value: string) {
          if (window.localStorage.getItem(persistenceKey) === "session") {
            window.localStorage.removeItem(key);
            window.sessionStorage.setItem(key, value);
          } else {
            window.sessionStorage.removeItem(key);
            window.localStorage.setItem(key, value);
          }
        },
        removeItem(key: string) {
          window.localStorage.removeItem(key);
          window.sessionStorage.removeItem(key);
        },
      },
    },
  });

  return client;
}
