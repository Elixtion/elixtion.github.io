/**
 * lib/reliability.js
 * Scout reliability scoring and data aggregation for CrowdScout.
 */
window.CS = window.CS || {};

window.CS.reliability = (function () {
  // ── Trust level thresholds ──────────────────────────────────────────────────
  function getTrustLevel(submissionCount) {
    if (submissionCount < 10) return "new";
    if (submissionCount < 50) return "active";
    return "trusted";
  }

  function getTrustMultiplier(trustLevel, teamVerified = false) {
    const base = { new: 0.8, active: 1.0, trusted: 1.2 }[trustLevel] ?? 1.0;
    return base + (teamVerified ? 0.1 : 0);
  }

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

  // ── Outlier detection ────────────────────────────────────────────────────────
  /**
   * Returns an array of booleans — true = outlier (> 2σ from mean)
   * @param {number[]} values
   * @returns {boolean[]}
   */
  function detectOutliers(values) {
    const m = mean(values);
    const sd = stdDev(values);
    if (sd === 0) return values.map(() => false);
    return values.map((v) => Math.abs(v - m) > 2 * sd);
  }

  // ── Weighted average ────────────────────────────────────────────────────────
  /**
   * @param {{ value: number; weight: number }[]} weightedValues
   */
  function weightedMean(weightedValues) {
    const totalWeight = weightedValues.reduce((s, v) => s + v.weight, 0);
    if (totalWeight === 0) return 0;
    return weightedValues.reduce((s, v) => s + v.value * v.weight, 0) / totalWeight;
  }

  // ── Confidence score ────────────────────────────────────────────────────────
  /**
   * Higher sample count + lower stddev → higher confidence (0–1).
   */
  function confidence(sampleSize, sd, valueRange = 100) {
    const sizeFactor = Math.min(sampleSize / 10, 1); // saturates at 10 samples
    const spreadFactor = valueRange > 0 ? 1 - Math.min(sd / valueRange, 1) : 1;
    return Math.round(sizeFactor * 0.6 * 100 + spreadFactor * 0.4 * 100) / 100;
  }

  // ── Aggregate metric across submissions ─────────────────────────────────────
  /**
   * @param {object[]} submissions  - each has .answers (JSONB) and .reliability_score
   * @param {string} metricKey
   * @param {'average'|'sum'|'mode'|'max'|'boolean_percentage'} aggregationType
   */
  function aggregateMetric(submissions, metricKey, aggregationType = "average") {
    const valid = submissions.filter(
      (s) => s.answers && s.answers[metricKey] !== undefined && s.answers[metricKey] !== null
    );
    if (!valid.length) return { mean: null, median: null, stdDev: null, sampleSize: 0, confidence: 0 };

    const raw = valid.map((s) => s.answers[metricKey]);
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
      default: { // average (weighted)
        const numRaw = raw.map(Number);
        const outlierFlags = detectOutliers(numRaw);
        // Reduce weight of outliers by 50%
        const wv = numRaw.map((v, i) => ({
          value: v,
          weight: weights[i] * (outlierFlags[i] ? 0.5 : 1.0),
        }));
        const m = weightedMean(wv);
        const sd = stdDev(numRaw);
        const valueRange = Math.max(...numRaw) - Math.min(...numRaw);
        return {
          mean: Math.round(m * 100) / 100,
          median: median(numRaw),
          stdDev: Math.round(sd * 100) / 100,
          sampleSize: valid.length,
          confidence: confidence(valid.length, sd, valueRange || 1),
          outlierCount: outlierFlags.filter(Boolean).length,
        };
      }
    }
    return {
      mean: typeof result.value === "number" ? Math.round(result.value * 100) / 100 : result.value,
      median: null,
      stdDev: null,
      sampleSize: valid.length,
      confidence: Math.min(valid.length / 5, 1),
      outlierCount: 0,
    };
  }

  // ── Aggregate ALL metrics for a team at an event ────────────────────────────
  /**
   * @param {object[]} submissions
   * @param {object[]} schemaFields  - from scout_schema_versions.schema.sections[].fields
   * @returns {object} keyed by field.id
   */
  function aggregateTeamStats(submissions, schemaFields) {
    const result = {};
    for (const field of schemaFields) {
      result[field.id] = aggregateMetric(submissions, field.id, field.aggregationType || "average");
    }
    return result;
  }

  // ── Reliability score calculation ──────────────────────────────────────────
  /**
   * Given a user's submissions and cross-scout data for the same matches,
   * compute a reliability score 0–1.
   */
  function computeReliability(userRecord) {
    const {
      consistencyScore = 0.8,
      tbaAccuracy = 0.8,
      submissionCount = 0,
      teamVerified = false,
      outlierCount = 0,
    } = userRecord;

    const trustLevel = getTrustLevel(submissionCount);
    const trustMultiplier = getTrustMultiplier(trustLevel, teamVerified);

    const totalSubmissions = Math.max(submissionCount, 1);
    const outlierPenalty = Math.min(outlierCount / totalSubmissions, 1);

    const accountFactor = Math.min(submissionCount / 20, 1); // ramp up over 20 submissions

    const base =
      consistencyScore * 0.4 +
      tbaAccuracy * 0.3 +
      accountFactor * 0.2 +
      (1 - outlierPenalty) * 0.1;

    return Math.min(base * trustMultiplier, 1.5); // cap at 1.5
  }

  return {
    getTrustLevel,
    getTrustMultiplier,
    detectOutliers,
    aggregateMetric,
    aggregateTeamStats,
    computeReliability,
    mean,
    stdDev,
    median,
    confidence,
  };
})();
