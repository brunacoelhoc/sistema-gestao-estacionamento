-- AlterTable
ALTER TABLE "mensalidades" ADD COLUMN     "comprovanteAnexo" TEXT,
ADD COLUMN     "comprovanteNomeArquivo" TEXT;

-- AlterTable
ALTER TABLE "mensalistas" ADD COLUMN     "email" TEXT;
