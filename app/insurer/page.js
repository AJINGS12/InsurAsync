"use client";

import { useEffect, useState, useCallback } from "react";
import { registerToolSafely } from "@/lib/webmcp/registerToolSafely";

const STATUS_META = {
  submitted: { label: "Submitted", color: "slate" },
  awaiting_documents: { label: "Awaiting documents", color: "amber" },
  documents_complete: { label: "Documents complete", color: "teal" },
  estimate_submitted: { label: "Estimate under review", color: "amber" },
  ready_for_settlement: { label: "Ready for settlement", color: "teal" },
  settled: { label: "Settled", color: "teal" },
  settlement_declined: { label: "Settlement declined", color: "red" }
};

export default function InsurerPage() {
  const [claims, setClaims] = useState([]);

  const refreshClaims = useCallback(async () => {
    const res = await fetch("/api/claims");
    if (res.ok) {
      const data = await res.json();
      setClaims(data.claims);
    }
  }, []);

  useEffect(() => {
    refreshClaims();
    const interval = setInterval(refreshClaims, 2000);
    return () => clearInterval(interval);
  }, [refreshClaims]);

  useEffect(() => {
    const cleanups = [];

    cleanups.push(
      registerToolSafely({
        name: "check_coverage",
        description:
          "Check whether a claim is covered under the policyholder's real policy terms, and return the deductible and per-incident limit.",
        inputSchema: {
          type: "object",
          properties: {
            claim_id: { type: "string", description: "The claim ID to check" }
          },
          required: ["claim_id"]
        },
        execute: async (input) => {
          const res = await fetch(`/api/claims/${input.claim_id}/check-coverage`, { method: "POST" });
          const data = await res.json();
          refreshClaims();
          return data;
        }
      })
    );

    cleanups.push(
      registerToolSafely({
        name: "request_missing_docs",
        description:
          "Request the documents actually required for this claim's incident type, based on the insurer's real requirements list.",
        inputSchema: {
          type: "object",
          properties: {
            claim_id: { type: "string", description: "The claim ID to request documents for" }
          },
          required: ["claim_id"]
        },
        execute: async (input) => {
          const res = await fetch(`/api/claims/${input.claim_id}/request-docs`, { method: "POST" });
          const data = await res.json();
          refreshClaims();
          return data;
        }
      })
    );

    cleanups.push(
      registerToolSafely({
        name: "check_estimate_against_policy",
        description:
          "Validate a submitted repair estimate against the policy's real per-incident coverage limit. Approves it or flags it for revision with the exact excess amount.",
        inputSchema: {
          type: "object",
          properties: {
            claim_id: { type: "string", description: "The claim ID whose estimate should be checked" }
          },
          required: ["claim_id"]
        },
        execute: async (input) => {
          const res = await fetch(`/api/claims/${input.claim_id}/estimate/check`, { method: "POST" });
          const data = await res.json();
          refreshClaims();
          return data;
        }
      })
    );

    return () => cleanups.forEach((fn) => fn());
  }, [refreshClaims]);

  return (
    <main className="container" style={{ paddingTop: "2.5rem", paddingBottom: "3rem" }}>
      <h1 style={{ fontSize: "1.8rem" }}>Insurer</h1>
      <p className="page-lead">
        Your agent checks coverage, requests required documents, and validates repair
        estimates against real policy terms — all visible below as claims come in.
      </p>

      {claims.length === 0 && <div className="empty-state">No claims yet.</div>}

      {claims.map((claim) => {
        const meta = STATUS_META[claim.status] || { label: claim.status, color: "slate" };
        return (
          <div key={claim.claim_id} className="claim-panel">
            <div className="claim-panel-header">
              <span className="claim-id">{claim.claim_id}</span>
              <span className={`status-chip ${meta.color}`}>{meta.label}</span>
            </div>
            <div className="claim-panel-body">
              <p style={{ marginTop: 0 }}>
                <strong>{claim.incident.incident_type}</strong> — {claim.incident.description}
              </p>
              {claim.requested_docs.length > 0 && (
                <p style={{ color: "var(--ink-soft)" }}>
                  Docs requested: {claim.requested_docs.join(", ")}
                </p>
              )}
              {claim.estimate && (
                <p style={{ color: "var(--ink-soft)" }}>
                  Estimate: ${claim.estimate.total.toFixed(2)} — {claim.estimate_status}
                  {claim.estimate_review_reason ? ` (${claim.estimate_review_reason})` : ""}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </main>
  );
}