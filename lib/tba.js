/**
 * lib/tba.js
 * The Blue Alliance API v3 wrapper for CrowdScout.
 * Caches responses in localStorage with a 5-minute TTL.
 */
window.CS = window.CS || {};

window.CS.tba = (function () {
  const BASE = "https://www.thebluealliance.com/api/v3";
  // TBA read key — safe to be public (read-only)
  const API_KEY = window.CS_TBA_KEY || "";
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  function cacheKey(path) { return "tba_cache_" + path.replace(/\//g, "_"); }

  function getCache(path) {
    try {
      const raw = localStorage.getItem(cacheKey(path));
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL) return null;
      return data;
    } catch { return null; }
  }

  function setCache(path, data) {
    try { localStorage.setItem(cacheKey(path), JSON.stringify({ ts: Date.now(), data })); }
    catch { /* storage full — ignore */ }
  }

  async function get(path) {
    const cached = getCache(path);
    if (cached) return cached;

    if (!API_KEY) {
      console.warn("[CS.tba] No TBA API key set. Set window.CS_TBA_KEY before loading tba.js.");
      return null;
    }

    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: { "X-TBA-Auth-Key": API_KEY },
      });
      if (!res.ok) throw new Error(`TBA ${res.status}: ${path}`);
      const data = await res.json();
      setCache(path, data);
      return data;
    } catch (err) {
      console.error("[CS.tba]", err);
      return null;
    }
  }

  return {
    // Team info
    getTeam: (n) => get(`/team/frc${n}`),
    getTeamEvents: (n, year) => get(`/team/frc${n}/events/${year}`),
    getTeamEventMatches: (n, eventKey) => get(`/team/frc${n}/event/${eventKey}/matches`),

    // Event info
    getEvent: (key) => get(`/event/${key}`),
    getEventTeams: (key) => get(`/event/${key}/teams`),
    getEventMatches: (key) => get(`/event/${key}/matches`),
    getEventRankings: (key) => get(`/event/${key}/rankings`),

    // Season events
    getSeasonEvents: (year) => get(`/events/${year}/simple`),

    // Match results
    getMatch: (key) => get(`/match/${key}`),

    // Team search helper (simple name match from teams list)
    searchTeams: async (query, year = 2026) => {
      if (!query || query.length < 2) return [];
      // Try number search first
      if (/^\d+$/.test(query.trim())) {
        const t = await get(`/team/frc${query.trim()}/simple`);
        return t ? [t] : [];
      }
      // Paginated search would require many calls — return empty for now and let UI use local cache
      return [];
    },

    clearCache() {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith("tba_cache_"));
      keys.forEach((k) => localStorage.removeItem(k));
    },
  };
})();
