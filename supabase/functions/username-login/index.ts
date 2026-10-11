// Supabase Edge Function: username-login
// Deploy this function in Supabase and set its standard SUPABASE_URL,
// SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY secrets.
// The service-role key must never be placed in frontend environment variables.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  try {
    const body = await req.json();
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[A-Za-z0-9_]{3,24}$/.test(username) || !password) {
      return new Response(JSON.stringify({ error: "Enter a valid username and password." }), { status: 400, headers });
    }

    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) throw new Error("Function secrets are not configured.");

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const publicClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile } = await admin.from("profiles").select("id").ilike("username", username).maybeSingle();

    // Do not disclose whether a username exists or reveal the associated email.
    if (!profile) return new Response(JSON.stringify({ error: "Invalid username or password." }), { status: 401, headers });
    const { data: found, error: lookupError } = await admin.auth.admin.getUserById(profile.id);
    const email = found.user?.email;
    if (lookupError || !email) return new Response(JSON.stringify({ error: "Invalid username or password." }), { status: 401, headers });

    const { data, error } = await publicClient.auth.signInWithPassword({ email, password });
    if (error || !data.session) return new Response(JSON.stringify({ error: "Invalid username or password." }), { status: 401, headers });
    return new Response(JSON.stringify(data), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ error: "Unable to sign in. Please try again." }), { status: 500, headers });
  }
});
