"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { registerToolSafely } from "@/lib/webmcp/registerToolSafely";

export const dynamic = "force-dynamic";

const STATUS_META = {
  submitted: { label: "Submitted", color: "slate" },
  awaiting_documents: { label: "Awaiting documents", color: "amber" },
  documents_complete: { label: "Documents complete", color: "teal" },
  estimate_submitted: { label: "Estimate under review", color: "amber" },
  ready_for_settlement: { label: "Ready for settlement", color: "teal" },
  settled: { label: "Settled", color: "teal" },
  settlement_declined: { label: "Settlement declined", color: "red" }
};

const STORAGE_KEY = "insurasync_active_claim_id";

export default function PolicyholderPage() {
  const searchParams = useSearchParams();
  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(false);

  const refreshClaim = useCallback(async (claimId) => {
    if (!claimId) return;
    const res = await fetch(`/api/claims/${claimId}`);
    if (res.ok) {
      const data = await res.json();
      setClaim(data.claim);
    }
  }, []);

  const rememberClaim = useCallback((claimId) => {
    if (typeof window !== "undefined" && claimId) {
      window.localStorage.setItem(STORAGE_KEY, claimId);
    }
  }, []);

  // Resolve which claim this page should show, in priority order:
  // 1. An explicit ?claim=CLM-XXXX in the URL (lets any page be opened
  //    directly to a specific claim — useful for demos and for an
  //    agent that already knows the claim_id).
  // 2. The last claim this browser filed, remembered via localStorage.
  // 3. Otherwise, no active claim — the page shows its empty state.
  useEffect(() => {
    const urlClaimId = searchParams.get("claim");
    const storedClaimId =
      typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const targetId = urlClaimId || storedClaimId;

    if (targetId) {
      refreshClaim(targetId);
      if (urlClaimId) rememberClaim(urlClaimId);
    }
  }, [searchParams, refreshClaim, rememberClaim]);

  useEffect(() => {
    if (!claim?.claim_id) return;
    const interval = setInterval(() => refreshClaim(claim.claim_id), 2000);
    return () => clearInterval(interval);
  }, [claim?.claim_id, refreshClaim]);

  useEffect(() => {
    const cleanups = [];

    cleanups.push(
      registerToolSafely({
        name: "submit_incident_report",
        description: "File a structured incident report to start a new insurance claim.",
        inputSchema: {
          type: "object",
          properties: {
            incident_type: {
              type: "string",
              enum: ["auto_collision", "water_damage", "theft"],
              description: "The type of incident being reported"
            },
            date: { type: "string", description: "Date of the incident, YYYY-MM-DD" },
            description: { type: "string", description: "Description of what happened" },
            photos: {
              type: "array",
              items: { type: "string" },
              description: "Reference URLs or filenames for damage photos, if any"
            },
            estimated_severity: {
              type: "string",
              description: "Policyholder's rough sense of severity, e.g. minor, moderate, major"
            }
          },
          required: ["incident_type", "date", "description"]
        },
        execute: async (input) => {
          setLoading(true);
          try {
            const res = await fetch("/api/claims", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(input)
            });
            const data = await res.json();
            if (!res.ok) return { success: false, error: data.error };
            setClaim(data.claim);
            rememberClaim(data.claim_id);
            return { success: true, claim_id: data.claim_id, status: data.status };
          } finally {
            setLoading(false);
          }
        }
      })
    );

    cleanups.push(
      registerToolSafely({
        name: "upload_document",
        description:
          "Submit a requested document to the insurer for the active claim. Only documents the insurer has actually requested will be accepted.",
        inputSchema: {
          type: "object",
          properties: {
            claim_id: { type: "string", description: "The claim ID this document belongs to" },
            doc_type: { type: "string", description: "Type of document being submitted, e.g. photos_of_damage, police_report" },
            file_ref: { type: "string", description: "Reference to the uploaded file (URL or filename)" }
          },
          required: ["claim_id", "doc_type", "file_ref"]
        },
        execute: async (input) => {
          const res = await fetch(`/api/claims/${input.claim_id}/upload-doc`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ doc_type: input.doc_type, file_ref: input.file_ref })
          });
          const data = await res.json();
          if (res.ok) refreshClaim(input.claim_id);
          return data;
        }
      })
    );

    cleanups.push(
      registerToolSafely({
        name: "confirm_settlement",
        description:
          "Check whether a claim is ready for final settlement confirmation. Does NOT finalize the claim — final confirmation requires the policyholder to click Confirm in the app UI.",
        inputSchema: {
          type: "object",
          properties: {
            claim_id: { type: "string", description: "The claim ID to check" }
          },
          required: ["claim_id"]
        },
        execute: async (input) => {
          const res = await fetch(`/api/claims/${input.claim_id}`);
          const data = await res.json();
          if (!res.ok) return { success: false, error: data.error };
          const ready = data.claim.estimate_status === "approved";
          return {
            ready_for_settlement: ready,
            note: ready
              ? "Estimate approved. Ask the policyholder to review and confirm in the app."
              : "Not yet ready — estimate is still under review."
          };
        }
      })
    );

    return () => cleanups.forEach((fn) => fn());
  }, [refreshClaim, rememberClaim]);

  const handleConfirm = async (accept) => {
    if (!claim?.claim_id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/claims/${claim.claim_id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept })
      });
      const data = await res.json();
      if (res.ok) refreshClaim(claim.claim_id);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const meta = claim ? STATUS_META[claim.status] || { label: claim.status, color: "slate" } : null;

  return (
    <main className="container" style={{ paddingTop: "2.5rem", paddingBottom: "3rem" }}>
      <h1 style={{ fontSize: "1.8rem" }}>Policyholder</h1>
      <p className="page-lead">
        Your agent can file a claim and upload requested documents on your behalf.
        Final settlement always requires your confirmation below.
      </p>

      {!claim && (
        <div className="empty-state">
          No active claim yet. Ask your agent to file an incident report to get started.
        </div>
      )}

      {claim && (
        <div className="claim-panel">
          <div className="claim-panel-header">
            <span className="claim-id">{claim.claim_id}</span>
            <span className={`status-chip ${meta.color}`}>{meta.label}</span>
          </div>
          <div className="claim-panel-body">
            <p style={{ marginTop: 0 }}>
              <strong>{claim.incident.incident_type}</strong> on {claim.incident.date}
            </p>
            <p style={{ color: "var(--ink-soft)" }}>{claim.incident.description}</p>

            {claim.requested_docs.length > 0 && (
              <div style={{ marginTop: "1rem" }}>
                <strong>Requested documents</strong>
                <ul className="doc-list">
                  {claim.requested_docs.map((d) => {
                    const uploaded = claim.uploaded_docs.some((u) => u.doc_type === d);
                    return (
                      <li key={d}>
                        {d.replace(/_/g, " ")} — {uploaded ? "✅ uploaded" : "⏳ pending"}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {claim.estimate && (
              <div style={{ marginTop: "1rem" }}>
                <strong>Repair estimate:</strong> ${claim.estimate.total.toFixed(2)}
                <br />
                <span style={{ color: "var(--ink-soft)" }}>Review status: {claim.estimate_status}</span>
              </div>
            )}

            {claim.estimate_status === "approved" && claim.status !== "settled" && (
              <div className="confirm-box">
                <p style={{ marginTop: 0, marginBottom: "0.75rem" }}>
                  <strong>Your estimate has been approved. Confirm settlement?</strong>
                </p>
                <button className="btn" onClick={() => handleConfirm(true)} disabled={loading} style={{ marginRight: 8 }}>
                  Confirm settlement
                </button>
                <button className="btn secondary" onClick={() => handleConfirm(false)} disabled={loading}>
                  Decline
                </button>
              </div>
            )}

            {claim.status === "settled" && (
              <p style={{ color: "var(--teal)", fontWeight: 600, marginTop: "1rem" }}>
                ✅ Claim settled.
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}