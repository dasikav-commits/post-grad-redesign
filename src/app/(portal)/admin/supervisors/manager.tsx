"use client";

import { useState } from "react";
import {
  createSupervisor,
  createSupervisorLogin,
  updateSupervisor,
  deleteSupervisor,
  setSupervisorApproval,
  type ActionResult,
} from "./actions";
import { useServerAction } from "@/components/use-server-action";

export type FacultyOption = { id: number; name: string };

export type SupervisorRow = {
  id: number;
  name: string;
  title: string | null;
  university: string | null;
  telephone: string | null;
  facultyId: number | null;
  facultyName: string | null;
  hasAccount: boolean;
  email?: string;
  initialPassword?: string | null;
  mustChangePassword?: boolean;
  usageCount: number;
  approvalStatus: string;
  approvalNote: string | null;
  approvedAt: Date | null;
};

const input =
  "w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-black outline-none focus:border-brand focus:ring-1 focus:ring-brand";

const APPROVAL_STYLE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
};
const APPROVAL_LABEL: Record<string, string> = {
  PENDING: "Pending approval",
  APPROVED: "Approved",
  REJECTED: "Not approved",
};

function useAction() {
  const { run: runAction, ...action } = useServerAction();
  function run(
    serverAction: (fd: FormData) => Promise<ActionResult>,
    fd: FormData,
    done?: (res: ActionResult) => void,
  ) {
    runAction({ action: () => serverAction(fd), onSuccess: done });
  }
  return { ...action, run };
}

export function SupervisorManager({
  supervisors,
  faculties,
}: {
  supervisors: SupervisorRow[];
  faculties: FacultyOption[];
}) {
  const pending = supervisors.filter((s) => s.approvalStatus === "PENDING");

  return (
    <div className="space-y-6">
      <AddSupervisor faculties={faculties} />

      {pending.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h3 className="text-base font-bold text-black">
            {pending.length} supervisor{pending.length === 1 ? "" : "s"} awaiting portal
            access approval
          </h3>
          <p className="mt-1 text-sm text-neutral-700">
            A supervisor cannot use the Supervisor portal until you approve their
            account. They are notified here and by email when you decide.
          </p>
        </div>
      )}

      {supervisors.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center text-sm text-neutral-500">
          No supervisors yet. Add them above so students can select them during
          registration.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-white">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="border-b border-border bg-muted text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-semibold">Name</th>
                <th className="px-4 py-2 font-semibold">Faculty</th>
                <th className="px-4 py-2 font-semibold">Title</th>
                <th className="px-4 py-2 font-semibold">University</th>
                <th className="px-4 py-2 font-semibold">Telephone</th>
                <th className="px-4 py-2 font-semibold">Portal access</th>
                <th className="px-4 py-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {supervisors.map((s) => (
                <SupervisorRowItem key={s.id} s={s} faculties={faculties} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FacultySelect({
  faculties,
  defaultValue,
}: {
  faculties: FacultyOption[];
  defaultValue?: number | null;
}) {
  return (
    <select name="facultyId" defaultValue={defaultValue ?? ""} className={input}>
      <option value="">All faculties</option>
      {faculties.map((f) => (
        <option key={f.id} value={f.id}>
          {f.name}
        </option>
      ))}
    </select>
  );
}

function AddSupervisor({ faculties }: { faculties: FacultyOption[] }) {
  const { pending, error, run } = useAction();
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(null);
  return (
    <form
      action={(fd) => run(createSupervisor, fd, (res) => {
        if (res.ok && res.tempPassword && res.email) {
          setCreated({ email: res.email, tempPassword: res.tempPassword });
        } else {
          setCreated(null);
        }
      })}
      className="rounded-lg border border-border bg-white p-4"
    >
      <h3 className="mb-3 text-base font-bold text-black">Add supervisor</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <input name="name" placeholder="Full name *" className={input} required />
        <input name="email" type="email" placeholder="Email *" className={input} required />
        <FacultySelect faculties={faculties} />
        <input name="title" placeholder="Title (e.g. Prof.)" className={input} />
        <input name="university" placeholder="University" className={input} />
        <input name="telephone" placeholder="Telephone" className={input} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          Add supervisor
        </button>
        {error && <p className="text-sm text-black">{error}</p>}
      </div>
      {created && (
        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-black">
          <p className="font-semibold">Account created — pending your approval</p>
          <p>Email: {created.email}</p>
          <p>Temporary password: {created.tempPassword}</p>
          <p className="mt-1 text-xs text-neutral-600">
            The supervisor sees a waiting screen until you approve their portal
            access below.
          </p>
        </div>
      )}
    </form>
  );
}

/**
 * Give a supervisor who is already in the list (proposed by a student, no
 * account yet) a portal login. Access still needs approval afterwards.
 */
function LoginControl({ s }: { s: SupervisorRow }) {
  const { pending, error, run } = useAction();
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(null);

  if (created) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-black">
        <p className="font-semibold">Login created</p>
        <p>{created.email}</p>
        <p>
          Password:{" "}
          <code className="bg-white px-1 font-mono">{created.tempPassword}</code>
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-black hover:border-brand"
      >
        Create login
      </button>
    );
  }

  return (
    <form
      action={(fd) =>
        run(createSupervisorLogin, fd, (res) => {
          if (res.ok && res.email && res.tempPassword) {
            setCreated({ email: res.email, tempPassword: res.tempPassword });
          }
          setOpen(false);
        })
      }
      className="space-y-1.5"
    >
      <input type="hidden" name="id" value={s.id} />
      <input
        name="email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="supervisor@… *"
        className={input}
      />
      <div className="flex gap-1.5">
        <button
          type="submit"
          disabled={pending || !email}
          className="rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
        >
          Create
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-black"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-[11px] text-black">{error}</p>}
    </form>
  );
}

