-- AlterTable
ALTER TABLE "mensalidades" ADD COLUMN     "motivoCancelamento" TEXT;

-- AlterTable
ALTER TABLE "mensalistas" ADD COLUMN     "categoriaPlano" TEXT NOT NULL DEFAULT 'Mensal Integral';
