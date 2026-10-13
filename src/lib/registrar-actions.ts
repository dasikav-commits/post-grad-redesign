"use server";

/**
 * Registrar communication tools.
 *
 * The Registrar is the channel through which applicants are informed, so this
 * covers both one-to-one messages (see `notifyStudent` in review-actions) and
 * announcements to a whole group of applicants — delivered to the portal
 * notification centre when the applicant has an account, and by email to the
 * address on the application in every case.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/guard";
import { notifyApplicationStudent, roleSenderName } from "@/lib/notify";
import { sendPortalEmail } from "@/lib/email";
import { getApplicationSummaries } from "@/lib/application-summary";
import {
  GROUP_LABEL,
  groupWhere,
  type NotifyGroup,
} from "@/lib/registrar-groups";

export type GroupResult =
  | { ok: true; reached: number; emailed: number }
  | { ok: false; error: string };

/** Send one announcement to a group of applicants. */
export async function notifyStudentGroup(
  form: FormData,
): Promise<GroupResult> {
  const session = await requireRole("REGISTRAR");

  const group = String(form.get("group") ?? "all") as NotifyGroup;
  const title = String(form.get("title") ?? "").trim();
  const message = String(form.get("message") ?? "").trim();
  const sendEmailToo = form.get("sendEmail") !== null;

  if (!title || !message) {
    return { ok: false, error: "A subject and a message are required." };
  }
  if (!(group in GROUP_LABEL)) {
    return { ok: false, error: "Unknown group." };
  }

  const apps = await prisma.applicationPostGraduate.findMany({
    where: groupWhere(group),
    orderBy: { registrationDate: "desc" },
    select: {
      id: true,
      userId: true,
      fullName: true,
      emails: { select: { email: true } },
    },
  });

  let targets = apps;
  if (group === "incomplete") {
    const summaries = await getApplicationSummaries(
      apps.map((a: { id: number }) => a.id),
    );
    targets = apps.filter((a: { id: number }) => {
      const s = summaries.get(a.id);
      return s ? !s.complete : false;
    });
  }

  if (targets.length === 0) {
    return { ok: false, error: "No applicants match that group." };
  }

  const senderLabel = roleSenderName(session.role, session.fullName);
  let reached = 0;
  let emailed = 0;

  for (const app of targets) {
    const notified = await notifyApplicationStudent(
      { id: app.id, userId: app.userId, fullName: app.fullName },
      {
        title,
        message,
        applicationId: app.id,
        category: "message",
        senderName: senderLabel,
        link: "/student/notifications",
      },
    );
    if (notified) reached += 1;

    const email = app.emails[0]?.email;
    if (sendEmailToo && email) {
      const sent = await sendPortalEmail({
        to: email,
        name: app.fullName,
        subject: title,
        heading: title,
        paragraphs: [message],
        senderLabel,
        ctaLabel: "Open the portal",
        ctaPath: "/student/notifications",
      });
      if (sent) emailed += 1;
    }
  }

  revalidatePath("/registrar/notify");
  revalidatePath("/registrar");
  return { ok: true, reached, emailed };
}
