/**
 * The postgraduate registration requirements checklist.
 *
 * One single definition is shared by:
 *   - the registration wizard (blocks submission until everything is met),
 *   - the student portal ("Requirements" page, so a student can see and fix
 *     anything still missing after they have an account),
 *   - the reviewer screens (Registrar / Faculty Admin / Main Admin) so the
 *     person verifying an application sees the same checklist the student did.
 *
 * Everything is reduced to a plain count of what has been supplied, so the same
 * evaluator works with a Prisma result on the server and with the wizard's
 * in-memory form on the client.
 */

/** Uploaded-document categories stored in `uploaded_file.category`. */
export const DOC_CATEGORY = {
  applicationForm: "APPLICATION_FORM",
  cv: "CV",
  birthCertificate: "BIRTH_CERTIFICATE",
  transcript: "TRANSCRIPT",
  refereeReport: "REFEREE_REPORT",
  budget: "BUDGET",
  photo: "PHOTO",
  paymentReceipt: "PAYMENT_RECEIPT",
} as const;

export type DocCategory = (typeof DOC_CATEGORY)[keyof typeof DOC_CATEGORY];

/** Upload folder (Supabase prefix) matching each document category. */
export const DOC_FOLDER: Record<DocCategory, string> = {
  APPLICATION_FORM: "application-form",
  CV: "cv",
  BIRTH_CERTIFICATE: "birth-certificate",
  TRANSCRIPT: "transcript",
  REFEREE_REPORT: "referee",
  BUDGET: "budget",
  PHOTO: "photo",
  PAYMENT_RECEIPT: "payment-receipt",
};

export type RequirementKey =
  | "applicationForm"
  | "cv"
  | "birthCertificate"
  | "educationalCertificates"
  | "professionalQualifications"
  | "transcripts"
  | "researchProposal"
  | "supervisors"
  | "supervisorCvs"
  | "refereeReports"
  | "budget"
  | "photo"
  | "paymentReceipts";

/**
 * How many of each thing the applicant supplied. Counts (not booleans) so the
 * UI can say "2 of 2 referee reports".
 */
export type RequirementFacts = {
  applicationForm: number;
  cv: number;
  birthCertificate: number;
  educationalCertificates: number;
  professionalQualifications: number;
  transcripts: number;
  researchProposal: number;
  supervisors: number;
  /** Supervisors that have a CV attached. */
  supervisorCvs: number;
  /** Supervisors that have a willingness-to-supervise letter attached. */
  supervisorConsents: number;
  refereeReports: number;
  budget: number;
  photo: number;
  paymentReceipts: number;
};

export const emptyFacts: RequirementFacts = {
  applicationForm: 0,
  cv: 0,
  birthCertificate: 0,
  educationalCertificates: 0,
  professionalQualifications: 0,
  transcripts: 0,
  researchProposal: 0,
  supervisors: 0,
  supervisorCvs: 0,
  supervisorConsents: 0,
  refereeReports: 0,
  budget: 0,
  photo: 0,
  paymentReceipts: 0,
};

type RequirementDef = {
  key: RequirementKey;
  n: number;
  label: string;
  /** What the applicant has to hand in. */
  expects: string;
  /** Minimum number of items that satisfies the requirement. */
  min: number;
  /** Facts field the count is read from. */
  count: (f: RequirementFacts) => number;
  /** Optional extra check (e.g. every supervisor needs a CV). */
  detail?: (f: RequirementFacts) => string | null;
};

