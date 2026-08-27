-- CreateEnum
CREATE TYPE "StatusDocumentoAssinatura" AS ENUM ('pendente_assinatura', 'assinado');

-- AlterTable
ALTER TABLE "notificacoes" ADD COLUMN     "folhaPontoId" TEXT;

-- CreateTable
CREATE TABLE "folhas_ponto_mensais" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "referencia" TEXT NOT NULL,
    "horasNormais" DECIMAL(6,2) NOT NULL,
    "horasExtras" DECIMAL(6,2) NOT NULL,
    "horasForaEscala" DECIMAL(6,2) NOT NULL,
    "faltas" INTEGER NOT NULL,
    "status" "StatusDocumentoAssinatura" NOT NULL DEFAULT 'pendente_assinatura',
    "geradoPorId" TEXT NOT NULL,
    "geradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assinadoEm" TIMESTAMP(3),

    CONSTRAINT "folhas_ponto_mensais_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "folhas_ponto_mensais_usuarioId_referencia_key" ON "folhas_ponto_mensais"("usuarioId", "referencia");

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_folhaPontoId_fkey" FOREIGN KEY ("folhaPontoId") REFERENCES "folhas_ponto_mensais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folhas_ponto_mensais" ADD CONSTRAINT "folhas_ponto_mensais_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folhas_ponto_mensais" ADD CONSTRAINT "folhas_ponto_mensais_geradoPorId_fkey" FOREIGN KEY ("geradoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
