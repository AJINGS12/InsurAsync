import { NextResponse } from "next/server";
import { getClaim, addUploadedDoc, logEvent } from "@/lib/mockData/claimStore";

// POST /api/claims/:id/upload-doc
// Backs the policyholder's `upload_document` WebMCP tool.
// Rejects documents that weren't actually requested for this claim,
// so the tool enforces the real requirement list rather than accepting anything.
export async function POST(request, { params }) {
  const { id } = await params;
  const claim = getClaim(id);

  if (!claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  const { doc_type, file_ref } = await request.json();

  if (!doc_type || !file_ref) {
    return NextResponse.json(
      { error: "doc_type and file_ref are required" },
      { status: 400 }
    );
  }

  if (!claim.requested_docs.includes(doc_type)) {
    const result = {
      accepted: false,
      reason: `"${doc_type}" was not requested for this claim`
    };
    logEvent(id, "policyholder", "upload_document", result);
    return NextResponse.json(result, { status: 400 });
  }

  const updated = addUploadedDoc(id, doc_type, file_ref);
  const stillMissing = updated.requested_docs.filter(
    (d) => !updated.uploaded_docs.some((u) => u.doc_type === d)
  );

  const result = {
    accepted: true,
    status: updated.status,
    still_missing: stillMissing
  };

  logEvent(id, "policyholder", "upload_document", result);
  return NextResponse.json(result);
}
