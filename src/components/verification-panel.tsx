"use client";

import { useState } from "react";
import {
  notifyStudent,
  requestCorrections,
  resolveCorrection,
  verifyApplication,
  type ReviewActionResult,
} from "@/lib/review-actions";
import { useServerAction } from "@/components/use-server-action";
import { VERIFICATION_LABEL } from "@/lib/status-labels";

const input =
  "w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-black outline-none focus:border-brand focus:ring-1 focus:ring-brand";
const primary =
  "rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50";
const ghost =
  "rounded-md border border-border px-4 py-2 text-sm font-medium text-black transition hover:border-brand hover:text-brand-dark disabled:opacity-50";

function useFormAction() {
  const { run: runAction, pending, error } = useServerAction();
  function run(
    action: (fd: FormData) => Promise<ReviewActionResult>,
    fd: FormData,
    onDone?: () => void,
  ) {
    runAction({ action: () => action(fd), onSuccess: onDone });
  }
  return { pending, error, run };
}

/**
 * The reviewer's control panel: verify the uploaded information, raise a Form
 * of Recorrection, or send the student a free-form notification (portal +
 * email).
 */
export function VerificationPanel({
  applicationId,
  verificationStatus,
  missingLabels,
}: {
  applicationId: number;
  verificationStatus: string;
  missingLabels: string[];
}) {
  const [tab, setTab] = useState<"verify" | "correct" | "notify" | null>(null);

  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-black">
            Verification &amp; student communication
          </h3>
          <p className="text-xs text-neutral-500">
            Current status:{" "}
            <span className="font-semibold text-black">
              {VERIFICATION_LABEL[verificationStatus] ?? verificationStatus}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab(tab === "verify" ? null : "verify")}
            className={tab === "verify" ? primary : ghost}
          >
            Verify information
          </button>
          <button
            type="button"
            onClick={() => setTab(tab === "correct" ? null : "correct")}
            className={tab === "correct" ? primary : ghost}
          >
            Request recorrection
          </button>
          <button
            type="button"
            onClick={() => setTab(tab === "notify" ? null : "notify")}
            className={tab === "notify" ? primary : ghost}
          >
            Notify student
          </button>
        </div>
      </div>

      {tab === "verify" && (
        <VerifyForm applicationId={applicationId} onDone={() => setTab(null)} />
      )}
      {tab === "correct" && (
        <CorrectionForm
          applicationId={applicationId}
          missingLabels={missingLabels}
          onDone={() => setTab(null)}
        />
      )}
      {tab === "notify" && (
        <NotifyForm applicationId={applicationId} onDone={() => setTab(null)} />
      )}
    </div>
  );
}

function VerifyForm({
  applicationId,
  onDone,
}: {
  applicationId: number;
  onDone: () => void;
}) {
  const { pending, error, run } = useFormAction();
  const [notes, setNotes] = useState("");
  const [sent, setSent] = useState<string | null>(null);

  function submit(status: "UNDER_REVIEW" | "VERIFIED") {
    const fd = new FormData();
    fd.set("applicationId", String(applicationId));
    fd.set("status", status);
    fd.set("notes", notes);
    run(verifyApplication, fd, () => {
      setSent(
        status === "VERIFIED"
          ? "Marked as verified. The student was notified in the portal and by email."
          : "Marked as under review. The student was notified in the portal and by email.",
      );
      onDone();
    });
  }

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <p className="text-sm text-neutral-600">
        Confirm that the information the student uploaded is correct. The student
        is notified in the portal and by email, and the Registrar is informed.
      </p>
      <textarea
        className={input}
        placeholder="Notes for the student (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      {error && <p className="text-sm text-black">{error}</p>}
      {sent && <p className="text-sm text-emerald-700">{sent}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("VERIFIED")}
          className={primary}
        >
          {pending ? "Saving…" : "Mark as verified"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("UNDER_REVIEW")}
          className={ghost}
        >
          Mark as under review
        </button>
      </div>
    </div>
  );
}

