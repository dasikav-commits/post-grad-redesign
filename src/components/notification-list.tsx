"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { NotificationItem } from "@/lib/notify";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "./notification-actions";

const CATEGORY_LABEL: Record<string, string> = {
  correction: "Corrections",
  verification: "Verification",
  faculty: "Faculty",
  progress: "Progress",
  message: "Messages",
  presentation: "Presentations",
};

const CATEGORY_STYLE: Record<string, string> = {
  correction: "bg-amber-100 text-amber-800",
  verification: "bg-sky-100 text-sky-700",
  faculty: "bg-violet-100 text-violet-700",
  progress: "bg-indigo-100 text-indigo-700",
  message: "bg-cyan-100 text-cyan-700",
  presentation: "bg-emerald-100 text-emerald-700",
};

/** Full notification centre: filter, open and mark as read. */
export function NotificationList({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<string>("all");

  const categories = [...new Set(items.map((i) => i.category).filter(Boolean))] as string[];
  const unread = items.filter((i) => !i.isRead).length;
  const shown =
    filter === "all" ? items : filter === "unread" ? items.filter((i) => !i.isRead) : items.filter((i) => i.category === filter);

  function markAll() {
    startTransition(async () => {
      try {
        await markAllNotificationsRead();
        router.refresh();
      } catch (error) {
        console.error("Could not mark notifications as read", error);
      }
    });
  }

  function markOne(id: number) {
    startTransition(async () => {
      try {
        await markNotificationRead(id);
        router.refresh();
      } catch (error) {
        console.error("Could not mark notification as read", error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === "all" ? "bg-brand text-white" : "border border-border bg-white text-black"}`}
        >
          All ({items.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("unread")}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === "unread" ? "bg-brand text-white" : "border border-border bg-white text-black"}`}
        >
          Unread ({unread})
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(c)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === c ? "bg-brand text-white" : "border border-border bg-white text-black"}`}
          >
            {CATEGORY_LABEL[c] ?? c}
          </button>
        ))}
        {unread > 0 && (
          <button
            type="button"
            onClick={markAll}
            disabled={isPending}
            className="ml-auto text-xs font-semibold text-brand hover:underline disabled:opacity-50"
          >
            Mark all read
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center text-sm text-neutral-500">
          Nothing here yet.
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-white">
          {shown.map((n) => {
            const body = (
              <div className="flex w-full items-start gap-3 p-4">
                {!n.isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                <div className={`flex-1 ${n.isRead ? "opacity-70" : ""}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-black">{n.title}</p>
                    {n.category && CATEGORY_LABEL[n.category] && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${CATEGORY_STYLE[n.category] ?? "bg-neutral-100 text-neutral-600"}`}
                      >
                        {CATEGORY_LABEL[n.category]}
                      </span>
                    )}
                    {n.senderName && (
                      <span className="text-[11px] text-neutral-500">from {n.senderName}</span>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">{n.message}</p>
                  <p className="mt-1 text-[11px] text-neutral-400">
                    {n.createdAt.toLocaleString()}
                  </p>
                </div>
                {!n.isRead && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      markOne(n.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.stopPropagation();
                        markOne(n.id);
                      }
                    }}
                    className="shrink-0 text-xs font-medium text-brand hover:underline"
                  >
                    Mark read
                  </span>
                )}
              </div>
            );

            return n.link ? (
              <Link
                key={n.id}
                href={n.link}
                onClick={() => !n.isRead && markOne(n.id)}
                className="block transition hover:bg-muted"
              >
                {body}
              </Link>
            ) : (
              <div key={n.id} className="transition hover:bg-muted">
                {body}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
