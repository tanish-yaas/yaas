import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  WelcomeFrame,
  FormError,
} from "@/components/workspace/welcome-frame";
import { CreateWorkspaceForm } from "@/components/workspace/create-workspace-form";

export default async function CreateWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { error } = await searchParams;

  return (
    <WelcomeFrame
      eyebrow="Create"
      title="Name your workspace"
      blurb="Usually the team or the company. You can change it later — the handle too."
      back={{ href: "/welcome", label: "Back" }}
      footer="You'll be the admin: you approve who joins and what they can do."
    >
      <FormError message={error} />
      <CreateWorkspaceForm />
    </WelcomeFrame>
  );
}
