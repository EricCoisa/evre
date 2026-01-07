-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER', 'MODERATOR');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "LogModule" AS ENUM ('USER', 'AUTH', 'SYSTEM', 'HEALTH', 'USER_ROUTE_ACCESS', 'SYSTEM_CONFIGURATION', 'ROUTE', 'ROLE_ROUTE_ACCESS', 'USER_CONFIGURATION', 'USER_CONFIGURATION_DEFINITION');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_log" (
    "id" TEXT NOT NULL,
    "module" "LogModule" NOT NULL,
    "action" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "performedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "labelKey" TEXT NOT NULL,
    "icon" TEXT,
    "parentId" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "isHome" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_route_accesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_route_accesses" (
    "roleId" "UserRole" NOT NULL,
    "routeId" TEXT NOT NULL,

    CONSTRAINT "role_route_accesses_pkey" PRIMARY KEY ("roleId","routeId")
);

-- CreateTable
CREATE TABLE "system_configurations" (
    "id" TEXT NOT NULL,
    "labelKey" TEXT NOT NULL,
    "valueType" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_configuration_definitions" (
    "id" TEXT NOT NULL,
    "labelKey" TEXT NOT NULL,
    "valueType" TEXT NOT NULL,
    "defaultValue" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
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

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "system_log_module_createdAt_idx" ON "system_log"("module", "createdAt");

-- CreateIndex
CREATE INDEX "system_log_performedById_idx" ON "system_log"("performedById");

-- CreateIndex
CREATE UNIQUE INDEX "routes_path_key" ON "routes"("path");

-- CreateIndex
CREATE INDEX "routes_parentId_idx" ON "routes"("parentId");

-- CreateIndex
CREATE INDEX "routes_isActive_idx" ON "routes"("isActive");

-- CreateIndex
CREATE INDEX "routes_ordem_idx" ON "routes"("ordem");

-- CreateIndex
CREATE INDEX "routes_isHome_idx" ON "routes"("isHome");

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
CREATE UNIQUE INDEX "system_configurations_labelKey_key" ON "system_configurations"("labelKey");

-- CreateIndex
CREATE UNIQUE INDEX "user_configuration_definitions_labelKey_key" ON "user_configuration_definitions"("labelKey");

-- CreateIndex
CREATE INDEX "user_configurations_userId_idx" ON "user_configurations"("userId");

-- CreateIndex
CREATE INDEX "user_configurations_definitionId_idx" ON "user_configurations"("definitionId");

-- CreateIndex
CREATE UNIQUE INDEX "user_configurations_userId_definitionId_key" ON "user_configurations"("userId", "definitionId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_log" ADD CONSTRAINT "system_log_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_route_accesses" ADD CONSTRAINT "user_route_accesses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_route_accesses" ADD CONSTRAINT "user_route_accesses_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_route_accesses" ADD CONSTRAINT "user_route_accesses_grantedBy_fkey" FOREIGN KEY ("grantedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_route_accesses" ADD CONSTRAINT "role_route_accesses_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_configurations" ADD CONSTRAINT "user_configurations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_configurations" ADD CONSTRAINT "user_configurations_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "user_configuration_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
