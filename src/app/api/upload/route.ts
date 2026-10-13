import { NextResponse } from "next/server";
import { uploadRegistrationFile } from "@/lib/storage";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

// Whitelist of logical folders the registration wizard may upload into.
const FOLDERS = new Set([
  "application-form",
  "academic",
  "work",
  "professional",
  "cv",
  "birth-certificate",
  "transcript",
  "photo",
  "payment-receipt",
  "referee",
  "budget",
  "supervisor-consent",
  "supervisor-cv",
  "proposal",
  "progress",
]);

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const file = form.get("file");
  const folder = String(form.get("folder") ?? "");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (!FOLDERS.has(folder)) {
    return NextResponse.json({ error: "Invalid upload target." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File exceeds the 15 MB limit." },
      { status: 400 },
    );
  }
  if (file.type && !ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "Only PDF, image or Word documents are allowed." },
      { status: 400 },
    );
  }

  try {
    const stored = await uploadRegistrationFile(folder, file);
    return NextResponse.json({ ok: true, ...stored });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
