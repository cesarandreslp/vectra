-- CreateEnum
CREATE TYPE "ModoAgente" AS ENUM ('AUTONOMO', 'SOLO_INFORME', 'APAGADO');

-- CreateEnum
CREATE TYPE "EstadoAnalisis" AS ENUM ('OK', 'ERROR');

-- CreateEnum
CREATE TYPE "EstadoCorrectivo" AS ENUM ('APLICADO', 'RECHAZADO', 'DESHECHO', 'PROPUESTO');

-- AlterTable
ALTER TABLE "TenantConfig" ADD COLUMN     "modoAgente" "ModoAgente" NOT NULL DEFAULT 'AUTONOMO';

-- CreateTable
CREATE TABLE "AnalisisEstrategia" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "semana" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoAnalisis" NOT NULL,
    "diagnostico" TEXT,
    "prioridades" JSONB,
    "snapshot" JSONB NOT NULL,
    "alias" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalisisEstrategia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectivoEstrategia" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "analisisId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "objetivoId" TEXT,
    "antes" JSONB,
    "despues" JSONB,
    "motivo" TEXT NOT NULL,
    "estado" "EstadoCorrectivo" NOT NULL,
    "motivoRechazo" TEXT,
    "deshechoPor" TEXT,
    "deshechoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorrectivoEstrategia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalisisEstrategia_tenantId_semana_key" ON "AnalisisEstrategia"("tenantId", "semana");

-- CreateIndex
CREATE INDEX "CorrectivoEstrategia_tenantId_analisisId_idx" ON "CorrectivoEstrategia"("tenantId", "analisisId");

-- AddForeignKey
ALTER TABLE "CorrectivoEstrategia" ADD CONSTRAINT "CorrectivoEstrategia_analisisId_fkey" FOREIGN KEY ("analisisId") REFERENCES "AnalisisEstrategia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
