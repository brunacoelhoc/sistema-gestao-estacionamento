-- AlterEnum
ALTER TYPE "Papel" ADD VALUE 'gestor';

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "atendidoPorId" TEXT;

-- CreateIndex
CREATE INDEX "tickets_atendidoPorId_status_idx" ON "tickets"("atendidoPorId", "status");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_atendidoPorId_fkey" FOREIGN KEY ("atendidoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
