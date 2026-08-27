-- AlterEnum
ALTER TYPE "TipoContrato" ADD VALUE 'pj';

-- AlterTable
ALTER TABLE "perfis_rh" ADD COLUMN     "gestorId" TEXT,
ADD COLUMN     "vagaOrigem" TEXT;

-- AddForeignKey
ALTER TABLE "perfis_rh" ADD CONSTRAINT "perfis_rh_gestorId_fkey" FOREIGN KEY ("gestorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
