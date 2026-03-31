/**
 * lib/supabase-client.js
 * Central Supabase client for CrowdScout.
 * Include AFTER the supabase CDN script on each page.
 */
(function () {
  const SUPABASE_URL = "https://kstzwynylwcvqmkzkjvr.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzdHp3eW55bHdjdnFta3pranZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1OTc3OTgsImV4cCI6MjA3MjE3Mzc5OH0.JvilpVaPUCEj0p9Ty4EHdtruq5yico79HWn8Uq6Lqjo";

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("[CrowdScout] Supabase JS not loaded. Add CDN script before lib/supabase-client.js");
    return;
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });

  /** @type {import('@supabase/supabase-js').SupabaseClient} */
  window.CS = window.CS || {};
  window.CS.db = client;

  // ── Auth helpers ──────────────────────────────────────────────────────────────
  window.CS.auth = {
    async getSession() {
      const { data } = await client.auth.getSession();
      return data.session;
    },
    async getUser() {
      const { data } = await client.auth.getUser();
      return data.user;
    },
    async requireAuth(redirectTo = "landing.html") {
      const session = await this.getSession();
      if (!session) { window.location.href = redirectTo; return null; }
      return session;
    },
    async signInWithGoogle() {
      return client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/home.html" },
      });
    },
    async signOut() {
      return client.auth.signOut();
    },
    onAuthStateChange(fn) {
      return client.auth.onAuthStateChange(fn);
    },
  };

  // ── Profile helpers ────────────────────────────────────────────────────────────
  window.CS.profile = {
    async get(userId) {
      const { data, error } = await client.from("profiles").select("*").eq("id", userId).single();
      if (error && error.code !== "PGRST116") console.error("[CS.profile.get]", error);
      return data;
    },
    async upsert(profile) {
      const { data, error } = await client.from("profiles").upsert(profile).select().single();
      if (error) console.error("[CS.profile.upsert]", error);
      return data;
    },
    isComplete(profile) {
      return !!(profile && profile.display_name && profile.profile_completed);
    },
  };

  // backward-compat: expose client as window.supabase (some old code uses it)
  window.supabase = client;
  // Also expose via old MyAuth wrapper so landing.html still works
  window.MyAuth = {
    supabase: client,
    async getSession() { return window.CS.auth.getSession(); },
    async requireAuth(r) { return window.CS.auth.requireAuth(r); },
    async signIn(email, password) {
      return client.auth.signInWithPassword({ email, password });
    },
    async signOut() { return client.auth.signOut(); },
    onAuthStateChange(fn) { return client.auth.onAuthStateChange((e, s) => fn(e, s)); },
  };
})();
