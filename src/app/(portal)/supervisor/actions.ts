"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireApprovedSupervisor } from "@/lib/guard";
import { notifyUser, notifyFacultyAdmins, notifyRole } from "@/lib/notify";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function submitSupervisorReview(form: FormData): Promise<ActionResult> {
  // Portal access must have been approved by the Main Admin.
  const gate = await requireApprovedSupervisor();
  if (!gate.ok) return gate;
  const { supervisorId } = gate;

  const progressId = Number(form.get("progressId"));
  const status = String(form.get("status") ?? "");
  const comment = String(form.get("comment") ?? "").trim();

  if (!progressId || !["APPROVED", "REJECTED"].includes(status)) {
    return { ok: false, error: "Invalid review request." };
  }

  const supervisor = { id: supervisorId };

  const report = await prisma.progressReport.findUnique({
    where: { id: progressId },
    select: {
      id: true,
      title: true,
      completedAt: true,
      proposal: {
        select: {
          supervisors: { select: { supervisorId: true } },
          application: {
            select: { id: true, userId: true, fullName: true, faculty: true },
          },
        },
      },
    },
  });

  if (!report) {
    return { ok: false, error: "Progress report was not found." };
  }

  const isAssigned = report.proposal.supervisors.some(
    (item) => item.supervisorId === supervisor.id,
  );
  if (!isAssigned) {
    return { ok: false, error: "You are not assigned to this student." };
  }

  const existing = await prisma.supervisorProgressReview.findFirst({
    where: {
      progressId,
      supervisorId: supervisor.id,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.supervisorProgressReview.update({
      where: { id: existing.id },
      data: {
        status: status === "APPROVED" ? "APPROVED" : "REJECTED",
        comment: comment || null,
        reviewedAt: new Date(),
      },
    });
  } else {
    await prisma.supervisorProgressReview.create({
      data: {
        progressId,
        supervisorId: supervisor.id,
        status: status === "APPROVED" ? "APPROVED" : "REJECTED",
        comment: comment || null,
        reviewedAt: new Date(),
      },
    });
  }

  const application = report.proposal.application;
  const studentUserId = application?.userId;

  // Let the student know their report has been reviewed.
  if (studentUserId) {
    await notifyUser(studentUserId, {
      title: "Progress report reviewed",
      message: `Your supervisor ${status === "APPROVED" ? "approved" : "requested changes on"} "${report.title}".`,
      applicationId: application?.id ?? null,
    });
  }

  // If every assigned supervisor has now APPROVED this report, the progress
  // stage is complete: record it and notify the student, faculty admins and
  // registrars. Only fires once (guarded by completedAt).
  const assignedIds = report.proposal.supervisors.map((s) => s.supervisorId);
  if (status === "APPROVED" && assignedIds.length > 0 && !report.completedAt) {
    const approvedCount = await prisma.supervisorProgressReview.count({
      where: {
        progressId,
        supervisorId: { in: assignedIds },
        status: "APPROVED",
      },
    });
    if (approvedCount === assignedIds.length) {
      await prisma.progressReport.update({
        where: { id: progressId },
        data: { completedAt: new Date() },
      });
      const studentName = application?.fullName ?? "The student";
      if (studentUserId) {
        await notifyUser(studentUserId, {
          title: "Progress stage complete",
          message: `All supervisors have approved "${report.title}". This progress stage is now complete.`,
          applicationId: application?.id ?? null,
        });
      }
      await notifyFacultyAdmins(application?.faculty, {
        title: "Progress stage complete",
        message: `${studentName}'s "${report.title}" has been approved by all supervisors.`,
        applicationId: application?.id ?? null,
      });
      await notifyRole("REGISTRAR", {
        title: "Progress stage complete",
        message: `${studentName}'s "${report.title}" has been approved by all supervisors.`,
        applicationId: application?.id ?? null,
      });
    }
  }

  revalidatePath("/supervisor/reviews");
  revalidatePath("/admin/progress");
  revalidatePath("/faculty-admin/progress");
  revalidatePath("/supervisor");
  revalidatePath("/student/progress");
  return { ok: true };
}
