import { NextResponse } from "next/server";
import { getClaim, logEvent } from "@/lib/mockData/claimStore";
import { policy } from "@/lib/mockData/policy";

export async function POST(request, { params }) {
  const { id } = await params;
  const claim = await getClaim(id);

  if (!claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  if (policy.status !== "active") {
    const result = { covered: false, reason: "Policy is not active" };
    await logEvent(id, "insurer", "check_coverage", result);
    return NextResponse.json(result);
  }

  const coverageKey = claim.incident.incident_type === "auto_collision"
    ? "collision"
    : "comprehensive";

  const coverageTerms = policy.coverage[coverageKey];

  if (!coverageTerms || !coverageTerms.covered) {
    const result = { covered: false, reason: `No active coverage for ${coverageKey}` };
    await logEvent(id, "insurer", "check_coverage", result);
    return NextResponse.json(result);
  }

  const result = {
    covered: true,
    deductible: coverageTerms.deductible,
    per_incident_limit: coverageTerms.per_incident_limit
  };

  await logEvent(id, "insurer", "check_coverage", result);
  return NextResponse.json(result);
}