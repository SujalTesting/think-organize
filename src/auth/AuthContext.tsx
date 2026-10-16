import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient, setAuthPersistence } from "../lib/supabase";

export type LearningPath = "sdet-ai" | "genai-agentic-ai";

export type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  date_of_birth: string | null;
  gender: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  bio: string;
  learning_path: LearningPath | null;
};

type ProfileInput = { full_name: string; username: string; date_of_birth: string; gender: string; country: string; state: string; city: string; bio?: string; learning_path?: LearningPath };
type AuthContextValue = {
  session: Session | null; user: User | null; profile: Profile | null;
  loading: boolean; profileLoading: boolean; configured: boolean;
  signInWithGoogle: (rememberMe: boolean) => Promise<void>;
  signUpWithEmail: (email: string, password: string, profile: ProfileInput) => Promise<string | null>;
  signInWithEmail: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  saveProfile: (profile: ProfileInput) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const fetchProfile = useCallback(async (id?: string) => {
    if (!supabase || !id) { setProfile(null); setProfileLoading(false); return; }
    setProfileLoading(true);
    try {
      const { data, error } = await supabase.from("profiles").select("id,full_name,username,date_of_birth,gender,country,state,city,bio,learning_path").eq("id", id).maybeSingle();
      if (error) throw error;
      setProfile(data as Profile | null);
    } catch (error) {
      console.error("Unable to load profile:", error);
      setProfile(null);
    } finally { setProfileLoading(false); }
  }, [supabase]);

  const refreshProfile = useCallback(async () => { await fetchProfile(session?.user.id); }, [fetchProfile, session?.user.id]);

  useEffect(() => {
    if (!supabase || !session) return;
    if (window.localStorage.getItem("learning-lab-auth-persistence") !== "remember") return;
    const expiresAt = Number(window.localStorage.getItem("learning-lab-auth-expiry") || 0);
    if (!expiresAt) return;
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      void supabase.auth.signOut({ scope: "local" });
      return;
    }
    const timeout = window.setTimeout(() => { void supabase.auth.signOut({ scope: "local" }); }, remaining);
    return () => window.clearTimeout(timeout);
  }, [supabase, session?.access_token]);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) console.error("Unable to restore Supabase session:", error.message);
      setSession(data.session);
      setLoading(false);
      if (data.session?.user.id) void fetchProfile(data.session.user.id);
    });
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession); setLoading(false);
      if (nextSession?.user.id) void fetchProfile(nextSession.user.id);
      else setProfile(null);
      if (nextSession && (event === "SIGNED_IN" || event === "INITIAL_SESSION") && window.location.hash) {
        const params = new URLSearchParams(window.location.hash.slice(1));
        if (params.has("access_token") || params.has("refresh_token")) window.history.replaceState(window.history.state, document.title, `${window.location.pathname}${window.location.search}`);
      }
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [supabase, fetchProfile]);

  const signInWithGoogle = useCallback(async (rememberMe: boolean) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    setAuthPersistence(rememberMe);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin, queryParams: { prompt: "select_account" } } });
    if (error) throw error;
  }, [supabase]);

  const signUpWithEmail = useCallback(async (email: string, password: string, p: ProfileInput) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin, data: { full_name: p.full_name, username: p.username, date_of_birth: p.date_of_birth, gender: p.gender, country: p.country, state: p.state, city: p.city, learning_path: p.learning_path || "genai-agentic-ai" } } });
    if (error) throw error;
    if (data.session && data.user) {
      const { error: profileError } = await supabase.from("profiles").upsert({ id: data.user.id, ...p, learning_path: p.learning_path || "genai-agentic-ai", username: p.username.trim() }, { onConflict: "id" });
      if (profileError) throw profileError;
      await fetchProfile(data.user.id);
    }
    return data.session ? null : "Check your email to confirm your account, then sign in.";
  }, [supabase, fetchProfile]);

  const signInWithEmail = useCallback(async (email: string, password: string, rememberMe: boolean) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    setAuthPersistence(rememberMe);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  }, [supabase]);

  const updatePassword = useCallback(async (password: string) => {
    if (!supabase || !session?.user.id) throw new Error("Sign in before changing your password.");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, [supabase, session?.user.id]);

  const saveProfile = useCallback(async (p: ProfileInput) => {
    if (!supabase || !session?.user.id) throw new Error("Sign in before saving your profile.");
    const values = { ...p, full_name: p.full_name.trim(), username: p.username.trim(), country: p.country.trim(), state: p.state.trim(), city: p.city.trim(), bio: (p.bio || "").trim(), learning_path: p.learning_path || profile?.learning_path || "genai-agentic-ai" };
    const { error } = await supabase.from("profiles").upsert({ id: session.user.id, ...values, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (error) throw error;
    await fetchProfile(session.user.id);
  }, [supabase, session?.user.id, fetchProfile, profile?.learning_path]);

  const signOut = useCallback(async () => {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, [supabase]);

  const value = useMemo<AuthContextValue>(() => ({ session, user: session?.user ?? null, profile, loading, profileLoading, configured: Boolean(supabase), signInWithGoogle, signUpWithEmail, signInWithEmail, updatePassword, saveProfile, signOut, refreshProfile }), [session, profile, loading, profileLoading, supabase, signInWithGoogle, signUpWithEmail, signInWithEmail, updatePassword, saveProfile, signOut, refreshProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error("useAuth must be used inside AuthProvider."); return value; }
