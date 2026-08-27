-- CreateEnum
CREATE TYPE "StatusFerias" AS ENUM ('pendente', 'aprovada', 'rejeitada');

-- CreateTable
CREATE TABLE "solicitacoes_ferias" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "dataInicio" DATE NOT NULL,
    "dataFim" DATE NOT NULL,
    "dias" INTEGER NOT NULL,
    "status" "StatusFerias" NOT NULL DEFAULT 'pendente',
    "decididoPorId" TEXT,
    "decididoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitacoes_ferias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solicitacoes_ferias_usuarioId_idx" ON "solicitacoes_ferias"("usuarioId");

-- AddForeignKey
ALTER TABLE "solicitacoes_ferias" ADD CONSTRAINT "solicitacoes_ferias_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_ferias" ADD CONSTRAINT "solicitacoes_ferias_decididoPorId_fkey" FOREIGN KEY ("decididoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
