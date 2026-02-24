-- CreateEnum
CREATE TYPE "TipoAbonoEquipamiento" AS ENUM ('DANO', 'PERDIDA', 'MENSUALIDAD');

-- CreateTable
CREATE TABLE "abonos_equipamiento" (
    "id" TEXT NOT NULL,
    "equipamientoId" TEXT NOT NULL,
    "tipo" "TipoAbonoEquipamiento" NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "cuadreId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "abonos_equipamiento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "abonos_equipamiento_equipamientoId_fecha_idx" ON "abonos_equipamiento"("equipamientoId", "fecha");

-- AddForeignKey
ALTER TABLE "abonos_equipamiento" ADD CONSTRAINT "abonos_equipamiento_equipamientoId_fkey" FOREIGN KEY ("equipamientoId") REFERENCES "equipamientos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abonos_equipamiento" ADD CONSTRAINT "abonos_equipamiento_cuadreId_fkey" FOREIGN KEY ("cuadreId") REFERENCES "cuadres"("id") ON DELETE SET NULL ON UPDATE CASCADE;
