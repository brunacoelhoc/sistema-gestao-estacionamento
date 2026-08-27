-- CreateEnum
CREATE TYPE "StatusHolerite" AS ENUM ('gerado', 'assinado', 'pago');

-- AlterTable
ALTER TABLE "notificacoes" ADD COLUMN     "holeriteId" TEXT;

-- CreateTable
CREATE TABLE "holerites" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "referencia" TEXT NOT NULL,
    "salarioProporcional" DECIMAL(10,2) NOT NULL,
    "valorHorasExtras" DECIMAL(10,2) NOT NULL,
    "valorHorasForaEscala" DECIMAL(10,2) NOT NULL,
    "valorVr" DECIMAL(10,2) NOT NULL,
    "valorVa" DECIMAL(10,2) NOT NULL,
    "inss" DECIMAL(10,2) NOT NULL,
    "irrf" DECIMAL(10,2) NOT NULL,
    "salarioLiquido" DECIMAL(10,2) NOT NULL,
    "status" "StatusHolerite" NOT NULL DEFAULT 'gerado',
    "geradoPorId" TEXT NOT NULL,
    "geradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assinadoEm" TIMESTAMP(3),
    "pagoEm" TIMESTAMP(3),

    CONSTRAINT "holerites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "holerites_usuarioId_referencia_key" ON "holerites"("usuarioId", "referencia");

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_holeriteId_fkey" FOREIGN KEY ("holeriteId") REFERENCES "holerites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holerites" ADD CONSTRAINT "holerites_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holerites" ADD CONSTRAINT "holerites_geradoPorId_fkey" FOREIGN KEY ("geradoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
