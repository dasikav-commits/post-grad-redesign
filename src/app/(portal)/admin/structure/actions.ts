"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type DegreeLevel, type StudyMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/guard";

export type ActionResult = { ok: true } | { ok: false; error: string };

const LEVELS: DegreeLevel[] = ["MPHIL", "PHD", "OTHER"];

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

// ---- Faculty -------------------------------------------------------------

export async function createFaculty(form: FormData): Promise<ActionResult> {
  await requireRole("MAIN_ADMIN");
  const name = str(form, "name");
  if (!name) return { ok: false, error: "Faculty name is required." };
  try {
    await prisma.faculty.create({ data: { name } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "A faculty with that name already exists." };
    }
    return { ok: false, error: "Could not create faculty." };
  }
  revalidatePath("/admin/structure");
  return { ok: true };
}

export async function renameFaculty(form: FormData): Promise<ActionResult> {
  await requireRole("MAIN_ADMIN");
  const id = Number(form.get("id"));
  const name = str(form, "name");
  if (!id || !name) return { ok: false, error: "Faculty name is required." };
  try {
    await prisma.faculty.update({ where: { id }, data: { name } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "A faculty with that name already exists." };
    }
    return { ok: false, error: "Could not rename faculty." };
  }
  revalidatePath("/admin/structure");
  return { ok: true };
}

export async function deleteFaculty(form: FormData): Promise<ActionResult> {
  await requireRole("MAIN_ADMIN");
  const id = Number(form.get("id"));
  if (!id) return { ok: false, error: "Invalid faculty." };

  const degreeCount = await prisma.degreeSought.count({
    where: { OR: [{ facultyId: id }, { departmentRef: { facultyId: id } }] },
  });
  if (degreeCount > 0) {
    return {
      ok: false,
      error: "Remove its degrees first before deleting this faculty.",
    };
  }

  try {
    await prisma.faculty.delete({ where: { id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return {
        ok: false,
        error: "Remove its degrees first before deleting this faculty.",
      };
    }
    return { ok: false, error: "Could not delete faculty." };
  }
  revalidatePath("/admin/structure");
  return { ok: true };
}

// ---- Degree --------------------------------------------------------------
//
// Degrees belong to a faculty. The department layer is no longer part of the
// structure manager (or of registration), so it is not required here.

export async function createDegree(form: FormData): Promise<ActionResult> {
  await requireRole("MAIN_ADMIN");
  const facultyId = Number(form.get("facultyId"));
  const name = str(form, "name");
  const type = str(form, "type") || null;
  const levelRaw = str(form, "level");
  const level = (LEVELS.includes(levelRaw as DegreeLevel)
    ? levelRaw
    : "OTHER") as DegreeLevel;
  if (!facultyId || !name) return { ok: false, error: "Degree name is required." };

  const studyModes: StudyMode[] = [];
  if (form.get("fullTime")) studyModes.push("FULL_TIME");
  if (form.get("partTime")) studyModes.push("PART_TIME");
  if (studyModes.length === 0)
    return { ok: false, error: "Select at least one study mode (Full time / Part time)." };

  const faculty = await prisma.faculty.findUnique({ where: { id: facultyId } });
  if (!faculty) return { ok: false, error: "Faculty not found." };

  try {
    await prisma.degreeSought.create({
      data: {
        name,
        type,
        level,
        studyModes,
        facultyId,
        faculty: faculty.name,
      },
    });
  } catch {
    return { ok: false, error: "Could not create degree." };
  }
  revalidatePath("/admin/structure");
  revalidatePath("/register");
  return { ok: true };
}

export async function deleteDegree(form: FormData): Promise<ActionResult> {
  await requireRole("MAIN_ADMIN");
  const id = Number(form.get("id"));
  if (!id) return { ok: false, error: "Invalid degree." };
  try {
    await prisma.degreeSought.delete({ where: { id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return {
        ok: false,
        error: "This degree is referenced by a proposal and cannot be deleted.",
      };
    }
    return { ok: false, error: "Could not delete degree." };
  }
  revalidatePath("/admin/structure");
  return { ok: true };
}
