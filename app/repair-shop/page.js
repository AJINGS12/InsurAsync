"use client";

import { useEffect, useState, useCallback } from "react";
import { registerToolSafely } from "@/lib/webmcp/registerToolSafely";

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
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem", fontFamily: "system-ui" }}>
      <h1>Repair Shop</h1>
      <p style={{ color: "#666" }}>
        Your agent proposes and revises repair estimates using the shop&apos;s real
        parts and labor pricing — no guessed numbers.
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
          {claim.estimate ? (
            <div>
              <strong>Current estimate:</strong> ${claim.estimate.total.toFixed(2)} —{" "}
              <strong>{claim.estimate_status}</strong>
              {claim.estimate_review_reason ? ` (${claim.estimate_review_reason})` : ""}
              <ul>
                {claim.estimate.line_items.map((item, i) => (
                  <li key={i}>
                    {item.part}: ${item.part_cost} + {item.labor_hours}h labor (${item.labor_cost}) = ${item.line_total}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p>No estimate submitted yet.</p>
          )}
        </div>
      ))}
    </main>
  );
}