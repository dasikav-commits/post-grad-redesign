import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Public: faculty → degree tree for the registration dropdowns.
 *
 * Departments are no longer part of the structure, so degrees hang directly off
 * a faculty. Legacy degrees that only have a department link are still returned
 * under that department's faculty.
 */
export async function GET() {
  const faculties = await prisma.faculty.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      degrees: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, level: true, type: true, studyModes: true },
      },
      departments: {
        select: {
          degrees: {
            orderBy: { name: "asc" },
            select: { id: true, name: true, level: true, type: true, studyModes: true },
          },
        },
      },
    },
  });

  const merged = faculties.map((f) => {
    const legacy = f.departments.flatMap((d) => d.degrees);
    const byId = new Map<number, (typeof legacy)[number]>();
    for (const d of [...f.degrees, ...legacy]) byId.set(d.id, d);
    return {
      id: f.id,
      name: f.name,
      degrees: [...byId.values()].sort((a, b) => a.name.localeCompare(b.name)),
    };
  });

  return NextResponse.json({ faculties: merged });
}
