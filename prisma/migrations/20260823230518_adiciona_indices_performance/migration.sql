-- CreateIndex
CREATE INDEX "mensalidades_mensalistaId_dataFim_idx" ON "mensalidades"("mensalistaId", "dataFim");

-- CreateIndex
CREATE INDEX "mensalidades_status_referencia_idx" ON "mensalidades"("status", "referencia");

-- CreateIndex
CREATE INDEX "tickets_status_dataEntrada_idx" ON "tickets"("status", "dataEntrada");

-- CreateIndex
CREATE INDEX "tickets_placa_status_idx" ON "tickets"("placa", "status");

-- CreateIndex
CREATE INDEX "tickets_vagaId_idx" ON "tickets"("vagaId");

-- CreateIndex
CREATE INDEX "tickets_mensalistaId_idx" ON "tickets"("mensalistaId");
