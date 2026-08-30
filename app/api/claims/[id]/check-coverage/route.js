import { NextResponse } from "next/server";
import { getClaim, logEvent } from "@/lib/mockData/claimStore";
import { policy } from "@/lib/mockData/policy";

// POST /api/claims/:id/check-coverage
// Backs the insurer's `check_coverage` WebMCP tool.
// Validates the claim's incident type against the REAL stored policy
// terms — this does not guess, it looks up actual coverage/deductible/limit.
export async function POST(request, { params }) {
  const { id } = await params;
  const claim = getClaim(id);

  if (!claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  if (policy.status !== "active") {
    const result = { covered: false, reason: "Policy is not active" };
    logEvent(id, "insurer", "check_coverage", result);
    return NextResponse.json(result);
  }

  // Map incident type to the relevant coverage bucket.
  const coverageKey = claim.incident.incident_type === "auto_collision"
    ? "collision"
    : "comprehensive";

  const coverageTerms = policy.coverage[coverageKey];

  if (!coverageTerms || !coverageTerms.covered) {
    const result = { covered: false, reason: `No active coverage for ${coverageKey}` };
    logEvent(id, "insurer", "check_coverage", result);
    return NextResponse.json(result);
  }

  const result = {
    covered: true,
    deductible: coverageTerms.deductible,
    per_incident_limit: coverageTerms.per_incident_limit
  };

  logEvent(id, "insurer", "check_coverage", result);
  return NextResponse.json(result);
}
