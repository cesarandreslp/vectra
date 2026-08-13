-- AlterTable
ALTER TABLE "Actividad" ADD COLUMN     "presupuestoAprobado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "presupuestoAprobadoEn" TIMESTAMP(3),
ADD COLUMN     "presupuestoAprobadoPor" TEXT;
