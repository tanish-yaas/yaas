import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/server/auth/session";
import { Avatar } from "@/components/ui/avatar";
import { buildTaskScope } from "@/server/services/tasks";
import { formatIST } from "@/lib/dates";

export default async function PersonPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const ctx = await getCurrentContext();
  if (!ctx?.membership) return null;

  const orgId = ctx.membership.organizationId;

  // Scoped to the viewer's own organisation, so a valid id from elsewhere
  // reads as missing rather than exposing a member of another org.
  const member = await prisma.organizationMember.findFirst({
    where: { organizationId: orgId, userId, status: "ACTIVE" },
    include: {
      user: { select: { name: true, email: true, image: true, profile: true } },
      role: { select: { name: true } },
    },
  });

  if (!member) notFound();

  const profile = member.user.profile;
  const name = profile?.displayName ?? member.user.name ?? member.user.email;

  // Their tasks, but only the ones this viewer is allowed to see anyway.
  const taskScope = await buildTaskScope(orgId, ctx.session.user.id, ctx.permissions);

  const [openTasks, doneCount] = await Promise.all([
    prisma.task.findMany({
      where: {
        ...taskScope,
        status: { notIn: ["DONE", "CANCELLED"] },
        assignments: { some: { userId } },
      },
      orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }],
      take: 8,
      select: { id: true, title: true, status: true, dueAt: true },
    }),
    prisma.task.count({
      where: {
        ...taskScope,
        status: "DONE",
        assignments: { some: { userId } },
      },
    }),
  ]);

  const isSelf = userId === ctx.session.user.id;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <section className="panel overflow-hidden">
        <div className="flex items-start gap-4 p-5">
          <Avatar
            avatarUrl={profile?.avatarUrl}
            image={member.user.image}
            name={name}
            size={72}
          />

          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-semibold tracking-tight">{name}</h1>
            {profile?.jobTitle && (
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {profile.jobTitle}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="chip border-[color-mix(in_oklab,white_10%,transparent)] bg-[color-mix(in_oklab,white_5%,transparent)] text-faint">
                {member.role.name}
              </span>
              {member.user.email && (
                <span className="text-[12px] text-faint">
                  {member.user.email}
                </span>
              )}
            </div>
          </div>

          {isSelf && (
            <Link
              href="/settings"
              className="shrink-0 rounded-full border border-[color-mix(in_oklab,white_12%,transparent)] px-3 py-1.5 text-[12px] text-faint transition-colors hover:text-foreground"
            >
              Edit profile
            </Link>
          )}
        </div>

        {profile?.bio && (
          <p className="border-t border-[color-mix(in_oklab,white_7%,transparent)] px-5 py-4 text-[13px] leading-relaxed text-muted-foreground">
            {profile.bio}
          </p>
        )}
      </section>

      <section className="panel mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[color-mix(in_oklab,white_7%,transparent)] px-4 py-2.5">
          <h2 className="text-[11px] uppercase tracking-[0.12em] text-faint">
            Open tasks
          </h2>
          <span className="text-[11px] text-faint">{doneCount} completed</span>
        </div>

        {openTasks.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-faint">
            Nothing open you can see
          </p>
        ) : (
          <div>
            {openTasks.map((t, i) => (
              <div
                key={t.id}
                className={`row ${
                  i > 0
                    ? "border-t border-[color-mix(in_oklab,white_6%,transparent)]"
                    : ""
                }`}
              >
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {t.title}
                </span>
                {t.dueAt && (
                  <span className="shrink-0 text-[11px] text-faint">
                    {formatIST(t.dueAt)}
                  </span>
                )}
                <span className="chip shrink-0 border-[color-mix(in_oklab,white_10%,transparent)] bg-[color-mix(in_oklab,white_5%,transparent)] text-faint">
                  {t.status.replace("_", " ").toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
