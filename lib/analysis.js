/**
 * lib/analysis.js
 * Schema-driven analysis helpers for CrowdScout.
 *
 * Everything here is generic over the season schema JSON (see lib/seasons.js),
 * so analysis pages work for any game year without code changes.
 *
 * Depends on lib/reliability.js (aggregation) — include after it.
 *
 * Expected points ("CS-EPA") — CrowdScout's analog of Statbotics EPA, computed
 * from crowd-sourced observations instead of match-result regression:
 *   total = auto + teleop + endgame, per the schema's pointsModel.
 */
window.CS = window.CS || {};

window.CS.analysis = (function () {

  const PHASES = ["auto", "teleop", "endgame"];

  // ── Schema helpers ───────────────────────────────────────────────────────────

  function allFields(schema) {
    return (schema?.sections || []).flatMap(s => s.fields || []);
  }

  function nonTextFields(schema) {
    return allFields(schema).filter(f => f.type !== "text");
  }

  function fieldById(schema, id) {
    return allFields(schema).find(f => f.id === id) || null;
  }

  /** Label for a select/range option value. */
  function optionLabel(field, value) {
    const opts = field?.config?.options || field?.config?.ranges || [];
    return opts.find(o => o.value === value)?.label ?? (value == null || value === "" ? "—" : String(value));
  }

  const PHASE_SHORT = { auto: "Auto", teleop: "Teleop", endgame: "End", post_match: "Post" };

  /**
   * Field label with a phase prefix when the same label appears in multiple
   * sections (e.g. auto + teleop both have "FUEL Scored").
   */
  function phaseLabel(schema, field) {
    const dupes = allFields(schema).filter(f => f.label === field.label);
    if (dupes.length <= 1) return field.label;
    const section = (schema?.sections || []).find(sec => (sec.fields || []).some(f => f.id === field.id));
    const prefix = section ? (PHASE_SHORT[section.phase] || section.title) : null;
    return prefix ? `${prefix} ${field.label}` : field.label;
  }

  // ── Aggregation ──────────────────────────────────────────────────────────────

  /** Aggregate every non-text schema field across submissions. */
  function aggregateFields(subs, schema) {
    return window.CS.reliability.aggregateTeamStats(subs, nonTextFields(schema));
  }

  // ── Expected points (CS-EPA) ─────────────────────────────────────────────────

  function _weightedMeanOf(subs, mapFn) {
    let num = 0, den = 0;
    for (const s of subs) {
      const v = mapFn(s.answers || {});
      if (v == null || isNaN(v)) continue;
      const w = Number(s.reliability_score ?? 1) || 1;
      num += v * w;
      den += w;
    }
    return den > 0 ? num / den : null;
  }

  /**
   * Expected points for one phase from the schema's pointsModel.
   * Returns null when no entries produced a value (no data).
   */
  function _phasePoints(subs, entries) {
    if (!entries?.length || !subs.length) return null;
    let total = null;
    for (const entry of entries) {
      let v = null;
      if (entry.pointsPer != null) {
        v = _weightedMeanOf(subs, a => a[entry.field] != null ? Number(a[entry.field]) * entry.pointsPer : null);
      } else if (entry.points != null) {
        v = _weightedMeanOf(subs, a => a[entry.field] != null ? (a[entry.field] ? entry.points : 0) : null);
      } else if (entry.pointsMap) {
        v = _weightedMeanOf(subs, a => {
          const raw = a[entry.field];
          if (raw == null || raw === "") return null;
          return entry.pointsMap[raw] ?? null;
        });
      }
      if (v != null) total = (total ?? 0) + v;
    }
    return total;
  }

  /**
   * @param {object[]} subs   — scout submissions (answers + reliability_score)
   * @param {object}   schema — season schema JSON with pointsModel
   * @returns {{ total, auto, teleop, endgame, sampleSize }} (nulls when unknown)
   */
  function expectedPoints(subs, schema) {
    const pm = schema?.pointsModel;
    const clean = (subs || []).filter(s => !s._outlier);
    if (!pm || !clean.length) return { total: null, auto: null, teleop: null, endgame: null, sampleSize: clean.length };

    const out = { sampleSize: clean.length };
    let total = null;
    for (const phase of PHASES) {
      const v = _phasePoints(clean, pm[phase]);
      out[phase] = v;
      if (v != null) total = (total ?? 0) + v;
    }
    out.total = total;
    return out;
  }

  /**
   * Per-match expected points series for trend charts.
   * Groups submissions by event+match and orders chronologically (by earliest
   * submission time within each match, which tracks real match order closely).
   *
   * @returns {{ label, eventKey, matchNumber, matchType, points, auto, teleop, endgame, sampleSize, ts }[]}
   */
  function perMatchPoints(subs, schema) {
    const groups = new Map();
    for (const s of subs || []) {
      const key = `${s.event_key || "?"}|${s.match_type || "qualification"}|${s.match_number || 0}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    }

    const rows = [];
    for (const [key, groupSubs] of groups) {
      const [eventKey, matchType, matchNumber] = key.split("|");
      const pts = expectedPoints(groupSubs, schema);
      const ts = Math.min(...groupSubs.map(s => new Date(s.created_at || 0).getTime()));
      rows.push({
        label: `${matchType === "playoff" ? "P" : "Q"}${matchNumber}`,
        eventKey,
        matchType,
        matchNumber: parseInt(matchNumber),
        points: pts.total,
        auto: pts.auto, teleop: pts.teleop, endgame: pts.endgame,
        sampleSize: pts.sampleSize,
        ts,
      });
    }

    rows.sort((a, b) => a.ts - b.ts || a.matchNumber - b.matchNumber);
    return rows;
  }

  // ── Display formatting ───────────────────────────────────────────────────────

  /**
   * Human-readable value for an aggregated schema field.
   * Handles the aggregationType conventions from lib/reliability.js:
   *   boolean_percentage → mean is already 0–100
   *   mode               → mean holds the modal raw value
   *   average/sum/max    → numeric
   */
  function fieldDisplay(field, agg) {
    if (!agg || agg.mean == null) return "—";
    switch (field.aggregationType) {
      case "boolean_percentage":
        return Math.round(agg.mean) + "%";
      case "mode":
        return optionLabel(field, agg.mean);
      default:
        return typeof agg.mean === "number" ? Number(agg.mean).toFixed(1) : String(agg.mean);
    }
  }

  /** Value counts for select/boolean fields (for distribution charts). */
  function distribution(subs, field) {
    const counts = new Map();
    for (const s of subs || []) {
      let v = (s.answers || {})[field.id];
      if (v === undefined || v === null || v === "") continue;
      if (field.type === "boolean") v = v ? "Yes" : "No";
      else v = optionLabel(field, v);
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    return counts;
  }

  function fmtPts(v, decimals = 1) {
    return v == null || isNaN(v) ? "—" : Number(v).toFixed(decimals);
  }

  // ── Chart.js theming ─────────────────────────────────────────────────────────

  const chartColors = {
    primary: "#99e550",
    auto: "#60a5fa",
    teleop: "#c084fc",
    endgame: "#fbbf24",
    red: "#f87171",
    blue: "#60a5fa",
    grid: "rgba(140,174,157,.12)",
    text: "#8cae9d",
    palette: ["#99e550", "#60a5fa", "#c084fc", "#fbbf24", "#f87171", "#34d399", "#f472b6", "#a3a3a3"],
  };

  function baseChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: chartColors.text, boxWidth: 12, font: { size: 11 } } },
      },
      scales: {
        x: { ticks: { color: chartColors.text, font: { size: 10 } }, grid: { color: chartColors.grid } },
        y: { ticks: { color: chartColors.text, font: { size: 10 } }, grid: { color: chartColors.grid } },
      },
    };
  }

  return {
    allFields, nonTextFields, fieldById, optionLabel, phaseLabel,
    aggregateFields,
    expectedPoints, perMatchPoints,
    fieldDisplay, distribution, fmtPts,
    chartColors, baseChartOptions,
  };
})();