function CorrectionForm({
  applicationId,
  missingLabels,
  onDone,
}: {
  applicationId: number;
  missingLabels: string[];
  onDone: () => void;
}) {
  const { pending, error, run } = useFormAction();
  const [items, setItems] = useState(missingLabels.join("\n"));
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  function submit() {
    const fd = new FormData();
    fd.set("applicationId", String(applicationId));
    fd.set("items", items);
    fd.set("message", message);
    run(requestCorrections, fd, () => {
      setSent(true);
      onDone();
    });
  }

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <p className="text-sm text-neutral-600">
        Form of Recorrection — list one correction per line. The student gets an
        in-app notification <strong>and</strong> an email; the Registrar is
        copied so applicants without an account can be reached too.
      </p>
      {missingLabels.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2">
          <p className="mb-1 text-xs font-semibold text-amber-800">
            Still missing from the checklist — click to add:
          </p>
          <div className="flex flex-wrap gap-1">
            {missingLabels.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() =>
                  setItems((prev) =>
                    prev.trim() ? `${prev.trim()}\n${label}` : label,
                  )
                }
                className="rounded border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-100"
              >
                + {label}
              </button>
            ))}
          </div>
        </div>
      )}
      <textarea
        className={`${input} min-h-28`}
        placeholder={"e.g.\nBirth certificate copy is not certified\nReferee report 2 is missing"}
        value={items}
        onChange={(e) => setItems(e.target.value)}
      />
      <textarea
        className={input}
        placeholder="Additional message to the student (optional)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      {error && <p className="text-sm text-black">{error}</p>}
      {sent && (
        <p className="text-sm text-emerald-700">
          Correction request sent to the student (portal + email).
        </p>
      )}
      <button type="button" disabled={pending} onClick={submit} className={primary}>
        {pending ? "Sending…" : "Send correction request"}
      </button>
    </div>
  );
}

function NotifyForm({
  applicationId,
  onDone,
}: {
  applicationId: number;
  onDone: () => void;
}) {
  const { pending, error, run } = useFormAction();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [sent, setSent] = useState(false);

  function submit() {
    const fd = new FormData();
    fd.set("applicationId", String(applicationId));
    fd.set("title", title);
    fd.set("message", message);
    if (sendEmail) fd.set("sendEmail", "1");
    run(notifyStudent, fd, () => {
      setSent(true);
      setTitle("");
      setMessage("");
      onDone();
    });
  }

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <p className="text-sm text-neutral-600">
        Send this student a message. It lands in their portal notification
        centre, and by email when the box below is ticked.
      </p>
      <input
        className={input}
        placeholder="Subject"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className={`${input} min-h-24`}
        placeholder="Message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <label className="flex items-center gap-2 text-sm text-black">
        <input
          type="checkbox"
          checked={sendEmail}
          onChange={(e) => setSendEmail(e.target.checked)}
        />
        Also send by email
      </label>
      {error && <p className="text-sm text-black">{error}</p>}
      {sent && (
        <p className="text-sm text-emerald-700">Notification sent.</p>
      )}
      <button type="button" disabled={pending} onClick={submit} className={primary}>
        {pending ? "Sending…" : "Send notification"}
      </button>
    </div>
  );
}

/** Small "accept" button on a correction the student has answered. */
export function ResolveCorrectionButton({
  correctionId,
  applicationId,
}: {
  correctionId: number;
  applicationId: number;
}) {
  const { pending, error, run } = useFormAction();
  const [done, setDone] = useState(false);

  function submit() {
    const fd = new FormData();
    fd.set("correctionId", String(correctionId));
    fd.set("applicationId", String(applicationId));
    run(resolveCorrection, fd, () => setDone(true));
  }

  if (done) {
    return (
      <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
        Accepted
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="rounded-md bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? "Saving…" : "Accept & close"}
      </button>
      {error && <span className="text-xs text-black">{error}</span>}
    </span>
  );
}
