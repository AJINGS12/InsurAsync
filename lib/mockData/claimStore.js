// A simple in-memory store simulating shared claim state.
// In production this would be a real database; for this demo,
// a module-level object is enough since we only need one server process.

export const claims = {};

let nextId = 1000;

export function createClaim(data) {
  const claim_id = `CLM-${nextId++}`;
  claims[claim_id] = {
    claim_id,
    status: "submitted",
    incident: data,
    requested_docs: [],
    uploaded_docs: [],
    estimate: null,
    estimate_status: null,
    log: [
      { actor: "policyholder", action: "submit_incident_report", detail: data }
    ]
  };
  return claims[claim_id];
}

export function getClaim(claim_id) {
  return claims[claim_id];
}

export function logEvent(claim_id, actor, action, detail) {
  const claim = claims[claim_id];
  if (!claim) return;
  claim.log.push({ actor, action, detail, timestamp: new Date().toISOString() });
}