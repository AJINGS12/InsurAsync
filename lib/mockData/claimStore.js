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

export function listClaims() {
  return Object.values(claims).sort((a, b) =>
    a.claim_id < b.claim_id ? 1 : -1
  );
}

export function logEvent(claim_id, actor, action, detail) {
  const claim = claims[claim_id];
  if (!claim) return;
  claim.log.push({ actor, action, detail, timestamp: new Date().toISOString() });
}

export function setRequestedDocs(claim_id, doc_types) {
  const claim = claims[claim_id];
  if (!claim) return null;
  claim.requested_docs = doc_types;
  claim.status = "awaiting_documents";
  return claim;
}

export function addUploadedDoc(claim_id, doc_type, file_ref) {
  const claim = claims[claim_id];
  if (!claim) return null;
  claim.uploaded_docs.push({ doc_type, file_ref });
  const stillMissing = claim.requested_docs.filter(
    (d) => !claim.uploaded_docs.some((u) => u.doc_type === d)
  );
  if (stillMissing.length === 0 && claim.requested_docs.length > 0) {
    claim.status = "documents_complete";
  }
  return claim;
}

export function setEstimate(claim_id, line_items, total) {
  const claim = claims[claim_id];
  if (!claim) return null;
  claim.estimate = { line_items, total };
  claim.estimate_status = "pending_review";
  claim.status = "estimate_submitted";
  return claim;
}

export function setEstimateStatus(claim_id, status, reason) {
  const claim = claims[claim_id];
  if (!claim) return null;
  claim.estimate_status = status;
  claim.estimate_review_reason = reason || null;
  if (status === "approved") claim.status = "ready_for_settlement";
  return claim;
}

export function setSettlement(claim_id, accepted) {
  const claim = claims[claim_id];
  if (!claim) return null;
  claim.status = accepted ? "settled" : "settlement_declined";
  claim.settled_at = new Date().toISOString();
  return claim;
}
