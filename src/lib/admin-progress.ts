import "server-only";

import { prisma } from "@/lib/prisma";

export type SupervisorReviewStatus = "PENDING" | "APPROVED" | "REJECTED";
export type EscalationStatusValue = "PENDING" | "APPROVED" | "RETURNED";

export type ReportSupervisorRow = {
  supervisorName: string;
  isMain: boolean;
  status: SupervisorReviewStatus;
  comment: string | null;
  reviewedAt: string | null;
};

export type ProgressReportRow = {
  id: number;
  title: string;
  submittedAt: string;
  fileName: string | null;
  filePath: string | null;
  supervisors: ReportSupervisorRow[];
  allApproved: boolean;
  /** Supervisor → Faculty → Admin chain. */
  facultyStatus: EscalationStatusValue;
  facultyComment: string | null;
  facultyReviewedAt: string | null;
  adminStatus: EscalationStatusValue;
  adminComment: string | null;
  adminReviewedAt: string | null;
  /** Which stage the report is waiting on right now. */
  stage: "supervisor" | "faculty" | "admin" | "complete";
};

export type StudentProgressRow = {
  applicationId: number;
  studentName: string;
  faculty: string | null;
  degreeProgram: string | null;
  status: string;
  registrationNumber: string | null;
  registrationComplete: boolean;
  proposalTitle: string | null;
  supervisorNames: string[];
  presentation: {
    title: string;
    date: string;
    isDone: boolean;
    isFinal: boolean;
  } | null;
  reports: ProgressReportRow[];
};

/**
 * Student-wise progress overview for staff.
 *
 * @param facultyName  scope to one faculty (faculty admins); null/undefined = all
 * @param completedOnly  only students whose registration has been completed
 *                       (registrar-approved). The Main Admin and Faculty Admin
 *                       progress screens use this so progress is only tracked
 *                       once a student is actually registered.
 */
export async function getStudentProgressOverview(
  facultyName?: string | null,
  completedOnly = false,
): Promise<StudentProgressRow[]> {
  const apps = await prisma.applicationPostGraduate.findMany({
    where: {
      ...(facultyName ? { faculty: facultyName } : {}),
      ...(completedOnly ? { status: "APPROVED" } : {}),
      researchProposals: { some: {} },
    },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      faculty: true,
      degreeProgram: true,
      status: true,
      registrationNumber: true,
      researchProposals: {
        take: 1,
        orderBy: { id: "desc" },
        select: {
          title: true,
          supervisors: {
            orderBy: { isMain: "desc" },
            select: {
              isMain: true,
              supervisor: { select: { name: true } },
            },
          },
          presentations: {
            orderBy: { presentationDate: "desc" },
            take: 1,
            select: {
              title: true,
              presentationDate: true,
              isDone: true,
              isFinal: true,
            },
          },
          progressReports: {
            orderBy: { submittedAt: "desc" },
            select: {
              id: true,
              title: true,
              submittedAt: true,
              completedAt: true,
              facultyStatus: true,
              facultyComment: true,
              facultyReviewedAt: true,
              adminStatus: true,
              adminComment: true,
              adminReviewedAt: true,
              files: { take: 1, select: { originalFileName: true, filePath: true } },
              reviews: {
                select: {
                  status: true,
                  comment: true,
                  reviewedAt: true,
                  supervisor: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  return apps.map((app): StudentProgressRow => {
    const proposal = app.researchProposals[0];
    const supervisorLinks = proposal?.supervisors ?? [];
    const presentation = proposal?.presentations[0] ?? null;

    const reports: ProgressReportRow[] = (proposal?.progressReports ?? []).map((r) => {
      // One row per assigned supervisor, filled from their review if present.
      const byName = new Map(
        r.reviews.map((rv) => [rv.supervisor.name, rv]),
      );
      const supervisors: ReportSupervisorRow[] = supervisorLinks.map((link) => {
        const rv = byName.get(link.supervisor.name);
        return {
          supervisorName: link.supervisor.name,
          isMain: link.isMain,
          status: (rv?.status ?? "PENDING") as SupervisorReviewStatus,
          comment: rv?.comment ?? null,
          reviewedAt: rv?.reviewedAt ? rv.reviewedAt.toISOString() : null,
        };
      });
      const allApproved =
        r.completedAt != null ||
        (supervisors.length > 0 && supervisors.every((s) => s.status === "APPROVED"));

      const facultyStatus = (r.facultyStatus ?? "PENDING") as EscalationStatusValue;
      const adminStatus = (r.adminStatus ?? "PENDING") as EscalationStatusValue;
      const stage: ProgressReportRow["stage"] = !allApproved
        ? "supervisor"
        : facultyStatus !== "APPROVED"
          ? "faculty"
          : adminStatus !== "APPROVED"
            ? "admin"
            : "complete";

      return {
        id: r.id,
        title: r.title,
        submittedAt: r.submittedAt.toISOString(),
        fileName: r.files[0]?.originalFileName ?? null,
        filePath: r.files[0]?.filePath ?? null,
        supervisors,
        allApproved,
        facultyStatus,
        facultyComment: r.facultyComment ?? null,
        facultyReviewedAt: r.facultyReviewedAt ? r.facultyReviewedAt.toISOString() : null,
        adminStatus,
        adminComment: r.adminComment ?? null,
        adminReviewedAt: r.adminReviewedAt ? r.adminReviewedAt.toISOString() : null,
        stage,
      };
    });

    return {
      applicationId: app.id,
      studentName: app.fullName,
      faculty: app.faculty,
      degreeProgram: app.degreeProgram,
      status: app.status,
      registrationNumber: app.registrationNumber,
      registrationComplete: app.status === "APPROVED",
      proposalTitle: proposal?.title ?? null,
      supervisorNames: supervisorLinks.map((l) => l.supervisor.name),
      presentation: presentation
        ? {
            title: presentation.title,
            date: presentation.presentationDate.toISOString(),
            isDone: presentation.isDone,
            isFinal: presentation.isFinal,
          }
        : null,
      reports,
    };
  });
}
