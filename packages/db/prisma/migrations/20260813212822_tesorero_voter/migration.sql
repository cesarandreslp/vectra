/*
  Warnings:

  - You are about to drop the column `cargoPostulado` on the `FinanceConfig` table. All the data in the column will be lost.
  - You are about to drop the column `cedulaTesorero` on the `FinanceConfig` table. All the data in the column will be lost.
  - You are about to drop the column `municipio` on the `FinanceConfig` table. All the data in the column will be lost.
  - You are about to drop the column `nombreTesorero` on the `FinanceConfig` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "FinanceConfig" DROP COLUMN "cargoPostulado",
DROP COLUMN "cedulaTesorero",
DROP COLUMN "municipio",
DROP COLUMN "nombreTesorero",
ADD COLUMN     "tesoreroId" TEXT;

-- AddForeignKey
ALTER TABLE "FinanceConfig" ADD CONSTRAINT "FinanceConfig_tesoreroId_fkey" FOREIGN KEY ("tesoreroId") REFERENCES "Voter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
