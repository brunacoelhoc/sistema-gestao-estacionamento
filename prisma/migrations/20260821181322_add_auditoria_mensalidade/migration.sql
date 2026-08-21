-- AlterTable
ALTER TABLE "mensalidades" ADD COLUMN     "alteradoEm" TIMESTAMP(3),
ADD COLUMN     "alteradoPorId" TEXT;

-- AddForeignKey
ALTER TABLE "mensalidades" ADD CONSTRAINT "mensalidades_alteradoPorId_fkey" FOREIGN KEY ("alteradoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
