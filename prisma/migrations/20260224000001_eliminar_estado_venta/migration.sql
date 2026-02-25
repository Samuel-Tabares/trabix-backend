-- Migration: Eliminar estado y fechaValidacion de Venta
-- Las ventas ahora se confirman automáticamente al registrarse

-- Eliminar el índice compuesto que incluía estado
DROP INDEX IF EXISTS "ventas_vendedorId_estado_idx";

-- Eliminar columnas de estado y fecha de validación
ALTER TABLE "ventas" DROP COLUMN IF EXISTS "estado";
ALTER TABLE "ventas" DROP COLUMN IF EXISTS "fechaValidacion";

-- Crear nuevo índice sin estado
CREATE INDEX IF NOT EXISTS "ventas_vendedorId_idx" ON "ventas"("vendedorId");

-- Eliminar el enum (solo si ya no está en uso)
DROP TYPE IF EXISTS "EstadoVenta";
