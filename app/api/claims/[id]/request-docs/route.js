import { NextResponse } from "next/server";
import { getClaim, setRequestedDocs, logEvent } from "@/lib/mockData/claimStore";
import { requiredDocsByIncidentType } from "@/lib/mockData/policy";

export async function POST(request, { params }) {
  const { id } = await params;
  const claim = await getClaim(id);

  if (!claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  const required = requiredDocsByIncidentType[claim.incident.incident_type] || [];
  const updated = await setRequestedDocs(id, required);

  const result = { requested_docs: required, status: updated.status };
  await logEvent(id, "insurer", "request_missing_docs", result);
  return NextResponse.json(result);
}