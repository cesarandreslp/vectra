-- AlterTable
ALTER TABLE "TenantConfig" ADD COLUMN     "politicaTratamiento" TEXT;

-- CreateTable
CREATE TABLE "SolicitudDatos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "cedulaHash" TEXT NOT NULL,
    "voterId" TEXT,
    "nombre" TEXT NOT NULL,
    "contacto" TEXT NOT NULL,
    "detalle" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'RECIBIDA',
    "venceEn" TIMESTAMP(3) NOT NULL,
    "respuesta" TEXT,
    "accion" TEXT,
    "atendidaEn" TIMESTAMP(3),
    "atendidaPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitudDatos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SolicitudDatos_tenantId_estado_venceEn_idx" ON "SolicitudDatos"("tenantId", "estado", "venceEn");

