import { NextResponse } from "next/server";
import { getClaim, setSettlement, logEvent } from "@/lib/mockData/claimStore";

export async function POST(request, { params }) {
  const { id } = await params;
  const claim = await getClaim(id);

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
  const updated = await setSettlement(id, !!accept);

  const result = { settled: !!accept, status: updated.status };
  await logEvent(id, "policyholder", "confirm_settlement", result);

  return NextResponse.json(result);
}