/** Approve / reject a supervisor's portal access. */
function ApprovalControl({ s }: { s: SupervisorRow }) {
  const { run: runAction, pending, error } = useServerAction();
  const [note, setNote] = useState("");
  const [asking, setAsking] = useState<"APPROVE" | "REJECT" | null>(null);

  function decide(decision: "APPROVE" | "REJECT") {
    const fd = new FormData();
    fd.set("id", String(s.id));
    fd.set("decision", decision);
    fd.set("note", note);
    runAction({
      action: () => setSupervisorApproval(fd),
      onSuccess: () => {
        setAsking(null);
        setNote("");
      },
    });
  }

  return (
    <div className="space-y-1.5">
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${APPROVAL_STYLE[s.approvalStatus] ?? "bg-neutral-100 text-neutral-600"}`}
      >
        {APPROVAL_LABEL[s.approvalStatus] ?? s.approvalStatus}
      </span>
      {s.approvedAt && (
        <p className="text-[11px] text-neutral-500">
          {s.approvedAt.toLocaleDateString()}
        </p>
      )}
      {s.approvalNote && (
        <p className="text-[11px] text-neutral-600">{s.approvalNote}</p>
      )}

      {asking ? (
        <div className="space-y-1.5">
          <input
            className={input}
            placeholder={asking === "REJECT" ? "Reason (sent to the supervisor)" : "Note (optional)"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={pending}
              onClick={() => decide(asking)}
              className="rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setAsking(null)}
              className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-black"
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-[11px] text-black">{error}</p>}
        </div>
      ) : (
        <div className="flex gap-1.5">
          {s.approvalStatus !== "APPROVED" && (
            <button
              type="button"
              onClick={() => setAsking("APPROVE")}
              className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Approve
            </button>
          )}
          {s.approvalStatus !== "REJECTED" && (
            <button
              type="button"
              onClick={() => setAsking("REJECT")}
              className="rounded-md border border-rose-300 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
            >
              Reject
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SupervisorRowItem({ s, faculties }: { s: SupervisorRow; faculties: FacultyOption[] }) {
  const { pending, error, run } = useAction();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <tr className="border-b border-border last:border-0">
        <td colSpan={7} className="px-4 py-3">
          <form
            action={(fd) => run(updateSupervisor, fd, () => setEditing(false))}
            className="grid items-center gap-2 sm:grid-cols-3"
          >
            <input type="hidden" name="id" value={s.id} />
            <input name="name" defaultValue={s.name} className={input} required />
            <FacultySelect faculties={faculties} defaultValue={s.facultyId} />
            <input name="title" defaultValue={s.title ?? ""} className={input} placeholder="Title" />
            <input name="university" defaultValue={s.university ?? ""} className={input} placeholder="University" />
            <input name="telephone" defaultValue={s.telephone ?? ""} className={input} placeholder="Telephone" />
            <div className="flex gap-2">
              <button type="submit" disabled={pending} className="rounded-md bg-brand px-3 py-2 text-xs font-semibold text-white">
                Save
              </button>
              <button type="button" onClick={() => setEditing(false)} className="rounded-md border border-border px-3 py-2 text-xs font-medium text-black">
                Cancel
              </button>
            </div>
          </form>
          {error && <p className="mt-1 text-sm text-black">{error}</p>}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-2 font-medium text-black">
        <div>
          <p>{s.name}</p>
          {s.hasAccount && (
            <div className="mt-1 space-y-1">
              <span className="rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white">
                ACCOUNT
              </span>
              {s.initialPassword && s.mustChangePassword && (
                <div className="mt-2 text-xs text-neutral-600">
                  <p className="font-medium">Temp. login:</p>
                  <p>Email: {s.email}</p>
                  <p>Password: <code className="bg-neutral-100 px-1 py-0.5 font-mono">{s.initialPassword}</code></p>
                </div>
              )}
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-2 text-neutral-600">{s.facultyName ?? "All"}</td>
      <td className="px-4 py-2 text-neutral-600">{s.title ?? "—"}</td>
      <td className="px-4 py-2 text-neutral-600">{s.university ?? "—"}</td>
      <td className="px-4 py-2 text-neutral-600">{s.telephone ?? "—"}</td>
      <td className="px-4 py-2">
        <ApprovalControl s={s} />
        {!s.hasAccount && (
          <div className="mt-2 border-t border-border pt-2">
            <p className="mb-1 text-[11px] text-neutral-500">No portal login yet</p>
            <LoginControl s={s} />
          </div>
        )}
      </td>
      <td className="px-4 py-2 text-right">
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setEditing(true)}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-neutral-600 hover:border-brand hover:text-brand-dark"
          >
            Edit
          </button>
          <form action={(fd) => run(deleteSupervisor, fd)}>
            <input type="hidden" name="id" value={s.id} />
            <button
              type="submit"
              disabled={pending || s.usageCount > 0}
              title={s.usageCount > 0 ? "Used in an application" : "Delete"}
              className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-neutral-600 hover:border-brand hover:text-brand-dark disabled:opacity-40"
            >
              Delete
            </button>
          </form>
        </div>
        {error && <p className="mt-1 text-right text-xs text-black">{error}</p>}
      </td>
    </tr>
  );
}
