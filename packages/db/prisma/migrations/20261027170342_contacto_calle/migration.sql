-- CreateEnum
CREATE TYPE "TemperaturaContacto" AS ENUM ('FRIO', 'TIBIO', 'CALIENTE');

-- CreateEnum
CREATE TYPE "EstadoContactoCalle" AS ENUM ('PENDIENTE', 'INVITADO', 'CONVERTIDO', 'DESCARTADO');

-- CreateTable
CREATE TABLE "ContactoCalle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "anfitrionId" TEXT NOT NULL,
    "registradoPorId" TEXT,
    "nombre" TEXT,
    "telefono" TEXT,
    "telefonoHash" TEXT,
    "temperatura" "TemperaturaContacto",
    "nota" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "neighborhoodId" TEXT,
    "communeId" TEXT,
    "asignadoAId" TEXT,
    "estado" "EstadoContactoCalle" NOT NULL DEFAULT 'PENDIENTE',
    "voterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactoCalle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactoCalle_tenantId_fecha_idx" ON "ContactoCalle"("tenantId", "fecha");

-- CreateIndex
CREATE INDEX "ContactoCalle_tenantId_asignadoAId_estado_idx" ON "ContactoCalle"("tenantId", "asignadoAId", "estado");

-- CreateIndex
CREATE INDEX "ContactoCalle_tenantId_telefonoHash_idx" ON "ContactoCalle"("tenantId", "telefonoHash");
