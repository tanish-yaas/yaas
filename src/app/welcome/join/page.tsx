import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { WelcomeFrame, FormError } from "@/components/workspace/welcome-frame";
import { JoinWorkspaceForm } from "@/components/workspace/join-workspace-form";

export default async function JoinWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; code?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { error, code } = await searchParams;

  return (
    <WelcomeFrame
      eyebrow="Join"
      title="Where are you headed?"
      blurb="Paste the code someone sent you. If you only know the workspace handle, that works too."
      back={{ href: "/welcome", label: "Back" }}
      footer="Codes look like NOVA-7K2P-XM4T-9BRC and can expire."
    >
      <FormError message={error} />
      <JoinWorkspaceForm initialCode={code ?? ""} />
    </WelcomeFrame>
  );
}
