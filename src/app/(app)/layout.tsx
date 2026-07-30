import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/server/auth/session";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getCurrentContext();

  if (!ctx) redirect("/login");
  if (!ctx.membership || ctx.membership.status === "PENDING") redirect("/pending");
  if (ctx.membership.status === "DEACTIVATED") redirect("/login");
  if (!ctx.profile) redirect("/onboarding");

  const canApprove = ctx.permissions.has("member.approve");
  const pendingCount = canApprove
    ? await prisma.organizationMember.count({
        where: {
          organizationId: ctx.membership.organizationId,
          status: "PENDING",
        },
      })
    : 0;

  return (
    <div className="aurora flex h-screen overflow-hidden">
      <Sidebar
        orgName={ctx.membership.organization.name}
        canApprove={canApprove}
        pendingCount={pendingCount}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar
          displayName={ctx.profile.displayName ?? "You"}
          email={ctx.session.user.email ?? ""}
          roleName={ctx.membership.role.name}
          image={ctx.session.user.image}
        />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}