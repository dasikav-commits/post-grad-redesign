"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approvePresentationResult } from "../actions";
import { rejectRegistration } from "../../registrations/actions";
import { useServerAction } from "@/components/use-server-action";

export function PresentationReviewForm({
  presentationId,
  isDone,
  isFinal,
  applicationId,
  applicationStatus,
}: {
  presentationId: number;
  isDone: boolean;
  isFinal: boolean;
  applicationId: number;
  applicationStatus: string;
}) {
  const { pending, error, run, setError } = useServerAction();
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const rejectAction = useServerAction();

  function handleReject() {
    rejectAction.run({
      action: () => rejectRegistration(applicationId, reason),
      refresh: false,
      onSuccess: () => router.push("/registrar/rejected"),
    });
  }

  function handleApprove() {
    if (!isDone) {
      setError("Presentation must be marked as completed by the supervisor first.");
      return;
    }

      run({
        action: () => approvePresentationResult(presentationId),
    });
  }

  if (isFinal) {
    return (
      <div className="rounded-lg border border-green-300 bg-green-50 p-4">
        <h3 className="mb-2 text-base font-bold text-green-900">✓ Approved</h3>
        <p className="text-sm text-green-800">
          This presentation has been approved. The student is now registered as a postgraduate.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-white p-4">
      <div>
        <h3 className="mb-2 text-base font-bold text-black">Review Presentation Result</h3>
        {error && (
          <p className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
        {!isDone && (
          <p className="mb-3 text-sm text-neutral-600">
            Waiting for the supervisor to mark this presentation as completed.
          </p>
        )}
        {isDone && !isFinal && (
          <p className="mb-3 text-sm text-neutral-600">
            The presentation has been completed. Review the supervisor&apos;s feedback and approve
            the result.
          </p>
        )}
      </div>
      {isDone && !isFinal && (
        <button
          onClick={handleApprove}
          disabled={pending}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {pending ? "Approving..." : "Approve Presentation Result"}
        </button>
      )}

      {/* Rejection lives with the presentation outcome, not in the new
          registration queue. Only possible while the registration is open. */}
      {applicationStatus === "ACTIVE" && (
        <div className="border-t border-border pt-3">
          {rejecting ? (
            <div className="space-y-2">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for rejection (sent to the applicant by email)"
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand"
              />
              {rejectAction.error && (
                <p className="text-sm text-black">{rejectAction.error}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={rejectAction.pending}
                  className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {rejectAction.pending ? "Rejecting…" : "Confirm rejection"}
                </button>
                <button
                  type="button"
                  onClick={() => setRejecting(false)}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-black hover:border-brand"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setRejecting(true)}
              className="rounded-md border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
            >
              Reject registration
            </button>
          )}
        </div>
      )}
    </div>
  );
}
