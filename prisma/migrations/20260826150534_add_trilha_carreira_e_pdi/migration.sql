-- CreateEnum
CREATE TYPE "StatusItemPdi" AS ENUM ('pendente', 'concluido');

-- AlterTable
ALTER TABLE "perfis_rh" ADD COLUMN     "deveres" TEXT,
ADD COLUMN     "direitos" TEXT,
ADD COLUMN     "etapaCarreiraAtualId" TEXT,
ADD COLUMN     "tarefas" TEXT;

-- CreateTable
CREATE TABLE "etapas_carreira" (
    "id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "faixaSalarial" TEXT,
    "descricao" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "etapas_carreira_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_pdi" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "status" "StatusItemPdi" NOT NULL DEFAULT 'pendente',
    "concluidoEm" TIMESTAMP(3),
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "itens_pdi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "etapas_carreira_ordem_key" ON "etapas_carreira"("ordem");

-- CreateIndex
CREATE INDEX "itens_pdi_usuarioId_idx" ON "itens_pdi"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "itens_pdi_usuarioId_ordem_key" ON "itens_pdi"("usuarioId", "ordem");

-- AddForeignKey
ALTER TABLE "perfis_rh" ADD CONSTRAINT "perfis_rh_etapaCarreiraAtualId_fkey" FOREIGN KEY ("etapaCarreiraAtualId") REFERENCES "etapas_carreira"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_pdi" ADD CONSTRAINT "itens_pdi_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_pdi" ADD CONSTRAINT "itens_pdi_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
