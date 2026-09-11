-- AlterTable
ALTER TABLE "Voter" ADD COLUMN     "censoEstado" TEXT,
ADD COLUMN     "censoJobId" TEXT,
ADD COLUMN     "censoLugar" JSONB,
ADD COLUMN     "censoVerificadoEn" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Voter_tenantId_censoEstado_idx" ON "Voter"("tenantId", "censoEstado");

-- CreateIndex
CREATE INDEX "Voter_censoJobId_idx" ON "Voter"("censoJobId");

