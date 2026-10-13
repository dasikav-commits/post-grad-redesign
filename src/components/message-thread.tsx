"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ThreadMessage } from "@/lib/messaging";
import { sendMessage, type SendResult } from "@/lib/messaging-actions";

function time(date: Date) {
  return new Date(date).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * One conversation between a student and a supervisor.
 *
 * `recipientId` is null when the counterpart has no portal account yet — the
 * composer is then disabled and the caller shows the email address instead.
 */
export function MessageThread({
  threadId,
  messages,
  meName,
  counterpartName,
  recipientId,
  supervisorProfileId,
  applicationId,
  emptyHint,
}: {
  threadId: string;
  messages: ThreadMessage[];
  meName: string;
  counterpartName: string;
  recipientId: number | null;
  supervisorProfileId: number;
  applicationId: number | null;
  emptyHint?: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(0);

  async function submit() {
    if (!body.trim()) {
      setError("Write a message first.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("body", body);
      fd.set("supervisorProfileId", String(supervisorProfileId));
      if (recipientId) fd.set("recipientId", String(recipientId));
      if (applicationId) fd.set("applicationId", String(applicationId));
      const res = (await sendMessage(fd)) as SendResult;
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setBody("");
      setSent((n) => n + 1);
      router.refresh();
    } catch {
      setError("Could not send the message. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      data-thread-id={threadId}
      className="flex h-full flex-col rounded-lg border border-border bg-white"
    >
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-bold text-black">
          {counterpartName || "Conversation"}
        </p>
        <p className="text-xs text-neutral-500">
          {messages.length} message{messages.length === 1 ? "" : "s"}
          {sent > 0 ? ` · ${sent} just sent` : ""}
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-500">
            {emptyHint ?? `No messages yet — say hello to ${counterpartName || "your supervisor"}.`}
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  m.mine
                    ? "rounded-br-sm bg-brand text-white"
                    : "rounded-bl-sm bg-muted text-black"
                }`}
              >
                <p className={`text-[11px] font-semibold ${m.mine ? "text-white/80" : "text-neutral-500"}`}>
                  {m.mine ? meName || "You" : m.senderName || counterpartName}
                </p>
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className={`mt-1 text-[10px] ${m.mine ? "text-white/70" : "text-neutral-400"}`}>
                  {time(m.createdAt)}
                  {!m.mine && m.isRead ? "" : ""}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-border p-3">
        {recipientId === null ? (
          <p className="text-xs text-neutral-500">
            {emptyHint ??
              "This supervisor does not have a portal account yet. Use the email address shown in the Supervisors section."}
          </p>
        ) : (
          <>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void submit();
              }}
              placeholder={`Message ${counterpartName || "your supervisor"}…`}
              className="min-h-20 w-full resize-y rounded-md border border-border bg-white px-3 py-2 text-sm text-black outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => void submit()}
                disabled={pending || !body.trim()}
                className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {pending ? "Sending…" : "Send"}
              </button>
              <span className="text-xs text-neutral-400">Ctrl/Cmd + Enter</span>
              {error && <span className="text-xs text-black">{error}</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
