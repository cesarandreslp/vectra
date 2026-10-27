-- CreateEnum
CREATE TYPE "EtapaProspecto" AS ENUM ('CANDIDATO', 'CONVERSADO', 'ACEPTO', 'NO_ACEPTO');

-- CreateTable
CREATE TABLE "ProspectoLider" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "phone" TEXT,
    "notas" TEXT,
    "etapa" "EtapaProspecto" NOT NULL DEFAULT 'CANDIDATO',
    "responsableId" TEXT,
    "voterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversadoEn" TIMESTAMP(3),
    "decididoEn" TIMESTAMP(3),

    CONSTRAINT "ProspectoLider_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProspectoLider_voterId_key" ON "ProspectoLider"("voterId");

-- CreateIndex
CREATE INDEX "ProspectoLider_tenantId_etapa_idx" ON "ProspectoLider"("tenantId", "etapa");

-- AddForeignKey
ALTER TABLE "ProspectoLider" ADD CONSTRAINT "ProspectoLider_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Voter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectoLider" ADD CONSTRAINT "ProspectoLider_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Voter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

