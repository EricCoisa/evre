-- CreateEnum
CREATE TYPE "ConfigValueType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'DATE', 'ENUM');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "LogModule" AS ENUM ('USER', 'AUTH', 'SYSTEM', 'HEALTH', 'USER_ROUTE_ACCESS', 'SYSTEM_CONFIGURATION', 'ROUTE', 'ROLE_ROUTE_ACCESS', 'USER_CONFIGURATION', 'USER_CONFIGURATION_DEFINITION', 'CMS', 'FEATURE_FLAG', 'AI', 'API_KEY', 'MCP', 'MESSAGING', 'NOTIFICATION', 'VERIFICATION');

-- CreateEnum
CREATE TYPE "FeatureFlagCategory" AS ENUM ('GENERAL', 'AI', 'CONNECTORS', 'MESSAGING', 'SYSTEM', 'AUTH', 'DASHBOARD', 'REPORTS', 'NOTIFICATIONS');

-- CreateEnum
CREATE TYPE "MessagingProvider" AS ENUM ('EVOLUTION_API', 'EVOLUTION_GO', 'META');

-- CreateEnum
CREATE TYPE "MessagingDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessagingStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "MessagingTemplateCategory" AS ENUM ('AUTHENTICATION', 'UTILITY', 'MARKETING');

-- CreateEnum
CREATE TYPE "MessagingButtonEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "MessagingTemplateApproval" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED');

