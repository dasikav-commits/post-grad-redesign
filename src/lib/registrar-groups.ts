/**
 * Applicant groups the Registrar can address from "Notify Students".
 * Plain (non-server) module so both the page and the server action can use it.
 */

import type { Prisma } from "@prisma/client";

export type NotifyGroup = "all" | "new" | "approved" | "corrections" | "incomplete";

export const GROUP_LABEL: Record<NotifyGroup, string> = {
  all: "Every applicant",
  new: "Applicants with a new registration",
  approved: "Registered students",
  corrections: "Applicants with open corrections",
  incomplete: "Applicants with missing requirements",
};

export const GROUP_HINT: Record<NotifyGroup, string> = {
  all: "Everyone who has submitted an application.",
  new: "Registrations that have not been decided yet.",
  approved: "Students whose registration has been completed.",
  corrections: "Applicants who still owe a correction.",
  incomplete: "Applicants whose requirement checklist is not complete.",
};

export const NOTIFY_GROUPS = Object.keys(GROUP_LABEL) as NotifyGroup[];

/** Prisma `where` fragment for a group ("incomplete" is filtered in JS). */
export function groupWhere(
  group: NotifyGroup,
): Prisma.ApplicationPostGraduateWhereInput {
  switch (group) {
    case "new":
      return { status: "ACTIVE" as const };
    case "approved":
      return { status: "APPROVED" as const };
    case "corrections":
      return { corrections: { some: { status: "OPEN" as const } } };
    default:
      return {};
  }
}
