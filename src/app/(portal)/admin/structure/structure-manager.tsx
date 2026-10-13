"use client";

import { useState } from "react";
import type { DegreeLevel, StudyMode } from "@prisma/client";
import {
  createDegree,
  createFaculty,
  deleteDegree,
  deleteFaculty,
  renameFaculty,
  type ActionResult,
} from "./actions";
import { useServerAction } from "@/components/use-server-action";

export type DegreeNode = {
  id: number;
  name: string;
  level: DegreeLevel;
  type: string | null;
  studyModes: StudyMode[];
};

const MODE_LABEL: Record<StudyMode, string> = {
  FULL_TIME: "Full time",
  PART_TIME: "Part time",
};

export type FacultyNode = {
  id: number;
  name: string;
  degrees: DegreeNode[];
};

const inputClass =
  "w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-black outline-none focus:border-brand focus:ring-1 focus:ring-brand";
const primaryBtn =
  "rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50";
const ghostBtn =
  "rounded-md border border-border px-2.5 py-1 text-xs font-medium text-neutral-600 transition hover:border-brand hover:text-brand-dark disabled:opacity-50";

function useAction() {
  const { run: runAction, ...action } = useServerAction();
  function run(
    serverAction: (fd: FormData) => Promise<ActionResult>,
    fd: FormData,
    onDone?: () => void,
  ) {
    runAction({ action: () => serverAction(fd), onSuccess: onDone });
  }
  return { ...action, run };
}

/**
 * Faculties & Degrees.
 *
 * Degrees hang directly off a faculty — the department layer is no longer used
 * to filter them here or during student registration.
 */
export function StructureManager({ faculties }: { faculties: FacultyNode[] }) {
  return (
    <div className="space-y-6">
      <AddFaculty />
      {faculties.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center text-sm text-neutral-500">
          No faculties yet. Add one above to get started.
        </div>
      ) : (
        faculties.map((f) => <FacultyCard key={f.id} faculty={f} />)
      )}
    </div>
  );
}

function AddFaculty() {
  const { pending, error, run } = useAction();
  return (
    <form
      action={(fd) => run(createFaculty, fd)}
      className="rounded-lg border border-border bg-white p-4"
    >
      <label className="mb-2 block text-sm font-semibold text-black">
        Add faculty
      </label>
      <div className="flex gap-2">
        <input name="name" placeholder="Faculty name" className={inputClass} required />
        <button type="submit" disabled={pending} className={primaryBtn}>
          Add
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-black">{error}</p>}
    </form>
  );
}

function FacultyCard({ faculty }: { faculty: FacultyNode }) {
  const { pending, error, run } = useAction();
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        {editing ? (
          <form
            action={(fd) => run(renameFaculty, fd, () => setEditing(false))}
            className="flex flex-1 gap-2"
          >
            <input type="hidden" name="id" value={faculty.id} />
            <input
              name="name"
              defaultValue={faculty.name}
              className={inputClass}
              required
            />
            <button type="submit" disabled={pending} className={ghostBtn}>
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className={ghostBtn}
            >
              Cancel
            </button>
          </form>
        ) : (
          <>
            <div>
              <h3 className="text-base font-bold text-black">{faculty.name}</h3>
              <p className="text-xs text-neutral-500">
                {faculty.degrees.length} degree{faculty.degrees.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(true)} className={ghostBtn}>
                Rename
              </button>
              <form action={(fd) => run(deleteFaculty, fd)}>
                <input type="hidden" name="id" value={faculty.id} />
                <button type="submit" disabled={pending} className={ghostBtn}>
                  Delete
                </button>
              </form>
            </div>
          </>
        )}
      </div>

      <div className="space-y-4 px-4 py-4">
        {error && <p className="text-sm text-black">{error}</p>}

        <ul className="space-y-1">
          {faculty.degrees.length === 0 ? (
            <li className="text-xs text-neutral-500">No degrees yet.</li>
          ) : (
            faculty.degrees.map((deg) => (
              <li
                key={deg.id}
                className="flex items-center justify-between rounded border border-border bg-white px-2.5 py-1.5"
              >
                <span className="text-sm text-black">
                  {deg.name}
                  <span className="ml-2 rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {deg.level}
                  </span>
                  {deg.studyModes.map((m) => (
                    <span
                      key={m}
                      className="ml-1 rounded border border-brand px-1.5 py-0.5 text-[10px] font-semibold text-black"
                    >
                      {MODE_LABEL[m]}
                    </span>
                  ))}
                  {deg.type && (
                    <span className="ml-1 text-xs text-neutral-500">{deg.type}</span>
                  )}
                </span>
                <DeleteDegreeButton id={deg.id} />
              </li>
            ))
          )}
        </ul>

        <AddDegree facultyId={faculty.id} />
      </div>
    </div>
  );
}

function DeleteDegreeButton({ id }: { id: number }) {
  const { pending, run } = useAction();
  return (
    <form action={(fd) => run(deleteDegree, fd)}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className={ghostBtn}>
        Delete
      </button>
    </form>
  );
}

function AddDegree({ facultyId }: { facultyId: number }) {
  const { pending, error, run } = useAction();
  return (
    <form
      action={(fd) => run(createDegree, fd)}
      className="flex flex-wrap items-center gap-2 border-t border-dashed border-border pt-3"
    >
      <input type="hidden" name="facultyId" value={facultyId} />
      <input
        name="name"
        placeholder="Degree name (e.g. PhD in Computer Science)"
        className="min-w-[14rem] flex-1 rounded-md border border-border bg-white px-3 py-2 text-sm text-black outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        required
      />
      <select
        name="level"
        defaultValue="PHD"
        className="rounded-md border border-border bg-white px-2 py-2 text-sm text-black outline-none focus:border-brand"
      >
        <option value="PHD">PhD</option>
        <option value="MPHIL">MPhil</option>
        <option value="OTHER">Other</option>
      </select>
      <input
        name="type"
        placeholder="Type (optional)"
        className="w-32 rounded-md border border-border bg-white px-3 py-2 text-sm text-black outline-none focus:border-brand focus:ring-1 focus:ring-brand"
      />
      <label className="flex items-center gap-1 text-xs text-black">
        <input type="checkbox" name="fullTime" defaultChecked /> Full time
      </label>
      <label className="flex items-center gap-1 text-xs text-black">
        <input type="checkbox" name="partTime" defaultChecked /> Part time
      </label>
      <button type="submit" disabled={pending} className={ghostBtn}>
        Add degree
      </button>
      {error && <p className="w-full text-sm text-black">{error}</p>}
    </form>
  );
}
