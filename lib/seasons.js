/**
 * lib/seasons.js
 * Season + schema registry for CrowdScout.
 *
 * The FRC game changes every year, so the scouting schema changes too.
 * Schemas live in the `scout_schema_versions` table (JSONB) keyed by season —
 * adding support for a new game year means inserting one row there, with no
 * code changes on the analysis side.
 *
 * Include AFTER lib/supabase-client.js (and lib/schema2026.js if the bundled
 * offline fallback is wanted).
 *
 * Schema JSON format (same as window.CS.schema2026):
 *   {
 *     version, seasonYear, gameName,
 *     sections: [{ id, title, phase, fields: [{ id, type, label, config, aggregationType }] }],
 *     pointsModel: {                        — drives expected-points (CS-EPA) math
 *       auto:    [{ field, pointsPer? , points?, pointsMap? }],
 *       teleop:  [ … ],
 *       endgame: [ … ],
 *     }
 *   }
 *   pointsPer  — numeric field: value × pointsPer
 *   points     — boolean field: fraction-true × points
 *   pointsMap  — select field: expected value over the option distribution
 */
window.CS = window.CS || {};

window.CS.seasons = (function () {
  const LS_KEY = "cs_seasons_cache_v1";
  const CACHE_TTL = 60 * 60 * 1000; // 1 hour
  const DEFAULT_YEAR = 2026;

  let _mem = null; // { seasons: [{id, year, name}], schemas: { [year]: schemaJson } }

  function readCache() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL) return null;
      return data;
    } catch { return null; }
  }

  function writeCache(data) {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ ts: Date.now(), data })); }
    catch { /* storage full */ }
  }

  /** Fetch seasons + latest schema per season from Supabase (or cache). */
  async function load(force = false) {
    if (_mem && !force) return _mem;

    if (!force) {
      const cached = readCache();
      if (cached) { _mem = cached; return _mem; }
    }

    const db = window.CS.db;
    const fallback = bundledFallback();
    if (!db || !navigator.onLine) { _mem = _mem || fallback; return _mem; }

    try {
      const [{ data: seasons }, { data: schemaRows }] = await Promise.all([
        db.from("seasons").select("id,year,name").order("year", { ascending: false }),
        db.from("scout_schema_versions").select("id,season_id,version,schema,created_at").order("created_at", { ascending: false }),
      ]);

      if (!seasons?.length) { _mem = fallback; return _mem; }

      const schemas = {};
      const schemaVersionIds = {};
      for (const s of seasons) {
        // rows are newest-first, so the first hit per season is the latest version
        const row = (schemaRows || []).find(r => r.season_id === s.id);
        if (row?.schema) {
          schemas[s.year] = row.schema;
          schemaVersionIds[s.year] = row.id;
        }
      }
      // Bundled 2026 as offline safety net if the DB has no schema for it
      if (!schemas[2026] && window.CS.schema2026) schemas[2026] = window.CS.schema2026;

      _mem = { seasons, schemas, schemaVersionIds };
      writeCache(_mem);
      return _mem;
    } catch (e) {
      console.warn("[CS.seasons] load failed, using fallback:", e);
      _mem = _mem || fallback;
      return _mem;
    }
  }

  function bundledFallback() {
    const schemas = {};
    if (window.CS.schema2026) schemas[2026] = window.CS.schema2026;
    return {
      seasons: [{ id: null, year: 2026, name: "Rebuilt" }],
      schemas,
      schemaVersionIds: {},
    };
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /** All seasons, newest first: [{ id, year, name }] */
  async function list() {
    return (await load()).seasons;
  }

  /** Schema JSON for a year (null if none known). */
  async function getSchema(year) {
    const { schemas } = await load();
    return schemas[year] || null;
  }

  async function getSeasonId(year) {
    const { seasons } = await load();
    return seasons.find(s => s.year === Number(year))?.id ?? null;
  }

  /** FRC event keys start with the season year: "2026casj" → 2026. */
  function yearFromEventKey(key) {
    const y = parseInt(String(key || "").slice(0, 4));
    return Number.isFinite(y) && y > 1991 ? y : DEFAULT_YEAR;
  }

  /** Resolve the active year for a page: ?year= param wins, then localStorage, then default. */
  function activeYear() {
    const p = parseInt(new URLSearchParams(location.search).get("year"));
    if (Number.isFinite(p)) return p;
    const ls = parseInt(localStorage.getItem("cs_active_year"));
    if (Number.isFinite(ls)) return ls;
    return DEFAULT_YEAR;
  }

  function setActiveYear(year) {
    try { localStorage.setItem("cs_active_year", String(year)); } catch {}
  }

  /**
   * Render a year <select> into containerEl and invoke onChange(year) on switch.
   * Default behavior updates the ?year= query param (reloading the page state).
   */
  async function renderYearPicker(containerEl, selectedYear, onChange) {
    if (!containerEl) return;
    const seasons = await list();
    const years = seasons.map(s => s.year);
    if (!years.includes(selectedYear)) years.unshift(selectedYear);

    containerEl.innerHTML = `
      <select class="cs-select" style="width:auto;min-width:110px;font-weight:700" aria-label="Season">
        ${years.map(y => {
          const name = seasons.find(s => s.year === y)?.name;
          return `<option value="${y}" ${y === selectedYear ? "selected" : ""}>${y}${name ? " · " + name : ""}</option>`;
        }).join("")}
      </select>`;

    containerEl.querySelector("select").addEventListener("change", (e) => {
      const year = parseInt(e.target.value);
      setActiveYear(year);
      if (onChange) { onChange(year); return; }
      const url = new URL(location.href);
      url.searchParams.set("year", year);
      location.href = url.toString();
    });
  }

  return {
    DEFAULT_YEAR,
    load, list, getSchema, getSeasonId,
    yearFromEventKey, activeYear, setActiveYear,
    renderYearPicker,
    clearCache() { try { localStorage.removeItem(LS_KEY); } catch {} _mem = null; },
  };
})();
