import { NextResponse } from "next/server";
import { getClaim, setEstimate, logEvent } from "@/lib/mockData/claimStore";
import { rateCard } from "@/lib/mockData/rateCard";

// POST /api/claims/:id/estimate
// Backs the repair shop's `propose_estimate` WebMCP tool.
// Calculates the total from the shop's REAL rate card (parts + labor)
// instead of the agent inventing a number.
//
// Expected body: { line_items: [{ part: "front_bumper", labor_hours: 2 }, ...] }
export async function POST(request, { params }) {
  const { id } = await params;
  const claim = getClaim(id);

  if (!claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  const { line_items } = await request.json();

  if (!Array.isArray(line_items) || line_items.length === 0) {
    return NextResponse.json(
      { error: "line_items array is required" },
      { status: 400 }
    );
  }

  let total = 0;
  const priced_items = [];
  const unknown_parts = [];

  for (const item of line_items) {
    const partPrice = rateCard.parts[item.part];
    if (partPrice === undefined) {
      unknown_parts.push(item.part);
      continue;
    }
    const laborCost = (item.labor_hours || 0) * rateCard.labor_rate_per_hour;
    const lineTotal = partPrice + laborCost;
    total += lineTotal;
    priced_items.push({
      part: item.part,
      part_cost: partPrice,
      labor_hours: item.labor_hours || 0,
      labor_cost: laborCost,
      line_total: lineTotal
    });
  }

  if (unknown_parts.length > 0) {
    return NextResponse.json(
      { error: `Unknown parts not in rate card: ${unknown_parts.join(", ")}` },
      { status: 400 }
    );
  }

  const updated = setEstimate(id, priced_items, total);
  const result = { line_items: priced_items, total, status: updated.status };

  logEvent(id, "repair_shop", "propose_estimate", result);
  return NextResponse.json(result);
}
