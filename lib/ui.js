/**
 * lib/ui.js
 * Shared UI helpers for CrowdScout pages.
 * - Connectivity status bar
 * - Profile dropdown
 * - Toast notifications
 * - Auth redirect + profile check
 */
window.CS = window.CS || {};

window.CS.ui = (function () {

  // ── Toast ──────────────────────────────────────────────────────────────────
  let _toastContainer = null;
  function _getToastContainer() {
    if (_toastContainer) return _toastContainer;
    _toastContainer = document.createElement("div");
    _toastContainer.id = "cs-toast-container";
    _toastContainer.style.cssText =
      "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;";
    document.body.appendChild(_toastContainer);
    return _toastContainer;
  }

  function toast(message, type = "info", durationMs = 3000) {
    const container = _getToastContainer();
    const el = document.createElement("div");
    const colors = {
      info: "background:#262e2a;color:#c6e0d4;border:1px solid #3f4e46;",
      success: "background:#1b350e;color:#99e550;border:1px solid #447526;",
      error: "background:#3b1c1c;color:#f87171;border:1px solid #7f1d1d;",
      warning: "background:#2d2200;color:#fbbf24;border:1px solid #78350f;",
    };
    el.style.cssText = `${colors[type] || colors.info}padding:10px 18px;border-radius:8px;font-size:0.875rem;font-family:Inter,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.4);pointer-events:auto;max-width:90vw;text-align:center;`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), durationMs);
  }

  // ── Connectivity bar ───────────────────────────────────────────────────────
  function initConnectivityBar(targetEl) {
    if (!targetEl) return;
    function update(ev) {
      const { isOnline, pendingCount } = ev ? ev.detail : window.CS.offline?.connectivity ?? { isOnline: true, pendingCount: 0 };
      let html, cls;
      if (!isOnline) {
        html = `<span class="material-symbols-outlined" style="font-size:16px;vertical-align:-3px">wifi_off</span> Offline — ${pendingCount} saved locally`;
        cls = "cs-conn-bar cs-conn-bar--offline";
      } else if (pendingCount > 0) {
        html = `<span class="material-symbols-outlined" style="font-size:16px;vertical-align:-3px">sync</span> Syncing ${pendingCount} submission${pendingCount > 1 ? "s" : ""}…`;
        cls = "cs-conn-bar cs-conn-bar--syncing";
      } else {
        html = `<span class="material-symbols-outlined" style="font-size:16px;vertical-align:-3px">cloud_done</span> Online — all synced`;
        cls = "cs-conn-bar cs-conn-bar--online";
      }
      targetEl.innerHTML = html;
      targetEl.className = cls;
    }
    window.addEventListener("cs-connectivity", update);
    // Initial state
    update(null);
  }

  // ── Profile dropdown ───────────────────────────────────────────────────────
  function initProfileDropdown({ btnId, dropdownId, avatarId }) {
    const btn = document.getElementById(btnId);
    const dropdown = document.getElementById(dropdownId);
    if (!btn || !dropdown) return;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const shown = dropdown.style.display === "block";
      dropdown.style.display = shown ? "none" : "block";
    });
    document.addEventListener("click", () => { dropdown.style.display = "none"; });

    // Populate from session
    (async () => {
      const session = await window.CS.auth?.getSession?.();
      const avatarEl = avatarId ? document.getElementById(avatarId) : null;
      if (session?.user) {
        const meta = session.user.user_metadata || {};
        const email = session.user.email || "";
        if (avatarEl) {
          avatarEl.src = meta.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(meta.full_name || email)}`;
        }
        // Show logged-in items
        document.querySelectorAll("[data-cs-logged-in]").forEach((el) => (el.style.display = ""));
        document.querySelectorAll("[data-cs-logged-out]").forEach((el) => (el.style.display = "none"));
        const emailEl = document.getElementById("cs-dropdown-email");
        if (emailEl) emailEl.textContent = meta.full_name || email;
      } else {
        if (avatarEl) avatarEl.src = "https://upload.wikimedia.org/wikipedia/commons/a/aa/Sin_cara.png";
        document.querySelectorAll("[data-cs-logged-in]").forEach((el) => (el.style.display = "none"));
        document.querySelectorAll("[data-cs-logged-out]").forEach((el) => (el.style.display = ""));
      }
    })();
  }

  // ── Auth guard ─────────────────────────────────────────────────────────────
  async function requireAuth(redirectTo = "landing.html") {
    const session = await window.CS.auth?.getSession?.();
    if (!session) { window.location.href = redirectTo; return null; }
    return session;
  }

  async function requireProfileComplete(redirectTo = "profile-setup.html") {
    const session = await requireAuth();
    if (!session) return null;
    const profile = await window.CS.profile?.get(session.user.id);
    if (!window.CS.profile?.isComplete(profile)) {
      window.location.href = redirectTo;
      return null;
    }
    return { session, profile };
  }

  // ── Format helpers ─────────────────────────────────────────────────────────
  function fmtDate(dateStr) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function climbLabel(val) {
    const map = { none: "—", attempted_failed: "Failed", level1: "L1", level2: "L2", level3: "L3" };
    return map[val] || val || "—";
  }

  function trustBadge(level) {
    const map = {
      new:     { icon: "🔴", label: "New",     cls: "cs-trust-new" },
      active:  { icon: "🟡", label: "Active",  cls: "cs-trust-active" },
      trusted: { icon: "🟢", label: "Trusted", cls: "cs-trust-trusted" },
      verified:{ icon: "⭐", label: "Verified",cls: "cs-trust-verified" },
    };
    const t = map[level] || map.new;
    return `<span class="${t.cls}" title="${t.label} scout">${t.icon} ${t.label}</span>`;
  }

  return { toast, initConnectivityBar, initProfileDropdown, requireAuth, requireProfileComplete, fmtDate, climbLabel, trustBadge };
})();
