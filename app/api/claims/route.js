import { NextResponse } from "next/server";
import { createClaim, listClaims } from "@/lib/mockData/claimStore";

// POST /api/claims — creates a new claim from a structured incident report.
// Backs the policyholder's `submit_incident_report` WebMCP tool.
export async function POST(request) {
  const body = await request.json();
  const { incident_type, date, description, photos, estimated_severity } = body;

  if (!incident_type || !date || !description) {
    return NextResponse.json(
      { error: "incident_type, date, and description are required" },
      { status: 400 }
    );
  }

  const claim = createClaim({
    incident_type,
    date,
    description,
    photos: photos || [],
    estimated_severity: estimated_severity || "unknown"
  });

  return NextResponse.json({ claim_id: claim.claim_id, status: claim.status, claim });
}

// GET /api/claims — lists all claims, most recent first.
// Backs the shared live negotiation log view.
export async function GET() {
  return NextResponse.json({ claims: listClaims() });
}
