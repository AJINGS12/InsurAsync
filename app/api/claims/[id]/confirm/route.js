import { NextResponse } from "next/server";
import { getClaim, setSettlement, logEvent } from "@/lib/mockData/claimStore";

// POST /api/claims/:id/confirm
// Backs the policyholder's `confirm_settlement` WebMCP tool.
// This is deliberately the ONLY tool that finalizes anything — it should
// only ever be triggered by an explicit human click in the UI, never
// called autonomously by an agent. See the policyholder page component
// for how this is gated behind a human confirmation step.
export async function POST(request, { params }) {
  const { id } = await params;
  const claim = getClaim(id);

  if (!claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  if (claim.estimate_status !== "approved") {
    return NextResponse.json(
      { error: "Cannot settle: estimate has not been approved yet" },
      { status: 400 }
    );
  }

  const { accept } = await request.json();
  const updated = setSettlement(id, !!accept);

  const result = { settled: !!accept, status: updated.status };
  logEvent(id, "policyholder", "confirm_settlement", result);

  return NextResponse.json(result);
}
