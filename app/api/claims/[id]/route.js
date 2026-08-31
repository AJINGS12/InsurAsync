import { NextResponse } from "next/server";
import { getClaim } from "@/lib/mockData/claimStore";

export async function GET(request, { params }) {
  const { id } = await params;
  const claim = await getClaim(id);

  if (!claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  return NextResponse.json({ claim });
}