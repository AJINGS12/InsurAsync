"use client";

import { useEffect, useState, useCallback } from "react";
import { registerToolSafely } from "@/lib/webmcp/registerToolSafely";

export default function PolicyholderPage() {
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

  // Poll for updates while a claim is active, so the human view stays
  // in sync as the insurer/repair-shop agents act on their own pages.
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

    // Deliberately NOT auto-executable in the same way as the others.
    // The tool exists so an agent can check whether a claim is ready to
    // settle, but the actual confirmation always requires the human
    // clicking the button in this page's UI (see handleConfirm below).
    // Registering it here documents the action for agent visibility and
    // allows an agent to prompt the human, without letting an agent
    // finalize money on someone's behalf autonomously.
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
  }, [refreshClaim]);

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

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "2rem", fontFamily: "system-ui" }}>
      <h1>Policyholder</h1>
      <p style={{ color: "#666" }}>
        Your agent can file a claim and upload requested documents on your behalf.
        Final settlement always requires your confirmation below.
      </p>

      {!claim && (
        <p style={{ marginTop: "2rem", padding: "1rem", background: "#f5f5f5", borderRadius: 8 }}>
          No active claim yet. Ask your agent to file an incident report to get started.
        </p>
      )}

      {claim && (
        <div style={{ marginTop: "2rem" }}>
          <h2>Claim {claim.claim_id}</h2>
          <p><strong>Status:</strong> {claim.status}</p>
          <p><strong>Incident:</strong> {claim.incident.incident_type} on {claim.incident.date}</p>
          <p>{claim.incident.description}</p>

          {claim.requested_docs.length > 0 && (
            <div style={{ marginTop: "1rem" }}>
              <strong>Requested documents:</strong>
              <ul>
                {claim.requested_docs.map((d) => {
                  const uploaded = claim.uploaded_docs.some((u) => u.doc_type === d);
                  return (
                    <li key={d}>
                      {d} — {uploaded ? "✅ uploaded" : "⏳ pending"}
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
              <strong>Review status:</strong> {claim.estimate_status}
            </div>
          )}

          {claim.estimate_status === "approved" && claim.status !== "settled" && (
            <div style={{ marginTop: "1.5rem", padding: "1rem", border: "2px solid #2563eb", borderRadius: 8 }}>
              <p><strong>Your estimate has been approved. Confirm settlement?</strong></p>
              <button onClick={() => handleConfirm(true)} disabled={loading} style={{ marginRight: 8 }}>
                Confirm Settlement
              </button>
              <button onClick={() => handleConfirm(false)} disabled={loading}>
                Decline
              </button>
            </div>
          )}

          {claim.status === "settled" && (
            <p style={{ marginTop: "1rem", color: "green", fontWeight: "bold" }}>
              ✅ Claim settled.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
