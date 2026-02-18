-- AddForeignKey
ALTER TABLE "lotes_venta_mayor" ADD CONSTRAINT "lotes_venta_mayor_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuadres" ADD CONSTRAINT "cuadres_cerradoPorCuadreMayorId_fkey" FOREIGN KEY ("cerradoPorCuadreMayorId") REFERENCES "cuadres_mayor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuadres_mayor" ADD CONSTRAINT "cuadres_mayor_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mini_cuadres" ADD CONSTRAINT "mini_cuadres_tandaId_fkey" FOREIGN KEY ("tandaId") REFERENCES "tandas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ganancias_reclutadores" ADD CONSTRAINT "ganancias_reclutadores_reclutadorId_fkey" FOREIGN KEY ("reclutadorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