-- CreateEnum
CREATE TYPE "VerificationChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'AUTHENTICATOR');

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_tool_accesses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_tool_accesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configurations" (
    "id" TEXT NOT NULL,
    "labelKey" TEXT NOT NULL,
    "valueType" "ConfigValueType" NOT NULL,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "secret" BOOLEAN NOT NULL DEFAULT false,
    "blocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "system_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_configuration_definitions" (
    "id" TEXT NOT NULL,
    "labelKey" TEXT NOT NULL,
    "valueType" "ConfigValueType" NOT NULL,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultValue" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "secret" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_configuration_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_configurations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "category" "FeatureFlagCategory" NOT NULL DEFAULT 'GENERAL',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flag_roles" (
    "id" TEXT NOT NULL,
    "featureFlagId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "feature_flag_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_log" (
    "id" TEXT NOT NULL,
    "module" "LogModule" NOT NULL,
    "action" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "performedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "redirectUris" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_grants" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "codeHash" TEXT,
    "codeChallenge" TEXT,
    "redirectUri" TEXT,
    "codeExpiresAt" TIMESTAMP(3),
    "accessHash" TEXT,
    "accessExpiresAt" TIMESTAMP(3),
    "refreshHash" TEXT,
    "refreshExpiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messaging_connections" (
    "id" TEXT NOT NULL,
    "provider" "MessagingProvider" NOT NULL,
    "phone" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messaging_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messaging_contacts" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "pushName" TEXT,
    "profilePictureUrl" TEXT,
    "profileSyncedAt" TIMESTAMP(3),
    "optOut" BOOLEAN NOT NULL DEFAULT false,
    "optOutAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messaging_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messaging_conversations" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "lastInboundAt" TIMESTAMP(3),

    CONSTRAINT "messaging_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messaging_messages" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "direction" "MessagingDirection" NOT NULL,
    "status" "MessagingStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "text" TEXT,
    "mediaUrl" TEXT,
    "mimeType" TEXT,
    "fileName" TEXT,
    "error" TEXT,
    "raw" JSONB,
    "sentById" TEXT,
    "templateId" TEXT,
    "correlation" JSONB,
    "replyToProviderMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messaging_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messaging_template_types" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "buttons" JSONB NOT NULL DEFAULT '[]',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messaging_template_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messaging_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "category" "MessagingTemplateCategory" NOT NULL,
    "typeId" TEXT NOT NULL,
    "header" JSONB,
    "body" TEXT NOT NULL,
    "footer" TEXT,
    "buttons" JSONB,
    "bypassOptOut" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "previousCategory" "MessagingTemplateCategory",
    "categoryChangedAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),
    "invalidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messaging_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messaging_template_submissions" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "providerTemplateId" TEXT,
    "status" "MessagingTemplateApproval" NOT NULL,
    "reason" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "outOfSync" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "messaging_template_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messaging_button_events" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "templateId" TEXT,
    "originalMessageId" TEXT,
    "typeKey" TEXT,
    "buttonKey" TEXT NOT NULL,
    "data" TEXT,
    "correlation" JSONB,
    "status" "MessagingButtonEventStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "messaging_button_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "titleKey" TEXT,
    "title" TEXT,
    "messageKey" TEXT,
    "message" TEXT,
    "payload" JSONB,
    "actionUrl" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "audienceAll" BOOLEAN NOT NULL DEFAULT false,
    "audienceRoleNames" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_recipients" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "labelKey" TEXT NOT NULL,
    "icon" TEXT,
    "parentId" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "showSideBar" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_route_accesses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "grantedBy" TEXT,
    "denied" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_route_accesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_route_accesses" (
    "roleId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,

    CONSTRAINT "role_route_accesses_pkey" PRIMARY KEY ("roleId","routeId")
);

-- CreateTable
CREATE TABLE "short_links" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "purpose" TEXT,
    "createdById" TEXT,
    "clicksCount" INTEGER NOT NULL DEFAULT 0,
    "maxClicks" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "short_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "salt" TEXT,
    "hash" TEXT,
    "name" TEXT,
    "phone" TEXT,
    "image" BYTEA,
    "imageUrl" TEXT,
    "roleId" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "deletedAt" TIMESTAMP(3),
    "loginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "termsAcceptedAt" TIMESTAMP(3),
    "termsVersion" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "replacedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceIpHash" TEXT,
    "sourceUaHash" TEXT,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invites" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "actionUrl" TEXT,
    "tokenHash" TEXT,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signup_intents" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "purpose" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "providerId" TEXT,
    "inviteId" TEXT,
    "inviteTokenHash" TEXT,
    "userId" TEXT,
    "callbackUrl" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signup_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "channel" "VerificationChannel" NOT NULL,
    "target" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_conversations_userId_idx" ON "ai_conversations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_userId_idx" ON "api_keys"("userId");

-- CreateIndex
CREATE INDEX "user_tool_accesses_userId_idx" ON "user_tool_accesses"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_tool_accesses_userId_toolName_key" ON "user_tool_accesses"("userId", "toolName");

-- CreateIndex
CREATE UNIQUE INDEX "system_configurations_labelKey_key" ON "system_configurations"("labelKey");

-- CreateIndex
CREATE UNIQUE INDEX "user_configuration_definitions_labelKey_key" ON "user_configuration_definitions"("labelKey");

-- CreateIndex
CREATE INDEX "user_configurations_userId_idx" ON "user_configurations"("userId");

-- CreateIndex
CREATE INDEX "user_configurations_definitionId_idx" ON "user_configurations"("definitionId");

-- CreateIndex
CREATE UNIQUE INDEX "user_configurations_userId_definitionId_key" ON "user_configurations"("userId", "definitionId");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- CreateIndex
CREATE INDEX "feature_flags_parentId_idx" ON "feature_flags"("parentId");

-- CreateIndex
CREATE INDEX "feature_flags_category_idx" ON "feature_flags"("category");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flag_roles_featureFlagId_roleId_key" ON "feature_flag_roles"("featureFlagId", "roleId");

-- CreateIndex
CREATE INDEX "system_log_module_createdAt_idx" ON "system_log"("module", "createdAt");

-- CreateIndex
CREATE INDEX "system_log_performedById_idx" ON "system_log"("performedById");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_grants_codeHash_key" ON "oauth_grants"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_grants_accessHash_key" ON "oauth_grants"("accessHash");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_grants_refreshHash_key" ON "oauth_grants"("refreshHash");

-- CreateIndex
CREATE INDEX "oauth_grants_userId_idx" ON "oauth_grants"("userId");

-- CreateIndex
CREATE INDEX "oauth_grants_clientId_idx" ON "oauth_grants"("clientId");

-- CreateIndex
CREATE INDEX "oauth_grants_codeExpiresAt_idx" ON "oauth_grants"("codeExpiresAt");

-- CreateIndex
CREATE INDEX "messaging_connections_provider_idx" ON "messaging_connections"("provider");

-- CreateIndex
CREATE INDEX "messaging_connections_phone_idx" ON "messaging_connections"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "messaging_contacts_phone_key" ON "messaging_contacts"("phone");

-- CreateIndex
CREATE INDEX "messaging_contacts_optOut_idx" ON "messaging_contacts"("optOut");

-- CreateIndex
CREATE INDEX "messaging_contacts_lastMessageAt_idx" ON "messaging_contacts"("lastMessageAt");

-- CreateIndex
CREATE INDEX "messaging_conversations_lastMessageAt_idx" ON "messaging_conversations"("lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "messaging_conversations_connectionId_contactId_key" ON "messaging_conversations"("connectionId", "contactId");

-- CreateIndex
CREATE INDEX "messaging_messages_connectionId_contactId_createdAt_idx" ON "messaging_messages"("connectionId", "contactId", "createdAt");

-- CreateIndex
CREATE INDEX "messaging_messages_contactId_createdAt_idx" ON "messaging_messages"("contactId", "createdAt");

-- CreateIndex
CREATE INDEX "messaging_messages_status_idx" ON "messaging_messages"("status");

-- CreateIndex
CREATE INDEX "messaging_messages_sentById_idx" ON "messaging_messages"("sentById");

-- CreateIndex
CREATE UNIQUE INDEX "messaging_messages_connectionId_providerMessageId_key" ON "messaging_messages"("connectionId", "providerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "messaging_template_types_key_key" ON "messaging_template_types"("key");

-- CreateIndex
CREATE INDEX "messaging_templates_typeId_idx" ON "messaging_templates"("typeId");

-- CreateIndex
CREATE UNIQUE INDEX "messaging_templates_key_language_key" ON "messaging_templates"("key", "language");

-- CreateIndex
CREATE INDEX "messaging_template_submissions_connectionId_idx" ON "messaging_template_submissions"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "messaging_template_submissions_templateId_connectionId_key" ON "messaging_template_submissions"("templateId", "connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "messaging_button_events_messageId_key" ON "messaging_button_events"("messageId");

-- CreateIndex
CREATE INDEX "messaging_button_events_connectionId_idx" ON "messaging_button_events"("connectionId");

-- CreateIndex
CREATE INDEX "messaging_button_events_status_createdAt_idx" ON "messaging_button_events"("status", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_audienceAll_idx" ON "notifications"("audienceAll");

-- CreateIndex
CREATE INDEX "notification_recipients_userId_readAt_idx" ON "notification_recipients"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_recipients_notificationId_userId_key" ON "notification_recipients"("notificationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "routes_path_key" ON "routes"("path");

-- CreateIndex
CREATE INDEX "routes_parentId_idx" ON "routes"("parentId");

-- CreateIndex
CREATE INDEX "routes_isActive_idx" ON "routes"("isActive");

-- CreateIndex
CREATE INDEX "routes_ordem_idx" ON "routes"("ordem");

-- CreateIndex
CREATE INDEX "user_route_accesses_userId_idx" ON "user_route_accesses"("userId");

-- CreateIndex
CREATE INDEX "user_route_accesses_routeId_idx" ON "user_route_accesses"("routeId");

-- CreateIndex
CREATE INDEX "user_route_accesses_grantedBy_idx" ON "user_route_accesses"("grantedBy");

-- CreateIndex
CREATE UNIQUE INDEX "user_route_accesses_userId_routeId_key" ON "user_route_accesses"("userId", "routeId");

-- CreateIndex
CREATE INDEX "role_route_accesses_roleId_idx" ON "role_route_accesses"("roleId");

-- CreateIndex
CREATE INDEX "role_route_accesses_routeId_idx" ON "role_route_accesses"("routeId");

-- CreateIndex
CREATE UNIQUE INDEX "short_links_code_key" ON "short_links"("code");

-- CreateIndex
CREATE INDEX "short_links_code_idx" ON "short_links"("code");

-- CreateIndex
CREATE INDEX "short_links_expiresAt_idx" ON "short_links"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "invites_email_key" ON "invites"("email");

-- CreateIndex
CREATE UNIQUE INDEX "invites_tokenHash_key" ON "invites"("tokenHash");

-- CreateIndex
CREATE INDEX "invites_expiresAt_idx" ON "invites"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "signup_intents_tokenHash_key" ON "signup_intents"("tokenHash");

-- CreateIndex
CREATE INDEX "signup_intents_email_purpose_usedAt_idx" ON "signup_intents"("email", "purpose", "usedAt");

-- CreateIndex
CREATE INDEX "signup_intents_expiresAt_idx" ON "signup_intents"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expiresAt_idx" ON "password_reset_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "verification_codes_userId_purpose_idx" ON "verification_codes"("userId", "purpose");

-- CreateIndex
CREATE INDEX "verification_codes_expiresAt_idx" ON "verification_codes"("expiresAt");

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tool_accesses" ADD CONSTRAINT "user_tool_accesses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_configurations" ADD CONSTRAINT "user_configurations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_configurations" ADD CONSTRAINT "user_configurations_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "user_configuration_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "feature_flags"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_flag_roles" ADD CONSTRAINT "feature_flag_roles_featureFlagId_fkey" FOREIGN KEY ("featureFlagId") REFERENCES "feature_flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_flag_roles" ADD CONSTRAINT "feature_flag_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_log" ADD CONSTRAINT "system_log_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_grants" ADD CONSTRAINT "oauth_grants_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "oauth_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_grants" ADD CONSTRAINT "oauth_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_conversations" ADD CONSTRAINT "messaging_conversations_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "messaging_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_conversations" ADD CONSTRAINT "messaging_conversations_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "messaging_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_messages" ADD CONSTRAINT "messaging_messages_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "messaging_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_messages" ADD CONSTRAINT "messaging_messages_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "messaging_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_messages" ADD CONSTRAINT "messaging_messages_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_messages" ADD CONSTRAINT "messaging_messages_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "messaging_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_templates" ADD CONSTRAINT "messaging_templates_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "messaging_template_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_template_submissions" ADD CONSTRAINT "messaging_template_submissions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "messaging_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_template_submissions" ADD CONSTRAINT "messaging_template_submissions_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "messaging_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_button_events" ADD CONSTRAINT "messaging_button_events_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messaging_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_button_events" ADD CONSTRAINT "messaging_button_events_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "messaging_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_route_accesses" ADD CONSTRAINT "user_route_accesses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_route_accesses" ADD CONSTRAINT "user_route_accesses_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_route_accesses" ADD CONSTRAINT "user_route_accesses_grantedBy_fkey" FOREIGN KEY ("grantedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_route_accesses" ADD CONSTRAINT "role_route_accesses_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_route_accesses" ADD CONSTRAINT "role_route_accesses_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "short_links" ADD CONSTRAINT "short_links_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
