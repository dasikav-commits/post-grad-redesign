import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

const CONTACT_LABEL: Record<string, string> = {
  MOBILE: "Mobile / Personal",
  RESIDENTIAL: "Residential",
  OFFICE: "Office",
  MOBILE_OFFICE: "Mobile (Office)",
};

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-1.5 text-sm last:border-0">
      <span className="text-neutral-500">{k}</span>
      <span className="text-right font-medium text-black">{v || "—"}</span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <h3 className="mb-2 text-base font-bold text-black">{title}</h3>
      {children}
    </div>
  );
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("MAIN_ADMIN");
  const { id } = await params;
  const appId = Number(id);
  if (!Number.isInteger(appId)) notFound();

  const app = await prisma.applicationPostGraduate.findUnique({
    where: { id: appId },
    include: {
      emails: true,
      contacts: true,
      declarations: {
        orderBy: { id: "desc" },
        include: { registrar: { include: { user: true } } },
      },
      researchProposals: { select: { title: true } },
    },
  });
  if (!app || app.status !== "REJECTED") notFound();

  const rejection =
    app.declarations.find((d) => d.status === "REJECTED") ?? app.declarations[0];

  return (
    <>
      <div className="mb-4">
        <Link href="/admin/rejected" className="text-sm text-neutral-500 underline">
          ← Back to rejected applications
        </Link>
      </div>
      <PageHeader
        title={app.fullName}
        subtitle={`Application #${app.id} · REJECTED`}
      />

      <div className="space-y-4">
        {/* Rejection reason — most important for follow-up. */}
        <div className="rounded-lg border border-brand bg-neutral-50 p-4">
          <h3 className="mb-1 text-base font-bold text-black">Reason for rejection</h3>
          <p className="text-sm text-black">
            {rejection?.registrarComment || "No reason was recorded."}
          </p>
          {rejection?.registrar?.user && (
            <p className="mt-2 text-xs text-neutral-500">
              Rejected by {rejection.registrar.user.fullName}
            </p>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Contact details — so the admin can reach the applicant. */}
          <Card title="Contact details">
            <Field
              k="Email"
              v={
                app.emails[0]?.email ? (
                  <a
                    href={`mailto:${app.emails[0].email}`}
                    className="underline underline-offset-2"
                  >
                    {app.emails.map((e) => e.email).join(", ")}
                  </a>
                ) : null
              }
            />
            {app.contacts.length === 0 ? (
              <Field k="Phone" v={null} />
            ) : (
              app.contacts.map((c) => (
                <Field
                  key={c.id}
                  k={CONTACT_LABEL[c.contactType] ?? c.contactType}
                  v={
                    <a
                      href={`tel:${c.contactValue}`}
                      className="underline underline-offset-2"
                    >
                      {c.contactValue}
                    </a>
                  }
                />
              ))
            )}
            <Field k="Residential address" v={app.residentialAddress} />
            <Field k="Official address" v={app.officialAddress} />
          </Card>

          {/* Applicant & programme reference. */}
          <Card title="Applicant & programme">
            <Field k="NIC" v={app.nic} />
            <Field k="Name with initials" v={app.nameWithInitials} />
            <Field k="Date of birth" v={app.dateOfBirth.toLocaleDateString()} />
            <Field k="Faculty" v={app.faculty} />
            <Field k="Degree" v={app.degreeProgram} />
            <Field
              k="Study mode"
              v={
                app.studyMode === "FULL_TIME"
                  ? "Full time"
                  : app.studyMode === "PART_TIME"
                    ? "Part time"
                    : ""
              }
            />
            <Field k="Proposal" v={app.researchProposals[0]?.title} />
          </Card>
        </div>
      </div>
    </>
  );
}
