-- CreateTable
CREATE TABLE "eventos_uso" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tela" TEXT NOT NULL,
    "duracaoMs" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_uso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "eventos_uso_tela_idx" ON "eventos_uso"("tela");

-- CreateIndex
CREATE INDEX "eventos_uso_criadoEm_idx" ON "eventos_uso"("criadoEm");
