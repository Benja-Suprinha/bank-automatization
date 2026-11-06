# Bank Automatization

Aplicación personal para registrar y revisar gastos recibidos desde Atajos en iPhone.

El repositorio está separado en dos aplicaciones:

```text
backend/    FastAPI, SQLAlchemy, SQLite y pytest
frontend/   React, TypeScript, Vite y lucide-react
```

## Backend

Requiere Python 3.12 o posterior. Desde la raíz del repositorio:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
notepad backend\.env
```

Configura `backend/.env`:

```env
API_KEY=mi-clave-local
DATABASE_URL=sqlite:///./data/app.db
LOG_LEVEL=INFO
LOG_FILE=data/api.log
```

El backend registra solicitudes con método, ruta, estado y duración; también registra eventos de parsing, duplicados y operaciones CRUD. Los logs se muestran en la terminal y se guardan en `backend/data/api.log`. No registra el body completo de las notificaciones ni la API key. Puedes usar `LOG_LEVEL=DEBUG`, `INFO`, `WARNING` o `ERROR`.

Inicia la API desde `backend/` para que SQLite se cree en `backend/data/app.db`:

```powershell
Set-Location backend
uvicorn app.main:app --reload --access-log --log-level info
```

La API queda disponible en `http://127.0.0.1:8000`. Health check:

```powershell
curl.exe http://127.0.0.1:8000/healthz
```

Ejemplo de notificación:

```bash
curl -X POST http://localhost:8000/api/v1/notifications \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: mi-clave-local' \
  -d '{"source":"cencosud","title":"Aprobamos tu compra","body":"Realizaste una compra por CLP 27,132 en JUMBO ONECLICK el 06/11/26 con tu tarjeta terminada en 2612","received_at":"2026-11-06T09:11:00-03:00","client_event_id":"uuid"}'
```

Endpoints principales:

- `POST /api/v1/notifications`
- `GET /api/v1/notifications?status=unparsed`
- `POST /api/v1/notifications/{id}/reparse`
- `GET /api/v1/transactions`
- `POST /api/v1/transactions`
- `PATCH /api/v1/transactions/{id}`
- `DELETE /api/v1/transactions/{id}`
- `GET /api/v1/transactions/export.csv`
- `GET /healthz`

Todos excepto `/healthz` requieren el header `X-API-Key`.

### Tests del backend

Desde la raíz:

```powershell
python -m pytest backend\tests -q
```

## Frontend

Con el backend corriendo, abre otra terminal desde la raíz:

```powershell
Set-Location frontend
npm install
Copy-Item .env.frontend.example .env
npm run dev
```

Abre `http://127.0.0.1:5173` e introduce la misma API key del backend. El dashboard permite listar, filtrar, crear, editar, borrar y exportar transacciones.

Opcionalmente, `frontend/.env` puede contener:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_API_KEY=mi-clave-local
```

Build de producción:

```powershell
Set-Location frontend
npm run build
```

## Docker

Configura `backend/.env` y ejecuta desde la raíz:

```powershell
docker compose up --build
```

La API se expone en `http://127.0.0.1:8000`. La base persistirá en `backend/data`.
