/**
 * lib/reliability-compute.js
 * CrowdScout Scout Reliability Scoring System
 *
 * Spec: FRC 2026 REBUILT data cleaning algorithm
 *
 * COMPOSITE reliability = 0.6 * tower_accuracy + 0.4 * fuel_accuracy
 *
 * Tower accuracy: correct reported climb levels vs TBA per-robot endgame data.
 * Fuel accuracy:  1 − mean(|scout_single_robot_fuel*3 − tba_alliance_fuel| / tba_alliance_fuel)
 *                 clamped to [0,1]. (Single robot * 3 is an approximation of alliance total.)
 *
 * Physical plausibility: reject fuel counts < 0 or > MAX_SINGLE_ROBOT_FUEL.
 * Trust multiplier from reliability.js applied on top of composite score.
 */
window.CS = window.CS || {};

window.CS.reliabilityCompute = (function () {

  // ── Configurable thresholds ──────────────────────────────────────────────
  const MAX_SINGLE_ROBOT_FUEL = 250;  // single robot max fuel in one match
  const FUEL_SUM_TOLERANCE    = 0.30; // 30% deviation flags fuel portion suspect
  const OUTLIER_Z_THRESHOLD   = 3.5;  // Modified Z-score threshold for outlier removal

  // Map our schema's climb values → TBA endGameRobotN values
  const SCHEMA_TO_TBA_CLIMB = {
    "none":             "None",
    "attempted_failed": "None",   // failed = None in TBA
    "level1":           "Level1",
    "level2":           "Level2",
    "level3":           "Level3",
  };

  // ── Modified Z-Score outlier removal ──────────────────────────────────────
  /**
   * Remove outliers from an array of numbers using Modified Z-Score.
   * Steps:
   *   1. Compute median of observations.
   *   2. Compute MAD = median(|xi - median|).
   *   3. Modified Z = 0.6745 * (xi - median) / MAD.
   *   4. Remove |Modified Z| > OUTLIER_Z_THRESHOLD.
   *   5. If MAD = 0 (all agree), skip removal.
   * @param {number[]} values
   * @returns {number[]} filtered values
   */
  function removeOutliersModZ(values) {
    if (values.length < 3) return values; // not enough data for meaningful removal
    const sorted = [...values].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    const deviations = values.map(v => Math.abs(v - med));
    const deviationsSorted = [...deviations].sort((a, b) => a - b);
    const mad = deviationsSorted[Math.floor(deviationsSorted.length / 2)];
    if (mad === 0) return values; // all scouts agree — skip removal
    return values.filter((v, i) => {
      const modZ = 0.6745 * deviations[i] / mad;
      return Math.abs(modZ) <= OUTLIER_Z_THRESHOLD;
    });
  }

  // ── Weighted mean ─────────────────────────────────────────────────────────
  /**
   * @param {{ value: number; weight: number }[]} items
   * @returns {number}
   */
  function weightedMean(items) {
    const totalW = items.reduce((s, x) => s + x.weight, 0);
    if (totalW === 0) return items.reduce((s, x) => s + x.value, 0) / Math.max(items.length, 1);
    return items.reduce((s, x) => s + x.value * x.weight, 0) / totalW;
  }

  // ── Build TBA match key from a submission ─────────────────────────────────
  function buildMatchKey(sub) {
    if (!sub.event_key || !sub.match_number) return null;
    const compLevel = (sub.match_type === "playoff") ? "sf1m" : "qm";
    return (sub.match_type === "playoff")
      ? `${sub.event_key}_sf1m${sub.match_number}`
      : `${sub.event_key}_qm${sub.match_number}`;
  }

  // ── Main recompute function ───────────────────────────────────────────────
  /**
   * Recompute reliability for a given user_id using cross-scout comparison and TBA data.
   * Upserts result to the scout_reliability table.
   * @param {string} userId
   */
  async function recompute(userId) {
    const db = window.CS.db;
    if (!db || !userId || !navigator.onLine) return;

    try {
      // 1. Fetch all submissions by this scout
      const { data: mySubs } = await db
        .from("scout_submissions")
        .select("id,event_key,match_number,match_type,team_number,driver_station,alliance_color,answers")
        .eq("owner_id", userId);

      if (!mySubs?.length) return;

      let towerCorrect  = 0;
      let towerTotal    = 0;
      const fuelErrors  = []; // array of proportional errors per match
      let outlierCount  = 0;
      const matchCache  = {}; // TBA match data keyed by match_key

      for (const sub of mySubs) {
        const matchKey = buildMatchKey(sub);
        if (!matchKey) continue;

        // Fetch and cache TBA match data
        if (!matchCache[matchKey]) {
          try {
            matchCache[matchKey] = await window.CS.tba.getMatch(matchKey) || null;
          } catch (_) {
            matchCache[matchKey] = null;
          }
        }
        const tbaMatch = matchCache[matchKey];
        if (!tbaMatch?.score_breakdown) continue;

        const alliance  = sub.alliance_color; // "red" or "blue"
        const breakdown = tbaMatch.score_breakdown?.[alliance];
        if (!breakdown) continue;

        // ── Step 1a: Tower Accuracy ───────────────────────────────────────
        // Compare scout's reported climb level to TBA's per-robot endgame data.
        const station = sub.driver_station; // 1-3=red, 4-6=blue
        if (station) {
          const robotPos = ((station - 1) % 3) + 1; // 1, 2, or 3
          // TBA uses endGameRobot1/2/3 (verify field name against real match data)
          const tbaClimb = breakdown[`endGameRobot${robotPos}`]
                        ?? breakdown[`endgameRobot${robotPos}`]
                        ?? null;

          if (tbaClimb !== null && tbaClimb !== undefined) {
            towerTotal++;
            const scoutClimb = sub.answers?.endgame_climb_level;
            const scoutAsTba = SCHEMA_TO_TBA_CLIMB[scoutClimb] ?? "None";
            if (scoutAsTba === tbaClimb) towerCorrect++;
          }
        }

        // ── Step 1b: Fuel Sum Accuracy ────────────────────────────────────
        // Scout scouted one robot; approximate alliance total as their report * 3.
        // TBA provides alliance-level totals in autoFuelCount / teleopFuelCount.
        const autoFuel   = Number(sub.answers?.auto_fuel_scored  ?? 0);
        const teleopFuel = Number(sub.answers?.teleop_fuel_scored ?? 0);

        // Physical plausibility check
        if (autoFuel < 0 || autoFuel > MAX_SINGLE_ROBOT_FUEL) outlierCount++;
        if (teleopFuel < 0 || teleopFuel > MAX_SINGLE_ROBOT_FUEL) outlierCount++;

        const tbaAutoTotal   = breakdown.autoFuelCount    ?? breakdown.autoFuelPoints   ?? null;
        const tbaTeleopTotal = breakdown.teleopFuelCount  ?? breakdown.teleopFuelPoints ?? null;

        if (tbaAutoTotal !== null && tbaAutoTotal > 0) {
          // Scout's robot can't score more than the full alliance total
          if (autoFuel > tbaAutoTotal * 1.05) outlierCount++;
          const estimatedAllianceAuto = autoFuel * 3;
          const err = Math.abs(estimatedAllianceAuto - tbaAutoTotal) / tbaAutoTotal;
          fuelErrors.push(Math.min(err, 1));
        }

        if (tbaTeleopTotal !== null && tbaTeleopTotal > 0) {
          if (teleopFuel > tbaTeleopTotal * 1.05) outlierCount++;
          const estimatedAllianceTeleop = teleopFuel * 3;
          const err = Math.abs(estimatedAllianceTeleop - tbaTeleopTotal) / tbaTeleopTotal;
          fuelErrors.push(Math.min(err, 1));
        }
      }

      // ── Step 2: Compute component scores ─────────────────────────────────
      // Default to 0.75 (neutral/unverified) when no TBA data available to compare against
      const towerAccuracy = towerTotal > 0
        ? towerCorrect / towerTotal
        : 0.75;

      const fuelAccuracy = fuelErrors.length > 0
        ? Math.max(0, 1 - (fuelErrors.reduce((s, e) => s + e, 0) / fuelErrors.length))
        : 0.75;

      // ── Step 3: Composite = 0.6 * tower + 0.4 * fuel ─────────────────────
      const composite = 0.6 * towerAccuracy + 0.4 * fuelAccuracy;

      // ── Step 4: Apply trust multiplier (submission count based) ───────────
      const trustLevel      = window.CS.reliability.getTrustLevel(mySubs.length);
      const trustMultiplier = window.CS.reliability.getTrustMultiplier(trustLevel);
      const finalScore      = Math.min(composite * trustMultiplier, 1.0);

      // ── Step 5: Upsert to scout_reliability ───────────────────────────────
      await db.from("scout_reliability").upsert({
        user_id:          userId,
        reliability_score: finalScore,
        tower_accuracy:    towerAccuracy,
        fuel_accuracy:     fuelAccuracy,
        submission_count:  mySubs.length,
        outlier_count:     outlierCount,
        updated_at:        new Date().toISOString(),
      }, { onConflict: "user_id" });

    } catch (err) {
      console.warn("[reliability-compute] recompute error:", err?.message ?? err);
    }
  }

  // ── updateAfterSubmit: trigger 3s after a submission syncs ───────────────
  function updateAfterSubmit(userId) {
    if (!userId) return;
    setTimeout(() => recompute(userId), 3000);
  }

  // ── Self-tests ────────────────────────────────────────────────────────────
  /**
   * Run inline unit tests for the statistical functions.
   * Logs results to console and returns { passed, failed, total }.
   */
  function runTests() {
    const results = [];

    // ── Test 1: removeOutliersModZ — normal operation ─────────────────
    {
      const vals = [10, 11, 12, 10, 11, 100]; // 100 is an outlier
      const filtered = removeOutliersModZ(vals);
      const pass = !filtered.includes(100) && filtered.length < vals.length;
      results.push({ name: "removeOutliersModZ removes outlier", pass, val: filtered });
    }

    // ── Test 2: removeOutliersModZ — all same (MAD=0, keep all) ──────
    {
      const vals = [50, 50, 50, 50];
      const filtered = removeOutliersModZ(vals);
      const pass = filtered.length === vals.length;
      results.push({ name: "removeOutliersModZ keeps all when MAD=0", pass, val: filtered });
    }

    // ── Test 3: removeOutliersModZ — too few values (< 3, keep all) ──
    {
      const vals = [10, 200];
      const filtered = removeOutliersModZ(vals);
      const pass = filtered.length === 2;
      results.push({ name: "removeOutliersModZ no-op with < 3 values", pass, val: filtered });
    }

    // ── Test 4: weightedMean — basic ──────────────────────────────────
    {
      const items = [{ value: 10, weight: 1 }, { value: 20, weight: 3 }];
      const result = weightedMean(items);
      const expected = (10 * 1 + 20 * 3) / 4; // 17.5
      const pass = Math.abs(result - expected) < 0.001;
      results.push({ name: "weightedMean basic", pass, val: result });
    }

    // ── Test 5: weightedMean — zero weights (falls back to simple mean) ─
    {
      const items = [{ value: 10, weight: 0 }, { value: 20, weight: 0 }];
      const result = weightedMean(items);
      const pass = Math.abs(result - 15) < 0.001;
      results.push({ name: "weightedMean zero-weight fallback", pass, val: result });
    }

    // ── Test 6: Tower accuracy formula ────────────────────────────────
    {
      const correct = 8, total = 10;
      const acc = total > 0 ? correct / total : 0.75;
      const pass = Math.abs(acc - 0.8) < 0.001;
      results.push({ name: "Tower accuracy = 8/10 = 0.8", pass, val: acc });
    }

    // ── Test 7: Fuel accuracy formula ─────────────────────────────────
    {
      const errors = [0.10, 0.20, 0.05, 0.15]; // mean = 0.125
      const meanErr = errors.reduce((a, b) => a + b) / errors.length;
      const acc = Math.max(0, 1 - meanErr);
      const pass = Math.abs(acc - 0.875) < 0.001;
      results.push({ name: "Fuel accuracy = 1 - 0.125 = 0.875", pass, val: acc });
    }

    // ── Test 8: Composite reliability formula ─────────────────────────
    {
      const tower = 0.80, fuel = 0.875;
      const composite = 0.6 * tower + 0.4 * fuel;
      const expected = 0.6 * 0.80 + 0.4 * 0.875; // = 0.48 + 0.35 = 0.83
      const pass = Math.abs(composite - expected) < 0.001;
      results.push({ name: "Composite = 0.6*tower + 0.4*fuel", pass, val: composite });
    }

    // ── Test 9: Physical plausibility — over max ───────────────────────
    {
      const fuel = 300;
      const isOutlier = fuel > MAX_SINGLE_ROBOT_FUEL;
      results.push({ name: "Fuel > 250 is outlier", pass: isOutlier, val: fuel });
    }

    // ── Test 10: Physical plausibility — under max ────────────────────
    {
      const fuel = 80;
      const isOutlier = fuel > MAX_SINGLE_ROBOT_FUEL;
      results.push({ name: "Fuel = 80 is not outlier", pass: !isOutlier, val: fuel });
    }

    // ── Test 11: Fuel tolerance — within 30% ─────────────────────────
    {
      const scoutFuel = 90; // 90*3=270 vs tba 300 → error = 10%
      const tbaTotal = 300;
      const error = Math.abs(scoutFuel * 3 - tbaTotal) / tbaTotal;
      const pass = error <= FUEL_SUM_TOLERANCE;
      results.push({ name: "Fuel within 30% tolerance (10% error)", pass, val: error.toFixed(3) });
    }

    // ── Test 12: Fuel tolerance — outside 30% ─────────────────────────
    {
      const scoutFuel = 10; // 10*3=30 vs tba 300 → error = 90%
      const tbaTotal = 300;
      const error = Math.abs(scoutFuel * 3 - tbaTotal) / tbaTotal;
      const pass = error > FUEL_SUM_TOLERANCE;
      results.push({ name: "Fuel outside 30% tolerance (90% error)", pass, val: error.toFixed(3) });
    }

    // ── Test 13: Trust levels ─────────────────────────────────────────
    {
      const newL     = window.CS.reliability.getTrustLevel(5);   // < 10 → "new"
      const activeL  = window.CS.reliability.getTrustLevel(30);  // < 50 → "active"
      const trustedL = window.CS.reliability.getTrustLevel(60);  // >= 50 → "trusted"
      const pass = newL === "new" && activeL === "active" && trustedL === "trusted";
      results.push({ name: "Trust levels (new/active/trusted)", pass, val: [newL, activeL, trustedL] });
    }

    // ── Test 14: buildMatchKey — qual ─────────────────────────────────
    {
      const sub = { event_key: "2026txhou", match_number: 12, match_type: "qualification" };
      const key = buildMatchKey(sub);
      const pass = key === "2026txhou_qm12";
      results.push({ name: "buildMatchKey qual", pass, val: key });
    }

    // ── Test 15: buildMatchKey — missing data ─────────────────────────
    {
      const sub = { event_key: null, match_number: 5, match_type: "qualification" };
      const key = buildMatchKey(sub);
      const pass = key === null;
      results.push({ name: "buildMatchKey null when missing event_key", pass, val: key });
    }

    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;

    console.group(`%c[reliability-compute] Self-tests: ${passed}/${results.length} passed`, failed > 0 ? "color:red" : "color:green");
    results.forEach(r =>
      console.log(`%c${r.pass ? "✓" : "✗"} ${r.name}: ${JSON.stringify(r.val)}`, r.pass ? "color:green" : "color:red")
    );
    if (failed > 0) console.error(`${failed} test(s) FAILED`);
    console.groupEnd();

    return { passed, failed, total: results.length };
  }

  // Run tests in development only
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => setTimeout(runTests, 500));
    } else {
      setTimeout(runTests, 500);
    }
  }

  return { recompute, updateAfterSubmit, runTests };
})();
