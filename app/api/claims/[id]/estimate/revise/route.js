import { NextResponse } from "next/server";
import { getClaim, setEstimate, logEvent } from "@/lib/mockData/claimStore";
import { rateCard } from "@/lib/mockData/rateCard";

// POST /api/claims/:id/estimate/revise
// Backs the repair shop's `revise_estimate` WebMCP tool.
// Reuses the same real-rate-card calculation as the initial estimate,
// called after the insurer's check_estimate_against_policy flags an issue.
export async function POST(request, { params }) {
  const { id } = await params;
  const claim = getClaim(id);

  if (!claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  const { revised_line_items } = await request.json();

  if (!Array.isArray(revised_line_items) || revised_line_items.length === 0) {
    return NextResponse.json(
      { error: "revised_line_items array is required" },
      { status: 400 }
    );
  }

  let total = 0;
  const priced_items = [];

  for (const item of revised_line_items) {
    const partPrice = rateCard.parts[item.part];
    if (partPrice === undefined) {
      return NextResponse.json(
        { error: `Unknown part in rate card: ${item.part}` },
        { status: 400 }
      );
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

  const updated = setEstimate(id, priced_items, total);
  const result = { line_items: priced_items, total, status: updated.status };

  logEvent(id, "repair_shop", "revise_estimate", result);
  return NextResponse.json(result);
}
