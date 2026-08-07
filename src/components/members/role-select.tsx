"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeMemberRole } from "@/server/actions/members";
import { useToast } from "@/components/ui/toast";

const ROLES = [
  { key: "ADMIN", label: "Admin" },
  { key: "MANAGER", label: "Manager" },
  { key: "MEMBER", label: "Member" },
];

export function RoleSelect({
  memberId,
  roleKey,
}: {
  memberId: string;
  roleKey: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { push } = useToast();

  return (
    <select
      value={roleKey}
      disabled={pending}
      aria-label="Role"
      onChange={(e) => {
        const next = e.target.value;
        startTransition(async () => {
          const result = await changeMemberRole(memberId, next);
          if (!result.ok) {
            push(result.error, "error");
            return;
          }
          push(`Now a ${ROLES.find((r) => r.key === next)?.label ?? next}`);
          router.refresh();
        });
      }}
      className={`chip chip-accent shrink-0 cursor-pointer appearance-none pr-2 outline-none ${
        pending ? "opacity-50" : ""
      }`}
    >
      {ROLES.map((r) => (
        <option key={r.key} value={r.key}>
          {r.label}
        </option>
      ))}
    </select>
  );
}
