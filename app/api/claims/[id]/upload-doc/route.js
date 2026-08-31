import { NextResponse } from "next/server";
import { getClaim, addUploadedDoc, logEvent } from "@/lib/mockData/claimStore";

export async function POST(request, { params }) {
  const { id } = await params;
  const claim = await getClaim(id);

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
    await logEvent(id, "policyholder", "upload_document", result);
    return NextResponse.json(result, { status: 400 });
  }

  const updated = await addUploadedDoc(id, doc_type, file_ref);
  const stillMissing = updated.requested_docs.filter(
    (d) => !updated.uploaded_docs.some((u) => u.doc_type === d)
  );

  const result = {
    accepted: true,
    status: updated.status,
    still_missing: stillMissing
  };

  await logEvent(id, "policyholder", "upload_document", result);
  return NextResponse.json(result);
}