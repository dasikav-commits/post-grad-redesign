import "server-only";

import { prisma } from "./prisma";
import {
  factsFromApplication,
  evaluateRequirements,
  requirementSummary,
  type RequirementFacts,
  type RequirementState,
} from "./requirements";

/**
 * Everything a reviewer (Main Admin, Faculty Admin or Registrar) needs to
 * verify one application: the submitted data, the documents, the requirements
 * checklist, the verification history and any open corrections.
 *
 * One loader keeps the three review screens consistent.
 */

export type ReviewFile = {
  id: number;
  fileName: string;
  filePath: string;
  category: string | null;
};

export type ReviewPacket = {
  id: number;
  fullName: string;
  nameWithInitials: string;
  nic: string;
  dateOfBirth: Date;
  maritalStatus: string | null;
  englishProficiency: string | null;
  residentialAddress: string | null;
  officialAddress: string | null;
  faculty: string | null;
  department: string | null;
  degreeProgram: string | null;
  studyMode: string | null;
  durationYears: number | null;
  programStartYear: number | null;
  registrationDate: Date;
  registrationNumber: string | null;
  status: string;
  verificationStatus: string;
  verifiedAt: Date | null;
  fundingMethod: string | null;
  fundingDetails: string | null;
  studentUserId: number | null;
  studentUserCode: string | null;
  emails: string[];
  contacts: { type: string; value: string }[];
  documents: ReviewFile[];
  academicQualifications: {
    id: number;
    university: string;
    degreeName: string | null;
    degreeClass: string | null;
    gpa: string | null;
    creditCount: string | null;
    files: ReviewFile[];
  }[];
  professionalQualifications: {
    id: number;
    institution: string;
    fieldOfStudy: string | null;
    files: ReviewFile[];
  }[];
  workExperiences: {
    id: number;
    organization: string;
    positionHeld: string | null;
    files: ReviewFile[];
  }[];
  proposal: {
    id: number;
    title: string;
    description: string | null;
    files: ReviewFile[];
    supervisors: {
      id: number;
      name: string;
      title: string | null;
      university: string | null;
      email: string | null;
      isMain: boolean;
      cvDocument: string | null;
      consentDocument: string | null;
    }[];
  } | null;
  requirements: RequirementState[];
  requirementSummary: { met: number; total: number; complete: boolean };
  facts: RequirementFacts;
  verifications: {
    id: number;
    status: string;
    notes: string | null;
    reviewerName: string | null;
    reviewerRole: string | null;
    createdAt: Date;
  }[];
  corrections: {
    id: number;
    items: string[];
    message: string | null;
    status: string;
    emailSent: boolean;
    raisedByName: string | null;
    raisedByRole: string | null;
    createdAt: Date;
    studentResponse: string | null;
    respondedAt: Date | null;
    resolvedAt: Date | null;
  }[];
  openCorrectionCount: number;
};

function toFiles(rows: { id: number; fileName: string; filePath: string }[]): ReviewFile[] {
  return rows.map((f) => ({ id: f.id, fileName: f.fileName, filePath: f.filePath, category: null }));
}

