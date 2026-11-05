-- AlterTable
ALTER TABLE "Voter" ADD COLUMN     "autorizacionDatosEn" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TenantConfig" ADD COLUMN     "autorizacionContacto" TEXT,
ADD COLUMN     "autorizacionTexto" TEXT;

-- CreateTable
CREATE TABLE "AutorizacionDatos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "ip" TEXT,
    "declaradaPorId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revocadaEn" TIMESTAMP(3),

    CONSTRAINT "AutorizacionDatos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutorizacionDatos_tenantId_voterId_idx" ON "AutorizacionDatos"("tenantId", "voterId");

