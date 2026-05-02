-- CreateEnum
CREATE TYPE "AiChatThreadStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AiChatMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "AiGenerationStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AiJournalContextSelectionMode" AS ENUM ('DATE_WINDOW', 'KEYWORD', 'RECENT');

-- CreateEnum
CREATE TYPE "AiUsageLogStatus" AS ENUM ('COMPLETED', 'FAILED', 'CANCELLED', 'BUDGET_REFUSED', 'RATE_LIMIT_REFUSED');

-- CreateEnum
CREATE TYPE "AiContentRetentionStatus" AS ENUM ('ACTIVE', 'CONTENT_DELETED', 'ANONYMIZED');

-- CreateEnum
CREATE TYPE "AiEnvironment" AS ENUM ('LOCAL', 'TEST', 'DEMO', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "AiFeature" AS ENUM ('JOURNAL_CHAT');

-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('FAKE', 'OPENAI');

-- CreateEnum
CREATE TYPE "AiBudgetCheckResult" AS ENUM ('ALLOWED', 'APP_BUDGET_EXCEEDED', 'USER_DAILY_LIMIT_EXCEEDED', 'ACTIVE_STREAM_LIMIT_EXCEEDED', 'LIVE_CALLS_DISABLED');

-- CreateTable
CREATE TABLE "ai_chat_thread" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "AiChatThreadStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inactivity_boundary_at" TIMESTAMP(3) NOT NULL,
    "content_retention_until" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "content_deleted_at" TIMESTAMP(3),
    "content_retention_status" "AiContentRetentionStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_chat_thread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_message" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "AiChatMessageRole" NOT NULL,
    "content" TEXT,
    "content_char_count" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "content_retention_until" TIMESTAMP(3) NOT NULL,
    "content_deleted_at" TIMESTAMP(3),
    "content_retention_status" "AiContentRetentionStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_chat_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_generation" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "user_message_id" TEXT NOT NULL,
    "assistant_message_id" TEXT,
    "provider" "AiProvider" NOT NULL,
    "requested_model" TEXT NOT NULL,
    "actual_model" TEXT,
    "prompt_version" TEXT NOT NULL,
    "status" "AiGenerationStatus" NOT NULL DEFAULT 'PENDING',
    "provider_response_id" TEXT,
    "finish_reason" TEXT,
    "error_type" TEXT,
    "safe_error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "latency_ms" INTEGER,
    "max_output_tokens" INTEGER NOT NULL DEFAULT 800,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_generation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_journal_context_use" (
    "id" TEXT NOT NULL,
    "generation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "journal_entry_id" TEXT NOT NULL,
    "selection_mode" "AiJournalContextSelectionMode" NOT NULL,
    "selection_reason" TEXT,
    "rank" INTEGER NOT NULL,
    "included_char_count" INTEGER NOT NULL,
    "included_token_estimate" INTEGER,
    "journal_entry_created_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_journal_context_use_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_log" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "thread_id" TEXT,
    "generation_id" TEXT,
    "environment" "AiEnvironment" NOT NULL,
    "feature" "AiFeature" NOT NULL DEFAULT 'JOURNAL_CHAT',
    "provider" "AiProvider",
    "model" TEXT,
    "prompt_version" TEXT,
    "status" "AiUsageLogStatus" NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "cached_input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "reasoning_tokens" INTEGER,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "estimated_cost_micro_usd" INTEGER NOT NULL DEFAULT 0,
    "latency_ms" INTEGER,
    "budget_check_result" "AiBudgetCheckResult" NOT NULL DEFAULT 'ALLOWED',
    "refusal_reason" TEXT,
    "content_retention_status" "AiContentRetentionStatus" NOT NULL DEFAULT 'ACTIVE',
    "content_deleted_at" TIMESTAMP(3),
    "anonymized_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_chat_thread_user_id_status_last_message_at_idx" ON "ai_chat_thread"("user_id", "status", "last_message_at");

-- CreateIndex
CREATE INDEX "ai_chat_thread_user_id_inactivity_boundary_at_idx" ON "ai_chat_thread"("user_id", "inactivity_boundary_at");

-- CreateIndex
CREATE INDEX "idx_ai_chat_thread_retention" ON "ai_chat_thread"("content_retention_status", "content_retention_until");

-- CreateIndex
CREATE INDEX "idx_ai_chat_message_retention" ON "ai_chat_message"("content_retention_status", "content_retention_until");

-- CreateIndex
CREATE UNIQUE INDEX "ai_chat_message_thread_id_sequence_key" ON "ai_chat_message"("thread_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "ai_generation_assistant_message_id_key" ON "ai_generation"("assistant_message_id");

-- CreateIndex
CREATE INDEX "ai_generation_user_id_status_created_at_idx" ON "ai_generation"("user_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_journal_context_use_generation_id_rank_key" ON "ai_journal_context_use"("generation_id", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "ai_journal_context_use_generation_id_journal_entry_id_key" ON "ai_journal_context_use"("generation_id", "journal_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_log_generation_id_key" ON "ai_usage_log"("generation_id");

-- CreateIndex
CREATE INDEX "ai_usage_log_user_id_feature_created_at_idx" ON "ai_usage_log"("user_id", "feature", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_log_environment_created_at_idx" ON "ai_usage_log"("environment", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_log_thread_id_created_at_idx" ON "ai_usage_log"("thread_id", "created_at");

-- CreateIndex
CREATE INDEX "journal_entry_userId_deletedAt_createdAt_idx" ON "journal_entry"("userId", "deletedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "ai_chat_thread" ADD CONSTRAINT "ai_chat_thread_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_message" ADD CONSTRAINT "ai_chat_message_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "ai_chat_thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_message" ADD CONSTRAINT "ai_chat_message_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generation" ADD CONSTRAINT "ai_generation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generation" ADD CONSTRAINT "ai_generation_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "ai_chat_thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generation" ADD CONSTRAINT "ai_generation_user_message_id_fkey" FOREIGN KEY ("user_message_id") REFERENCES "ai_chat_message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generation" ADD CONSTRAINT "ai_generation_assistant_message_id_fkey" FOREIGN KEY ("assistant_message_id") REFERENCES "ai_chat_message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_journal_context_use" ADD CONSTRAINT "ai_journal_context_use_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "ai_generation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_journal_context_use" ADD CONSTRAINT "ai_journal_context_use_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_journal_context_use" ADD CONSTRAINT "ai_journal_context_use_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_log" ADD CONSTRAINT "ai_usage_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_log" ADD CONSTRAINT "ai_usage_log_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "ai_chat_thread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_log" ADD CONSTRAINT "ai_usage_log_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "ai_generation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
