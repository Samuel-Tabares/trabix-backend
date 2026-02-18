# 🛠️ Configuración Local del Proyecto **TRABIX Backend**

Esta guía te ayuda a levantar el proyecto en local sin sufrir (o al menos sufrir menos 😅).

---

## 📦 Instalación de dependencias

```bash
npm install
```

Instala todas las dependencias del proyecto.

---

## 🐳 Servicios necesarios (PostgreSQL + Redis)

```bash
docker-compose -f docker-compose.test.yml up -d
```

Levanta los contenedores de **PostgreSQL** y **Redis** para el entorno de pruebas.

---

## 🧬 Prisma

### Generar cliente

```bash
npx prisma generate
```

Genera el cliente de Prisma.

### Aplicar migraciones (desarrollo)

```bash
npx prisma migrate dev
```

Aplica las migraciones a la base de datos local.

### Aplicar migraciones (fallback)

```bash
npx prisma migrate deploy
```

Útil si `migrate dev` falla o estás en un entorno más cercano a producción.

### Reset completo de la base de datos ⚠️

```bash
npx prisma migrate reset
```

* Elimina **toda** la base de datos
* Vuelve a aplicar migraciones
* Ejecuta los **seeds** automáticamente

---

## 🏗️ Build del proyecto

```bash
npm run build
```

Y realiza lo siguiente:

* Compila **TypeScript → JavaScript**
* Genera la carpeta **`dist/`** con el código listo para producción

En resumen:

> **Prepara el backend para ejecutarse en producción.**

---

## ✅ Verificación de TypeScript

```bash
npx tsc --noEmit
```

Verifica errores de TypeScript sin generar archivos.

---

## 🗄️ Acceso directo a PostgreSQL

```bash
psql -h localhost -p 5433 -U postgres -d trabix_test
```

**Password:** `testpassword`

### Comandos útiles dentro de psql

```sql
\dt                      -- ver tablas
\d nombre_tabla           -- ver estructura de una tabla
SELECT * FROM nombre_tabla; -- ver datos
```

---

## 🚀 Ejecutar la aplicación

### Desarrollo (hot‑reload)

```bash
npm run start:dev
```

* Levanta el backend en modo desarrollo
* Recarga automáticamente al cambiar archivos

### Producción local

```bash
npm run build
npm run start:prod
```

* Usa el código compilado en **`dist/`**
* Simula cómo correrá en un servidor real

---

## 🌱 Seeds

### Prerrequisito

```bash
npx ts-node prisma/seeds/test-scenarios.seed.ts
```

Este seed se ejecuta automáticamente al hacer `prisma migrate reset`.

---

## 🧪 Tests E2E

### Ejecutar todos los escenarios

```bash
npm run test:e2e -- --testPathPattern=all-scenarios
```

### Ejecutar tests usando `.env.test`

```bash
NODE_ENV=test npx dotenv-cli -e .env.test -- npm run test:e2e -- --testPathPattern=all-scenarios
```

Usa esta opción para forzar conexiones y variables del entorno de test.

---

✨ **Tip final:** si algo explota… revisa primero Docker, luego Prisma, y después respira profundo 🧘‍♂️

swagger: http://localhost:3000/docs
api base: http://localhost:3000/api/v1
ambiente: development