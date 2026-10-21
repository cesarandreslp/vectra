-- CreateEnum
CREATE TYPE "EstadoAgenda" AS ENUM ('REALIZADA', 'INCUMPLIDA', 'CANCELADA');

-- AlterTable
ALTER TABLE "AgendaEntrada" ADD COLUMN     "estado" "EstadoAgenda",
ADD COLUMN     "retrasoMin" INTEGER;
