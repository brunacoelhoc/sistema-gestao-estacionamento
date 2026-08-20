-- CreateEnum
CREATE TYPE "StatusMensalidade" AS ENUM ('pendente', 'paga', 'cancelada');

-- CreateTable
CREATE TABLE "mensalidades" (
    "id" TEXT NOT NULL,
    "mensalistaId" TEXT NOT NULL,
    "referencia" TEXT NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3) NOT NULL,
    "diasCobrados" INTEGER NOT NULL,
    "diasNoMes" INTEGER NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "status" "StatusMensalidade" NOT NULL DEFAULT 'pendente',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensalidades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mensalidades_mensalistaId_referencia_key" ON "mensalidades"("mensalistaId", "referencia");

-- AddForeignKey
ALTER TABLE "mensalidades" ADD CONSTRAINT "mensalidades_mensalistaId_fkey" FOREIGN KEY ("mensalistaId") REFERENCES "mensalistas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
