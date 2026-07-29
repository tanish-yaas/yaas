export const PERMISSIONS = {
  "task.create": "Create tasks",
  "task.view_own": "View own tasks",
  "task.view_team": "View team tasks",
  "task.view_any": "View all tasks",
  "task.edit_own": "Edit own tasks",
  "task.edit_team": "Edit team tasks",
  "task.edit_any": "Edit any task",
  "task.delete_own": "Delete own tasks",
  "task.delete_any": "Delete any task",
  "task.assign": "Assign tasks to others",
  "calendar.view_own": "View own calendar",
  "calendar.view_team": "View team calendars",
  "calendar.view_any": "View all calendars",
  "calendar.edit_own": "Edit own calendar",
  "calendar.edit_any": "Edit any calendar",
  "calendar.share": "Share calendars",
  "team.view": "View teams",
  "team.create": "Create teams",
  "team.manage": "Manage team membership",
  "member.invite": "Invite members",
  "member.approve": "Approve pending members",
  "member.deactivate": "Deactivate members",
  "member.assign_role": "Change member roles",
  "org.settings": "Manage organization settings",
  "org.view_audit": "View audit logs",
  "ai.use": "Use AI features",
  "ai.configure": "Configure AI settings",
  "whatsapp.link": "Link own WhatsApp number",
  "whatsapp.configure": "Configure WhatsApp integration",
  "report.view_own": "View own reports",
  "report.view_team": "View team reports",
  "report.view_any": "View all reports",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export const ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  ADMIN: Object.keys(PERMISSIONS) as PermissionKey[],

  MANAGER: [
    "task.create", "task.view_own", "task.view_team", "task.edit_own",
    "task.edit_team", "task.delete_own", "task.assign",
    "calendar.view_own", "calendar.view_team", "calendar.edit_own",
    "calendar.share", "team.view", "team.manage",
    "member.invite", "member.approve",
    "ai.use", "whatsapp.link",
    "report.view_own", "report.view_team",
  ],

  MEMBER: [
    "task.create", "task.view_own", "task.view_team", "task.edit_own",
    "task.delete_own",
    "calendar.view_own", "calendar.edit_own",
    "team.view", "ai.use", "whatsapp.link", "report.view_own",
  ],
};

export const ROLE_NAMES: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  MEMBER: "Member",
};