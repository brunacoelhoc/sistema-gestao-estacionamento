-- CreateEnum
CREATE TYPE "TipoContrato" AS ENUM ('clt');

-- CreateTable
CREATE TABLE "perfis_rh" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "salarioBase" DECIMAL(10,2) NOT NULL,
    "tipoContrato" "TipoContrato" NOT NULL DEFAULT 'clt',
    "dataAdmissao" TIMESTAMP(3) NOT NULL,
    "dataDemissao" TIMESTAMP(3),
    "diasEscala" INTEGER[],
    "horasPorDia" INTEGER NOT NULL DEFAULT 6,
    "bancoNome" TEXT NOT NULL,
    "agencia" TEXT NOT NULL,
    "contaBancaria" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "perfis_rh_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "perfis_rh_usuarioId_key" ON "perfis_rh"("usuarioId");

-- AddForeignKey
ALTER TABLE "perfis_rh" ADD CONSTRAINT "perfis_rh_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
