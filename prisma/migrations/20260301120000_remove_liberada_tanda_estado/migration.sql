-- Migration: Remove LIBERADA from EstadoTanda enum
-- Tandas LIBERADA transition directly to EN_TRANSITO (no more 2-hour wait)

-- Step 1: Migrate any existing LIBERADA tandas to EN_TRANSITO
UPDATE "tandas"
SET
  estado = 'EN_TRANSITO'::"EstadoTanda",
  "fechaEnTransito" = COALESCE("fechaLiberacion", NOW()),
  version = version + 1
WHERE estado = 'LIBERADA'::"EstadoTanda";

-- Step 2: Drop the default value on the column before changing the type
ALTER TABLE "tandas" ALTER COLUMN "estado" DROP DEFAULT;

-- Step 3: Rename old enum to allow creating the new one
ALTER TYPE "EstadoTanda" RENAME TO "EstadoTanda_old";

-- Step 4: Create new enum without LIBERADA
CREATE TYPE "EstadoTanda" AS ENUM ('INACTIVA', 'EN_TRANSITO', 'EN_CASA', 'FINALIZADA');

-- Step 5: Update the tandas table to use the new enum type
ALTER TABLE "tandas"
  ALTER COLUMN "estado" TYPE "EstadoTanda"
  USING "estado"::text::"EstadoTanda";

-- Step 6: Restore the default value using the new enum type
ALTER TABLE "tandas" ALTER COLUMN "estado" SET DEFAULT 'INACTIVA'::"EstadoTanda";

-- Step 7: Drop the old enum
DROP TYPE "EstadoTanda_old";
