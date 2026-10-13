import type { UserRole } from "@prisma/client";

export type NavLink = {
  label: string;
  href: string;
};

export const ROLE_LABELS: Record<UserRole, string> = {
  STUDENT: "Student",
  SUPERVISOR: "Supervisor",
  MAIN_ADMIN: "Main Admin",
  FACULTY_ADMIN: "Faculty Admin",
  REGISTRAR: "Registrar",
};

// Landing route for each role after login.
export const ROLE_HOME: Record<UserRole, string> = {
  STUDENT: "/student",
  SUPERVISOR: "/supervisor",
  MAIN_ADMIN: "/admin",
  FACULTY_ADMIN: "/faculty-admin",
  REGISTRAR: "/registrar",
};

// Sidebar links per role. These are the simple, role-identifiable menus.
export const ROLE_NAV: Record<UserRole, NavLink[]> = {
  STUDENT: [
    { label: "Dashboard", href: "/student" },
    { label: "My Application", href: "/student/application" },
    { label: "Requirements", href: "/student/requirements" },
    { label: "Corrections", href: "/student/corrections" },
    { label: "Research Proposal", href: "/student/proposal" },
    { label: "Progress Reports", href: "/student/progress" },
    { label: "Supervisors", href: "/student/supervisors" },
    { label: "Messages", href: "/student/messages" },
    { label: "Presentations", href: "/student/presentations" },
    { label: "Notifications", href: "/student/notifications" },
  ],
  SUPERVISOR: [
    { label: "Dashboard", href: "/supervisor" },
    { label: "My Students", href: "/supervisor/students" },
    { label: "Progress Review", href: "/supervisor/reviews" },
    { label: "Presentations", href: "/supervisor/presentations" },
    { label: "Messages", href: "/supervisor/messages" },
  ],
  REGISTRAR: [
    { label: "Dashboard", href: "/registrar" },
    { label: "New Registrations", href: "/registrar/registrations" },
    { label: "All Applications", href: "/registrar/applications" },
    { label: "Notify Students", href: "/registrar/notify" },
    { label: "Approved", href: "/registrar/approved" },
    { label: "Student Progress", href: "/registrar/progress" },
    { label: "Pending Presentations", href: "/registrar/presentations" },
    { label: "Completed Presentations", href: "/registrar/presentations/completed" },
    { label: "Rejected", href: "/registrar/rejected" },
  ],
  MAIN_ADMIN: [
    { label: "Dashboard", href: "/admin" },
    { label: "Applications", href: "/admin/applications" },
    { label: "Student Progress", href: "/admin/progress" },
    { label: "Presentations", href: "/admin/presentations" },
    { label: "Faculties & Degrees", href: "/admin/structure" },
    { label: "Supervisors", href: "/admin/supervisors" },
    { label: "Users", href: "/admin/users" },
    { label: "Rejected", href: "/admin/rejected" },
  ],
  FACULTY_ADMIN: [
    { label: "Dashboard", href: "/faculty-admin" },
    { label: "Applications", href: "/faculty-admin/applications" },
    { label: "Student Progress", href: "/faculty-admin/progress" },
    { label: "Rejected", href: "/faculty-admin/rejected" },
  ],
};
