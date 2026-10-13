import Link from "next/link";
import { requireRole } from "@/lib/guard";
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

export const dynamic = "force-dynamic";

type Counterpart = {
  supervisorProfileId: number;
  name: string;
  email: string | null;
  recipientId: number | null;
  canMessage: boolean;
  applicationId: number | null;
  threadId: string;
  isMain: boolean;
};

/**
 * Student → Supervisor message box.
 *
 * `?supervisor=<profileId>` opens (or starts) a conversation; `?thread=<id>`
 * re-opens one from the list.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string; supervisor?: string }>;
}) {
  const session = await requireRole("STUDENT");
  const { thread: threadParam, supervisor: supervisorParam } = await searchParams;

  // The student's own application (any status) and the supervisors they proposed.
  const application = await prisma.applicationPostGraduate.findFirst({
    where: { userId: session.userId },
    orderBy: { id: "desc" },
    select: {
      id: true,
      researchProposals: {
        select: {
          supervisors: {
            orderBy: { isMain: "desc" },
            select: {
              isMain: true,
              supervisor: {
                select: {
                  id: true,
                  name: true,
                  approvalStatus: true,
                  userId: true,
                  user: { select: { id: true, email: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const applicationId = application?.id ?? null;
  const supervisors: Counterpart[] = (application?.researchProposals ?? []).flatMap(
    (proposal) =>
      proposal.supervisors.map((ps) => ({
        supervisorProfileId: ps.supervisor.id,
        name: ps.supervisor.name,
        email: ps.supervisor.user?.email ?? null,
        recipientId: ps.supervisor.userId,
        canMessage:
          ps.supervisor.userId != null && ps.supervisor.approvalStatus === "APPROVED",
        applicationId,
        threadId: threadKey(ps.supervisor.id, applicationId),
        isMain: ps.isMain,
      })),
  );

  const inbox = await getInbox(session.userId, null);
  const inboxByThread = new Map(inbox.map((t) => [t.threadId, t]));

  const requestedSupervisor = supervisorParam ? Number(supervisorParam) : null;
  const selected =
    supervisors.find((s) => s.threadId === threadParam) ??
    supervisors.find((s) => s.supervisorProfileId === requestedSupervisor) ??
    supervisors.find((s) => (inboxByThread.get(s.threadId)?.unread ?? 0) > 0) ??
    supervisors.find((s) => inboxByThread.has(s.threadId)) ??
    supervisors[0] ??
    null;

  let messages: ThreadMessage[] = [];
  if (selected) {
    await markThreadRead(selected.threadId, session.userId, null);
    messages = await getThread(selected.threadId, session.userId);
  }

  return (
    <>
      <PageHeader
        title="Messages"
        subtitle="Talk to your supervisors directly. Messages are delivered in the portal and by email."
      />

      {supervisors.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center text-sm text-neutral-500">
          {applicationId
            ? "No supervisors are linked to your application yet."
            : "You have not submitted an application yet, so there is no supervisor to message."}{" "}
          <Link href="/student/supervisors" className="text-brand underline">
            See the Supervisors section
          </Link>
          .
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
          {/* Conversation list */}
          <div className="space-y-2">
            {supervisors.map((s) => {
              const thread = inboxByThread.get(s.threadId);
              const active = selected?.threadId === s.threadId;
              return (
                <Link
                  key={s.threadId}
                  href={`/student/messages?supervisor=${s.supervisorProfileId}`}
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
                    {thread?.lastMessage ??
                      (s.canMessage
                        ? "Start a conversation"
                        : s.email
                          ? `No portal account — email ${s.email}`
                          : "No portal account or email on record")}
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

          {/* Conversation */}
          {selected && (
            <MessageThread
              threadId={selected.threadId}
              messages={messages}
              meName={session.fullName}
              counterpartName={selected.name}
              recipientId={selected.canMessage ? selected.recipientId : null}
              supervisorProfileId={selected.supervisorProfileId}
              applicationId={selected.applicationId}
              emptyHint={
                selected.canMessage
                  ? `No messages yet — write to ${selected.name}.`
                  : `${selected.name} does not have an approved portal account yet.${
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
