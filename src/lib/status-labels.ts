/**
 * Display labels / badge styles for the verification and escalation statuses.
 * Kept in a plain (non-client) module so both Server and Client Components can
 * import the values.
 */

export const VERIFICATION_LABEL: Record<string, string> = {
  NOT_VERIFIED: "Not verified",
  UNDER_REVIEW: "Under review",
  VERIFIED: "Verified",
  CORRECTION_REQUESTED: "Correction requested",
};

export const VERIFICATION_STYLE: Record<string, string> = {
  NOT_VERIFIED: "bg-neutral-100 text-neutral-600",
  UNDER_REVIEW: "bg-sky-100 text-sky-700",
  VERIFIED: "bg-emerald-100 text-emerald-700",
  CORRECTION_REQUESTED: "bg-amber-100 text-amber-800",
};

export const ESCALATION_LABEL: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  RETURNED: "Returned",
};

export const ESCALATION_STYLE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  RETURNED: "bg-rose-100 text-rose-700",
};

export const FUNDING_LABEL: Record<string, string> = {
  SELF_FUNDED: "Self funded",
  EMPLOYER_SPONSORED: "Employer sponsored",
  UNIVERSITY_GRANT: "University grant",
  EXTERNAL_SCHOLARSHIP: "External scholarship",
  OTHER: "Other",
};

export const STUDY_MODE_LABEL: Record<string, string> = {
  FULL_TIME: "Full time",
  PART_TIME: "Part time",
};

/** Portal role, as shown to people ("raised by …"). */
export const ROLE_LABEL: Record<string, string> = {
  STUDENT: "Student",
  SUPERVISOR: "Supervisor",
  MAIN_ADMIN: "Main Admin",
  FACULTY_ADMIN: "Faculty Admin",
  REGISTRAR: "Registrar",
};
