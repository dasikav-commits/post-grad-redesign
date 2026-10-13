"use server";

/**
 * Progress-report escalation: Supervisor → Faculty Admin → Main Admin.
 *
 * Supervisors review in their own portal (`/supervisor/reviews`). Once every
 * assigned supervisor has approved, the report moves to the faculty admin, and
 * once the faculty admin endorses it, to the main admin. Each stage records its
 * decision on the ProgressReport row and tells the student (portal + email),
 * the supervisors and the next reviewer.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  notifyFacultyAdmins,
  notifyRole,
  notifySupervisor,
  notifyUser,
  roleSenderName,
} from "@/lib/notify";
import { sendPortalEmail } from "@/lib/email";

export type StageResult = { ok: true } | { ok: false; error: string };

type Stage = "FACULTY" | "ADMIN";
type Decision = "APPROVED" | "RETURNED";

export async function reviewProgressStage(form: FormData): Promise<StageResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "You must be signed in." };

  const progressId = Number(form.get("progressId"));
  const stage = String(form.get("stage") ?? "") as Stage;
  const decision = String(form.get("decision") ?? "") as Decision;
  const comment = String(form.get("comment") ?? "").trim() || null;

  if (!Number.isInteger(progressId) || !["APPROVED", "RETURNED"].includes(decision)) {
    return { ok: false, error: "Invalid review request." };
  }

  if (stage === "FACULTY") {
    if (session.role !== "FACULTY_ADMIN") {
      return { ok: false, error: "Only a faculty admin can review at this stage." };
    }
  } else if (stage === "ADMIN") {
    if (session.role !== "MAIN_ADMIN" && session.role !== "REGISTRAR") {
      return { ok: false, error: "Only the main admin can sign off this stage." };
    }
  } else {
    return { ok: false, error: "Unknown review stage." };
  }

  const report = await prisma.progressReport.findUnique({
    where: { id: progressId },
    include: {
      reviews: { select: { status: true } },
      proposal: {
        select: {
          title: true,
          supervisors: { select: { supervisorId: true } },
          application: {
            select: {
              id: true,
              userId: true,
              fullName: true,
              faculty: true,
              emails: { select: { email: true } },
            },
          },
        },
      },
    },
  });
  if (!report) return { ok: false, error: "Progress report not found." };

  const application = report.proposal.application;
  const supervisorApproved =
    report.completedAt != null ||
    (report.reviews.length > 0 &&
      report.reviews.every((r: { status: string }) => r.status === "APPROVED"));

  if (!supervisorApproved) {
    return {
      ok: false,
      error: "The supervisors have not approved this report yet.",
    };
  }

  if (stage === "ADMIN" && report.facultyStatus !== "APPROVED") {
    return {
      ok: false,
      error: "The faculty admin has to endorse this report first.",
    };
  }

  // Faculty admins only handle their own faculty.
  if (stage === "FACULTY" && session.role === "FACULTY_ADMIN") {
    const profile = await prisma.facultyAdminProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, faculty: true },
    });
    if (!profile) return { ok: false, error: "Faculty admin profile not found." };
    if (profile.faculty && application.faculty && profile.faculty !== application.faculty) {
      return { ok: false, error: "This student belongs to another faculty." };
    }

    await prisma.progressReport.update({
      where: { id: progressId },
      data: {
        facultyStatus: decision,
        facultyComment: comment,
        facultyAdminId: profile.id,
        facultyReviewedAt: new Date(),
        // A returned report restarts the chain.
        ...(decision === "RETURNED" ? { adminStatus: "PENDING", adminComment: null, adminId: null, adminReviewedAt: null } : {}),
      },
    });
  } else {
    const admin = await prisma.adminProfile.upsert({
      where: { userId: session.userId },
      update: {},
      create: { userId: session.userId },
    });
    await prisma.progressReport.update({
      where: { id: progressId },
      data: {
        adminStatus: decision,
        adminComment: comment,
        adminId: admin.id,
        adminReviewedAt: new Date(),
      },
    });
  }

  const senderLabel = roleSenderName(session.role, session.fullName);
  const studentName = application.fullName;
  const title = report.title;
  const outcome = decision === "APPROVED" ? "approved" : "returned for changes";
  const stageLabel = stage === "FACULTY" ? "Faculty Admin" : "Main Admin";

  // Student: portal + email.
  if (application.userId) {
    await notifyUser(application.userId, {
      title: `Progress report ${outcome}`,
      message: `${stageLabel} ${outcome} your "${title}" progress report.${comment ? ` Comment: ${comment}` : ""}`,
      applicationId: application.id,
      category: "progress",
      senderName: senderLabel,
      link: "/student/progress",
    });
  }
  const studentEmail = application.emails[0]?.email;
  if (studentEmail) {
    await sendPortalEmail({
      to: studentEmail,
      name: studentName,
      subject: `Progress Report ${decision === "APPROVED" ? "Approved" : "Returned"} - ${stageLabel}`,
      heading: `Your progress report was ${outcome}`,
      paragraphs: [
        `The ${stageLabel} has ${outcome} your progress report "${title}".`,
        ...(comment ? [`Comment: ${comment}`] : []),
        decision === "RETURNED"
          ? "Please upload a revised report from the Progress Reports page."
          : stage === "FACULTY"
            ? "It has been forwarded to the Main Admin for final sign-off."
            : "This completes the review chain for this report.",
      ],
      senderLabel,
      ctaLabel: "Open progress reports",
      ctaPath: "/student/progress",
    });
  }

  // Supervisors are told what happened to the report they approved.
  for (const link of report.proposal.supervisors) {
    await notifySupervisor(link.supervisorId, {
      title: `Progress report ${outcome}`,
      message: `${studentName}'s "${title}" was ${outcome} by the ${stageLabel}.`,
      applicationId: application.id,
      category: "progress",
      senderName: senderLabel,
    });
  }

  if (decision === "APPROVED" && stage === "FACULTY") {
    // Next stage: main admin (+ registrar, who handles registrations).
    await notifyRole("MAIN_ADMIN", {
      title: "Progress report awaiting admin sign-off",
      message: `${studentName}'s "${title}" has been endorsed by the faculty admin.`,
      applicationId: application.id,
      category: "progress",
      senderName: senderLabel,
      link: "/admin/progress",
    });
    await notifyRole("REGISTRAR", {
      title: "Progress report endorsed by faculty",
      message: `${studentName}'s "${title}" has been endorsed by the faculty admin and forwarded to the main admin.`,
      applicationId: application.id,
      category: "progress",
      senderName: senderLabel,
    });
  }

  if (decision === "APPROVED" && stage === "ADMIN") {
    await notifyFacultyAdmins(application.faculty, {
      title: "Progress report signed off",
      message: `${studentName}'s "${title}" has been signed off by the main admin.`,
      applicationId: application.id,
      category: "progress",
      senderName: senderLabel,
    });
    await notifyRole("REGISTRAR", {
      title: "Progress report signed off",
      message: `${studentName}'s "${title}" completed the Supervisor → Faculty → Admin chain.`,
      applicationId: application.id,
      category: "progress",
      senderName: senderLabel,
    });
  }

  revalidatePath("/admin/progress");
  revalidatePath("/faculty-admin/progress");
  revalidatePath("/supervisor/reviews");
  revalidatePath("/student/progress");
  return { ok: true };
}
