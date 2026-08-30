import { NextResponse } from "next/server";
import { getClaim, setRequestedDocs, logEvent } from "@/lib/mockData/claimStore";
import { requiredDocsByIncidentType } from "@/lib/mockData/policy";

// POST /api/claims/:id/request-docs
// Backs the insurer's `request_missing_docs` WebMCP tool.
// Looks up the REAL document requirements for this incident type
// instead of an agent guessing what paperwork might be needed.
export async function POST(request, { params }) {
  const { id } = await params;
  const claim = getClaim(id);

  if (!claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  const required = requiredDocsByIncidentType[claim.incident.incident_type] || [];
  const updated = setRequestedDocs(id, required);

  const result = { requested_docs: required, status: updated.status };
  logEvent(id, "insurer", "request_missing_docs", result);
  return NextResponse.json(result);
}
