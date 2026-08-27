-- CreateTable
CREATE TABLE "assinaturas_eletronicas" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "imagemDataUri" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assinaturas_eletronicas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assinaturas_eletronicas_usuarioId_key" ON "assinaturas_eletronicas"("usuarioId");

-- AddForeignKey
ALTER TABLE "assinaturas_eletronicas" ADD CONSTRAINT "assinaturas_eletronicas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
