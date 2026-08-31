import { NextResponse } from "next/server";
import { createClaim, listClaims } from "@/lib/mockData/claimStore";

export async function POST(request) {
  const body = await request.json();
  const { incident_type, date, description, photos, estimated_severity } = body;

  if (!incident_type || !date || !description) {
    return NextResponse.json(
      { error: "incident_type, date, and description are required" },
      { status: 400 }
    );
  }

  const claim = await createClaim({
    incident_type,
    date,
    description,
    photos: photos || [],
    estimated_severity: estimated_severity || "unknown"
  });

  return NextResponse.json({ claim_id: claim.claim_id, status: claim.status, claim });
}

export async function GET() {
  const claims = await listClaims();
  return NextResponse.json({ claims });
}