export async function getApplicationReviewPacket(
  applicationId: number,
): Promise<ReviewPacket | null> {
  const app = await prisma.applicationPostGraduate.findUnique({
    where: { id: applicationId },
    include: {
      user: { select: { id: true, userCode: true } },
      emails: true,
      contacts: true,
      academicQualifications: { include: { files: true } },
      professionalQualifications: { include: { files: true } },
      workExperiences: { include: { files: true } },
      researchProposals: {
        orderBy: { id: "desc" },
        take: 1,
        include: {
          files: true,
          supervisors: {
            orderBy: { isMain: "desc" },
            include: { supervisor: { include: { user: { select: { email: true } } } } },
          },
        },
      },
      verifications: {
        orderBy: { createdAt: "desc" },
        include: { reviewer: { select: { fullName: true } } },
      },
      corrections: {
        orderBy: { createdAt: "desc" },
        include: { raisedBy: { select: { fullName: true } } },
      },
    },
  });
  if (!app) return null;

  const documents = await prisma.uploadedFile.findMany({
    where: { applicationId },
    orderBy: { id: "asc" },
  });

  const proposal = app.researchProposals[0] ?? null;

  const facts = factsFromApplication({
    uploadedFiles: documents,
    academicQualifications: app.academicQualifications,
    professionalQualifications: app.professionalQualifications,
    researchProposals: proposal ? [proposal] : [],
  });

  return {
    id: app.id,
    fullName: app.fullName,
    nameWithInitials: app.nameWithInitials,
    nic: app.nic,
    dateOfBirth: app.dateOfBirth,
    maritalStatus: app.maritalStatus,
    englishProficiency: app.englishProficiency,
    residentialAddress: app.residentialAddress,
    officialAddress: app.officialAddress,
    faculty: app.faculty,
    department: app.department,
    degreeProgram: app.degreeProgram,
    studyMode: app.studyMode,
    durationYears: app.durationYears,
    programStartYear: app.programStartYear,
    registrationDate: app.registrationDate,
    registrationNumber: app.registrationNumber,
    status: app.status,
    verificationStatus: app.verificationStatus,
    verifiedAt: app.verifiedAt,
    fundingMethod: app.fundingMethod,
    fundingDetails: app.fundingDetails,
    studentUserId: app.user?.id ?? null,
    studentUserCode: app.user?.userCode ?? null,
    emails: app.emails.map((e: { email: string }) => e.email),
    contacts: app.contacts.map((c: { contactType: string; contactValue: string }) => ({
      type: c.contactType,
      value: c.contactValue,
    })),
    documents: documents.map((d: { id: number; fileName: string; filePath: string; category: string | null }) => ({
      id: d.id,
      fileName: d.fileName,
      filePath: d.filePath,
      category: d.category,
    })),
    academicQualifications: app.academicQualifications.map(
      (a: {
        id: number;
        university: string;
        degreeName: string | null;
        degreeClass: string | null;
        gpa: string | null;
        creditCount: string | null;
        files: { id: number; fileName: string; filePath: string }[];
      }) => ({
        id: a.id,
        university: a.university,
        degreeName: a.degreeName,
        degreeClass: a.degreeClass,
        gpa: a.gpa,
        creditCount: a.creditCount,
        files: toFiles(a.files),
      }),
    ),
    professionalQualifications: app.professionalQualifications.map(
      (p: {
        id: number;
        institution: string;
        fieldOfStudy: string | null;
        files: { id: number; fileName: string; filePath: string }[];
      }) => ({
        id: p.id,
        institution: p.institution,
        fieldOfStudy: p.fieldOfStudy,
        files: toFiles(p.files),
      }),
    ),
    workExperiences: app.workExperiences.map(
      (w: {
        id: number;
        organization: string;
        positionHeld: string | null;
        files: { id: number; fileName: string; filePath: string }[];
      }) => ({
        id: w.id,
        organization: w.organization,
        positionHeld: w.positionHeld,
        files: toFiles(w.files),
      }),
    ),
    proposal: proposal
      ? {
          id: proposal.id,
          title: proposal.title,
          description: proposal.description,
          files: toFiles(proposal.files),
          supervisors: proposal.supervisors.map(
            (s: {
              id: number;
              isMain: boolean;
              cvDocument: string | null;
              consentDocument: string | null;
              supervisor: {
                name: string;
                title: string | null;
                university: string | null;
                user: { email: string } | null;
              };
            }) => ({
              id: s.id,
              name: s.supervisor.name,
              title: s.supervisor.title,
              university: s.supervisor.university,
              email: s.supervisor.user?.email ?? null,
              isMain: s.isMain,
              cvDocument: s.cvDocument,
              consentDocument: s.consentDocument,
            }),
          ),
        }
      : null,
    requirements: evaluateRequirements(facts),
    requirementSummary: requirementSummary(facts),
    facts,
    verifications: app.verifications.map(
      (v: {
        id: number;
        status: string;
        notes: string | null;
        createdAt: Date;
        reviewerRole: string | null;
        reviewer: { fullName: string } | null;
      }) => ({
        id: v.id,
        status: v.status,
        notes: v.notes,
        reviewerName: v.reviewer?.fullName ?? null,
        reviewerRole: v.reviewerRole,
        createdAt: v.createdAt,
      }),
    ),
    corrections: app.corrections.map(
      (c: {
        id: number;
        items: string;
        message: string | null;
        status: string;
        emailSent: boolean;
        createdAt: Date;
        studentResponse: string | null;
        respondedAt: Date | null;
        resolvedAt: Date | null;
        raisedByRole: string | null;
        raisedBy: { fullName: string } | null;
      }) => ({
        id: c.id,
        items: c.items
          .split("\n")
          .map((i: string) => i.trim())
          .filter(Boolean),
        message: c.message,
        status: c.status,
        emailSent: c.emailSent,
        raisedByName: c.raisedBy?.fullName ?? null,
        raisedByRole: c.raisedByRole,
        createdAt: c.createdAt,
        studentResponse: c.studentResponse,
        respondedAt: c.respondedAt,
        resolvedAt: c.resolvedAt,
      }),
    ),
    openCorrectionCount: app.corrections.filter(
      (c: { status: string }) => c.status === "OPEN",
    ).length,
  };
}

/** The email address to reach an applicant on (account email, else form email). */
export function applicantEmail(packet: Pick<ReviewPacket, "emails">): string | null {
  return packet.emails[0] ?? null;
}
