-- CreateEnum
CREATE TYPE "OrigenContacto" AS ENUM ('CALLE', 'CHAT');

-- CreateEnum
CREATE TYPE "CanalConversacion" AS ENUM ('WHATSAPP', 'TELEGRAM', 'SMS', 'EMAIL');

-- AlterTable
ALTER TABLE "Voter" ADD COLUMN     "telefonoHash" TEXT;

-- AlterTable
ALTER TABLE "ContactoCalle" ADD COLUMN     "intereses" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "origen" "OrigenContacto" NOT NULL DEFAULT 'CALLE',
ADD COLUMN     "quiereSerVoluntario" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AgenteCampana" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "propuestas" TEXT NOT NULL DEFAULT '',
    "biografia" TEXT NOT NULL DEFAULT '',
    "tono" TEXT NOT NULL DEFAULT '',
    "lineamientos" TEXT NOT NULL DEFAULT '',
    "textoAutorizacion" TEXT NOT NULL DEFAULT '',
    "versionAprobada" JSONB,
    "aprobadoEn" TIMESTAMP(3),
    "aprobadoPorId" TEXT,
    "escalamientoUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "escalamientoHorario" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgenteCampana_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversacion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "canal" "CanalConversacion" NOT NULL,
    "telefonoHash" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "voterId" TEXT,
    "contactoId" TEXT,
    "autorizoEn" TIMESTAMP(3),
    "rechazoEn" TIMESTAMP(3),
    "escaladaEn" TIMESTAMP(3),
    "escaladaMotivo" TEXT,
    "atendidaEn" TIMESTAMP(3),
    "atendidaPorId" TEXT,
    "ultimoMensajeEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MensajeConversacion" (
    "id" TEXT NOT NULL,
    "conversacionId" TEXT NOT NULL,
    "entrante" BOOLEAN NOT NULL,
    "texto" TEXT NOT NULL,
    "autorId" TEXT,
    "providerMsgId" TEXT,
    "temas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MensajeConversacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgenteCampana_tenantId_key" ON "AgenteCampana"("tenantId");

-- CreateIndex
CREATE INDEX "Conversacion_tenantId_ultimoMensajeEn_idx" ON "Conversacion"("tenantId", "ultimoMensajeEn");

-- CreateIndex
CREATE INDEX "Conversacion_tenantId_escaladaEn_idx" ON "Conversacion"("tenantId", "escaladaEn");

-- CreateIndex
CREATE UNIQUE INDEX "Conversacion_tenantId_canal_telefonoHash_key" ON "Conversacion"("tenantId", "canal", "telefonoHash");

-- CreateIndex
CREATE UNIQUE INDEX "MensajeConversacion_providerMsgId_key" ON "MensajeConversacion"("providerMsgId");

-- CreateIndex
CREATE INDEX "MensajeConversacion_conversacionId_createdAt_idx" ON "MensajeConversacion"("conversacionId", "createdAt");

-- CreateIndex
CREATE INDEX "Voter_tenantId_telefonoHash_idx" ON "Voter"("tenantId", "telefonoHash");

-- AddForeignKey
ALTER TABLE "MensajeConversacion" ADD CONSTRAINT "MensajeConversacion_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "Conversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

