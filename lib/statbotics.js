/**
 * lib/statbotics.js
 * Statbotics API v3 wrapper for CrowdScout.
 * No auth required — public API.
 * Docs: https://api.statbotics.io/v3/docs
 */
window.CS = window.CS || {};

window.CS.statbotics = (function () {
  const BASE = "https://api.statbotics.io/v3";
  const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  function cacheKey(path) { return "sb_cache_" + path.replace(/\//g, "_"); }

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
    catch { /* storage full */ }
  }

  async function get(path) {
    const cached = getCache(path);
    if (cached) return cached;
    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: { "Accept": "application/json" }
      });
      if (!res.ok) throw new Error(`Statbotics ${res.status}: ${path}`);
      const data = await res.json();
      setCache(path, data);
      return data;
    } catch (err) {
      console.warn("[CS.statbotics]", err.message);
      return null;
    }
  }

  return {
    /**
     * Get team season stats for a given year.
     * Key response fields:
     *   epa.breakdown.total_points   — flat number
     *   epa.breakdown.auto_points
     *   epa.breakdown.teleop_points
     *   epa.breakdown.endgame_points
     *   epa.ranks.total.rank         — overall rank
     *   epa.ranks.total.percentile   — 0–1 (1 = best)
     *   record.wins / .losses / .ties
     */
    getTeamYear: (teamNum, year) => get(`/team_year/${teamNum}/${year}`),

    /**
     * Get team's all-time info.
     */
    getTeam: (teamNum) => get(`/team/${teamNum}`),

    /**
     * Get all team-year records for an event.
     */
    getEventTeams: (eventKey) => get(`/team_events?event=${eventKey}&limit=100`),

    /**
     * Get a specific match's Statbotics data.
     */
    getMatch: (matchKey) => get(`/match/${matchKey}`),

    /**
     * Format an EPA value for display.
     * @param {number|null} val
     * @param {number} decimals
     */
    fmtEPA(val, decimals = 1) {
      if (val == null || isNaN(val)) return "—";
      return Number(val).toFixed(decimals);
    },
  };
})();
