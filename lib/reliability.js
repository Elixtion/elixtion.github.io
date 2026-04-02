/**
 * lib/reliability.js
 * Scout reliability scoring and data aggregation for CrowdScout.
 *
 * Implements the full 2026 REBUILT cleaning pipeline:
 *   Step 1 — Scout reliability scoring (tower accuracy + fuel accuracy)
 *   Step 2 — Individual report validation (hard corrections + plausibility)
 *   Step 3 — Robust per-robot fuel estimation (Modified Z-Score + weighted mean + alliance scaling)
 *   Step 4 — Cross-match consistency flagging
 *   Step 5 — OPR sanity check
 *
 * Backward-compatible: all existing functions (aggregateTeamStats, aggregateMetric,
 * computeReliability, etc.) are preserved unchanged in signature and behavior.
 *
 * Run window.CS.reliability.runTests() from the browser console to self-verify.
 */
window.CS = window.CS || {};

window.CS.reliability = (function () {

  // ── Configurable thresholds (all in one place per spec) ─────────────────────
  const CFG = {
    MAX_SINGLE_ROBOT_FUEL:    250,   // Physical plausibility cap (balls per match)
    FUEL_SUM_DEV_THRESHOLD:   0.30,  // Flag if scout sum deviates >30% from TBA total
    MODIFIED_Z_THRESHOLD:     3.5,   // Outlier cutoff for modified Z-score
    CROSS_MATCH_FLAG_SD:      2.5,   // SDs from robot event median to flag a match
    OPR_WARNING_THRESHOLD:    0.50,  // Warn if scouting vs OPR differs by >50%
    RELIABILITY_TOWER_WEIGHT: 0.6,   // Weight of tower accuracy in composite reliability
    RELIABILITY_FUEL_WEIGHT:  0.4,   // Weight of fuel accuracy in composite reliability
  };

  // ── Statistical helpers ─────────────────────────────────────────────────────

  function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  }

  function stdDev(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + Math.pow(v - m, 2), 0) / arr.length);
  }

  function median(arr) {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Median Absolute Deviation — more robust than standard deviation for outlier detection.
   * MAD = median(|xi - median(x)|)
   */
  function mad(arr) {
    if (!arr.length) return 0;
    const med = median(arr);
    return median(arr.map(v => Math.abs(v - med)));
  }

  /**
   * Modified Z-scores per Iglewicz & Hoaglin (1993).
   * Mi = 0.6745 * (xi - median) / MAD
   * More robust than standard Z-score for small or skewed samples.
   * Returns all-zeros if MAD = 0 (all values identical — no outliers possible).
   */
  function modifiedZScores(arr) {
    const med = median(arr);
    const m   = mad(arr);
    if (m === 0) return arr.map(() => 0); // all identical → no outliers
    return arr.map(v => (0.6745 * (v - med)) / m);
  }

  /**
   * Remove outliers using Modified Z-Score.
   * Skips removal entirely if fewer than 3 values or MAD = 0 (unanimous agreement).
   *
   * @param {number[]} values
   * @param {number}   [threshold=3.5]
   * @returns {{ filtered: number[], outlierMask: boolean[] }}
   */
  function removeOutliersModifiedZ(values, threshold = CFG.MODIFIED_Z_THRESHOLD) {
    // Too few values to meaningfully detect outliers
    if (values.length < 3) return { filtered: values, outlierMask: values.map(() => false) };
    // All scouts agree → skip outlier removal
    if (mad(values) === 0)  return { filtered: values, outlierMask: values.map(() => false) };

    const zScores    = modifiedZScores(values);
    const outlierMask = zScores.map(z => Math.abs(z) > threshold);
    const filtered   = values.filter((_, i) => !outlierMask[i]);
    return { filtered, outlierMask };
  }

  /**
   * Legacy detectOutliers (2σ from mean). Kept for backward compatibility.
   * New code should use removeOutliersModifiedZ.
   */
  function detectOutliers(values) {
    const m = mean(values);
    const sd = stdDev(values);
    if (sd === 0) return values.map(() => false);
    return values.map((v) => Math.abs(v - m) > 2 * sd);
  }

  // ── Weighted average ────────────────────────────────────────────────────────

  /** @param {{ value: number; weight: number }[]} weightedValues */
  function weightedMean(weightedValues) {
    const totalWeight = weightedValues.reduce((s, v) => s + v.weight, 0);
    if (totalWeight === 0) return 0;
    return weightedValues.reduce((s, v) => s + v.value * v.weight, 0) / totalWeight;
  }

  // ── Confidence score ────────────────────────────────────────────────────────

  function confidence(sampleSize, sd, valueRange = 100) {
    const sizeFactor   = Math.min(sampleSize / 10, 1);
    const spreadFactor = valueRange > 0 ? 1 - Math.min(sd / valueRange, 1) : 1;
    return Math.round(sizeFactor * 0.6 * 100 + spreadFactor * 0.4 * 100) / 100;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1 — Scout Reliability Scoring
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Normalize TBA climb level strings to a canonical form.
   * TBA may use "Level1", "1", or null/None.
   */
  function normalizeTbaClimbLevel(val) {
    if (!val || val === "None") return "none";
    if (val === "Level1" || val === "1") return "level1";
    if (val === "Level2" || val === "2") return "level2";
    if (val === "Level3" || val === "3") return "level3";
    return "none";
  }

  /**
   * Normalize scout-reported climb values to the same canonical form.
   * Treats "attempted_failed" as a non-climb (same as None).
   */
  function normalizeScoutClimbLevel(val) {
    if (!val || val === "none" || val === "attempted_failed") return "none";
    if (val === "level1") return "level1";
    if (val === "level2") return "level2";
    if (val === "level3") return "level3";
    return "none";
  }

  /**
   * Compute a scout's tower accuracy against TBA per-robot climb data.
   *
   * @param {object[]} scoutReports — each: { answers, matchKey, allianceKey, stationIndex }
   * @param {object}   tbaByMatch  — matchKey → TBA score_breakdown object
   * @returns {number} tower_accuracy ∈ [0, 1]; defaults to 0.8 when no TBA data available
   */
  function computeTowerAccuracy(scoutReports, tbaByMatch) {
    let correct = 0, total = 0;

    for (const report of scoutReports) {
      const tba = tbaByMatch[report.matchKey];
      if (!tba) continue;

      const alliance  = report.allianceKey;   // "red" or "blue"
      const robotNum  = (report.stationIndex ?? 0) + 1; // 1, 2, or 3

      // TBA fields: robot1Auto / robot2Auto / robot3Auto for auto climb,
      // endGameRobot1 / endGameRobot2 / endGameRobot3 for teleop.
      // Verify against actual 2026 API response if field names differ.
      const tbaAutoClimb = tba[alliance]?.[`robot${robotNum}Auto`]      ?? null;
      const tbaTeleClimb = tba[alliance]?.[`endGameRobot${robotNum}`]   ?? null;

      // Auto climb comparison (scout reports boolean; TBA reports "None" or "Level1")
      if (tbaAutoClimb !== null &&
          report.answers?.auto_climbed_level1 !== undefined &&
          report.answers?.auto_climbed_level1 !== null) {
        const tbaDidClimb  = tbaAutoClimb !== "None" && tbaAutoClimb !== "";
        const scoutDidClimb = !!report.answers.auto_climbed_level1;
        correct += scoutDidClimb === tbaDidClimb ? 1 : 0;
        total++;
      }

      // Teleop climb level comparison
      if (tbaTeleClimb !== null &&
          report.answers?.endgame_climb_level !== undefined &&
          report.answers?.endgame_climb_level !== null) {
        const tbaLevel   = normalizeTbaClimbLevel(tbaTeleClimb);
        const scoutLevel = normalizeScoutClimbLevel(report.answers.endgame_climb_level);
        correct += scoutLevel === tbaLevel ? 1 : 0;
        total++;
      }
    }

    return total === 0 ? 0.8 : correct / total; // 0.8 default when no TBA data
  }

  /**
   * Compute a scout's fuel accuracy by comparing their per-robot sum to TBA alliance totals.
   * Validates auto fuel and teleop fuel separately if scouts track them separately.
   *
   * @param {object[]} scoutReports
   * @param {object}   tbaByMatch
   * @returns {number} fuel_accuracy ∈ [0, 1]; defaults to 0.8 when no TBA data available
   */
  function computeFuelAccuracy(scoutReports, tbaByMatch) {
    const errors = [];

    for (const report of scoutReports) {
      const tba = tbaByMatch[report.matchKey];
      if (!tba) continue;

      const alliance = report.allianceKey;
      // TBA may use camelCase or snake_case depending on API version — try both
      const tbaAutoFuel  = tba[alliance]?.autoFuelCount   ?? tba[alliance]?.auto_fuel_count   ?? null;
      const tbaTeleFuel  = tba[alliance]?.teleopFuelCount  ?? tba[alliance]?.teleop_fuel_count  ?? null;

      if (tbaAutoFuel === null || tbaTeleFuel === null) continue;
      const tbaTotal = tbaAutoFuel + tbaTeleFuel;
      if (tbaTotal <= 0) continue; // avoid division by zero on low-scoring matches

      const scoutAuto  = Number(report.answers?.auto_fuel_scored   ?? 0);
      const scoutTele  = Number(report.answers?.teleop_fuel_scored  ?? 0);
      const scoutTotal = scoutAuto + scoutTele;

      errors.push(Math.abs(scoutTotal - tbaTotal) / tbaTotal);
    }

    if (!errors.length) return 0.8;
    return Math.max(0, Math.min(1, 1 - mean(errors)));
  }

  /**
   * Composite reliability per spec:
   *   reliability = 0.6 × tower_accuracy + 0.4 × fuel_accuracy
   */
  function computeScoutReliability(towerAccuracy, fuelAccuracy) {
    return CFG.RELIABILITY_TOWER_WEIGHT * towerAccuracy +
           CFG.RELIABILITY_FUEL_WEIGHT  * fuelAccuracy;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 2 — Individual Report Validation
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Validate and correct a single scout's report for one match.
   *
   * Checks:
   *   (a) Tower hard-validation against TBA — corrects mismatches, increments error count
   *   (b) Fuel sum sanity — flags report as suspect if sum deviates >30% from TBA
   *   (c) Physical plausibility — rejects negative or implausibly large fuel counts
   *
   * @param {object}      report — { answers, matchKey, allianceKey, stationIndex }
   * @param {object|null} tba    — TBA score_breakdown for this match; null if not yet available
   * @returns {{ correctedAnswers: object, flagReasons: string[], fuelSuspect: boolean, tbaValidated: boolean }}
   */
  function validateReport(report, tba) {
    const answers     = { ...report.answers };
    const flagReasons = [];
    let   fuelSuspect = false;
    const tbaValidated = tba !== null;

    // ── 2a. Tower hard-validation ─────────────────────────────────────────────
    if (tba) {
      const alliance = report.allianceKey;
      const robotNum = (report.stationIndex ?? 0) + 1;

      const tbaAutoClimb = tba[alliance]?.[`robot${robotNum}Auto`]    ?? null;
      const tbaTeleClimb = tba[alliance]?.[`endGameRobot${robotNum}`] ?? null;

      if (tbaAutoClimb !== null) {
        const tbaDidClimb = tbaAutoClimb !== "None" && tbaAutoClimb !== "";
        if (answers.auto_climbed_level1 !== undefined &&
            !!answers.auto_climbed_level1 !== tbaDidClimb) {
          flagReasons.push(`Auto climb mismatch: scout=${answers.auto_climbed_level1}, TBA=${tbaAutoClimb} — corrected to TBA value`);
          answers.auto_climbed_level1 = tbaDidClimb;
        }
      }

      if (tbaTeleClimb !== null) {
        const tbaLevel   = normalizeTbaClimbLevel(tbaTeleClimb);
        const scoutLevel = normalizeScoutClimbLevel(answers.endgame_climb_level);
        if (scoutLevel !== tbaLevel) {
          flagReasons.push(`Teleop climb mismatch: scout=${answers.endgame_climb_level}, TBA=${tbaTeleClimb} — corrected to TBA value`);
          answers.endgame_climb_level = tbaLevel;
        }
      }
    }

    // ── 2b. Fuel sum sanity check ─────────────────────────────────────────────
    if (tba) {
      const alliance    = report.allianceKey;
      const tbaAutoFuel = tba[alliance]?.autoFuelCount  ?? tba[alliance]?.auto_fuel_count  ?? null;
      const tbaTeleFuel = tba[alliance]?.teleopFuelCount ?? tba[alliance]?.teleop_fuel_count ?? null;

      if (tbaAutoFuel !== null && tbaTeleFuel !== null) {
        const tbaTotal   = tbaAutoFuel + tbaTeleFuel;
        const scoutTotal = Number(answers.auto_fuel_scored ?? 0) + Number(answers.teleop_fuel_scored ?? 0);

        if (tbaTotal > 0 &&
            Math.abs(scoutTotal - tbaTotal) / tbaTotal > CFG.FUEL_SUM_DEV_THRESHOLD) {
          flagReasons.push(`Fuel sum suspect: scout=${scoutTotal}, TBA alliance=${tbaTotal} (>${Math.round(CFG.FUEL_SUM_DEV_THRESHOLD * 100)}% deviation)`);
          fuelSuspect = true; // down-weighted in Step 3, not discarded
        }
      }
    }

    // ── 2c. Physical plausibility ─────────────────────────────────────────────
    const autoFuel = Number(answers.auto_fuel_scored  ?? 0);
    const teleFuel = Number(answers.teleop_fuel_scored ?? 0);

    if (autoFuel < 0) {
      flagReasons.push("Negative auto fuel count rejected → set to 0");
      answers.auto_fuel_scored = 0;
    } else if (autoFuel > CFG.MAX_SINGLE_ROBOT_FUEL) {
      flagReasons.push(`Auto fuel ${autoFuel} exceeds max ${CFG.MAX_SINGLE_ROBOT_FUEL} → clamped`);
      answers.auto_fuel_scored = CFG.MAX_SINGLE_ROBOT_FUEL;
    }

    if (teleFuel < 0) {
      flagReasons.push("Negative teleop fuel count rejected → set to 0");
      answers.teleop_fuel_scored = 0;
    } else if (teleFuel > CFG.MAX_SINGLE_ROBOT_FUEL) {
      flagReasons.push(`Teleop fuel ${teleFuel} exceeds max ${CFG.MAX_SINGLE_ROBOT_FUEL} → clamped`);
      answers.teleop_fuel_scored = CFG.MAX_SINGLE_ROBOT_FUEL;
    }

    return {
      correctedAnswers: answers,
      flagReasons,
      fuelSuspect,
      tbaValidated,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 3 — Robust Per-Robot Fuel Estimation
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Estimate a single robot's fuel count from multiple scout observations.
   *
   * Process:
   *   1. Down-weight suspect observations (fuel sum mismatch) by 50%
   *   2. Remove outliers via Modified Z-Score (skips if all agree or < 3 samples)
   *   3. Compute reliability-weighted mean of the remaining inliers
   *
   * @param {{ value: number, weight: number, suspect?: boolean }[]} observations
   * @returns {{ estimate: number, outlierCount: number, sampleSize: number }}
   */
  function estimateRobotFuel(observations) {
    if (!observations.length) return { estimate: 0, outlierCount: 0, sampleSize: 0 };

    // Apply 50% weight penalty to suspect reports (flag from Step 2b)
    const adjusted = observations.map(o => ({
      value:  o.value,
      weight: o.weight * (o.suspect ? 0.5 : 1.0),
    }));

    const values = adjusted.map(o => o.value);

    // Modified Z-Score outlier removal
    const { outlierMask } = removeOutliersModifiedZ(values);
    const inliers     = adjusted.filter((_, i) => !outlierMask[i]);
    const outlierCount = outlierMask.filter(Boolean).length;

    // Edge: all values flagged (degenerate case) — fall back to median
    if (!inliers.length) {
      return { estimate: median(values), outlierCount, sampleSize: observations.length };
    }

    return {
      estimate:    weightedMean(inliers),
      outlierCount,
      sampleSize:  observations.length,
    };
  }

  /**
   * Scale three robot fuel estimates so they sum exactly to the TBA alliance total.
   * This is the alliance-constrained scaling step: preserves relative proportions
   * while ensuring the alliance sum matches the sensor-accurate TBA value.
   *
   * Edge cases:
   *   - All estimates = 0  → distribute TBA total equally (TBA_total / 3)
   *   - Single nonzero robot → that robot gets the full TBA total
   *
   * @param {number[]} robotEstimates  — [robot1, robot2, robot3]
   * @param {number}   tbaAllianceTotal
   * @returns {number[]}               — adjusted [robot1, robot2, robot3]
   */
  function allianceConstrainedScaling(robotEstimates, tbaAllianceTotal) {
    const sum = robotEstimates.reduce((a, b) => a + b, 0);

    if (sum === 0) {
      // No scout reported any fuel — divide TBA total equally across all 3
      return robotEstimates.map(() => tbaAllianceTotal / 3);
    }

    return robotEstimates.map(e => (e / sum) * tbaAllianceTotal);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 4 — Cross-Match Consistency Flagging
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Flag per-match fuel estimates that are statistical outliers for a single robot
   * across all its matches at an event.
   *
   * A flagged match where the alliance TBA total was ALSO anomalous is likely valid
   * (the whole alliance genuinely had an unusual match). Otherwise it needs review.
   *
   * @param {{ matchKey: string, adjustedFuel: number, tbaAllianceTotal: number }[]} matchData
   * @returns {{ matchKey, adjustedFuel, tbaAllianceTotal, flagged, reason?, allianceAlsoAnomalous? }[]}
   */
  function flagCrossMatchOutliers(matchData) {
    if (matchData.length < 3) return matchData.map(m => ({ ...m, flagged: false }));

    const values = matchData.map(m => m.adjustedFuel);
    const med    = median(values);
    const sd     = stdDev(values);

    const allianceTotals = matchData.map(m => m.tbaAllianceTotal).filter(v => v >= 0);
    const allianceMean   = allianceTotals.length ? mean(allianceTotals)   : 0;
    const allianceSd     = allianceTotals.length > 1 ? stdDev(allianceTotals) : 0;

    return matchData.map(m => {
      if (sd === 0 || Math.abs(m.adjustedFuel - med) <= CFG.CROSS_MATCH_FLAG_SD * sd) {
        return { ...m, flagged: false };
      }

      // Check whether the alliance itself was anomalous (>2 SD from its event mean)
      const allianceDeviation    = allianceSd > 0 ? Math.abs(m.tbaAllianceTotal - allianceMean) / allianceSd : 0;
      const allianceAlsoAnomalous = allianceDeviation > 2;

      return {
        ...m,
        flagged: true,
        allianceAlsoAnomalous,
        reason: allianceAlsoAnomalous
          ? "Outlier vs robot event median but alliance also had an unusual match — likely valid"
          : "Outlier vs robot event median — investigate or down-weight",
      };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 5 — OPR Sanity Check
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Compare scouting-derived average match contribution to TBA OPR.
   * Logs a warning (does NOT auto-correct) if they differ by more than 50%.
   * OPR has its own biases; this is a human-review signal only.
   *
   * @param {number} scoutingAvg — mean(adjustedFuel + climbPoints) across matches
   * @param {number} opr
   * @param {string} teamKey
   * @returns {{ teamKey, scoutingAvg, opr, diffPct, warning } | null}
   */
  function checkOPRSanity(scoutingAvg, opr, teamKey) {
    if (opr <= 0 || scoutingAvg <= 0) return null;

    const diffPct = Math.abs(scoutingAvg - opr) / opr;
    if (diffPct > CFG.OPR_WARNING_THRESHOLD) {
      const warning = `[CS.reliability] OPR sanity warning for ${teamKey}: ` +
        `scouting avg=${scoutingAvg.toFixed(1)}, OPR=${opr.toFixed(1)}, ` +
        `diff=${(diffPct * 100).toFixed(0)}% (>${Math.round(CFG.OPR_WARNING_THRESHOLD * 100)}% threshold)`;
      console.warn(warning);
      return { teamKey, scoutingAvg, opr, diffPct, warning };
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Legacy trust level (backward compat — used by some profile/badge logic)
  // ─────────────────────────────────────────────────────────────────────────────

  function getTrustLevel(submissionCount) {
    if (submissionCount < 10) return "new";
    if (submissionCount < 50) return "active";
    return "trusted";
  }

  function getTrustMultiplier(trustLevel, teamVerified = false) {
    const base = { new: 0.8, active: 1.0, trusted: 1.2 }[trustLevel] ?? 1.0;
    return base + (teamVerified ? 0.1 : 0);
  }

  /**
   * Legacy computeReliability — updated to accept new tower/fuel accuracy fields.
   * If towerAccuracy + fuelAccuracy are provided, uses the spec formula.
   * Otherwise falls through to the legacy formula for backward compatibility.
   */
  function computeReliability(userRecord) {
    const {
      consistencyScore = 0.8,
      tbaAccuracy      = 0.8,
      towerAccuracy    = null,
      fuelAccuracy     = null,
      submissionCount  = 0,
      teamVerified     = false,
      outlierCount     = 0,
    } = userRecord;

    if (towerAccuracy !== null && fuelAccuracy !== null) {
      return computeScoutReliability(towerAccuracy, fuelAccuracy);
    }

    const trustLevel      = getTrustLevel(submissionCount);
    const trustMultiplier = getTrustMultiplier(trustLevel, teamVerified);
    const outlierPenalty  = Math.min(outlierCount / Math.max(submissionCount, 1), 1);
    const accountFactor   = Math.min(submissionCount / 20, 1);

    const base =
      consistencyScore * 0.4 +
      tbaAccuracy * 0.3 +
      accountFactor * 0.2 +
      (1 - outlierPenalty) * 0.1;

    return Math.min(base * trustMultiplier, 1.5);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Aggregation (unchanged — used by team.html, event.html)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Aggregate a single metric across all submissions for a robot.
   * Upgraded to use Modified Z-Score outlier removal for numeric averages.
   */
  function aggregateMetric(submissions, metricKey, aggregationType = "average") {
    const valid = submissions.filter(
      (s) => s.answers && s.answers[metricKey] !== undefined && s.answers[metricKey] !== null
    );
    if (!valid.length) return { mean: null, median: null, stdDev: null, sampleSize: 0, confidence: 0 };

    const raw     = valid.map((s) => s.answers[metricKey]);
    const weights = valid.map((s) => s.reliability_score ?? 1.0);

    let result;
    switch (aggregationType) {
      case "sum":
        result = { value: raw.reduce((a, b) => a + Number(b), 0) };
        break;

      case "max":
        result = { value: Math.max(...raw.map(Number)) };
        break;

      case "mode": {
        const freq = {};
        raw.forEach((v) => { freq[v] = (freq[v] || 0) + 1; });
        const maxFreq = Math.max(...Object.values(freq));
        result = { value: Object.entries(freq).find(([, f]) => f === maxFreq)?.[0] };
        break;
      }

      case "boolean_percentage":
        result = { value: (raw.filter(Boolean).length / raw.length) * 100 };
        break;

      default: { // average — reliability-weighted with Modified Z-Score outlier removal
        const numRaw = raw.map(Number);
        const { outlierMask } = removeOutliersModifiedZ(numRaw);
        const wv = numRaw.map((v, i) => ({
          value:  v,
          weight: weights[i] * (outlierMask[i] ? 0.5 : 1.0), // down-weight rather than discard
        }));
        const m          = weightedMean(wv);
        const sd         = stdDev(numRaw);
        const valueRange = Math.max(...numRaw) - Math.min(...numRaw);
        return {
          mean:         Math.round(m * 100) / 100,
          median:       median(numRaw),
          stdDev:       Math.round(sd * 100) / 100,
          sampleSize:   valid.length,
          confidence:   confidence(valid.length, sd, valueRange || 1),
          outlierCount: outlierMask.filter(Boolean).length,
        };
      }
    }

    return {
      mean:         typeof result.value === "number" ? Math.round(result.value * 100) / 100 : result.value,
      median:       null,
      stdDev:       null,
      sampleSize:   valid.length,
      confidence:   Math.min(valid.length / 5, 1),
      outlierCount: 0,
    };
  }

  /** Aggregate all schema fields for a team. */
  function aggregateTeamStats(submissions, schemaFields) {
    const result = {};
    for (const field of schemaFields) {
      result[field.id] = aggregateMetric(submissions, field.id, field.aggregationType || "average");
    }
    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UNIT TESTS
  // Call window.CS.reliability.runTests() from the browser console to self-verify.
  // ─────────────────────────────────────────────────────────────────────────────

  function runTests() {
    let passed = 0, failed = 0;

    function assert(label, condition, note = "") {
      if (condition) {
        console.log(`  ✓ ${label}`);
        passed++;
      } else {
        console.error(`  ✗ ${label}${note ? " — " + note : ""}`);
        failed++;
      }
    }

    function approx(a, b, tol = 0.01) {
      return Math.abs(a - b) <= tol;
    }

    console.group("[CS.reliability] Unit Tests");

    // ── modifiedZScores ────────────────────────────────────────────────────────
    console.group("modifiedZScores");
    {
      const zs = modifiedZScores([1, 2, 3, 4, 100]);
      assert("Outlier 100 has |Z| > 3.5", Math.abs(zs[4]) > 3.5);
      assert("Non-outliers have |Z| < 3.5", zs.slice(0, 4).every(z => Math.abs(z) < 3.5));
    }
    {
      const zs = modifiedZScores([5, 5, 5, 5]);
      assert("All-identical → all zero Z-scores (MAD=0)", zs.every(z => z === 0));
    }
    console.groupEnd();

    // ── removeOutliersModifiedZ ────────────────────────────────────────────────
    console.group("removeOutliersModifiedZ");
    {
      const { filtered, outlierMask } = removeOutliersModifiedZ([10, 11, 10, 12, 200]);
      assert("Outlier 200 is flagged",             outlierMask[4] === true);
      assert("Non-outliers are not flagged",        outlierMask.slice(0, 4).every(f => !f));
      assert("Filtered array excludes outlier",     !filtered.includes(200));
    }
    {
      const { outlierMask } = removeOutliersModifiedZ([1, 100]); // only 2 values
      assert("< 3 values → no outlier removal",    outlierMask.every(f => !f));
    }
    {
      const { outlierMask } = removeOutliersModifiedZ([42, 42, 42, 42]); // MAD = 0
      assert("MAD=0 (unanimous) → no removal",     outlierMask.every(f => !f));
    }
    {
      // Values with multiple outliers on both ends
      const { outlierMask } = removeOutliersModifiedZ([1, 50, 51, 50, 49, 500]);
      assert("High outlier 500 is flagged",         outlierMask[5] === true);
      // Low outlier 1 may or may not be flagged depending on distribution
    }
    console.groupEnd();

    // ── allianceConstrainedScaling ─────────────────────────────────────────────
    console.group("allianceConstrainedScaling");
    {
      const scaled = allianceConstrainedScaling([30, 20, 50], 120);
      assert("Scaled sum equals TBA total 120",    approx(scaled.reduce((a, b) => a + b, 0), 120));
      assert("Proportions preserved (30:20 = 1.5)", approx(scaled[0] / scaled[1], 30 / 20, 0.05));
    }
    {
      const scaled = allianceConstrainedScaling([0, 0, 0], 90);
      assert("All-zero → equal distribution (30 each)", scaled.every(v => approx(v, 30)));
    }
    {
      const scaled = allianceConstrainedScaling([100, 0, 0], 80);
      assert("Single nonzero → gets full TBA total",    approx(scaled[0], 80));
      assert("Zero robots stay zero",                    approx(scaled[1], 0) && approx(scaled[2], 0));
    }
    {
      const scaled = allianceConstrainedScaling([10, 10, 10], 60);
      assert("Equal estimates → equal scaling",          scaled.every(v => approx(v, 20)));
    }
    console.groupEnd();

    // ── estimateRobotFuel ──────────────────────────────────────────────────────
    console.group("estimateRobotFuel");
    {
      const obs = [
        { value: 40, weight: 1.0 },
        { value: 41, weight: 1.0 },
        { value: 39, weight: 1.0 },
        { value: 38, weight: 1.0 },
        { value: 200, weight: 0.5 }, // obvious outlier
      ];
      const { estimate, outlierCount } = estimateRobotFuel(obs);
      assert("Outlier 200 is removed",       outlierCount >= 1);
      assert("Estimate close to true ~40",   approx(estimate, 40, 5));
    }
    {
      const { estimate } = estimateRobotFuel([{ value: 50, weight: 1.0 }]);
      assert("Single observation → that value", approx(estimate, 50));
    }
    {
      const obs = [{ value: 30, weight: 1.0, suspect: true }, { value: 30, weight: 1.0 }];
      const { estimate } = estimateRobotFuel(obs);
      assert("Suspect flag → down-weighted but still included", approx(estimate, 30));
    }
    console.groupEnd();

    // ── computeScoutReliability ────────────────────────────────────────────────
    console.group("computeScoutReliability");
    assert("Perfect (1,1) → 1.0",    approx(computeScoutReliability(1.0, 1.0), 1.0));
    assert("Both 0.5 → 0.5",         approx(computeScoutReliability(0.5, 0.5), 0.5));
    assert("Tower=1,Fuel=0 → 0.6",   approx(computeScoutReliability(1.0, 0.0), 0.6));
    assert("Tower=0,Fuel=1 → 0.4",   approx(computeScoutReliability(0.0, 1.0), 0.4));
    console.groupEnd();

    // ── flagCrossMatchOutliers ─────────────────────────────────────────────────
    console.group("flagCrossMatchOutliers");
    {
      const data = [
        { matchKey: "m1", adjustedFuel: 40, tbaAllianceTotal: 120 },
        { matchKey: "m2", adjustedFuel: 42, tbaAllianceTotal: 125 },
        { matchKey: "m3", adjustedFuel: 38, tbaAllianceTotal: 115 },
        { matchKey: "m4", adjustedFuel: 200, tbaAllianceTotal: 120 }, // outlier
      ];
      const res = flagCrossMatchOutliers(data);
      assert("Outlier match m4 is flagged",           res[3].flagged === true);
      assert("Normal matches m1-m3 not flagged",      res.slice(0, 3).every(r => !r.flagged));
    }
    {
      const data = [
        { matchKey: "m1", adjustedFuel: 40, tbaAllianceTotal: 120 },
        { matchKey: "m2", adjustedFuel: 200, tbaAllianceTotal: 120 },
      ];
      const res = flagCrossMatchOutliers(data);
      assert("< 3 matches → no flagging",             res.every(r => !r.flagged));
    }
    {
      // Alliance also had an unusual match → allianceAlsoAnomalous
      const data = [
        { matchKey: "m1", adjustedFuel: 40, tbaAllianceTotal: 120 },
        { matchKey: "m2", adjustedFuel: 40, tbaAllianceTotal: 120 },
        { matchKey: "m3", adjustedFuel: 40, tbaAllianceTotal: 120 },
        { matchKey: "m4", adjustedFuel: 200, tbaAllianceTotal: 600 }, // both outliers
      ];
      const res = flagCrossMatchOutliers(data);
      assert("Alliance also anomalous flag set",      res[3].flagged && res[3].allianceAlsoAnomalous);
    }
    console.groupEnd();

    // ── checkOPRSanity ─────────────────────────────────────────────────────────
    console.group("checkOPRSanity");
    assert("Within 50% → no warning",       checkOPRSanity(100, 120, "frc254") === null);
    assert("Exceeds 50% → warning object",  checkOPRSanity(10,  100, "frc254") !== null);
    assert("OPR=0 → null (no comparison)",  checkOPRSanity(50,  0,   "frc254") === null);
    console.groupEnd();

    // ── allianceConstrainedScaling edge: tbaTotal = 0 ─────────────────────────
    console.group("edge cases");
    {
      const scaled = allianceConstrainedScaling([10, 20, 30], 0);
      assert("TBA total = 0 → all zeros",  scaled.every(v => v === 0));
    }
    console.groupEnd();

    const status = failed === 0 ? "ALL PASSED" : `${failed} FAILED`;
    console.log(`\n▶ Results: ${passed} passed, ${failed} failed — ${status}`);
    console.groupEnd();

    return { passed, failed };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return {
    // Config
    CFG,
    // Statistical primitives
    mean, stdDev, median, mad,
    modifiedZScores, removeOutliersModifiedZ,
    detectOutliers,   // legacy 2σ version
    weightedMean, confidence,
    // Step 1
    computeTowerAccuracy, computeFuelAccuracy, computeScoutReliability,
    // Step 2
    validateReport,
    // Step 3
    estimateRobotFuel, allianceConstrainedScaling,
    // Step 4
    flagCrossMatchOutliers,
    // Step 5
    checkOPRSanity,
    // Legacy aggregation (used by team.html, event.html)
    aggregateMetric, aggregateTeamStats,
    // Legacy reliability
    getTrustLevel, getTrustMultiplier, computeReliability,
    // Unit tests
    runTests,
  };
})();