export const REQUIREMENTS: RequirementDef[] = [
  {
    key: "applicationForm",
    n: 1,
    label: "Completed Application Form (signed)",
    expects: "Signed application form — scanned copy",
    min: 1,
    count: (f) => f.applicationForm,
  },
  {
    key: "cv",
    n: 2,
    label: "Curriculum Vitae (CV)",
    expects: "Your complete CV",
    min: 1,
    count: (f) => f.cv,
  },
  {
    key: "birthCertificate",
    n: 3,
    label: "Birth Certificate",
    expects: "Certified copy",
    min: 1,
    count: (f) => f.birthCertificate,
  },
  {
    key: "educationalCertificates",
    n: 4,
    label: "Educational Certificates",
    expects: "Certified copy attached to every academic qualification",
    min: 1,
    count: (f) => f.educationalCertificates,
    detail: (f) =>
      f.educationalCertificates === 0
        ? "Add at least one academic qualification with its certificate"
        : null,
  },
  {
    key: "professionalQualifications",
    n: 5,
    label: "Professional Qualifications",
    expects: "Certified copy of each professional certificate",
    min: 1,
    count: (f) => f.professionalQualifications,
  },
  {
    key: "transcripts",
    n: 6,
    label: "Academic Transcripts",
    expects: "Complete transcripts",
    min: 1,
    count: (f) => f.transcripts,
  },
  {
    key: "researchProposal",
    n: 7,
    label: "Research Proposal",
    expects: "Signed research proposal (PDF)",
    min: 1,
    count: (f) => f.researchProposal,
  },
  {
    key: "supervisors",
    n: 8,
    label: "Proposed Supervisors",
    expects: "1 – 5 supervisors, exactly one marked as main",
    min: 1,
    count: (f) => f.supervisors,
  },
  {
    key: "supervisorCvs",
    n: 9,
    label: "Supervisors' CVs",
    expects: "CV + willingness-to-supervise letter for every supervisor",
    min: 1,
    count: (f) => Math.min(f.supervisorCvs, f.supervisorConsents),
    detail: (f) =>
      f.supervisors > 0 && f.supervisorCvs < f.supervisors
        ? `${f.supervisors - f.supervisorCvs} supervisor CV(s) missing`
        : f.supervisors > 0 && f.supervisorConsents < f.supervisors
          ? `${f.supervisors - f.supervisorConsents} willingness letter(s) missing`
          : null,
  },
  {
    key: "refereeReports",
    n: 10,
    label: "Referee Reports",
    expects: "Two (02) referee reports",
    min: 2,
    count: (f) => f.refereeReports,
  },
  {
    key: "budget",
    n: 11,
    label: "Proposed Budget / Funding Evidence",
    expects: "Budget plus evidence of funding or financial support",
    min: 1,
    count: (f) => f.budget,
  },
  {
    key: "photo",
    n: 12,
    label: "Passport-size Photograph",
    expects: "Colour passport-size photograph",
    min: 1,
    count: (f) => f.photo,
  },
  {
    key: "paymentReceipts",
    n: 13,
    label: "Payment Receipts",
    expects: "Receipts of relevant payments incl. the application lodging fee",
    min: 1,
    count: (f) => f.paymentReceipts,
  },
];

export type RequirementState = {
  key: RequirementKey;
  n: number;
  label: string;
  expects: string;
  min: number;
  have: number;
  met: boolean;
  /** Human readable "what is still needed", or null when satisfied. */
  detail: string | null;
};

export function evaluateRequirements(
  facts: RequirementFacts,
): RequirementState[] {
  return REQUIREMENTS.map((r) => {
    const have = r.count(facts);
    const met = have >= r.min;
    return {
      key: r.key,
      n: r.n,
      label: r.label,
      expects: r.expects,
      min: r.min,
      have,
      met,
      detail: met ? null : (r.detail?.(facts) ?? `${r.min - have} more required`),
    };
  });
}

export function missingRequirements(
  facts: RequirementFacts,
): RequirementState[] {
  return evaluateRequirements(facts).filter((r) => !r.met);
}

export function requirementsComplete(facts: RequirementFacts): boolean {
  return missingRequirements(facts).length === 0;
}

/** "9 of 13 requirements met" style summary. */
export function requirementSummary(facts: RequirementFacts): {
  met: number;
  total: number;
  complete: boolean;
} {
  const states = evaluateRequirements(facts);
  const met = states.filter((s) => s.met).length;
  return { met, total: states.length, complete: met === states.length };
}

/**
 * Build the facts from an application loaded with its documents,
 * qualifications and proposals. Accepts the loose shape Prisma returns so it
 * can be used with whichever `select`/`include` a page already has.
 */
export function factsFromApplication(app: {
  uploadedFiles?: { category: string | null }[];
  academicQualifications?: { files?: unknown[] }[];
  professionalQualifications?: { files?: unknown[] }[];
  researchProposals?: {
    files?: unknown[];
    supervisors?: { cvDocument?: string | null; consentDocument?: string | null }[];
  }[];
}): RequirementFacts {
  const docs = app.uploadedFiles ?? [];
  const byCategory = (c: string) =>
    docs.filter((d) => (d.category ?? "").toUpperCase() === c).length;

  const proposal = app.researchProposals?.[0];
  const supervisors = proposal?.supervisors ?? [];

  return {
    ...emptyFacts,
    applicationForm: byCategory(DOC_CATEGORY.applicationForm),
    cv: byCategory(DOC_CATEGORY.cv),
    birthCertificate: byCategory(DOC_CATEGORY.birthCertificate),
    transcripts: byCategory(DOC_CATEGORY.transcript),
    refereeReports: byCategory(DOC_CATEGORY.refereeReport),
    budget: byCategory(DOC_CATEGORY.budget),
    photo: byCategory(DOC_CATEGORY.photo),
    paymentReceipts: byCategory(DOC_CATEGORY.paymentReceipt),
    educationalCertificates: (app.academicQualifications ?? []).reduce(
      (sum, q) => sum + (q.files?.length ?? 0),
      0,
    ),
    professionalQualifications: (app.professionalQualifications ?? []).reduce(
      (sum, q) => sum + (q.files?.length ?? 0),
      0,
    ),
    researchProposal: proposal?.files?.length ?? 0,
    supervisors: supervisors.length,
    supervisorCvs: supervisors.filter((s) => s.cvDocument).length,
    supervisorConsents: supervisors.filter((s) => s.consentDocument).length,
  };
}
