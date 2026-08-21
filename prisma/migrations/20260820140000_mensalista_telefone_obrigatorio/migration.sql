-- Preenche telefones vazios antes de tornar a coluna obrigatória — mensalistas
-- cadastrados antes desta migração podiam não ter telefone informado.
UPDATE "mensalistas" SET "telefone" = '(00) 00000-0000' WHERE "telefone" IS NULL;

-- AlterTable
ALTER TABLE "mensalistas" ALTER COLUMN "telefone" SET NOT NULL;
ALTER TABLE "mensalistas" ADD COLUMN "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
