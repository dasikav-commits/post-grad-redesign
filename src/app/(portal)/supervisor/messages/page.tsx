import Link from "next/link";
import { requireRole } from "@/lib/guard";
import { getSupervisorAccess } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import {
  getInbox,
  getThread,
  markThreadRead,
  threadKey,
  type ThreadMessage,
} from "@/lib/messaging";
import { PageHeader } from "@/components/page-header";
import { MessageThread } from "@/components/message-thread";
import { SupervisorWaitingScreen } from "@/components/supervisor-waiting-screen";

export const dynamic = "force-dynamic";

/** Supervisor → Student message box. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ application?: string; thread?: string }>;
}) {
  const session = await requireRole("SUPERVISOR");
  const access = await getSupervisorAccess();
  if (!access.ok) {
    return (
      <SupervisorWaitingScreen
        reason={access.reason}
        note={access.note}
        fullName={session.fullName}
      />
    );
  }

  const { application: applicationParam, thread: threadParam } = await searchParams;

  const links = await prisma.proposalSupervisor.findMany({
    where: { supervisorId: access.supervisorId },
    orderBy: { assignedDate: "desc" },
    select: {
      isMain: true,
      proposal: {
        select: {
          id: true,
          title: true,
          applicationId: true,
          application: {
            select: {
              id: true,
              fullName: true,
              userId: true,
              emails: { select: { email: true } },
            },
          },
        },
      },
    },
  });

  const students = links
    .filter((l) => l.proposal.applicationId != null && l.proposal.application)
    .map((l) => {
      const application = l.proposal.application;
      return {
        applicationId: application.id,
        name: application.fullName,
        email: application.emails[0]?.email ?? null,
        recipientId: application.userId,
        proposalTitle: l.proposal.title,
        isMain: l.isMain,
        threadId: threadKey(access.supervisorId, application.id),
      };
    })
    .filter(
      (s, i, arr) => arr.findIndex((x) => x.applicationId === s.applicationId) === i,
    );

  const inbox = await getInbox(session.userId, access.supervisorId);
  const inboxByThread = new Map(inbox.map((t) => [t.threadId, t]));

  const requestedApplication = applicationParam ? Number(applicationParam) : null;
  const selected =
    students.find((s) => s.threadId === threadParam) ??
    students.find((s) => s.applicationId === requestedApplication) ??
    students.find((s) => (inboxByThread.get(s.threadId)?.unread ?? 0) > 0) ??
    students.find((s) => inboxByThread.has(s.threadId)) ??
    students[0] ??
    null;

  let messages: ThreadMessage[] = [];
  if (selected) {
    await markThreadRead(selected.threadId, session.userId, access.supervisorId);
    messages = await getThread(selected.threadId, session.userId);
  }

  return (
    <>
      <PageHeader
        title="Messages"
        subtitle="Talk to the students you supervise. Messages are delivered in the portal and by email."
      />

      {students.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center text-sm text-neutral-500">
          No students are linked to you yet.{" "}
          <Link href="/supervisor/students" className="text-brand underline">
            See My Students
          </Link>
          .
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
          <div className="space-y-2">
            {students.map((s) => {
              const thread = inboxByThread.get(s.threadId);
              const active = selected?.threadId === s.threadId;
              return (
                <Link
                  key={s.threadId}
                  href={`/supervisor/messages?application=${s.applicationId}`}
                  className={`block rounded-lg border p-3 transition ${
                    active
                      ? "border-brand bg-brand/5"
                      : "border-border bg-white hover:border-brand"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-black">
                      {s.name}
                      {s.isMain && (
                        <span className="ml-2 rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          MAIN
                        </span>
                      )}
                    </p>
                    {(thread?.unread ?? 0) > 0 && (
                      <span className="rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {thread?.unread}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">
                    {thread?.lastMessage ?? s.proposalTitle}
                  </p>
                  {thread && (
                    <p className="mt-1 text-[11px] text-neutral-400">
                      {thread.messageCount} message{thread.messageCount === 1 ? "" : "s"} ·{" "}
                      {thread.lastAt.toLocaleDateString()}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>

          {selected && (
            <MessageThread
              threadId={selected.threadId}
              messages={messages}
              meName={access.name}
              counterpartName={selected.name}
              recipientId={selected.recipientId}
              supervisorProfileId={access.supervisorId}
              applicationId={selected.applicationId}
              emptyHint={
                selected.recipientId
                  ? `No messages yet — write to ${selected.name}.`
                  : `${selected.name} does not have a portal account yet.${
                      selected.email ? ` Email them at ${selected.email}.` : ""
                    }`
              }
            />
          )}
        </div>
      )}
    </>
  );
}
