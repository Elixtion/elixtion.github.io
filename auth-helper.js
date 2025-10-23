// ============================================
// auth-helper.js
// Shared authentication utilities
// ============================================

// CONFIGURATION - REPLACE THESE VALUES
const SUPABASE_URL = '://kstzwynylwcvqhttpsmkzkjvr.supabase.co'; // e.g., 'https://xxxxx.supabase.co'
const SUPABASE_ANON_KEY = '.eyJpc3MiOiJzdXBhYmFzZSIeyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9sInJlZiI6ImtzdHp3eW55bHdjdnFta3pranZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1OTc3OTgsImV4cCI6MjA3MjE3Mzc5OH0.JvilpVaPUCEj0p9Ty4EHdtruq5yico79HWn8Uq6Lqjo'; // Your project's anon/public key

// Initialize Supabase client
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// ============================================
// AUTHENTICATION CHECK FUNCTIONS
// ============================================

/**
 * Check if user is authenticated and email is confirmed
 * @returns {Promise<{user: Object|null, session: Object|null, isConfirmed: boolean}>}
 */
async function checkAuth() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) throw error;
    
    if (!session || !session.user) {
      return { user: null, session: null, isConfirmed: false };
    }
    
    const isConfirmed = !!session.user.email_confirmed_at;
    
    return {
      user: session.user,
      session: session,
      isConfirmed: isConfirmed
    };
  } catch (error) {
    console.error('Auth check error:', error);
    return { user: null, session: null, isConfirmed: false };
  }
}

/**
 * Protect a page - redirect if not authenticated or not confirmed
 * Call this at the top of any protected page
 * @param {Object} options - Configuration options
 * @param {string} options.loginUrl - Where to redirect if not logged in (default: '/login.html')
 * @param {string} options.confirmUrl - Where to redirect if email not confirmed (default: '/resend-confirmation.html')
 * @param {boolean} options.requireConfirmation - Whether to require email confirmation (default: true)
 * @returns {Promise<{user: Object, session: Object}>}
 */
async function protectPage(options = {}) {
  const {
    loginUrl = '/login.html',
    confirmUrl = '/resend-confirmation.html',
    requireConfirmation = true
  } = options;
  
  const { user, session, isConfirmed } = await checkAuth();
  
  // Not logged in at all
  if (!user || !session) {
    window.location.href = loginUrl;
    throw new Error('Not authenticated');
  }
  
  // Logged in but email not confirmed
  if (requireConfirmation && !isConfirmed) {
    window.location.href = confirmUrl;
    throw new Error('Email not confirmed');
  }
  
  return { user, session };
}

/**
 * Get current user
 * @returns {Promise<Object|null>}
 */
async function getCurrentUser() {
  const { user } = await checkAuth();
  return user;
}

/**
 * Sign out the current user
 * @returns {Promise<void>}
 */
async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    window.location.href = '/';
  } catch (error) {
    console.error('Sign out error:', error);
    alert('Failed to sign out. Please try again.');
  }
}

/**
 * Update user profile avatar in header
 * @param {string} selector - CSS selector for avatar element
 */
async function updateProfileAvatar(selector = '#landingAvatar') {
  const { user } = await checkAuth();
  const avatarEl = document.querySelector(selector);
  
  if (avatarEl && user) {
    // If you have custom avatar URLs in user metadata
    const avatarUrl = user.user_metadata?.avatar_url;
    if (avatarUrl) {
      avatarEl.src = avatarUrl;
    }
    
    // Update alt text
    const username = user.user_metadata?.username || user.email;
    avatarEl.alt = username;
  }
}

/**
 * Display user info in a greeting element
 * @param {string} selector - CSS selector for greeting element
 */
async function displayUserGreeting(selector = '#userGreeting') {
  const { user } = await checkAuth();
  const greetingEl = document.querySelector(selector);
  
  if (greetingEl && user) {
    const username = user.user_metadata?.username || user.email.split('@')[0];
    greetingEl.textContent = `Welcome back, ${username}!`;
  }
}

// ============================================
// EXPORT FOR USE IN OTHER FILES
// ============================================
// If using ES6 modules, uncomment:
// export { supabase, checkAuth, protectPage, getCurrentUser, signOut, updateProfileAvatar, displayUserGreeting };

// For global access without modules:
window.authHelper = {
  supabase,
  checkAuth,
  protectPage,
  getCurrentUser,
  signOut,
  updateProfileAvatar,
  displayUserGreeting
};