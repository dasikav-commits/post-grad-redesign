"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { assignPresentationDate } from "../../actions";
import { useServerAction } from "@/components/use-server-action";

export function AssignPresentationForm({ applicationId }: { applicationId: number }) {
  const router = useRouter();
  const { pending, error, run, setError } = useServerAction();
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) {
      setError("Please select a presentation date.");
      return;
    }

    const presentationDate = new Date(date);
    if (isNaN(presentationDate.getTime())) {
      setError("Invalid date format.");
      return;
    }

    run({
      action: () => assignPresentationDate(applicationId, presentationDate, title, venue),
      refresh: false,
      onSuccess: () => {
        router.push("/faculty-admin/presentations");
      },
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-black">
          Presentation Date <span className="text-red-500">*</span>
        </label>
        <input
          type="datetime-local"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <p className="mt-1 text-xs text-neutral-600">
          Select the date and time for the presentation
        </p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-black">
          Venue <span className="text-neutral-500">(optional)</span>
        </label>
        <input
          type="text"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          placeholder="e.g., Faculty Board Room, Building 02"
          className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <p className="mt-1 text-xs text-neutral-600">
          Included in the schedule notice sent to the student and supervisors
        </p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-black">
          Presentation Title <span className="text-neutral-500">(optional)</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Research Proposal Defense"
          className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand"
        />
      </div>

      <div className="flex gap-2 pt-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {pending ? "Assigning..." : "Assign date & venue"}
        </button>
        <Link
          href="/faculty-admin/presentations"
          className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-black hover:border-brand"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
