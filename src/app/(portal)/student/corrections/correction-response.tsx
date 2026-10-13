"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  respondToCorrection,
  type CorrectionResponseResult,
} from "@/lib/student-actions";

/** Student reply to one correction request. */
export function CorrectionResponse({ correctionId }: { correctionId: number }) {
  const router = useRouter();
  const [response, setResponse] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!response.trim()) {
      setError("Write your response first.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("correctionId", String(correctionId));
      fd.set("response", response);
      const res = (await respondToCorrection(fd)) as CorrectionResponseResult;
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError("Could not send your response. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        Response sent. The reviewer has been notified and will re-check your
        application.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder="Explain what you corrected, or ask a question…"
        className="min-h-20 w-full resize-y rounded-md border border-border bg-white px-3 py-2 text-sm text-black outline-none focus:border-brand focus:ring-1 focus:ring-brand"
      />
      {error && <p className="text-sm text-black">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={pending || !response.trim()}
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send response"}
        </button>
        <span className="text-xs text-neutral-500">
          Your reply goes to the reviewer, the faculty admin and the registrar.
        </span>
      </div>
    </div>
  );
}
