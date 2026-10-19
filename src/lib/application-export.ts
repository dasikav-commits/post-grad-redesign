import "server-only";

import type { UserRole, VerificationStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { factsFromApplication, requirementSummary } from "./requirements";
import { buildXlsx, type CellValue, type Sheet } from "./xlsx";
import { FUNDING_LABEL, STUDY_MODE_LABEL, VERIFICATION_LABEL } from "./status-labels";

/**
 * Builds the "student applications" Excel export shared by the Faculty Admin
 * and Main Admin / Registrar application lists.
 */

export type ExportScope = "all" | "active" | "approved" | "rejected";

/** Verification filters the export can be narrowed to. */
export const VERIFICATIONS = [
  "NOT_VERIFIED",
  "UNDER_REVIEW",
  "VERIFIED",
  "CORRECTION_REQUESTED",
] as const;

export const EXPORT_HEADERS = [
  "Application ID",
  "Name",
  "NIC",
  "Reg No",
  "Email",
  "Faculty",
  "Degree",
  "FT/PT",
  "Proposal title",
  "Contact",
  "Funding method",
  "Requirements met",
  "Verification",
  "Open corrections",
  "Status",
  "Submitted",
] as const;

function statusFilter(scope: ExportScope) {
  if (scope === "active") return { status: "ACTIVE" as const };
  if (scope === "approved") return { status: "APPROVED" as const };
  if (scope === "rejected") return { status: "REJECTED" as const };
  return {};
}

/**
 * Load the applications a given staff member may export, plus everything needed
 * for the requirement counts. Faculty admins are scoped to their own faculty.
 */
export async function loadExportRows(
  role: UserRole,
  userId: number,
  scope: ExportScope,
  verification?: string | null,
): Promise<CellValue[][]> {
  const facultyFilter =
    role === "FACULTY_ADMIN"
      ? await prisma.facultyAdminProfile
          .findUnique({ where: { userId }, select: { faculty: true } })
          .then((p) => (p?.faculty ? { faculty: p.faculty } : {}))
      : {};

  // Comma separated list of VerificationStatus values, e.g.
  // "NOT_VERIFIED,UNDER_REVIEW".
  const verificationFilter = (() => {
    const wanted: VerificationStatus[] = (verification ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter((v): v is VerificationStatus =>
        (VERIFICATIONS as readonly string[]).includes(v),
      );
    return wanted.length ? { verificationStatus: { in: wanted } } : {};
  })();

  const apps = await prisma.applicationPostGraduate.findMany({
    where: { ...statusFilter(scope), ...facultyFilter, ...verificationFilter },
    orderBy: { registrationDate: "desc" },
    include: {
      user: { select: { userCode: true } },
      emails: { select: { email: true } },
      contacts: { select: { contactType: true, contactValue: true } },
      academicQualifications: { select: { id: true, files: { select: { id: true } } } },
      professionalQualifications: { select: { id: true, files: { select: { id: true } } } },
      researchProposals: {
        take: 1,
        orderBy: { id: "desc" },
        select: {
          title: true,
          files: { select: { id: true } },
          supervisors: { select: { cvDocument: true, consentDocument: true } },
        },
      },
      corrections: { where: { status: "OPEN" }, select: { id: true } },
    },
  });

  const ids = apps.map((a: { id: number }) => a.id);
  const docs = ids.length
    ? await prisma.uploadedFile.findMany({
        where: { applicationId: { in: ids } },
        select: { applicationId: true, category: true },
      })
    : [];
  const docsByApp = new Map<number, { category: string | null }[]>();
  for (const d of docs) {
    const list = docsByApp.get(d.applicationId) ?? [];
    list.push({ category: d.category });
    docsByApp.set(d.applicationId, list);
  }

  return apps.map((a): CellValue[] => {
    const proposal = a.researchProposals[0];
    const facts = factsFromApplication({
      uploadedFiles: docsByApp.get(a.id) ?? [],
      academicQualifications: a.academicQualifications,
      professionalQualifications: a.professionalQualifications,
      researchProposals: proposal ? [proposal] : [],
    });
    const summary = requirementSummary(facts);

    return [
      a.id,
      a.fullName,
      a.nic,
      a.registrationNumber ?? a.user?.userCode ?? "",
      a.emails.map((e: { email: string }) => e.email).join(", "),
      a.faculty ?? "",
      a.degreeProgram ?? "",
      a.studyMode ? (STUDY_MODE_LABEL[a.studyMode] ?? a.studyMode) : "",
      proposal?.title ?? "",
      a.contacts
        .map((c: { contactType: string; contactValue: string }) => c.contactValue)
        .join(", "),
      a.fundingMethod ? (FUNDING_LABEL[a.fundingMethod] ?? a.fundingMethod) : "",
      `${summary.met}/${summary.total}`,
      VERIFICATION_LABEL[a.verificationStatus] ?? a.verificationStatus,
      a.corrections.length,
      a.status,
      new Date(a.registrationDate).toISOString().slice(0, 10),
    ];
  });
}

export function buildApplicationsSheet(
  rows: CellValue[][],
  sheetName: string,
): Sheet {
  return {
    name: sheetName,
    headers: [...EXPORT_HEADERS],
    rows,
    widths: [14, 26, 14, 14, 28, 20, 26, 10, 40, 20, 20, 16, 20, 15, 12, 12],
  };
}

export function buildApplicationsWorkbook(
  rows: CellValue[][],
  sheetName: string,
): Buffer {
  return buildXlsx(buildApplicationsSheet(rows, sheetName));
}
