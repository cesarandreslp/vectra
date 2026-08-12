-- CreateEnum
CREATE TYPE "AgendaAmbito" AS ENUM ('CANDIDATO', 'JEFES');

-- AlterTable
ALTER TABLE "Voter" ADD COLUMN     "agendaAbierta" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gestionaAgenda" "AgendaAmbito";

-- CreateTable
CREATE TABLE "AgendaApertura" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "anfitrionId" TEXT NOT NULL,
    "abierta" BOOLEAN NOT NULL,
    "gestorId" TEXT,
    "adminUserId" TEXT,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgendaApertura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgendaApertura_tenantId_anfitrionId_createdAt_idx" ON "AgendaApertura"("tenantId", "anfitrionId", "createdAt");

-- AddForeignKey
ALTER TABLE "AgendaApertura" ADD CONSTRAINT "AgendaApertura_anfitrionId_fkey" FOREIGN KEY ("anfitrionId") REFERENCES "Voter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaApertura" ADD CONSTRAINT "AgendaApertura_gestorId_fkey" FOREIGN KEY ("gestorId") REFERENCES "Voter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
