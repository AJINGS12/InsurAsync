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

export default function RepairShopPage() {
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
        name: "propose_estimate",
        description:
          "Submit a repair estimate for a claim, calculated from the shop's real parts and labor rate card. Provide line items with part names and labor hours.",
        inputSchema: {
          type: "object",
          properties: {
            claim_id: { type: "string", description: "The claim ID this estimate is for" },
            line_items: {
              type: "array",
              description: "List of repair line items",
              items: {
                type: "object",
                properties: {
                  part: {
                    type: "string",
                    description: "Part name, must match the shop's rate card, e.g. front_bumper, headlight_assembly, fender_panel, windshield"
                  },
                  labor_hours: { type: "number", description: "Estimated labor hours for this part" }
                },
                required: ["part"]
              }
            }
          },
          required: ["claim_id", "line_items"]
        },
        execute: async (input) => {
          const res = await fetch(`/api/claims/${input.claim_id}/estimate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ line_items: input.line_items })
          });
          const data = await res.json();
          refreshClaims();
          return data;
        }
      })
    );

    cleanups.push(
      registerToolSafely({
        name: "revise_estimate",
        description:
          "Submit a revised repair estimate after the insurer has flagged the original as exceeding the policy limit. Recalculated from the real rate card.",
        inputSchema: {
          type: "object",
          properties: {
            claim_id: { type: "string", description: "The claim ID this revised estimate is for" },
            revised_line_items: {
              type: "array",
              description: "Updated list of repair line items",
              items: {
                type: "object",
                properties: {
                  part: { type: "string", description: "Part name, must match the shop's rate card" },
                  labor_hours: { type: "number", description: "Estimated labor hours for this part" }
                },
                required: ["part"]
              }
            }
          },
          required: ["claim_id", "revised_line_items"]
        },
        execute: async (input) => {
          const res = await fetch(`/api/claims/${input.claim_id}/estimate/revise`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ revised_line_items: input.revised_line_items })
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
    <main className="container" style={{ paddingTop: "2.5rem", paddingBottom: "3rem" }}>
      <h1 style={{ fontSize: "1.8rem" }}>Repair shop</h1>
      <p className="page-lead">
        Your agent proposes and revises repair estimates using the shop&apos;s real
        parts and labor pricing — no guessed numbers.
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
              {claim.estimate ? (
                <div>
                  <p style={{ color: "var(--ink-soft)" }}>
                    Current estimate: ${claim.estimate.total.toFixed(2)} — {claim.estimate_status}
                    {claim.estimate_review_reason ? ` (${claim.estimate_review_reason})` : ""}
                  </p>
                  <ul className="doc-list">
                    {claim.estimate.line_items.map((item, i) => (
                      <li key={i}>
                        {item.part}: ${item.part_cost} + {item.labor_hours}h labor (${item.labor_cost}) = ${item.line_total}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p style={{ color: "var(--ink-soft)" }}>No estimate submitted yet.</p>
              )}
            </div>
          </div>
        );
      })}
    </main>
  );
}