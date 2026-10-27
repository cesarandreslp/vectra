-- CreateEnum
CREATE TYPE "EstadoCargo" AS ENUM ('VACANTE', 'CONVERSACION', 'ASIGNADO');

-- CreateTable
CREATE TABLE "CargoAsignacion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "indice" INTEGER NOT NULL DEFAULT 0,
    "estado" "EstadoCargo" NOT NULL DEFAULT 'VACANTE',
    "voterId" TEXT,
    "userId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CargoAsignacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CargoAsignacion_tenantId_cargo_indice_key" ON "CargoAsignacion"("tenantId", "cargo", "indice");

-- AddForeignKey
ALTER TABLE "CargoAsignacion" ADD CONSTRAINT "CargoAsignacion_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Voter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

