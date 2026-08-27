-- CreateEnum
CREATE TYPE "StatusSolicitacaoExtra" AS ENUM ('pendente', 'aprovada', 'rejeitada');

-- AlterTable
ALTER TABLE "perfis_rh" ADD COLUMN     "horaInicioEscala" TEXT NOT NULL DEFAULT '08:00';

-- CreateTable
CREATE TABLE "registros_ponto" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "horaEntrada" TIMESTAMP(3),
    "horaSaida" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registros_ponto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitacoes_trabalho_extra" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "motivo" TEXT NOT NULL,
    "status" "StatusSolicitacaoExtra" NOT NULL DEFAULT 'pendente',
    "aprovadoPorId" TEXT,
    "aprovadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitacoes_trabalho_extra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "registros_ponto_usuarioId_data_key" ON "registros_ponto"("usuarioId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "solicitacoes_trabalho_extra_usuarioId_data_key" ON "solicitacoes_trabalho_extra"("usuarioId", "data");

-- AddForeignKey
ALTER TABLE "registros_ponto" ADD CONSTRAINT "registros_ponto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_trabalho_extra" ADD CONSTRAINT "solicitacoes_trabalho_extra_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_trabalho_extra" ADD CONSTRAINT "solicitacoes_trabalho_extra_aprovadoPorId_fkey" FOREIGN KEY ("aprovadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
