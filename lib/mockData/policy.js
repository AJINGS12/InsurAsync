// Mock policy data — represents the real, stored terms an insurer's
// agent tools validate against. In production this would come from
// a real policy management system, not a static file.

export const policy = {
  policy_id: "POL-48213",
  policyholder_name: "Jordan Lee",
  policy_type: "auto",
  coverage: {
    collision: {
      covered: true,
      deductible: 500,
      per_incident_limit: 8000
    },
    comprehensive: {
      covered: true,
      deductible: 250,
      per_incident_limit: 8000
    }
  },
  status: "active"
};

// What documents are required, per incident type.
// The insurer's `request_missing_docs` tool checks against this list —
// it does not guess what's needed, it looks it up.
export const requiredDocsByIncidentType = {
  auto_collision: ["photos_of_damage", "police_report"],
  water_damage: ["photos_of_damage", "plumber_report"],
  theft: ["police_report", "proof_of_ownership"]
};