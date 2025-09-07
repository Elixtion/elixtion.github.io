/* auth.js — shared auth helpers (include AFTER the supabase <script> in pages) */
/* This script sets window.MyAuth and also assigns window.supabase = supabaseClient
   so older code referencing `supabase` still works.
*/

(function () {
  // Replace with your Supabase project details if different
  const SUPABASE_URL = "https://kstzwynylwcvqmkzkjvr.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzdHp3eW55bHdjdnFta3pranZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1OTc3OTgsImV4cCI6MjA3MjE3Mzc5OH0.JvilpVaPUCEj0p9Ty4EHdtruq5yico79HWn8Uq6Lqjo";

  // Ensure supabase library is loaded (script tag must be present on page)
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('Supabase JS not loaded. Add: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script> BEFORE auth.js');
  }

  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  });

  // expose
  window.MyAuth = {
    supabase: supabaseClient,
    async getSession() {
      const { data } = await supabaseClient.auth.getSession();
      return data.session;
    },
    async requireAuth(redirectTo = 'landing.html') {
      const session = await this.getSession();
      if (!session) {
        window.location.href = redirectTo;
        return null;
      }
      return session;
    },
    async signUpWithMetadata(email, password, metadata = {}) {
      // Uses options.data to pass metadata to the user record
      const res = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: metadata }
      });
      return res;
    },
    async signIn(email, password) {
      const res = await supabaseClient.auth.signInWithPassword({ email, password });
      return res;
    },
    async signOut() {
      return await supabaseClient.auth.signOut();
    },
    onAuthStateChange(fn) {
      return supabaseClient.auth.onAuthStateChange((event, session) => fn(event, session));
    }
  };

  // also make supabase global so old code can reference it:
  window.supabase = supabaseClient;
})();
