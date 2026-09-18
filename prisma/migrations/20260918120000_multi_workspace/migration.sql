-- Multi-workspace.
--
-- The tables were always multi-tenant — every row has carried an
-- organization_id since the init migration. What was single-tenant was the
-- code above them: bootstrapUser() force-joined every new account to the
-- first organization it found. This migration adds the two things that were
-- missing (a way to be invited, a record of how you got in) and names the
-- workspace everyone is already in.

-- CreateEnum
CREATE TYPE "JoinMethod" AS ENUM ('FOUNDED', 'INVITE_CODE', 'REQUEST', 'DOMAIN');

-- CreateTable
CREATE TABLE "organization_invites" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "max_uses" INTEGER,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "email" TEXT,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_invites_code_key" ON "organization_invites"("code");
CREATE INDEX "organization_invites_organization_id_idx" ON "organization_invites"("organization_id");
CREATE INDEX "organization_invites_role_id_idx" ON "organization_invites"("role_id");
CREATE INDEX "organization_invites_created_by_id_idx" ON "organization_invites"("created_by_id");
CREATE INDEX "organization_invites_organization_id_revoked_at_idx" ON "organization_invites"("organization_id", "revoked_at");

-- AddForeignKey
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "organization_members" ADD COLUMN "join_method" "JoinMethod" NOT NULL DEFAULT 'REQUEST';
ALTER TABLE "organization_members" ADD COLUMN "invite_id" TEXT;

-- CreateIndex
CREATE INDEX "organization_members_invite_id_idx" ON "organization_members"("invite_id");

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "organization_invites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Data: name the workspace everyone is already in.
-- ---------------------------------------------------------------------------

-- Every task, event, diary page and notification in this database already
-- points at this organization, so there is nothing to move: the rename IS the
-- migration. Scoped to the oldest surviving org so that re-running this on a
-- database that has since grown a second workspace cannot touch it.
UPDATE "organizations"
SET "name" = 'Influencer Marketing',
    "slug" = 'influencer-marketing',
    "updated_at" = NOW()
WHERE "id" = (
  SELECT "id" FROM "organizations"
  WHERE "deleted_at" IS NULL
  ORDER BY "created_at" ASC
  LIMIT 1
)
-- Only if nobody has claimed the handle. Without this a re-run against a
-- database where a second workspace took the name would fail on the unique
-- index instead of quietly doing nothing.
AND NOT EXISTS (
  SELECT 1 FROM "organizations" WHERE "slug" = 'influencer-marketing'
);

-- The founder founded it; everyone else was let in by the old approval queue.
-- Without this every existing row would read REQUEST, including the owner's,
-- and the members page would claim the founder asked to join their own
-- workspace.
UPDATE "organization_members" m
SET "join_method" = 'FOUNDED'
FROM "organizations" o
WHERE m."organization_id" = o."id" AND m."user_id" = o."owner_id";
