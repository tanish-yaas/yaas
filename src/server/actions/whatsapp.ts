"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/server/rbac/guard";

export async function generateLinkCode() {
  const ctx = await requirePermission("whatsapp.link");
  const userId = ctx.session.user.id;
  const identifier = `whatsapp:${userId}`;

  await prisma.verificationToken.deleteMany({ where: { identifier } });

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) suffix += chars[bytes[i] % chars.length];

  const code = `LINK-${suffix}`;
  const expires = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.verificationToken.create({
    data: { identifier, token: code, expires },
  });

  revalidatePath("/settings");
  return { ok: true as const, code, expiresAt: expires.toISOString() };
}

export async function unlinkWhatsApp() {
  const ctx = await requirePermission("whatsapp.link");
  const userId = ctx.session.user.id;

  await prisma.profile.update({
    where: { userId },
    data: {
      whatsappNumber: null,
      whatsappVerified: false,
      whatsappVerifiedAt: null,
      whatsappOptIn: false,
    },
  });

  await prisma.verificationToken.deleteMany({
    where: { identifier: `whatsapp:${userId}` },
  });

  revalidatePath("/settings");
  return { ok: true as const };
}