import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  buildApplicationsWorkbook,
  loadExportRows,
  type ExportScope,
} from "@/lib/application-export";
import { safeFileName, XLSX_MIME } from "@/lib/xlsx";

export const dynamic = "force-dynamic";

const ALLOWED = ["MAIN_ADMIN", "FACULTY_ADMIN", "REGISTRAR"];
const SCOPES: ExportScope[] = ["all", "active", "approved", "rejected"];

const SHEET_NAME: Record<ExportScope, string> = {
  all: "Applications",
  active: "New applications",
  approved: "Approved",
  rejected: "Rejected",
};

/**
 * GET /api/export/applications?scope=all|active|approved|rejected
 *
 * Downloads the student applications list as a real .xlsx workbook. Faculty
 * admins only ever get their own faculty's rows.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !ALLOWED.includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requested = new URL(request.url).searchParams.get("scope") ?? "all";
  const scope: ExportScope = SCOPES.includes(requested as ExportScope)
    ? (requested as ExportScope)
    : "all";

  const verification = new URL(request.url).searchParams.get("verification");
  const rows = await loadExportRows(
    session.role,
    session.userId,
    scope,
    verification,
  );
  const workbook = buildApplicationsWorkbook(rows, SHEET_NAME[scope]);

  return new NextResponse(new Uint8Array(workbook), {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="${safeFileName(
        `student-applications-${scope}${
          verification ? `-${verification.toLowerCase().replace(/,/g, "+")}` : ""
        }`,
      )}"`,
      "Cache-Control": "no-store",
    },
  });
}
