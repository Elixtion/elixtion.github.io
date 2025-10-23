// ============================================
// auth-helper.js
// Shared authentication utilities
// ============================================

// CONFIGURATION - REPLACE THESE VALUES
const SUPABASE_URL = '://kstzwynylwcvqhttpsmkzkjvr.supabase.co'; // e.g., 'https://xxxxx.supabase.co'
const SUPABASE_ANON_KEY = 'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzdHp3eW55bHdjdnFta3pranZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1OTc3OTgsImV4cCI6MjA3MjE3Mzc5OH0'; // Your project's anon/public key

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
 * @param {Object} options
 * @param {string} options.loginUrl
 * @param {string} options.confirmUrl
 * @param {boolean} options.requireConfirmation
 * @returns {Promise<{user: Object, session: Object}>}
 */
async function protectPage(options = {}) {
  const {
    loginUrl = '/login.html',
    confirmUrl = '/resend-confirmation.html',
    requireConfirmation = true
  } = options;
  
  const { user, session, isConfirmed } = await checkAuth();
  
  if (!user || !session) {
    window.location.href = loginUrl;
    throw new Error('Not authenticated');
  }
  
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
    const avatarUrl = user.user_metadata?.avatar_url;
    if (avatarUrl) {
      avatarEl.src = avatarUrl;
    }
    
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
// CONFIRMATION PAGE LOGIC
// ============================================

/**
 * Handles email confirmation process on confirmation.html
 */
async function handleEmailConfirmation() {
  const loadingState = document.getElementById('loadingState');
  const successState = document.getElementById('successState');
  const errorState = document.getElementById('errorState');

  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) throw error;

    if (session && session.user && session.user.email_confirmed_at) {
      // Success: user confirmed and logged in
      loadingState.classList.add('hidden');
      successState.classList.remove('hidden');

      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 2500);
    } else {
      // Waiting or invalid
      setTimeout(async () => {
        const { data: { session: newSession } } = await supabase.auth.getSession();
        if (newSession && newSession.user.email_confirmed_at) {
          loadingState.classList.add('hidden');
          successState.classList.remove('hidden');
          setTimeout(() => {
            window.location.href = '/dashboard.html';
          }, 2500);
        } else {
          throw new Error('Email not confirmed yet.');
        }
      }, 3000);
    }
  } catch (error) {
    console.error('Email confirmation error:', error);
    if (loadingState) loadingState.classList.add('hidden');
    if (errorState) errorState.classList.remove('hidden');
  }
}

// ============================================
// AUTH STATE LISTENER
// ============================================
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    console.log('User signed in:', session?.user);
  }
  if (event === 'USER_UPDATED') {
    console.log('User updated (email verified):', session?.user);
  }
  if (event === 'SIGNED_OUT') {
    console.log('User signed out.');
  }
});