-- CreateEnum
CREATE TYPE "TipoJustificativaPonto" AS ENUM ('atestado', 'abono', 'folga');

-- CreateTable
CREATE TABLE "justificativas_ponto" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "tipo" "TipoJustificativaPonto" NOT NULL,
    "descricao" TEXT,
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "justificativas_ponto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "justificativas_ponto_usuarioId_data_key" ON "justificativas_ponto"("usuarioId", "data");

-- AddForeignKey
ALTER TABLE "justificativas_ponto" ADD CONSTRAINT "justificativas_ponto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "justificativas_ponto" ADD CONSTRAINT "justificativas_ponto_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
