import "server-only";

import { prisma } from "./prisma";

/**
 * Registration numbers ("Reg No") are handed out when a registration is
 * completed: `PG/<year>/<seq>`, where the sequence restarts each year.
 *
 * The value is guarded by a unique index, so the candidate is checked (and
 * bumped) before it is written.
 */
export async function nextRegistrationNumber(
  registrationDate: Date = new Date(),
): Promise<string> {
  const year = new Date(registrationDate).getFullYear();
  const prefix = `PG/${year}/`;

  const existing = await prisma.applicationPostGraduate.count({
    where: { registrationNumber: { startsWith: prefix } },
  });

  let seq = existing + 1;
  // Skip any number already taken (e.g. after a rejected/re-used sequence).
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = `${prefix}${String(seq).padStart(3, "0")}`;
    const clash = await prisma.applicationPostGraduate.findUnique({
      where: { registrationNumber: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
    seq += 1;
  }

  // Extremely unlikely fallback: timestamp-suffixed number.
  return `${prefix}${Date.now().toString().slice(-6)}`;
}
