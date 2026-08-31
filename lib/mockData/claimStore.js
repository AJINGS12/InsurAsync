// Claim store backed by Redis (Vercel-hosted).
//
// Each claim is stored as its own JSON string under key
// `insurasync:claim:{claim_id}`. A Redis list at `insurasync:claim_index`
// tracks claim IDs in creation order (newest first, since we push to
// the front) so listClaims() can enumerate them without a full scan.
// A dedicated counter key generates sequential claim IDs.
//
// All functions here are ASYNC — every caller must await them.

import { getRedisClient } from "./redisClient";

const CLAIM_PREFIX = "insurasync:claim:";
const INDEX_KEY = "insurasync:claim_index";
const NEXT_ID_KEY = "insurasync:next_id";

async function ensureCounterInitialized(redis) {
  const exists = await redis.exists(NEXT_ID_KEY);
  if (!exists) {
    await redis.set(NEXT_ID_KEY, 999);
  }
}

async function saveClaim(claim) {
  const redis = await getRedisClient();
  await redis.set(CLAIM_PREFIX + claim.claim_id, JSON.stringify(claim));
}

export async function createClaim(data) {
  const redis = await getRedisClient();
  await ensureCounterInitialized(redis);
  const nextId = await redis.incr(NEXT_ID_KEY);
  const claim_id = `CLM-${nextId}`;

  const claim = {
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

  await redis.set(CLAIM_PREFIX + claim_id, JSON.stringify(claim));
  await redis.lPush(INDEX_KEY, claim_id);

  return claim;
}

export async function getClaim(claim_id) {
  const redis = await getRedisClient();
  const raw = await redis.get(CLAIM_PREFIX + claim_id);
  return raw ? JSON.parse(raw) : null;
}

export async function listClaims() {
  const redis = await getRedisClient();
  const ids = await redis.lRange(INDEX_KEY, 0, -1);
  const claims = [];
  for (const id of ids) {
    const raw = await redis.get(CLAIM_PREFIX + id);
    if (raw) claims.push(JSON.parse(raw));
  }
  return claims;
}

export async function logEvent(claim_id, actor, action, detail) {
  const claim = await getClaim(claim_id);
  if (!claim) return;
  claim.log.push({ actor, action, detail, timestamp: new Date().toISOString() });
  await saveClaim(claim);
}

export async function setRequestedDocs(claim_id, doc_types) {
  const claim = await getClaim(claim_id);
  if (!claim) return null;
  claim.requested_docs = doc_types;
  claim.status = "awaiting_documents";
  await saveClaim(claim);
  return claim;
}

export async function addUploadedDoc(claim_id, doc_type, file_ref) {
  const claim = await getClaim(claim_id);
  if (!claim) return null;
  claim.uploaded_docs.push({ doc_type, file_ref });
  const stillMissing = claim.requested_docs.filter(
    (d) => !claim.uploaded_docs.some((u) => u.doc_type === d)
  );
  if (stillMissing.length === 0 && claim.requested_docs.length > 0) {
    claim.status = "documents_complete";
  }
  await saveClaim(claim);
  return claim;
}

export async function setEstimate(claim_id, line_items, total) {
  const claim = await getClaim(claim_id);
  if (!claim) return null;
  claim.estimate = { line_items, total };
  claim.estimate_status = "pending_review";
  claim.status = "estimate_submitted";
  await saveClaim(claim);
  return claim;
}

export async function setEstimateStatus(claim_id, status, reason) {
  const claim = await getClaim(claim_id);
  if (!claim) return null;
  claim.estimate_status = status;
  claim.estimate_review_reason = reason || null;
  if (status === "approved") claim.status = "ready_for_settlement";
  await saveClaim(claim);
  return claim;
}

export async function setSettlement(claim_id, accepted) {
  const claim = await getClaim(claim_id);
  if (!claim) return null;
  claim.status = accepted ? "settled" : "settlement_declined";
  claim.settled_at = new Date().toISOString();
  await saveClaim(claim);
  return claim;
}