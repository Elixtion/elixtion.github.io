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

    // Season events — full endpoint includes week, event_type_string needed for filtering
    getSeasonEvents: (year) => get(`/events/${year}`),

    // Match results
    getMatch: (key) => get(`/match/${key}`),

    // Team media (photos, etc.) for a given year
    getTeamMedia: (n, year) => get(`/team/frc${n}/media/${year}`),

    // Team social media links
    getTeamSocial: (n) => get(`/team/frc${n}/social_media`),

    // Team years participated
    getTeamYears: (n) => get(`/team/frc${n}/years_participated`),

    // Team search helper
    searchTeams: async (query, year = 2026) => {
      if (!query || query.length < 2) return [];
      // Direct team number lookup
      if (/^\d+$/.test(query.trim())) {
        const t = await get(`/team/frc${query.trim()}/simple`);
        return t ? [t] : [];
      }
      // Partial number — try a few nearby teams
      if (/^\d+$/.test(query.trim().replace(/\s/g, ""))) {
        const n = parseInt(query.trim());
        const results = await Promise.all(
          [n, n * 10, n * 10 + 1].map(x => get(`/team/frc${x}/simple`))
        );
        return results.filter(Boolean);
      }
      // Name search — search cached pages
      return [];
    },

    /**
     * Fetch a paginated page of teams for a year (500 per page, 0-indexed).
     * Used for bulk caching / name search.
     */
    getTeamsPage: (year, page) => get(`/teams/${year}/${page}/simple`),

    /**
     * Extract a usable photo URL from TBA media array.
     * Prefers imgur/cdphotothread; falls back to avatar.
     */
    getBestPhoto(mediaArray) {
      if (!mediaArray || !mediaArray.length) return null;
      // Prefer high-res image types
      const preferred = ["imgur", "cdphotothread", "grabcad"];
      for (const type of preferred) {
        const item = mediaArray.find(m => m.type === type && m.direct_url);
        if (item) return item.direct_url;
      }
      // Fall back to any with a direct_url
      const any = mediaArray.find(m => m.direct_url);
      if (any) return any.direct_url;
      // Avatar fallback
      const avatar = mediaArray.find(m => m.type === "avatar" && m.details?.base64Image);
      if (avatar) return `data:image/png;base64,${avatar.details.base64Image}`;
      return null;
    },

    clearCache() {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith("tba_cache_"));
      keys.forEach((k) => localStorage.removeItem(k));
    },
  };
})();
