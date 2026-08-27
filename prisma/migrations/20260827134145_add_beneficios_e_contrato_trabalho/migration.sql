-- CreateEnum
CREATE TYPE "TipoValeTransporte" AS ENUM ('vale_transporte', 'vale_combustivel', 'nenhum');

-- AlterEnum
ALTER TYPE "TipoNotificacao" ADD VALUE 'contrato';

-- AlterTable
ALTER TABLE "notificacoes" ADD COLUMN     "contratoId" TEXT;

-- AlterTable
ALTER TABLE "perfis_rh" ADD COLUMN     "bonusDesempenho" DECIMAL(10,2),
ADD COLUMN     "observacoesBeneficios" TEXT,
ADD COLUMN     "tipoValeTransporte" "TipoValeTransporte" NOT NULL DEFAULT 'nenhum';

-- CreateTable
CREATE TABLE "contratos_trabalho" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "numeroVersao" INTEGER NOT NULL,
    "cargo" TEXT NOT NULL,
    "vagaOrigem" TEXT,
    "tipoContrato" "TipoContrato" NOT NULL,
    "dataAdmissao" TIMESTAMP(3) NOT NULL,
    "diasEscala" INTEGER[],
    "horasPorDia" INTEGER NOT NULL,
    "horaInicioEscala" TEXT NOT NULL,
    "salarioBase" DECIMAL(10,2) NOT NULL,
    "tipoValeTransporte" "TipoValeTransporte" NOT NULL,
    "bonusDesempenho" DECIMAL(10,2),
    "observacoesBeneficios" TEXT,
    "direitos" TEXT,
    "deveres" TEXT,
    "tarefas" TEXT,
    "nomeGestorNoMomento" TEXT,
    "cargoGestorNoMomento" TEXT,
    "status" "StatusDocumentoAssinatura" NOT NULL DEFAULT 'pendente_assinatura',
    "geradoPorId" TEXT NOT NULL,
    "geradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assinadoEm" TIMESTAMP(3),

    CONSTRAINT "contratos_trabalho_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contratos_trabalho_usuarioId_numeroVersao_key" ON "contratos_trabalho"("usuarioId", "numeroVersao");

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos_trabalho"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos_trabalho" ADD CONSTRAINT "contratos_trabalho_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos_trabalho" ADD CONSTRAINT "contratos_trabalho_geradoPorId_fkey" FOREIGN KEY ("geradoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
