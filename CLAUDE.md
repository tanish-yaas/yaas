## YAAS conventions

- Timezone is locked to Asia/Kolkata via src/config/app.ts. Never add a timezone picker.
- All datetime-local inputs MUST go through fromLocalInput() / toLocalInput() in src/lib/dates.ts.
  Never `new Date(formValue)` — the server runs in UTC and dates land 5.5h off.
- Every DB query is scoped by organizationId. Task queries go through buildTaskScope().
  Calendar queries go through getVisibleCalendarIds().
- Every mutation starts with requireContext() or requirePermission(key) from src/server/rbac/guard.ts.
- Deletes are soft: set deletedAt, never remove rows.
- AI proposes, users confirm. AI tools must never write directly to the database.
- Prisma client generates to src/generated/prisma, not @prisma/client.
- Overlays (dropdowns, modals) must portal to document.body — backdrop-filter parents trap fixed positioning.
- Do not add a class that sets `position` and also carries layout utilities. See the aurora-bg pattern.