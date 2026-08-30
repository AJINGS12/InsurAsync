import { NextResponse } from "next/server";
import { getClaim } from "@/lib/mockData/claimStore";

// GET /api/claims/:id — fetches full state of a single claim.
export async function GET(request, { params }) {
  const { id } = await params;
  const claim = getClaim(id);

  if (!claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  return NextResponse.json({ claim });
}
