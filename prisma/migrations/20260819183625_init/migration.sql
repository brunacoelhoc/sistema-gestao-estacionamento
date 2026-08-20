-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('admin', 'funcionario');

-- CreateEnum
CREATE TYPE "Provedor" AS ENUM ('local', 'google');

-- CreateEnum
CREATE TYPE "TipoVaga" AS ENUM ('comum', 'coberta', 'mensalista');

-- CreateEnum
CREATE TYPE "StatusVaga" AS ENUM ('livre', 'ocupada');

-- CreateEnum
CREATE TYPE "StatusTicket" AS ENUM ('aberto', 'fechado');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT,
    "email" TEXT NOT NULL,
    "senha" TEXT,
    "telefone" TEXT,
    "endereco" TEXT,
    "dataNascimento" TIMESTAMP(3),
    "avatar" TEXT,
    "role" "Papel" NOT NULL DEFAULT 'funcionario',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "aceitouTermos" BOOLEAN NOT NULL DEFAULT false,
    "provedor" "Provedor" NOT NULL DEFAULT 'local',
    "senhaTemporaria" BOOLEAN NOT NULL DEFAULT false,
    "senhaAlteradaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensalistas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "telefone" TEXT,
    "valorMensalidade" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "mensalistas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vagas" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "TipoVaga" NOT NULL DEFAULT 'comum',
    "status" "StatusVaga" NOT NULL DEFAULT 'livre',

    CONSTRAINT "vagas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarifas" (
    "id" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "valorHora" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "tarifas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "status" "StatusTicket" NOT NULL DEFAULT 'aberto',
    "dataEntrada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataSaida" TIMESTAMP(3),
    "valorTotal" DECIMAL(10,2),
    "formaPagamento" TEXT,
    "vagaId" TEXT NOT NULL,
    "tarifaId" TEXT,
    "mensalistaId" TEXT,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_cpf_key" ON "usuarios"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "mensalistas_cpf_key" ON "mensalistas"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "mensalistas_placa_key" ON "mensalistas"("placa");

-- CreateIndex
CREATE UNIQUE INDEX "vagas_codigo_key" ON "vagas"("codigo");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_vagaId_fkey" FOREIGN KEY ("vagaId") REFERENCES "vagas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_tarifaId_fkey" FOREIGN KEY ("tarifaId") REFERENCES "tarifas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_mensalistaId_fkey" FOREIGN KEY ("mensalistaId") REFERENCES "mensalistas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
