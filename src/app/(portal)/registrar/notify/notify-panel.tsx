"use client";

import { useState } from "react";
import { notifyStudentGroup, type GroupResult } from "@/lib/registrar-actions";
import { GROUP_HINT, GROUP_LABEL, NOTIFY_GROUPS } from "@/lib/registrar-groups";

const input =
  "w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-black outline-none focus:border-brand focus:ring-1 focus:ring-brand";

/**
 * Registrar → applicants announcements. Every message goes to the applicant's
 * portal notification centre (when they have an account) and, optionally, to
 * the email address on their application.
 */
export function NotifyStudentsPanel({ counts }: { counts: Record<string, number> }) {
  const [group, setGroup] = useState<string>("all");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ reached: number; emailed: number } | null>(null);

  async function submit() {
    if (!title.trim() || !message.trim()) {
      setError("A subject and a message are required.");
      return;
    }
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.set("group", group);
      fd.set("title", title);
      fd.set("message", message);
      if (sendEmail) fd.set("sendEmail", "1");
      const res = (await notifyStudentGroup(fd)) as GroupResult;
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult({ reached: res.reached, emailed: res.emailed });
      setTitle("");
      setMessage("");
    } catch {
      setError("Could not send the announcement. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <h3 className="text-base font-bold text-black">Send an announcement</h3>
      <p className="mt-1 text-sm text-neutral-600">
        As Registrar you are the channel through which applicants are informed.
        Pick a group, write the message, and it is delivered in the portal and by
        email.
      </p>

      <div className="mt-3 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-black">Group</label>
          <select
            className={input}
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          >
            {NOTIFY_GROUPS.map((g) => (
              <option key={g} value={g}>
                {GROUP_LABEL[g]} ({counts[g] ?? 0})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-neutral-500">{GROUP_HINT[group as keyof typeof GROUP_HINT]}</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-black">Subject</label>
          <input
            className={input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Application lodging fee reminder"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-black">Message</label>
          <textarea
            className={`${input} min-h-28`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write the announcement…"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-black">
          <input
            type="checkbox"
            checked={sendEmail}
            onChange={(e) => setSendEmail(e.target.checked)}
          />
          Also send by email to the address on each application
        </label>

        {error && <p className="text-sm text-black">{error}</p>}
        {result && (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Sent. {result.reached} applicant{result.reached === 1 ? "" : "s"} reached
            in the portal · {result.emailed} email{result.emailed === 1 ? "" : "s"} sent.
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send announcement"}
        </button>
      </div>
    </div>
  );
}
