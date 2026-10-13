import "server-only";

import { prisma } from "./prisma";
import { factsFromApplication, requirementSummary } from "./requirements";

export type ApplicationSummary = {
  requirementsMet: number;
  requirementsTotal: number;
  complete: boolean;
  openCorrections: number;
};

/**
 * Requirement-completeness + open-correction counts for a batch of
 * applications, so the list screens can show "9/13" without loading every
 * document of every application one by one.
 */
export async function getApplicationSummaries(
  applicationIds: number[],
): Promise<Map<number, ApplicationSummary>> {
  const result = new Map<number, ApplicationSummary>();
  if (applicationIds.length === 0) return result;

  const [apps, docs, openCorrections] = await Promise.all([
    prisma.applicationPostGraduate.findMany({
      where: { id: { in: applicationIds } },
      select: {
        id: true,
        academicQualifications: { select: { id: true, files: { select: { id: true } } } },
        professionalQualifications: { select: { id: true, files: { select: { id: true } } } },
        researchProposals: {
          take: 1,
          orderBy: { id: "desc" },
          select: {
            files: { select: { id: true } },
            supervisors: { select: { cvDocument: true, consentDocument: true } },
          },
        },
      },
    }),
    prisma.uploadedFile.findMany({
      where: { applicationId: { in: applicationIds } },
      select: { applicationId: true, category: true },
    }),
    prisma.correctionRequest.findMany({
      where: { applicationId: { in: applicationIds }, status: "OPEN" },
      select: { applicationId: true },
    }),
  ]);

  // Group document categories per application.
  const docsByApp = new Map<number, { category: string | null }[]>();
  for (const d of docs) {
    const list = docsByApp.get(d.applicationId) ?? [];
    list.push({ category: d.category });
    docsByApp.set(d.applicationId, list);
  }

  for (const app of apps) {
    const proposal = app.researchProposals[0];
    const facts = factsFromApplication({
      uploadedFiles: docsByApp.get(app.id) ?? [],
      academicQualifications: app.academicQualifications,
      professionalQualifications: app.professionalQualifications,
      researchProposals: proposal ? [proposal] : [],
    });
    const summary = requirementSummary(facts);
    result.set(app.id, {
      requirementsMet: summary.met,
      requirementsTotal: summary.total,
      complete: summary.complete,
      openCorrections: 0,
    });
  }

  for (const c of openCorrections) {
    const entry = result.get(c.applicationId);
    if (entry) entry.openCorrections += 1;
  }

  return result;
}
