"use client";

import { useEffect, useState, useCallback } from "react";

const STATUS_META = {
  submitted: { label: "Submitted", color: "slate" },
  awaiting_documents: { label: "Awaiting documents", color: "amber" },
  documents_complete: { label: "Documents complete", color: "teal" },
  estimate_submitted: { label: "Estimate under review", color: "amber" },
  ready_for_settlement: { label: "Ready for settlement", color: "teal" },
  settled: { label: "Settled", color: "teal" },
  settlement_declined: { label: "Settlement declined", color: "red" }
};

const ACTOR_LABELS = {
  policyholder: "🧍 Policyholder",
  insurer: "🏢 Insurer",
  repair_shop: "🔧 Repair shop"
};

export default function HomePage() {
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
    const interval = setInterval(refreshClaims, 1500);
    return () => clearInterval(interval);
  }, [refreshClaims]);

  return (
    <main>
      <div className="container">
        <div className="hero">
          <h1>Three parties. One synced claim.</h1>
          <p className="hero-lead">
            Watch the policyholder, insurer, and repair shop agents negotiate a claim
            in real time — real coverage checks, real pricing, real limits. No relaying
            information between them by hand.
          </p>
          <div className="legend">
            <span className="legend-item">
              <span className="legend-dot" style={{ background: "#6B7280" }} /> Submitted
            </span>
            <span className="legend-item">
              <span className="legend-dot" style={{ background: "#B8863B" }} /> In progress
            </span>
            <span className="legend-item">
              <span className="legend-dot" style={{ background: "#0E7C6B" }} /> Settled
            </span>
            <span className="legend-item">
              <span className="legend-dot" style={{ background: "#C1432E" }} /> Declined
            </span>
          </div>
        </div>

        {claims.length === 0 && (
          <div className="empty-state">
            No claims yet. Open the Policyholder view and ask your agent to file an
            incident report to start one.
          </div>
        )}

        {claims.map((claim) => {
          const meta = STATUS_META[claim.status] || { label: claim.status, color: "slate" };
          return (
            <div key={claim.claim_id} className="claim-panel">
              <div className="claim-panel-header">
                <span className="claim-id">{claim.claim_id}</span>
                <span className={`status-chip ${meta.color}`}>{meta.label}</span>
              </div>
              <div className="claim-panel-body">
                {claim.log.map((entry, i) => (
                  <div key={i} className="log-entry">
                    <span className="log-actor">
                      {ACTOR_LABELS[entry.actor] || entry.actor}
                    </span>
                    {" → "}
                    <span className="log-action">{entry.action}</span>
                    <div className="log-detail">{summarize(entry)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

function summarize(entry) {
  const d = entry.detail;
  if (!d) return "";
  switch (entry.action) {
    case "submit_incident_report":
      return `${d.incident_type} reported on ${d.date}`;
    case "check_coverage":
      return d.covered
        ? `Covered — deductible $${d.deductible}, limit $${d.per_incident_limit}`
        : `Not covered: ${d.reason}`;
    case "request_missing_docs":
      return `Requested: ${d.requested_docs.join(", ")}`;
    case "upload_document":
      return d.accepted ? `Document accepted (${d.status})` : `Rejected: ${d.reason}`;
    case "propose_estimate":
    case "revise_estimate":
      return `Estimate total: $${d.total.toFixed(2)}`;
    case "check_estimate_against_policy":
      return d.approved
        ? `Approved — $${d.total} within $${d.limit} limit`
        : `Flagged — $${d.total} exceeds $${d.limit} limit by $${d.excess}`;
    case "confirm_settlement":
      return d.settled ? "Settlement confirmed by policyholder" : "Settlement declined";
    default:
      return JSON.stringify(d);
  }
}