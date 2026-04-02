/**
 * lib/schema2026.js
 * The 2026 "Rebuilt" FRC game scouting schema.
 * This matches the scout_schema_versions JSONB format.
 */
window.CS = window.CS || {};

window.CS.schema2026 = {
  version: "2026-v1.0",
  seasonYear: 2026,
  gameName: "Rebuilt",
  sections: [
    // ── AUTO ──────────────────────────────────────────────────────────────────
    {
      id: "auto",
      title: "Autonomous",
      phase: "auto",
      fields: [
        {
          id: "auto_start_position",
          type: "select",
          label: "Starting Position",
          required: true,
          config: { options: [{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }] },
          aggregationType: "mode",
        },
        {
          id: "auto_fuel_scored",
          type: "tally",
          label: "FUEL Scored",
          required: true,
          config: { increments: [1, 3, 5, 10, 20], showTotal: true, allowUndo: true },
          aggregationType: "average",
        },
        {
          id: "auto_left_zone",
          type: "boolean",
          label: "Left Starting Zone",
          required: true,
          config: {},
          aggregationType: "boolean_percentage",
        },
        {
          id: "auto_climbed_level1",
          type: "boolean",
          label: "Climbed Tower (Level 1)",
          required: false,
          config: {},
          aggregationType: "boolean_percentage",
        },
        {
          id: "auto_shooting_rate",
          type: "range",
          label: "Shooting Rate (balls/sec)",
          required: false,
          config: {
            ranges: [
              { value: "0-3", label: "0–3 balls/sec" },
              { value: "3.1-6", label: "3.1–6 balls/sec" },
              { value: "6.1+", label: "6.1+ balls/sec" },
            ],
          },
          aggregationType: "mode",
        },
        {
          id: "auto_intake_rate",
          type: "range",
          label: "Intake Rate (balls/sec)",
          required: false,
          config: {
            ranges: [
              { value: "0-3", label: "0–3 balls/sec" },
              { value: "3.1-6", label: "3.1–6 balls/sec" },
              { value: "6.1+", label: "6.1+ balls/sec" },
            ],
          },
          aggregationType: "mode",
        },
      ],
    },

    // ── TELEOP ────────────────────────────────────────────────────────────────
    {
      id: "teleop",
      title: "Teleop (Shifts 1–4)",
      phase: "teleop",
      fields: [
        {
          id: "teleop_fuel_scored",
          type: "tally",
          label: "FUEL Scored",
          required: true,
          config: { increments: [1, 3, 5, 10, 20], showTotal: true, allowUndo: true },
          aggregationType: "average",
        },
        {
          id: "teleop_shooting_rate",
          type: "range",
          label: "Shooting Rate (balls/sec)",
          required: false,
          config: {
            ranges: [
              { value: "0-3", label: "0–3 balls/sec" },
              { value: "3.1-6", label: "3.1–6 balls/sec" },
              { value: "6.1+", label: "6.1+ balls/sec" },
            ],
          },
          aggregationType: "mode",
        },
        {
          id: "teleop_intake_rate",
          type: "range",
          label: "Intake Rate (balls/sec)",
          required: false,
          config: {
            ranges: [
              { value: "0-3", label: "0–3 balls/sec" },
              { value: "3.1-6", label: "3.1–6 balls/sec" },
              { value: "6.1+", label: "6.1+ balls/sec" },
            ],
          },
          aggregationType: "mode",
        },
        {
          id: "teleop_played_defense",
          type: "boolean",
          label: "Played Defense",
          required: false,
          config: {},
          aggregationType: "boolean_percentage",
        },
        {
          id: "teleop_defense_effectiveness",
          type: "select",
          label: "Defense Effectiveness",
          required: false,
          config: {
            options: [
              { value: "none", label: "None" },
              { value: "minimal", label: "Minimal" },
              { value: "moderate", label: "Moderate" },
              { value: "significant", label: "Significant" },
            ],
          },
          aggregationType: "mode",
        },
        {
          id: "teleop_was_defended",
          type: "boolean",
          label: "Was Defended Against",
          required: false,
          config: {},
          aggregationType: "boolean_percentage",
        },
        {
          id: "teleop_penalties",
          type: "number",
          label: "Penalties Committed",
          required: false,
          config: { min: 0, max: 20, step: 1 },
          aggregationType: "average",
        },
      ],
    },

    // ── ENDGAME ───────────────────────────────────────────────────────────────
    {
      id: "endgame",
      title: "Endgame",
      phase: "endgame",
      fields: [
        {
          id: "endgame_climb_level",
          type: "select",
          label: "Climb Result",
          required: true,
          config: {
            options: [
              { value: "none", label: "Did Not Attempt" },
              { value: "attempted_failed", label: "Attempted, Failed" },
              { value: "level1", label: "Level 1 (10 pts)" },
              { value: "level2", label: "Level 2 (20 pts)" },
              { value: "level3", label: "Level 3 (30 pts)" },
            ],
          },
          aggregationType: "mode",
        },
        {
          id: "endgame_climb_time",
          type: "select",
          label: "Climb Speed",
          required: false,
          config: {
            options: [
              { value: "fast", label: "Fast (< 5 sec)" },
              { value: "medium", label: "Medium (5–15 sec)" },
              { value: "slow", label: "Slow (> 15 sec)" },
            ],
          },
          aggregationType: "mode",
        },
        {
          id: "endgame_scored_during",
          type: "boolean",
          label: "Continued Scoring During Endgame",
          required: false,
          config: {},
          aggregationType: "boolean_percentage",
        },
      ],
    },

    // ── POST-MATCH ────────────────────────────────────────────────────────────
    {
      id: "post_match",
      title: "Post-Match",
      phase: "post_match",
      fields: [
        {
          id: "post_robot_died",
          type: "boolean",
          label: "Robot Died / Disabled",
          required: false,
          config: {},
          aggregationType: "boolean_percentage",
        },
        {
          id: "post_robot_disconnected",
          type: "boolean",
          label: "Robot Disconnected",
          required: false,
          config: {},
          aggregationType: "boolean_percentage",
        },
        {
          id: "post_died_when",
          type: "select",
          label: "When Did It Die?",
          required: false,
          config: {
            options: [
              { value: "auto", label: "Auto" },
              { value: "early_teleop", label: "Early Teleop" },
              { value: "mid_teleop", label: "Mid Teleop" },
              { value: "endgame", label: "Endgame" },
            ],
          },
          aggregationType: "mode",
        },
        {
          id: "post_notes",
          type: "text",
          label: "Notes (optional)",
          required: false,
          config: {},
          aggregationType: "mode", // not really aggregated
        },
      ],
    },
  ],
};
