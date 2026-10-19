/**
 * Presentation schedule forwarding.
 *
 * Whenever a presentation is scheduled (or rescheduled) the Faculty Admin's
 * actions call `forwardSchedule()`, which tells the student AND every
 * supervisor — in-app and by email — the date, time and venue.
 */

import { prisma } from "./prisma";
import { notifyApplicationStudent, notifySupervisor } from "./notify";
import { sendPortalEmail } from "./email";

export type ScheduleMode = "assigned" | "rescheduled";

export type ScheduleSupervisor = {
  supervisorId: number;
  name: string;
  email: string | null;
};

export type ForwardScheduleInput = {
  mode: ScheduleMode;
  applicationId: number;
  studentName: string;
  studentUserId: number | null;
  studentEmail: string | null;
  proposalTitle: string;
  presentationDate: Date;
  venue: string | null;
  supervisors: ScheduleSupervisor[];
};

function scheduleItems(input: ForwardScheduleInput): string[] {
  return [
    `Date & time: ${input.presentationDate.toLocaleString()}`,
    `Venue: ${input.venue?.trim() || "To be announced"}`,
    `Research proposal: ${input.proposalTitle}`,
  ];
}

/**
 * Notify the student and every supervisor that the presentation schedule has
 * been set (mode "assigned") or changed (mode "rescheduled").
 */
export async function forwardSchedule(input: ForwardScheduleInput): Promise<void> {
  const assigned = input.mode === "assigned";
  const title = assigned
    ? "Presentation scheduled"
    : "Presentation rescheduled";
  const sentence = assigned
    ? `Your presentation has been scheduled for ${input.presentationDate.toLocaleString()}.`
    : `Your presentation has been rescheduled for ${input.presentationDate.toLocaleString()}.`;
  const items = scheduleItems(input);

  // Student (in-app notification always — email when an address is on record).
  await notifyApplicationStudent(
    {
      id: input.applicationId,
      userId: input.studentUserId,
      fullName: input.studentName,
    },
    {
      title,
      message: `${sentence} Venue: ${input.venue?.trim() || "To be announced"}.`,
      category: "presentation",
      senderName: "Faculty Admin",
      link: "/student/presentations",
    },
  );
  if (input.studentEmail) {
    await sendPortalEmail({
      to: input.studentEmail,
      name: input.studentName,
      subject: `${title} - ${input.proposalTitle}`,
      heading: title,
      paragraphs: [sentence],
      items,
      senderLabel: "Faculty Admin, Postgraduate Portal",
      ctaLabel: "Open your presentations",
      ctaPath: "/student/presentations",
    });
  }

  // Every supervisor (in-app via their supervisor profile + email).
  for (const s of input.supervisors) {
    const superSentence = assigned
      ? `The presentation for your student ${input.studentName} has been scheduled for ${input.presentationDate.toLocaleString()}.`
      : `The presentation for your student ${input.studentName} has been rescheduled for ${input.presentationDate.toLocaleString()}.`;
    await notifySupervisor(s.supervisorId, {
      title,
      message: `${superSentence} Venue: ${input.venue?.trim() || "To be announced"}.`,
      category: "presentation",
      senderName: "Faculty Admin",
      link: "/supervisor/presentations",
    });
    if (s.email) {
      await sendPortalEmail({
        to: s.email,
        name: s.name,
        subject: `${title} - ${input.studentName}`,
        heading: title,
        paragraphs: [superSentence],
        items,
        senderLabel: "Faculty Admin, Postgraduate Portal",
        ctaLabel: "Open your presentations",
        ctaPath: "/supervisor/presentations",
      });
    }
  }
}

/** Supervisor list in the shape `forwardSchedule` expects, for a proposal. */
export async function scheduleSupervisorsForProposal(proposalId: number): Promise<ScheduleSupervisor[]> {
  const links = await prisma.proposalSupervisor.findMany({
    where: { proposalId },
    select: {
      supervisor: {
        select: {
          id: true,
          name: true,
          user: { select: { email: true } },
        },
      },
    },
  });
  return links.map((l) => ({
    supervisorId: l.supervisor.id,
    name: l.supervisor.name,
    email: l.supervisor.user?.email ?? null,
  }));
}
