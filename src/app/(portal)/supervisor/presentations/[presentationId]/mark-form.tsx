"use client";

import { markPresentationDone } from "../actions";
import { useServerAction } from "@/components/use-server-action";

export function MarkPresentationCompleteForm({
  presentationId,
  isDone,
}: {
  presentationId: number;
  isDone: boolean;
}) {
  const { pending, error, run } = useServerAction();

  function handleMarkDone() {
    run({
      action: () => markPresentationDone(presentationId),
    });
  }

  if (isDone) {
    return (
      <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
        <h3 className="mb-2 text-base font-bold text-yellow-900">✓ Marked Complete</h3>
        <p className="text-sm text-yellow-800">
          This presentation has been marked as completed. The Faculty Admin will
          now record the outcome (Recommended / Not recommended).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-white p-4">
      <h3 className="text-base font-bold text-black">Mark Presentation Complete</h3>
      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <p className="text-sm text-neutral-600">
        Once you mark this presentation as complete, the Faculty Admin will
        record the outcome.
      </p>
      <button
        onClick={handleMarkDone}
        disabled={pending}
        className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? "Marking..." : "Mark Complete"}
      </button>
    </div>
  );
}
