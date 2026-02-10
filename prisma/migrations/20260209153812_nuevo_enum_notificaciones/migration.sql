-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoNotificacion" ADD VALUE 'LOTE_ACTIVADO';
ALTER TYPE "TipoNotificacion" ADD VALUE 'LOTE_FINALIZADO';
ALTER TYPE "TipoNotificacion" ADD VALUE 'EQUIPAMIENTO_SOLICITADO';
ALTER TYPE "TipoNotificacion" ADD VALUE 'EQUIPAMIENTO_ENTREGADO';
ALTER TYPE "TipoNotificacion" ADD VALUE 'FONDO_EGRESO';

-- CreateIndex
CREATE INDEX "notificaciones_usuarioId_leida_idx" ON "notificaciones"("usuarioId", "leida");

-- CreateIndex
CREATE INDEX "notificaciones_fechaCreacion_idx" ON "notificaciones"("fechaCreacion");

-- CreateIndex
CREATE INDEX "notificaciones_usuarioId_fechaCreacion_idx" ON "notificaciones"("usuarioId", "fechaCreacion");
