import { NextResponse } from "next/server";
import { getClaim, setEstimateStatus, logEvent } from "@/lib/mockData/claimStore";
import { policy } from "@/lib/mockData/policy";

export async function POST(request, { params }) {
  const { id } = await params;
  const claim = await getClaim(id);

  if (!claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  if (!claim.estimate) {
    return NextResponse.json(
      { error: "No estimate has been submitted for this claim yet" },
      { status: 400 }
    );
  }

  const coverageKey = claim.incident.incident_type === "auto_collision"
    ? "collision"
    : "comprehensive";
  const limit = policy.coverage[coverageKey].per_incident_limit;

  const total = claim.estimate.total;
  const withinLimit = total <= limit;

  const result = withinLimit
    ? { approved: true, total, limit }
    : {
        approved: false,
        total,
        limit,
        excess: Math.round((total - limit) * 100) / 100,
        reason: `Estimate exceeds per-incident limit of $${limit} by $${Math.round((total - limit) * 100) / 100}`
      };

  await setEstimateStatus(id, withinLimit ? "approved" : "revision_requested", result.reason || null);
  await logEvent(id, "insurer", "check_estimate_against_policy", result);

  return NextResponse.json(result);
}