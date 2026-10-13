import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Checklist } from "./checklist";
import {
  RegistrationWizard,
  type FacultyNode,
  type SupervisorOption,
} from "./wizard";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const [rawFaculties, supervisors] = await Promise.all([
    prisma.faculty.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        // Degrees hang directly off the faculty now (departments were removed).
        degrees: {
          orderBy: { name: "asc" },
          select: { id: true, name: true, level: true, type: true, studyModes: true },
        },
        // Legacy degrees that still only carry a department link.
        departments: {
          select: {
            degrees: {
              orderBy: { name: "asc" },
              select: { id: true, name: true, level: true, type: true, studyModes: true },
            },
          },
        },
      },
    }),
    prisma.supervisorProfile.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, title: true, university: true, facultyId: true },
    }),
  ]);

  const faculties: FacultyNode[] = rawFaculties.map((f) => {
    const legacy = f.departments.flatMap((d) => d.degrees);
    const byId = new Map<number, FacultyNode["degrees"][number]>();
    for (const d of [...f.degrees, ...legacy]) byId.set(d.id, d);
    return {
      id: f.id,
      name: f.name,
      degrees: [...byId.values()].sort((a, b) => a.name.localeCompare(b.name)),
    };
  });

  const supervisorOptions: SupervisorOption[] = supervisors.map((s) => ({
    id: s.id,
    name: s.name,
    title: s.title,
    university: s.university,
    facultyId: s.facultyId,
  }));

  return (
    <main className="min-h-screen bg-muted">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-brand">
              <span className="text-sm font-bold">WU</span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-black">Postgraduate Registration</p>
              <p className="text-xs text-neutral-500">University of Wayamba</p>
            </div>
          </div>
          <Link href="/login" className="text-sm font-semibold text-black underline underline-offset-4">
            Sign in
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <Checklist />
        {faculties.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center text-sm text-neutral-500">
            Registration is not open yet — no programmes have been published.
            Please check back later.
          </div>
        ) : (
          <RegistrationWizard
            faculties={faculties}
            supervisorOptions={supervisorOptions}
          />
        )}
      </div>
    </main>
  );
}
