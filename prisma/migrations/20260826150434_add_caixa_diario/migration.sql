-- CreateEnum
CREATE TYPE "StatusCaixa" AS ENUM ('aberto', 'fechado');

-- CreateTable
CREATE TABLE "caixas_diarios" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "valorAbertura" DECIMAL(10,2) NOT NULL,
    "abertoPorId" TEXT NOT NULL,
    "abertoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valorFechamento" DECIMAL(10,2),
    "valorEsperadoFechamento" DECIMAL(10,2),
    "diferenca" DECIMAL(10,2),
    "fechadoPorId" TEXT,
    "fechadoEm" TIMESTAMP(3),
    "observacoesFechamento" TEXT,
    "status" "StatusCaixa" NOT NULL DEFAULT 'aberto',

    CONSTRAINT "caixas_diarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "caixas_diarios_data_key" ON "caixas_diarios"("data");

-- AddForeignKey
ALTER TABLE "caixas_diarios" ADD CONSTRAINT "caixas_diarios_abertoPorId_fkey" FOREIGN KEY ("abertoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caixas_diarios" ADD CONSTRAINT "caixas_diarios_fechadoPorId_fkey" FOREIGN KEY ("fechadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
