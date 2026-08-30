"use client";

import { useEffect, useState, useCallback } from "react";
import { registerToolSafely } from "@/lib/webmcp/registerToolSafely";

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
          const res = await fetch(`/api/claims/${input.claim_id}/check-coverage`, {
            method: "POST"
          });
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
          const res = await fetch(`/api/claims/${input.claim_id}/request-docs`, {
            method: "POST"
          });
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
          const res = await fetch(`/api/claims/${input.claim_id}/estimate/check`, {
            method: "POST"
          });
          const data = await res.json();
          refreshClaims();
          return data;
        }
      })
    );

    return () => cleanups.forEach((fn) => fn());
  }, [refreshClaims]);

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem", fontFamily: "system-ui" }}>
      <h1>Insurer</h1>
      <p style={{ color: "#666" }}>
        Your agent checks coverage, requests required documents, and validates repair
        estimates against real policy terms — all visible below as claims come in.
      </p>

      {claims.length === 0 && (
        <p style={{ marginTop: "2rem", padding: "1rem", background: "#f5f5f5", borderRadius: 8 }}>
          No claims yet.
        </p>
      )}

      {claims.map((claim) => (
        <div
          key={claim.claim_id}
          style={{ marginTop: "1.5rem", padding: "1rem", border: "1px solid #ddd", borderRadius: 8 }}
        >
          <h3>{claim.claim_id}</h3>
          <p><strong>Status:</strong> {claim.status}</p>
          <p><strong>Incident:</strong> {claim.incident.incident_type} — {claim.incident.description}</p>
          {claim.requested_docs.length > 0 && (
            <p><strong>Docs requested:</strong> {claim.requested_docs.join(", ")}</p>
          )}
          {claim.estimate && (
            <p>
              <strong>Estimate:</strong> ${claim.estimate.total.toFixed(2)} —{" "}
              <strong>{claim.estimate_status}</strong>
              {claim.estimate_review_reason ? ` (${claim.estimate_review_reason})` : ""}
            </p>
          )}
        </div>
      ))}
    </main>
  );
}