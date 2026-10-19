"use client";

import { useState } from "react";
import {
  approvePresentationResult,
  markPresentationNotRecommended,
  reschedulePresentation,
} from "../actions";
import { useServerAction } from "@/components/use-server-action";

/**
 * Outcome panel + actions: "Recommended" completes the registration, "Not
 * recommended" rejects the application with a reason. Once an outcome is
 * recorded the panel becomes read-only.
 */
export function PresentationReviewForm({
  presentationId,
  isDone,
  outcome,
  outcomeNote,
}: {
  presentationId: number;
  isDone: boolean;
  outcome: string | null;
  outcomeNote: string | null;
}) {
  const approve = useServerAction();
  const reject = useServerAction();
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState("");

  function handleApprove() {
    if (!isDone) {
      approve.setError("Presentation must be marked as completed by the supervisor first.");
      return;
    }
    approve.run({
      action: () => approvePresentationResult(presentationId),
    });
  }

  function handleNotRecommended() {
    if (!note.trim()) {
      reject.setError("Give the reason for 'Not recommended'.");
      return;
    }
    reject.run({
      action: () => markPresentationNotRecommended(presentationId, note),
    });
  }

  if (outcome === "RECOMMENDED") {
    return (
      <div className="rounded-lg border border-green-300 bg-green-50 p-4">
        <h3 className="mb-2 text-base font-bold text-green-900">✓ Recommended</h3>
        <p className="text-sm text-green-800">
          This presentation was recommended. The student is now registered as a
          postgraduate.
        </p>
      </div>
    );
  }

  if (outcome === "NOT_RECOMMENDED") {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4">
        <h3 className="mb-2 text-base font-bold text-red-900">✗ Not recommended</h3>
        <p className="text-sm text-red-800">
          The application was rejected and the reason was sent to the student,
          the supervisors, the Registrar and the Main Admin.
        </p>
        {outcomeNote && (
          <p className="mt-2 rounded bg-white/70 px-2 py-1.5 text-sm text-red-900">
            Reason: {outcomeNote}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-white p-4">
      <div>
        <h3 className="mb-2 text-base font-bold text-black">Record the outcome</h3>
        {(approve.error || reject.error) && (
          <p className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {approve.error || reject.error}
          </p>
        )}
        {!isDone && (
          <p className="mb-3 text-sm text-neutral-600">
            Waiting for the supervisor to mark this presentation as completed.
          </p>
        )}
        {isDone && (
          <p className="mb-3 text-sm text-neutral-600">
            The presentation has been completed. Choose <strong>Recommended</strong> to
            complete the registration, or <strong>Not recommended</strong> to reject the
            application with a reason.
          </p>
        )}
      </div>

      {isDone && (
        <>
          <button
            onClick={handleApprove}
            disabled={approve.pending || reject.pending}
            className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {approve.pending ? "Saving…" : "Recommended"}
          </button>

          <div className="border-t border-border pt-3">
            {noting ? (
              <div className="space-y-2">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Reason for 'Not recommended' (sent to the student and supervisors)"
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleNotRecommended}
                    disabled={reject.pending || approve.pending}
                    className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    {reject.pending ? "Saving…" : "Confirm — Not recommended"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoting(false)}
                    className="rounded-md border border-border px-4 py-2 text-sm font-medium text-black hover:border-brand"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setNoting(true)}
                className="w-full rounded-md border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
              >
                Not recommended…
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Move a scheduled presentation (date/time and/or venue). The new schedule is
 * forwarded to the student and every supervisor, exactly like the original
 * assignment.
 */
export function ReschedulePresentationForm({
  presentationId,
  initialDate,
  initialVenue,
}: {
  presentationId: number;
  initialDate: string;
  initialVenue: string;
}) {
  const { pending, error, run, setError } = useServerAction();
  const [date, setDate] = useState(initialDate);
  const [venue, setVenue] = useState(initialVenue);

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
      action: () => reschedulePresentation(presentationId, presentationDate, venue),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-white p-4">
      <h3 className="text-base font-bold text-black">Reschedule</h3>
      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <p className="text-sm text-neutral-600">
        Changing the date or venue notifies the student and every supervisor
        again (portal + email).
      </p>
      <div>
        <label className="block text-sm font-semibold text-black">Date &amp; time</label>
        <input
          type="datetime-local"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-black">Venue</label>
        <input
          type="text"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          placeholder="e.g., Faculty Board Room, Building 02"
          className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? "Saving…" : "Reschedule & notify"}
      </button>
    </form>
  );
}
