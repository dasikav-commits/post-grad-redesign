"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { NotificationItem } from "@/lib/notify";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "./notification-actions";

function timeAgo(date: Date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

const CATEGORY_LABEL: Record<string, string> = {
  correction: "Correction",
  verification: "Verification",
  faculty: "Faculty",
  progress: "Progress",
  message: "Message",
  presentation: "Presentation",
};

const CATEGORY_STYLE: Record<string, string> = {
  correction: "bg-amber-100 text-amber-800",
  verification: "bg-sky-100 text-sky-700",
  faculty: "bg-violet-100 text-violet-700",
  progress: "bg-indigo-100 text-indigo-700",
  message: "bg-cyan-100 text-cyan-700",
  presentation: "bg-emerald-100 text-emerald-700",
};

export function NotificationBell({
  items,
  unread,
  messageCount = 0,
}: {
  items: NotificationItem[];
  unread: number;
  /** Unread message-box conversations, shown as a second badge. */
  messageCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const markAll = () =>
    startTransition(async () => {
      try {
        await markAllNotificationsRead();
        router.refresh();
      } catch (error) {
        console.error("Could not mark notifications as read", error);
      }
    });

  const markOne = (id: number) =>
    startTransition(async () => {
      try {
        await markNotificationRead(id);
        router.refresh();
      } catch (error) {
        console.error("Could not mark notification as read", error);
      }
    });

  const badge = unread + messageCount;

  return (
    <div className="relative flex items-center gap-2" ref={ref}>
      {messageCount > 0 && (
        <span className="hidden rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-700 sm:inline">
          {messageCount} new message{messageCount === 1 ? "" : "s"}
        </span>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-white text-neutral-600 transition hover:bg-muted"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {badge > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-bold text-foreground">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                disabled={isPending}
                className="text-xs font-medium text-brand hover:underline disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-neutral-500">
                No notifications yet.
              </p>
            ) : (
              items.map((n) => {
                const category = n.category ?? undefined;
                const body = (
                  <>
                    <div className="flex w-full items-start gap-2">
                      {!n.isRead && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
                      )}
                      <span className="flex-1 text-sm font-semibold text-foreground">
                        {n.title}
                      </span>
                      <span className="shrink-0 text-[11px] text-neutral-400">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                    <p className="pl-4 text-xs text-neutral-600">{n.message}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-4">
                      {category && CATEGORY_LABEL[category] && (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${CATEGORY_STYLE[category] ?? "bg-neutral-100 text-neutral-600"}`}
                        >
                          {CATEGORY_LABEL[category]}
                        </span>
                      )}
                      {n.senderName && (
                        <span className="text-[10px] text-neutral-400">
                          from {n.senderName}
                        </span>
                      )}
                    </div>
                  </>
                );

                const classes = `flex w-full flex-col items-start gap-0.5 border-b border-border px-4 py-3 text-left transition last:border-0 hover:bg-muted ${
                  n.isRead ? "opacity-60" : ""
                }`;

                return n.link ? (
                  <Link
                    key={n.id}
                    href={n.link}
                    onClick={() => {
                      if (!n.isRead) markOne(n.id);
                      setOpen(false);
                    }}
                    className={classes}
                  >
                    {body}
                  </Link>
                ) : (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => !n.isRead && markOne(n.id)}
                    className={classes}
                  >
                    {body}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
