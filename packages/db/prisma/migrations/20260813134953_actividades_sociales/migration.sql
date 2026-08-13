-- CreateEnum
CREATE TYPE "ActividadEstado" AS ENUM ('PLANEADA', 'EN_CURSO', 'REALIZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "InsumoTipo" AS ENUM ('ALIMENTACION', 'INSUMO', 'MATERIAL', 'HERRAMIENTA');

-- CreateEnum
CREATE TYPE "InsumoEstado" AS ENUM ('REQUERIDO', 'APROBADO', 'CONSEGUIDO');

-- AlterTable
ALTER TABLE "Voter" ADD COLUMN     "esSimpatizante" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Actividad" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT,
    "descripcion" TEXT,
    "fecha" TIMESTAMP(3),
    "estado" "ActividadEstado" NOT NULL DEFAULT 'PLANEADA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Actividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrupoActividad" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actividadId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "lugar" TEXT,
    "responsableId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrupoActividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiembroGrupo" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,

    CONSTRAINT "MiembroGrupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsumoGrupo" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "tipo" "InsumoTipo" NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "costoEstimado" DOUBLE PRECISION,
    "estado" "InsumoEstado" NOT NULL DEFAULT 'REQUERIDO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsumoGrupo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Actividad_tenantId_fecha_idx" ON "Actividad"("tenantId", "fecha");

-- CreateIndex
CREATE INDEX "Actividad_tenantId_estado_idx" ON "Actividad"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "GrupoActividad_tenantId_actividadId_idx" ON "GrupoActividad"("tenantId", "actividadId");

-- CreateIndex
CREATE INDEX "MiembroGrupo_tenantId_voterId_idx" ON "MiembroGrupo"("tenantId", "voterId");

-- CreateIndex
CREATE UNIQUE INDEX "MiembroGrupo_grupoId_voterId_key" ON "MiembroGrupo"("grupoId", "voterId");

-- CreateIndex
CREATE INDEX "InsumoGrupo_tenantId_grupoId_idx" ON "InsumoGrupo"("tenantId", "grupoId");

-- AddForeignKey
ALTER TABLE "GrupoActividad" ADD CONSTRAINT "GrupoActividad_actividadId_fkey" FOREIGN KEY ("actividadId") REFERENCES "Actividad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrupoActividad" ADD CONSTRAINT "GrupoActividad_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Voter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiembroGrupo" ADD CONSTRAINT "MiembroGrupo_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "GrupoActividad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiembroGrupo" ADD CONSTRAINT "MiembroGrupo_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Voter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsumoGrupo" ADD CONSTRAINT "InsumoGrupo_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "GrupoActividad"("id") ON DELETE CASCADE ON UPDATE CASCADE;
