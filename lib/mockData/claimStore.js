// Claim store with file-based persistence.
//
// Claims are kept in memory for fast reads (cached on globalThis, same
// reasoning as before — Next.js dev can split route compilation into
// separate module contexts) but every write is also saved to a JSON
// file on disk, and the file is read back in on server startup. This
// means claims now survive `npm run dev` restarts.
//
// Note: this is still a lightweight, single-process store meant for
// local development and demoing — not a real production database.
// If you deploy to a serverless platform (Vercel, etc.), the
// filesystem there is usually read-only or ephemeral between
// invocations, so this file-based persistence will only reliably work
// when running locally or on a platform with a persistent filesystem
// (e.g. Render, a VM, or Docker with a mounted volume).

import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "claims.json");

function loadFromDisk() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      return { claims: parsed.claims || {}, nextId: parsed.nextId || 1000 };
    }
  } catch (err) {
    console.warn("[claimStore] Could not read claims.json, starting fresh:", err.message);
  }
  return { claims: {}, nextId: 1000 };
}

function saveToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(
        { claims: globalThis.__insurasyncClaims, nextId: globalThis.__insurasyncNextId },
        null,
        2
      )
    );
  } catch (err) {
    console.warn("[claimStore] Could not write claims.json:", err.message);
  }
}

if (!globalThis.__insurasyncClaims) {
  const loaded = loadFromDisk();
  globalThis.__insurasyncClaims = loaded.claims;
  globalThis.__insurasyncNextId = loaded.nextId;
}

export const claims = globalThis.__insurasyncClaims;

export function createClaim(data) {
  const claim_id = `CLM-${globalThis.__insurasyncNextId++}`;
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
  saveToDisk();
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
  saveToDisk();
}

export function setRequestedDocs(claim_id, doc_types) {
  const claim = claims[claim_id];
  if (!claim) return null;
  claim.requested_docs = doc_types;
  claim.status = "awaiting_documents";
  saveToDisk();
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
  saveToDisk();
  return claim;
}

export function setEstimate(claim_id, line_items, total) {
  const claim = claims[claim_id];
  if (!claim) return null;
  claim.estimate = { line_items, total };
  claim.estimate_status = "pending_review";
  claim.status = "estimate_submitted";
  saveToDisk();
  return claim;
}

export function setEstimateStatus(claim_id, status, reason) {
  const claim = claims[claim_id];
  if (!claim) return null;
  claim.estimate_status = status;
  claim.estimate_review_reason = reason || null;
  if (status === "approved") claim.status = "ready_for_settlement";
  saveToDisk();
  return claim;
}

export function setSettlement(claim_id, accepted) {
  const claim = claims[claim_id];
  if (!claim) return null;
  claim.status = accepted ? "settled" : "settlement_declined";
  claim.settled_at = new Date().toISOString();
  saveToDisk();
  return claim;
}