-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('PENDING', 'ACTIVE', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('LEAD', 'MEMBER');

-- CreateEnum
CREATE TYPE "CalendarType" AS ENUM ('PERSONAL', 'TEAM', 'ORGANIZATION', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "CalendarAccessLevel" AS ENUM ('VIEW', 'COMMENT', 'EDIT', 'FULL_ACCESS');

-- CreateEnum
CREATE TYPE "EventVisibility" AS ENUM ('DEFAULT', 'PUBLIC', 'PRIVATE', 'CONFIDENTIAL');

-- CreateEnum
CREATE TYPE "AttendeeStatus" AS ENUM ('NEEDS_ACTION', 'ACCEPTED', 'DECLINED', 'TENTATIVE');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TaskSource" AS ENUM ('MANUAL', 'WHATSAPP', 'AI_PARSED', 'RECURRING', 'CALENDAR', 'EMAIL', 'IMPORT', 'API');

-- CreateEnum
CREATE TYPE "TaskAssignmentRole" AS ENUM ('OWNER', 'COLLABORATOR', 'REVIEWER');

-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('BLOCKS', 'RELATES_TO');

-- CreateEnum
CREATE TYPE "ReminderScheduleType" AS ENUM ('MORNING_DIGEST', 'EVENING_REVIEW', 'WEEKLY_REVIEW', 'DEADLINE_SWEEP', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('IN_APP', 'EMAIL', 'WHATSAPP', 'PUSH');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TASK_ASSIGNED', 'TASK_DUE_SOON', 'TASK_OVERDUE', 'TASK_COMPLETED', 'TASK_COMMENT', 'TASK_MENTION', 'TASK_BLOCKED', 'EVENT_INVITE', 'EVENT_REMINDER', 'EVENT_UPDATED', 'MEMBER_JOIN_REQUEST', 'MEMBER_APPROVED', 'AI_SUGGESTION', 'DIGEST', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "AIParseStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'APPLIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LLMRole" AS ENUM ('SYSTEM', 'USER', 'ASSISTANT', 'TOOL');

-- CreateEnum
CREATE TYPE "AISuggestionType" AS ENUM ('TASK_PRIORITY', 'TASK_BREAKDOWN', 'SCHEDULE_SLOT', 'ROADBLOCK_RESOLUTION', 'WORKLOAD_REBALANCE', 'DEADLINE_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "AISuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DISMISSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'LOGIN', 'LOGOUT', 'INVITE', 'APPROVE', 'REJECT', 'PERMISSION_CHANGE', 'EXPORT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "email_verified" TIMESTAMP(3),
    "image" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "bio" TEXT,
    "job_title" TEXT,
    "whatsapp_number" TEXT,
    "whatsapp_verified" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp_verified_at" TIMESTAMP(3),
    "whatsapp_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "working_hours_start" INTEGER NOT NULL DEFAULT 9,
    "working_hours_end" INTEGER NOT NULL DEFAULT 17,
    "working_days" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "email_notifications" BOOLEAN NOT NULL DEFAULT true,
    "whatsapp_notifications" BOOLEAN NOT NULL DEFAULT false,
    "push_notifications" BOOLEAN NOT NULL DEFAULT true,
    "in_app_notifications" BOOLEAN NOT NULL DEFAULT true,
    "ai_suggestions_enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_prioritize" BOOLEAN NOT NULL DEFAULT true,
    "digest_enabled" BOOLEAN NOT NULL DEFAULT true,
    "default_calendar_id" TEXT,
    "default_organization_id" TEXT,
    "default_task_view" TEXT NOT NULL DEFAULT 'list',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logo_url" TEXT,
    "owner_id" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "status" "MemberStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT,
    "invited_at" TIMESTAMP(3),
    "joined_at" TIMESTAMP(3),
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "deactivated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "organization_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_settings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "default_timezone" TEXT NOT NULL DEFAULT 'UTC',
    "default_locale" TEXT NOT NULL DEFAULT 'en',
    "week_starts_on" INTEGER NOT NULL DEFAULT 1,
    "working_days" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "working_hours_start" INTEGER NOT NULL DEFAULT 9,
    "working_hours_end" INTEGER NOT NULL DEFAULT 17,
    "allow_self_signup" BOOLEAN NOT NULL DEFAULT false,
    "require_approval" BOOLEAN NOT NULL DEFAULT true,
    "allowed_domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "default_role_id" TEXT,
    "ai_enabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsapp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "brand_color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendars" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "team_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "type" "CalendarType" NOT NULL DEFAULT 'PERSONAL',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "provider" TEXT,
    "external_id" TEXT,
    "synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "calendar_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "meeting_url" TEXT,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "rrule" TEXT,
    "recurrence_parent_id" TEXT,
    "recurrence_exdates" TIMESTAMP(3)[] DEFAULT ARRAY[]::TIMESTAMP(3)[],
    "original_start_at" TIMESTAMP(3),
    "is_recurrence_exception" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "EventVisibility" NOT NULL DEFAULT 'DEFAULT',
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "busy" BOOLEAN NOT NULL DEFAULT true,
    "task_id" TEXT,
    "provider" TEXT,
    "external_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_attendees" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT,
    "email" TEXT,
    "name" TEXT,
    "status" "AttendeeStatus" NOT NULL DEFAULT 'NEEDS_ACTION',
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "is_organizer" BOOLEAN NOT NULL DEFAULT false,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_attendees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_shares" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "calendar_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_level" "CalendarAccessLevel" NOT NULL DEFAULT 'VIEW',
    "granted_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "team_id" TEXT,
    "parent_task_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "priority_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priority_pinned" BOOLEAN NOT NULL DEFAULT false,
    "risk_level" "RiskLevel" NOT NULL DEFAULT 'NONE',
    "roadblock" TEXT,
    "roadblock_at" TIMESTAMP(3),
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "start_at" TIMESTAMP(3),
    "due_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "estimated_minutes" INTEGER,
    "actual_minutes" INTEGER,
    "source" "TaskSource" NOT NULL DEFAULT 'MANUAL',
    "ai_parsed_task_id" TEXT,
    "recurring_task_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_assignments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "TaskAssignmentRole" NOT NULL DEFAULT 'OWNER',
    "assigned_by_id" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_dependencies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "depends_on_task_id" TEXT NOT NULL,
    "type" "DependencyType" NOT NULL DEFAULT 'BLOCKS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labels" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#94a3b8',
    "description" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_labels" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "label_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "body" TEXT NOT NULL,
    "is_edited" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "task_id" TEXT,
    "comment_id" TEXT,
    "uploaded_by_id" TEXT,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "url" TEXT,
    "checksum" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_status_history" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "from_status" "TaskStatus",
    "to_status" "TaskStatus" NOT NULL,
    "changed_by_id" TEXT,
    "reason" TEXT,
    "duration_seconds" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_priority_history" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "from_score" DOUBLE PRECISION,
    "to_score" DOUBLE PRECISION NOT NULL,
    "from_priority" "TaskPriority",
    "to_priority" "TaskPriority",
    "changed_by_id" TEXT,
    "changed_by_ai" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_priority_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_tasks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "assignee_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "rrule" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "template" JSONB,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "last_run_at" TIMESTAMP(3),
    "run_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "recurring_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "task_id" TEXT,
    "event_id" TEXT,
    "schedule_id" TEXT,
    "remind_at" TIMESTAMP(3) NOT NULL,
    "channel" "DeliveryChannel" NOT NULL DEFAULT 'IN_APP',
    "message" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_schedules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "ReminderScheduleType" NOT NULL,
    "channel" "DeliveryChannel" NOT NULL DEFAULT 'IN_APP',
    "time_of_day" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "days_of_week" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "next_send_at" TIMESTAMP(3),
    "last_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminder_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "data" JSONB,
    "task_id" TEXT,
    "event_id" TEXT,
    "read_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "notification_id" TEXT NOT NULL,
    "channel" "DeliveryChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "provider_message_id" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_messages" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "user_id" TEXT,
    "wa_message_id" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "from_number" TEXT NOT NULL,
    "to_number" TEXT NOT NULL,
    "body" TEXT,
    "media_url" TEXT,
    "media_type" TEXT,
    "template_name" TEXT,
    "conversation_id" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "provider" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "event_type" TEXT,
    "payload" JSONB NOT NULL,
    "headers" JSONB,
    "signature" TEXT,
    "status" "WebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "processed_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_parsed_tasks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "raw_input" TEXT NOT NULL,
    "parsed_output" JSONB,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "status" "AIParseStatus" NOT NULL DEFAULT 'PENDING',
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "total_tokens" INTEGER,
    "latency_ms" INTEGER,
    "source_message_id" TEXT,
    "error" TEXT,
    "applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_parsed_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_conversations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "purpose" TEXT,
    "model" TEXT NOT NULL,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_cost" DOUBLE PRECISION,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_messages" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" "LLMRole" NOT NULL,
    "content" TEXT NOT NULL,
    "tool_calls" JSONB,
    "tool_name" TEXT,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "latency_ms" INTEGER,
    "finish_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_suggestions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "task_id" TEXT,
    "type" "AISuggestionType" NOT NULL,
    "payload" JSONB NOT NULL,
    "reason" TEXT,
    "confidence" DOUBLE PRECISION,
    "model" TEXT,
    "status" "AISuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "dismissed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productivity_snapshots" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "tasks_created" INTEGER NOT NULL DEFAULT 0,
    "tasks_completed" INTEGER NOT NULL DEFAULT 0,
    "tasks_overdue" INTEGER NOT NULL DEFAULT 0,
    "tasks_blocked" INTEGER NOT NULL DEFAULT 0,
    "completion_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "focus_minutes" INTEGER NOT NULL DEFAULT 0,
    "meeting_minutes" INTEGER NOT NULL DEFAULT 0,
    "avg_priority_score" DOUBLE PRECISION,
    "on_time_rate" DOUBLE PRECISION,
    "breakdown" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productivity_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "actor_id" TEXT,
    "actor_email" TEXT,
    "action" "AuditAction" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "request_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_idx" ON "sessions"("expires");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE INDEX "verification_tokens_expires_idx" ON "verification_tokens"("expires");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_whatsapp_number_key" ON "profiles"("whatsapp_number");

-- CreateIndex
CREATE INDEX "profiles_whatsapp_number_idx" ON "profiles"("whatsapp_number");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_user_id_key" ON "user_settings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_owner_id_idx" ON "organizations"("owner_id");

-- CreateIndex
CREATE INDEX "organizations_slug_idx" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_deleted_at_idx" ON "organizations"("deleted_at");

-- CreateIndex
CREATE INDEX "organization_members_organization_id_idx" ON "organization_members"("organization_id");

-- CreateIndex
CREATE INDEX "organization_members_user_id_idx" ON "organization_members"("user_id");

-- CreateIndex
CREATE INDEX "organization_members_role_id_idx" ON "organization_members"("role_id");

-- CreateIndex
CREATE INDEX "organization_members_approved_by_id_idx" ON "organization_members"("approved_by_id");

-- CreateIndex
CREATE INDEX "organization_members_organization_id_status_idx" ON "organization_members"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organization_id_user_id_key" ON "organization_members"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "roles_organization_id_idx" ON "roles"("organization_id");

-- CreateIndex
CREATE INDEX "roles_key_idx" ON "roles"("key");

-- CreateIndex
CREATE INDEX "roles_is_system_idx" ON "roles"("is_system");

-- CreateIndex
CREATE UNIQUE INDEX "roles_organization_id_key_key" ON "roles"("organization_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "permissions_resource_idx" ON "permissions"("resource");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_resource_action_key" ON "permissions"("resource", "action");

-- CreateIndex
CREATE INDEX "role_permissions_role_id_idx" ON "role_permissions"("role_id");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "teams_organization_id_idx" ON "teams"("organization_id");

-- CreateIndex
CREATE INDEX "teams_deleted_at_idx" ON "teams"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "teams_organization_id_slug_key" ON "teams"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "team_members_team_id_idx" ON "team_members"("team_id");

-- CreateIndex
CREATE INDEX "team_members_user_id_idx" ON "team_members"("user_id");

-- CreateIndex
CREATE INDEX "team_members_organization_id_idx" ON "team_members"("organization_id");

-- CreateIndex
CREATE INDEX "team_members_team_id_role_idx" ON "team_members"("team_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_team_id_user_id_key" ON "team_members"("team_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_settings_organization_id_key" ON "organization_settings"("organization_id");

-- CreateIndex
CREATE INDEX "organization_settings_organization_id_idx" ON "organization_settings"("organization_id");

-- CreateIndex
CREATE INDEX "organization_settings_default_role_id_idx" ON "organization_settings"("default_role_id");

-- CreateIndex
CREATE INDEX "calendars_organization_id_idx" ON "calendars"("organization_id");

-- CreateIndex
CREATE INDEX "calendars_owner_id_idx" ON "calendars"("owner_id");

-- CreateIndex
CREATE INDEX "calendars_team_id_idx" ON "calendars"("team_id");

-- CreateIndex
CREATE INDEX "calendars_organization_id_type_idx" ON "calendars"("organization_id", "type");

-- CreateIndex
CREATE INDEX "calendars_provider_external_id_idx" ON "calendars"("provider", "external_id");

-- CreateIndex
CREATE INDEX "calendars_deleted_at_idx" ON "calendars"("deleted_at");

-- CreateIndex
CREATE INDEX "calendar_events_organization_id_idx" ON "calendar_events"("organization_id");

-- CreateIndex
CREATE INDEX "calendar_events_calendar_id_idx" ON "calendar_events"("calendar_id");

-- CreateIndex
CREATE INDEX "calendar_events_created_by_id_idx" ON "calendar_events"("created_by_id");

-- CreateIndex
CREATE INDEX "calendar_events_recurrence_parent_id_idx" ON "calendar_events"("recurrence_parent_id");

-- CreateIndex
CREATE INDEX "calendar_events_task_id_idx" ON "calendar_events"("task_id");

-- CreateIndex
CREATE INDEX "calendar_events_start_at_idx" ON "calendar_events"("start_at");

-- CreateIndex
CREATE INDEX "calendar_events_calendar_id_start_at_end_at_idx" ON "calendar_events"("calendar_id", "start_at", "end_at");

-- CreateIndex
CREATE INDEX "calendar_events_organization_id_start_at_idx" ON "calendar_events"("organization_id", "start_at");

-- CreateIndex
CREATE INDEX "calendar_events_provider_external_id_idx" ON "calendar_events"("provider", "external_id");

-- CreateIndex
CREATE INDEX "calendar_events_deleted_at_idx" ON "calendar_events"("deleted_at");

-- CreateIndex
CREATE INDEX "event_attendees_organization_id_idx" ON "event_attendees"("organization_id");

-- CreateIndex
CREATE INDEX "event_attendees_event_id_idx" ON "event_attendees"("event_id");

-- CreateIndex
CREATE INDEX "event_attendees_user_id_idx" ON "event_attendees"("user_id");

-- CreateIndex
CREATE INDEX "event_attendees_user_id_status_idx" ON "event_attendees"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "event_attendees_event_id_user_id_key" ON "event_attendees"("event_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_attendees_event_id_email_key" ON "event_attendees"("event_id", "email");

-- CreateIndex
CREATE INDEX "calendar_shares_organization_id_idx" ON "calendar_shares"("organization_id");

-- CreateIndex
CREATE INDEX "calendar_shares_calendar_id_idx" ON "calendar_shares"("calendar_id");

-- CreateIndex
CREATE INDEX "calendar_shares_user_id_idx" ON "calendar_shares"("user_id");

-- CreateIndex
CREATE INDEX "calendar_shares_granted_by_id_idx" ON "calendar_shares"("granted_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_shares_calendar_id_user_id_key" ON "calendar_shares"("calendar_id", "user_id");

-- CreateIndex
CREATE INDEX "tasks_organization_id_idx" ON "tasks"("organization_id");

-- CreateIndex
CREATE INDEX "tasks_created_by_id_idx" ON "tasks"("created_by_id");

-- CreateIndex
CREATE INDEX "tasks_team_id_idx" ON "tasks"("team_id");

-- CreateIndex
CREATE INDEX "tasks_parent_task_id_idx" ON "tasks"("parent_task_id");

-- CreateIndex
CREATE INDEX "tasks_ai_parsed_task_id_idx" ON "tasks"("ai_parsed_task_id");

-- CreateIndex
CREATE INDEX "tasks_recurring_task_id_idx" ON "tasks"("recurring_task_id");

-- CreateIndex
CREATE INDEX "tasks_organization_id_status_idx" ON "tasks"("organization_id", "status");

-- CreateIndex
CREATE INDEX "tasks_organization_id_due_at_idx" ON "tasks"("organization_id", "due_at");

-- CreateIndex
CREATE INDEX "tasks_organization_id_status_priority_score_idx" ON "tasks"("organization_id", "status", "priority_score" DESC);

-- CreateIndex
CREATE INDEX "tasks_organization_id_position_idx" ON "tasks"("organization_id", "position");

-- CreateIndex
CREATE INDEX "tasks_due_at_idx" ON "tasks"("due_at");

-- CreateIndex
CREATE INDEX "tasks_deleted_at_idx" ON "tasks"("deleted_at");

-- CreateIndex
CREATE INDEX "task_assignments_organization_id_idx" ON "task_assignments"("organization_id");

-- CreateIndex
CREATE INDEX "task_assignments_task_id_idx" ON "task_assignments"("task_id");

-- CreateIndex
CREATE INDEX "task_assignments_user_id_idx" ON "task_assignments"("user_id");

-- CreateIndex
CREATE INDEX "task_assignments_assigned_by_id_idx" ON "task_assignments"("assigned_by_id");

-- CreateIndex
CREATE INDEX "task_assignments_user_id_role_idx" ON "task_assignments"("user_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "task_assignments_task_id_user_id_role_key" ON "task_assignments"("task_id", "user_id", "role");

-- CreateIndex
CREATE INDEX "task_dependencies_organization_id_idx" ON "task_dependencies"("organization_id");

-- CreateIndex
CREATE INDEX "task_dependencies_task_id_idx" ON "task_dependencies"("task_id");

-- CreateIndex
CREATE INDEX "task_dependencies_depends_on_task_id_idx" ON "task_dependencies"("depends_on_task_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_dependencies_task_id_depends_on_task_id_type_key" ON "task_dependencies"("task_id", "depends_on_task_id", "type");

-- CreateIndex
CREATE INDEX "labels_organization_id_idx" ON "labels"("organization_id");

-- CreateIndex
CREATE INDEX "labels_created_by_id_idx" ON "labels"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "labels_organization_id_name_key" ON "labels"("organization_id", "name");

-- CreateIndex
CREATE INDEX "task_labels_organization_id_idx" ON "task_labels"("organization_id");

-- CreateIndex
CREATE INDEX "task_labels_task_id_idx" ON "task_labels"("task_id");

-- CreateIndex
CREATE INDEX "task_labels_label_id_idx" ON "task_labels"("label_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_labels_task_id_label_id_key" ON "task_labels"("task_id", "label_id");

-- CreateIndex
CREATE INDEX "task_comments_organization_id_idx" ON "task_comments"("organization_id");

-- CreateIndex
CREATE INDEX "task_comments_task_id_idx" ON "task_comments"("task_id");

-- CreateIndex
CREATE INDEX "task_comments_author_id_idx" ON "task_comments"("author_id");

-- CreateIndex
CREATE INDEX "task_comments_parent_id_idx" ON "task_comments"("parent_id");

-- CreateIndex
CREATE INDEX "task_comments_task_id_created_at_idx" ON "task_comments"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "task_comments_deleted_at_idx" ON "task_comments"("deleted_at");

-- CreateIndex
CREATE INDEX "attachments_organization_id_idx" ON "attachments"("organization_id");

-- CreateIndex
CREATE INDEX "attachments_task_id_idx" ON "attachments"("task_id");

-- CreateIndex
CREATE INDEX "attachments_comment_id_idx" ON "attachments"("comment_id");

-- CreateIndex
CREATE INDEX "attachments_uploaded_by_id_idx" ON "attachments"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "attachments_deleted_at_idx" ON "attachments"("deleted_at");

-- CreateIndex
CREATE INDEX "task_status_history_organization_id_idx" ON "task_status_history"("organization_id");

-- CreateIndex
CREATE INDEX "task_status_history_task_id_idx" ON "task_status_history"("task_id");

-- CreateIndex
CREATE INDEX "task_status_history_changed_by_id_idx" ON "task_status_history"("changed_by_id");

-- CreateIndex
CREATE INDEX "task_status_history_task_id_created_at_idx" ON "task_status_history"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "task_priority_history_organization_id_idx" ON "task_priority_history"("organization_id");

-- CreateIndex
CREATE INDEX "task_priority_history_task_id_idx" ON "task_priority_history"("task_id");

-- CreateIndex
CREATE INDEX "task_priority_history_changed_by_id_idx" ON "task_priority_history"("changed_by_id");

-- CreateIndex
CREATE INDEX "task_priority_history_task_id_created_at_idx" ON "task_priority_history"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "task_priority_history_changed_by_ai_idx" ON "task_priority_history"("changed_by_ai");

-- CreateIndex
CREATE INDEX "recurring_tasks_organization_id_idx" ON "recurring_tasks"("organization_id");

-- CreateIndex
CREATE INDEX "recurring_tasks_owner_id_idx" ON "recurring_tasks"("owner_id");

-- CreateIndex
CREATE INDEX "recurring_tasks_assignee_id_idx" ON "recurring_tasks"("assignee_id");

-- CreateIndex
CREATE INDEX "recurring_tasks_next_run_at_idx" ON "recurring_tasks"("next_run_at");

-- CreateIndex
CREATE INDEX "recurring_tasks_is_active_next_run_at_idx" ON "recurring_tasks"("is_active", "next_run_at");

-- CreateIndex
CREATE INDEX "recurring_tasks_deleted_at_idx" ON "recurring_tasks"("deleted_at");

-- CreateIndex
CREATE INDEX "reminders_organization_id_idx" ON "reminders"("organization_id");

-- CreateIndex
CREATE INDEX "reminders_user_id_idx" ON "reminders"("user_id");

-- CreateIndex
CREATE INDEX "reminders_task_id_idx" ON "reminders"("task_id");

-- CreateIndex
CREATE INDEX "reminders_event_id_idx" ON "reminders"("event_id");

-- CreateIndex
CREATE INDEX "reminders_schedule_id_idx" ON "reminders"("schedule_id");

-- CreateIndex
CREATE INDEX "reminders_status_remind_at_idx" ON "reminders"("status", "remind_at");

-- CreateIndex
CREATE INDEX "reminders_user_id_remind_at_idx" ON "reminders"("user_id", "remind_at");

-- CreateIndex
CREATE INDEX "reminder_schedules_organization_id_idx" ON "reminder_schedules"("organization_id");

-- CreateIndex
CREATE INDEX "reminder_schedules_user_id_idx" ON "reminder_schedules"("user_id");

-- CreateIndex
CREATE INDEX "reminder_schedules_next_send_at_idx" ON "reminder_schedules"("next_send_at");

-- CreateIndex
CREATE INDEX "reminder_schedules_is_active_next_send_at_idx" ON "reminder_schedules"("is_active", "next_send_at");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_schedules_user_id_type_time_of_day_channel_key" ON "reminder_schedules"("user_id", "type", "time_of_day", "channel");

-- CreateIndex
CREATE INDEX "notifications_organization_id_idx" ON "notifications"("organization_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_task_id_idx" ON "notifications"("task_id");

-- CreateIndex
CREATE INDEX "notifications_event_id_idx" ON "notifications"("event_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_organization_id_idx" ON "notification_deliveries"("organization_id");

-- CreateIndex
CREATE INDEX "notification_deliveries_notification_id_idx" ON "notification_deliveries"("notification_id");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_created_at_idx" ON "notification_deliveries"("status", "created_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_provider_message_id_idx" ON "notification_deliveries"("provider_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_notification_id_channel_key" ON "notification_deliveries"("notification_id", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_messages_wa_message_id_key" ON "whatsapp_messages"("wa_message_id");

-- CreateIndex
CREATE INDEX "whatsapp_messages_organization_id_idx" ON "whatsapp_messages"("organization_id");

-- CreateIndex
CREATE INDEX "whatsapp_messages_user_id_idx" ON "whatsapp_messages"("user_id");

-- CreateIndex
CREATE INDEX "whatsapp_messages_wa_message_id_idx" ON "whatsapp_messages"("wa_message_id");

-- CreateIndex
CREATE INDEX "whatsapp_messages_from_number_idx" ON "whatsapp_messages"("from_number");

-- CreateIndex
CREATE INDEX "whatsapp_messages_to_number_idx" ON "whatsapp_messages"("to_number");

-- CreateIndex
CREATE INDEX "whatsapp_messages_direction_status_idx" ON "whatsapp_messages"("direction", "status");

-- CreateIndex
CREATE INDEX "whatsapp_messages_created_at_idx" ON "whatsapp_messages"("created_at");

-- CreateIndex
CREATE INDEX "webhook_events_organization_id_idx" ON "webhook_events"("organization_id");

-- CreateIndex
CREATE INDEX "webhook_events_provider_status_idx" ON "webhook_events"("provider", "status");

-- CreateIndex
CREATE INDEX "webhook_events_created_at_idx" ON "webhook_events"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_external_id_key" ON "webhook_events"("provider", "external_id");

-- CreateIndex
CREATE INDEX "ai_parsed_tasks_organization_id_idx" ON "ai_parsed_tasks"("organization_id");

-- CreateIndex
CREATE INDEX "ai_parsed_tasks_user_id_idx" ON "ai_parsed_tasks"("user_id");

-- CreateIndex
CREATE INDEX "ai_parsed_tasks_source_message_id_idx" ON "ai_parsed_tasks"("source_message_id");

-- CreateIndex
CREATE INDEX "ai_parsed_tasks_status_idx" ON "ai_parsed_tasks"("status");

-- CreateIndex
CREATE INDEX "ai_parsed_tasks_organization_id_created_at_idx" ON "ai_parsed_tasks"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_parsed_tasks_model_prompt_version_idx" ON "ai_parsed_tasks"("model", "prompt_version");

-- CreateIndex
CREATE INDEX "llm_conversations_organization_id_idx" ON "llm_conversations"("organization_id");

-- CreateIndex
CREATE INDEX "llm_conversations_user_id_idx" ON "llm_conversations"("user_id");

-- CreateIndex
CREATE INDEX "llm_conversations_user_id_updated_at_idx" ON "llm_conversations"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "llm_messages_organization_id_idx" ON "llm_messages"("organization_id");

-- CreateIndex
CREATE INDEX "llm_messages_conversation_id_idx" ON "llm_messages"("conversation_id");

-- CreateIndex
CREATE INDEX "llm_messages_conversation_id_created_at_idx" ON "llm_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_suggestions_organization_id_idx" ON "ai_suggestions"("organization_id");

-- CreateIndex
CREATE INDEX "ai_suggestions_user_id_idx" ON "ai_suggestions"("user_id");

-- CreateIndex
CREATE INDEX "ai_suggestions_task_id_idx" ON "ai_suggestions"("task_id");

-- CreateIndex
CREATE INDEX "ai_suggestions_user_id_status_idx" ON "ai_suggestions"("user_id", "status");

-- CreateIndex
CREATE INDEX "ai_suggestions_expires_at_idx" ON "ai_suggestions"("expires_at");

-- CreateIndex
CREATE INDEX "ai_suggestions_type_status_idx" ON "ai_suggestions"("type", "status");

-- CreateIndex
CREATE INDEX "productivity_snapshots_organization_id_idx" ON "productivity_snapshots"("organization_id");

-- CreateIndex
CREATE INDEX "productivity_snapshots_user_id_idx" ON "productivity_snapshots"("user_id");

-- CreateIndex
CREATE INDEX "productivity_snapshots_organization_id_date_idx" ON "productivity_snapshots"("organization_id", "date");

-- CreateIndex
CREATE INDEX "productivity_snapshots_date_idx" ON "productivity_snapshots"("date");

-- CreateIndex
CREATE UNIQUE INDEX "productivity_snapshots_user_id_date_key" ON "productivity_snapshots"("user_id", "date");

-- CreateIndex
CREATE INDEX "activity_logs_organization_id_idx" ON "activity_logs"("organization_id");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_idx" ON "activity_logs"("user_id");

-- CreateIndex
CREATE INDEX "activity_logs_entity_type_entity_id_idx" ON "activity_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "activity_logs_organization_id_created_at_idx" ON "activity_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_idx" ON "audit_logs"("organization_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_default_role_id_fkey" FOREIGN KEY ("default_role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_recurrence_parent_id_fkey" FOREIGN KEY ("recurrence_parent_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_shares" ADD CONSTRAINT "calendar_shares_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_shares" ADD CONSTRAINT "calendar_shares_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_shares" ADD CONSTRAINT "calendar_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_shares" ADD CONSTRAINT "calendar_shares_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_ai_parsed_task_id_fkey" FOREIGN KEY ("ai_parsed_task_id") REFERENCES "ai_parsed_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_recurring_task_id_fkey" FOREIGN KEY ("recurring_task_id") REFERENCES "recurring_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_depends_on_task_id_fkey" FOREIGN KEY ("depends_on_task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labels" ADD CONSTRAINT "labels_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labels" ADD CONSTRAINT "labels_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_labels" ADD CONSTRAINT "task_labels_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_labels" ADD CONSTRAINT "task_labels_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_labels" ADD CONSTRAINT "task_labels_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "task_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "task_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_status_history" ADD CONSTRAINT "task_status_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_status_history" ADD CONSTRAINT "task_status_history_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_status_history" ADD CONSTRAINT "task_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_priority_history" ADD CONSTRAINT "task_priority_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_priority_history" ADD CONSTRAINT "task_priority_history_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_priority_history" ADD CONSTRAINT "task_priority_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_tasks" ADD CONSTRAINT "recurring_tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_tasks" ADD CONSTRAINT "recurring_tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_tasks" ADD CONSTRAINT "recurring_tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "reminder_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_schedules" ADD CONSTRAINT "reminder_schedules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_schedules" ADD CONSTRAINT "reminder_schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_parsed_tasks" ADD CONSTRAINT "ai_parsed_tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_parsed_tasks" ADD CONSTRAINT "ai_parsed_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_parsed_tasks" ADD CONSTRAINT "ai_parsed_tasks_source_message_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "whatsapp_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_conversations" ADD CONSTRAINT "llm_conversations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_conversations" ADD CONSTRAINT "llm_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_messages" ADD CONSTRAINT "llm_messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_messages" ADD CONSTRAINT "llm_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "llm_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productivity_snapshots" ADD CONSTRAINT "productivity_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productivity_snapshots" ADD CONSTRAINT "productivity_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
