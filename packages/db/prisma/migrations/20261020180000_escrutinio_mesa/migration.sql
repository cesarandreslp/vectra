-- CreateTable
CREATE TABLE "EscrutinioMesa" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "votingTableId" TEXT NOT NULL,
    "datos" JSONB NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'REVISADA',
    "historial" JSONB NOT NULL DEFAULT '[]',
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscrutinioMesa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EscrutinioMesa_votingTableId_key" ON "EscrutinioMesa"("votingTableId");

-- CreateIndex
CREATE INDEX "EscrutinioMesa_tenantId_idx" ON "EscrutinioMesa"("tenantId");
