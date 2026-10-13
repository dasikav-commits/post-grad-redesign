import { requireRole } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { StructureManager, type FacultyNode } from "./structure-manager";

export const dynamic = "force-dynamic";

export default async function StructurePage() {
  await requireRole("MAIN_ADMIN");

  // Degrees are attached to a faculty directly. Legacy rows that only carry a
  // department are grouped under that department's faculty so nothing
  // disappears from the manager.
  const [faculties, degrees] = await Promise.all([
    prisma.faculty.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.degreeSought.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        level: true,
        type: true,
        studyModes: true,
        facultyId: true,
        departmentRef: { select: { facultyId: true } },
      },
    }),
  ]);

  const byFaculty = new Map<number, FacultyNode["degrees"]>();
  for (const d of degrees) {
    const facultyId = d.facultyId ?? d.departmentRef?.facultyId ?? null;
    if (facultyId == null) continue;
    const list = byFaculty.get(facultyId) ?? [];
    list.push({
      id: d.id,
      name: d.name,
      level: d.level,
      type: d.type,
      studyModes: d.studyModes,
    });
    byFaculty.set(facultyId, list);
  }

  const data: FacultyNode[] = faculties.map((f) => ({
    id: f.id,
    name: f.name,
    degrees: byFaculty.get(f.id) ?? [],
  }));

  return (
    <>
      <PageHeader
        title="Faculties & Degrees"
        subtitle="Manage the faculty → degree structure used in student registration."
      />
      <StructureManager faculties={data} />
    </>
  );
}
