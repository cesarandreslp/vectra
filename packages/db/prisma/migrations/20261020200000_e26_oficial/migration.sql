-- CreateTable
CREATE TABLE "E26Oficial" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "alcance" TEXT NOT NULL,
    "datos" JSONB NOT NULL,
    "observacion" TEXT,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "E26Oficial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "E26Oficial_tenantId_alcance_key" ON "E26Oficial"("tenantId", "alcance");
