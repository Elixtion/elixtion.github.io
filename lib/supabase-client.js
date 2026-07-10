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

  // ── URL helper ────────────────────────────────────────────────────────────────
  // Absolute URL for a page in this site, correct on GitHub Pages, custom
  // domains, and localhost (handles sites served from a sub-path).
  function pageUrl(page) {
    const dir = window.location.pathname.replace(/[^/]*$/, ""); // strip filename
    return window.location.origin + dir + page;
  }

  // ── Auth helpers (email + password only) ──────────────────────────────────────
  window.CS.auth = {
    pageUrl,
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
    async signIn(email, password) {
      return client.auth.signInWithPassword({ email, password });
    },
    // Confirmation email link lands on auth-callback.html, which routes to
    // profile-setup or home once the session is established.
    async signUp(email, password) {
      return client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: pageUrl("auth-callback.html") },
      });
    },
    async resendConfirmation(email) {
      return client.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: pageUrl("auth-callback.html") },
      });
    },
    // Recovery link lands on reset-password.html where the user sets a new one.
    async sendPasswordReset(email) {
      return client.auth.resetPasswordForEmail(email, {
        redirectTo: pageUrl("reset-password.html"),
      });
    },
    async updatePassword(newPassword) {
      return client.auth.updateUser({ password: newPassword });
    },
    async signOut() {
      return client.auth.signOut();
    },
    onAuthStateChange(fn) {
      return client.auth.onAuthStateChange(fn);
    },
  };

  // ── Shared friendly error translation ──────────────────────────────────────────
  window.CS.auth.friendlyError = function (msg) {
    const m = (msg || "").toLowerCase();
    if (m.includes("invalid login credentials") || m.includes("invalid credentials") || m.includes("email or password"))
      return "Incorrect email or password. Please try again.";
    if (m.includes("email not confirmed"))
      return "Please verify your email before signing in. Check your inbox (and spam folder).";
    if (m.includes("user already registered") || m.includes("already registered") || m.includes("already exists"))
      return "An account with this email already exists. Try signing in instead.";
    if (m.includes("password should be at least") || m.includes("password must be"))
      return "Password must be at least 6 characters long.";
    if (m.includes("for security purposes") || m.includes("after 60 seconds"))
      return "Too many attempts. Please wait 60 seconds before trying again.";
    if (m.includes("rate limit") || m.includes("too many requests"))
      return "Too many requests. Please wait a moment and try again.";
    if (m.includes("network") || m.includes("failed to fetch"))
      return "Network error. Check your connection and try again.";
    if (m.includes("email") && (m.includes("invalid") || m.includes("format")))
      return "Please enter a valid email address.";
    if (m.includes("signup") && m.includes("disabled"))
      return "New sign-ups are temporarily disabled. Try again later.";
    if (m.includes("expired") || m.includes("otp"))
      return "That link has expired or was already used. Request a new one.";
    if (m.includes("same password") || m.includes("different from the old"))
      return "New password must be different from your current password.";
    if (m.includes("database") || m.includes("unexpected"))
      return "Something went wrong on our end. Please try again.";
    return msg || "Something went wrong. Please try again.";
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
