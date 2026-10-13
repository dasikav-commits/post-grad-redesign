"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/guard";
import { hashPassword } from "@/lib/auth";
import { nextUserCode } from "@/lib/user-code";
import { notifySupervisor, roleSenderName } from "@/lib/notify";
import { sendSupervisorApprovalEmail } from "@/lib/email";

export type ActionResult =
  | { ok: true; tempPassword?: string; email?: string }
  | { ok: false; error: string };

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function generateTempPassword(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `WU-${hex}!`;
}

export async function createSupervisor(form: FormData): Promise<ActionResult> {
  await requireRole("MAIN_ADMIN");
  const name = str(form, "name");
  if (!name) return { ok: false, error: "Supervisor name is required." };

  const email = str(form, "email").toLowerCase();
  if (!email) return { ok: false, error: "Supervisor email is required." };

  // A supervisor already in the list (e.g. proposed by a student during
  // registration) may not have a portal account yet — link one instead of
  // creating a second profile for the same person.
  const existingUser = await prisma.portalUser.findUnique({
    where: { email },
    select: {
      id: true,
      role: true,
      supervisor: { select: { id: true, name: true } },
    },
  });
  if (existingUser?.supervisor) {
    return {
      ok: false,
      error: `${existingUser.supervisor.name} is already in the supervisor list.`,
    };
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  try {
    await prisma.$transaction(async (tx) => {
      const profile = await tx.supervisorProfile.create({
        data: {
          name,
          title: str(form, "title") || null,
          university: str(form, "university") || null,
          telephone: str(form, "telephone") || null,
          facultyId: Number(form.get("facultyId")) || null,
          // Portal access is gated: the Main Admin approves it below.
          approvalStatus: "PENDING",
        },
      });

      let userId = existingUser?.id ?? null;
      if (!userId) {
        const userCode = await nextUserCode(tx, "SUPERVISOR");
        const user = await tx.portalUser.create({
          data: {
            userCode,
            fullName: name,
            email,
            passwordHash,
            role: "SUPERVISOR",
            mustChangePassword: true,
            initialPassword: tempPassword,
          },
        });
        userId = user.id;
      } else if (existingUser && existingUser.role !== "SUPERVISOR") {
        await tx.portalUser.update({
          where: { id: existingUser.id },
          data: { role: "SUPERVISOR" },
        });
      }

      await tx.supervisorProfile.update({
        where: { id: profile.id },
        data: { userId },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "A user with that email already exists." };
    }
    return { ok: false, error: "Could not create supervisor account." };
  }

  revalidatePath("/admin/supervisors");
  return { ok: true, email, tempPassword: existingUser ? undefined : tempPassword };
}

/**
 * Give a supervisor who is already in the list (but has no login) a portal
 * account. Access still has to be approved before they can use the portal.
 */
export async function createSupervisorLogin(form: FormData): Promise<ActionResult> {
  await requireRole("MAIN_ADMIN");
  const id = Number(form.get("id"));
  const email = str(form, "email").toLowerCase();
  if (!id) return { ok: false, error: "Supervisor is required." };
  if (!email) return { ok: false, error: "An email address is required." };

  const profile = await prisma.supervisorProfile.findUnique({
    where: { id },
    select: { id: true, name: true, userId: true },
  });
  if (!profile) return { ok: false, error: "Supervisor not found." };
  if (profile.userId) {
    return { ok: false, error: "This supervisor already has a login." };
  }

  const clash = await prisma.portalUser.findUnique({
    where: { email },
    select: { id: true, supervisor: { select: { id: true } } },
  });
  if (clash?.supervisor) {
    return { ok: false, error: "That email is already linked to another supervisor." };
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  try {
    await prisma.$transaction(async (tx) => {
      let userId = clash?.id ?? null;
      if (!userId) {
        const userCode = await nextUserCode(tx, "SUPERVISOR");
        const user = await tx.portalUser.create({
          data: {
            userCode,
            fullName: profile.name,
            email,
            passwordHash,
            role: "SUPERVISOR",
            mustChangePassword: true,
            initialPassword: tempPassword,
          },
        });
        userId = user.id;
      }
      await tx.supervisorProfile.update({
        where: { id },
        data: { userId, approvalStatus: "PENDING" },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "A user with that email already exists." };
    }
    return { ok: false, error: "Could not create the supervisor login." };
  }

  revalidatePath("/admin/supervisors");
  return { ok: true, email, tempPassword };
}

export async function updateSupervisor(form: FormData): Promise<ActionResult> {
  await requireRole("MAIN_ADMIN");
  const id = Number(form.get("id"));
  const name = str(form, "name");
  if (!id || !name) return { ok: false, error: "Supervisor name is required." };

  await prisma.supervisorProfile.update({
    where: { id },
    data: {
      name,
      title: str(form, "title") || null,
      university: str(form, "university") || null,
      telephone: str(form, "telephone") || null,
      facultyId: Number(form.get("facultyId")) || null,
    },
  });
  revalidatePath("/admin/supervisors");
  return { ok: true };
}

export async function deleteSupervisor(form: FormData): Promise<ActionResult> {
  await requireRole("MAIN_ADMIN");
  const id = Number(form.get("id"));
  if (!id) return { ok: false, error: "Invalid supervisor." };

  try {
    await prisma.supervisorProfile.delete({ where: { id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return {
        ok: false,
        error: "This supervisor is used in an application and cannot be deleted.",
      };
    }
    return { ok: false, error: "Could not delete supervisor." };
  }
  revalidatePath("/admin/supervisors");
  return { ok: true };
}

// ---- Portal access approval ---------------------------------------------
//
// A supervisor account created here is locked until the Main Admin approves it.
// Approval (or rejection) is recorded on the profile and the supervisor is told
// in the portal and by email.

export type ApprovalResult = { ok: true } | { ok: false; error: string };

export async function setSupervisorApproval(
  form: FormData,
): Promise<ApprovalResult> {
  const session = await requireRole("MAIN_ADMIN");
  const id = Number(form.get("id"));
  const decision = String(form.get("decision") ?? "");
  const note = str(form, "note") || null;

  if (!id || !["APPROVE", "REJECT"].includes(decision)) {
    return { ok: false, error: "Invalid approval request." };
  }

  const supervisor = await prisma.supervisorProfile.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      userId: true,
      user: { select: { id: true, email: true, fullName: true } },
    },
  });
  if (!supervisor) return { ok: false, error: "Supervisor not found." };

  const approved = decision === "APPROVE";

  await prisma.supervisorProfile.update({
    where: { id },
    data: {
      approvalStatus: approved ? "APPROVED" : "REJECTED",
      approvalNote: note,
      approvedAt: approved ? new Date() : null,
      approvedById: approved ? session.userId : null,
    },
  });

  if (supervisor.user) {
    await notifySupervisor(supervisor.id, {
      title: approved
        ? "Supervisor portal access approved"
        : "Supervisor portal access not approved",
      message: approved
        ? "The Main Admin approved your account. You can now use the Supervisor portal."
        : `The Main Admin did not approve your account.${note ? ` Note: ${note}` : ""}`,
      category: "verification",
      senderName: roleSenderName(session.role, session.fullName),
      link: "/supervisor",
    });

    await sendSupervisorApprovalEmail({
      to: supervisor.user.email,
      name: supervisor.user.fullName || supervisor.name,
      approved,
      note,
    });
  }

  revalidatePath("/admin/supervisors");
  return { ok: true };
}
