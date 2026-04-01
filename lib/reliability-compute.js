/**
 * lib/reliability-compute.js
 * Computes and updates scout reliability scores based on cross-scout comparison.
 *
 * System:
 * - For each submission, compare the scout's numeric values to the consensus
 *   of all other scouts who scouted the same team in the same match.
 * - If a scout's value is > 2 standard deviations from the mean, it's an outlier.
 * - Reliability = f(consistency_score, submission_count, outlier_rate)
 * - Score is stored in scout_reliability table { user_id, reliability_score, updated_at, submission_count, outlier_count }
 *
 * Called after each submission and on profile/home page load.
 */
window.CS = window.CS || {};

window.CS.reliabilityCompute = (function () {
  const NUMERIC_FIELDS = [
    "auto_fuel_scored",
    "teleop_fuel_scored",
    "teleop_penalties",
  ];

  /**
   * Recompute reliability for a given user_id.
   * Fetches all their submissions, cross-references with same-match-team submissions from others,
   * counts outliers, and saves updated score to scout_reliability table.
   */
  async function recompute(userId) {
    const db = window.CS.db;
    if (!db || !userId) return;

    try {
      // 1. Fetch all submissions by this user
      const { data: mySubs } = await db
        .from("scout_submissions")
        .select("id,event_key,match_number,match_type,team_number,answers")
        .eq("owner_id", userId);

      if (!mySubs || !mySubs.length) return;

      const totalSubmissions = mySubs.length;
      let totalOutliers = 0;
      let comparedCount = 0; // submissions where we had data to compare

      // 2. For each submission, get other scouts' data for same match+team
      for (const sub of mySubs) {
        const { data: otherSubs } = await db
          .from("scout_submissions")
          .select("answers")
          .eq("event_key", sub.event_key)
          .eq("match_number", sub.match_number)
          .eq("match_type", sub.match_type)
          .eq("team_number", sub.team_number)
          .neq("owner_id", userId);

        if (!otherSubs || otherSubs.length < 2) continue; // need at least 2 others for meaningful comparison

        comparedCount++;

        // Check each numeric field
        for (const fieldId of NUMERIC_FIELDS) {
          const myVal = sub.answers?.[fieldId];
          if (myVal === null || myVal === undefined) continue;

          const otherVals = otherSubs
            .map(s => Number(s.answers?.[fieldId]))
            .filter(v => !isNaN(v));

          if (otherVals.length < 2) continue;

          const mean = otherVals.reduce((a, b) => a + b, 0) / otherVals.length;
          const variance = otherVals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / otherVals.length;
          const sd = Math.sqrt(variance);

          if (sd > 0 && Math.abs(Number(myVal) - mean) > 2 * sd) {
            totalOutliers++;
          }
        }
      }

      // 3. Compute consistency score
      // If we had comparisons: consistencyScore based on outlier rate
      // If no comparisons available: default to 0.75 (new/unverified)
      const outlierRate = comparedCount > 0 ? totalOutliers / (comparedCount * NUMERIC_FIELDS.length) : 0;
      const consistencyScore = comparedCount > 0 ? Math.max(0, 1 - outlierRate * 2) : 0.75;

      // 4. Use computeReliability from reliability.js
      const reliabilityScore = window.CS.reliability.computeReliability({
        consistencyScore,
        tbaAccuracy: 0.8, // neutral — we don't verify against TBA scores in real-time
        submissionCount: totalSubmissions,
        teamVerified: false,
        outlierCount: totalOutliers,
      });

      // Cap at 1.0 for display (score > 1.0 is only possible with trust multiplier for advanced scouts)
      const finalScore = Math.min(reliabilityScore, 1.0);

      // 5. Upsert to scout_reliability table
      await db.from("scout_reliability").upsert({
        user_id: userId,
        reliability_score: finalScore,
        submission_count: totalSubmissions,
        outlier_count: totalOutliers,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    } catch (err) {
      console.warn("[reliability-compute] Error:", err);
    }
  }

  /**
   * Light-weight trigger: called right after a submission is saved.
   * Runs asynchronously in background — does not block the UI.
   */
  function updateAfterSubmit(userId) {
    if (!userId) return;
    // Small delay so the submission has time to be saved to the DB
    setTimeout(() => recompute(userId), 3000);
  }

  return { recompute, updateAfterSubmit };
})();
