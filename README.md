# TRACKED

TRACKED is a Django REST API and React frontend for spreadsheet-style life tracking. Signed-in users can create tracker columns and record typed values against calendar dates.

## Features

- Email/password authentication through Django Allauth
- Authenticated API with private per-user trackers and entries
- Trackers with configurable ordering and active state
- Binary, number, time, duration, text, rating, and prayer tracker types
- Monthly calendar data grouped into weeks
- Typed entry validation
- SQLite for local development or PostgreSQL through `DATABASE_URL`

## Local setup

Start the API in one terminal:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export SECRET_KEY=development-secret
export DJANGO_DEBUG=True
python manage.py migrate
python manage.py runserver
```

Tracker data is private to each authenticated account.

Start the frontend in another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The API is available at
`http://localhost:8000/api/v1/`.

Run the automated checks from their respective application directories:

```bash
cd backend && .venv/bin/python manage.py test
cd ../frontend && npm test && npm run build
```

The browser journey uses an isolated temporary SQLite database and starts both
local services automatically:

```bash
cd frontend
npx playwright install chromium
npm run test:e2e
```

To smoke-test an already deployed staging environment, set `E2E_BASE_URL`.
The suite creates a unique account and tracker, so do not point it at production
unless disposable test accounts are acceptable:

```bash
E2E_BASE_URL=https://staging.example.com npm run test:e2e
```

The React frontend reads its API base path from the `api-base-url` meta tag in
`frontend/index.html`. In production, the frontend server proxies `/api` and
`/accounts` to Django so authentication cookies remain first-party. When the
page is running on a local host, the frontend calls the local API on port 8000.

## Deployment

Build the React frontend before starting the production Django process. Django
serves the compiled `frontend/dist` files through WhiteNoise, so no separate
frontend server is required at runtime.

From the repository root, build the frontend, then collect Django's static files
and start Gunicorn:

```bash
cd frontend
npm ci
npm run build
cd ../backend
python manage.py collectstatic --noinput
gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000}
```

The frontend is available at `/`; account setup is handled inside the React app.
The deployment health check remains available at `/health/`.

### Ownership migration backup gate

Migration `0014_add_per_user_ownership` preserves existing shared tracker data
under one account. Before deploying it to PostgreSQL:

1. Create a database backup using Railway's backup facility or `pg_dump`.
2. Restore that backup into a separate PostgreSQL database and confirm the
   expected user, tracker, snapshot, and entry counts.
3. Set `TRACKER_LEGACY_OWNER_EMAIL` to the account that should receive the
   formerly shared records.
4. Set `TRACKER_OWNERSHIP_BACKUP_VERIFIED=true` only after the restore check.

The migration refuses to run on PostgreSQL when tracking data exists and the
backup-verification flag is absent. After deployment, compare the record counts
again and remove `TRACKER_OWNERSHIP_BACKUP_VERIFIED` from the service.

For the separate Railway services, use these origins:

```text
Frontend: https://frontend-production-9e32.up.railway.app
Backend:  https://tracked-app-production-8314.up.railway.app
```

Set `FRONTEND_URL=https://frontend-production-9e32.up.railway.app` on the
backend Railway service. Optionally set `BACKEND_URL` to the backend origin on
the frontend Railway service; it defaults to the production backend above. The
frontend origin is included in Django's CSRF trusted-origin settings. In Google
Cloud Console, register the callback on the public frontend origin because the
`/accounts` path is proxied to Django (including the trailing slash):

```text
https://frontend-production-9e32.up.railway.app/accounts/google/login/callback/
```

If the custom frontend domain is enabled, register its callback too:

```text
https://tracked.zohirhamid.com/accounts/google/login/callback/
```

## Main endpoints

```text
       /api/v1/_allauth/app/v1/auth/
GET    /api/v1/auth/csrf/
GET    /api/v1/tracker/profile/username/
POST   /api/v1/tracker/profile/username/
GET    /api/v1/tracker/month/<year>/<month>/
GET    /api/v1/tracker/trackers/
POST   /api/v1/tracker/trackers/create/
PATCH  /api/v1/tracker/trackers/<id>/
DELETE /api/v1/tracker/trackers/<id>/delete/
POST   /api/v1/tracker/entries/create/
DELETE /api/v1/tracker/entries/<id>/delete/
```

## Environment

```text
SECRET_KEY=
DJANGO_DEBUG=True
COOKIE_SECURE=False
DATABASE_URL=
FRONTEND_URL=http://localhost:5173
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Google credentials can come from `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
or from a Google `SocialApp` assigned to Django Site ID 1. Use one source per
deployment; when the environment pair is absent, Allauth falls back to the
database record. Register the backend callback URLs, including
`http://localhost:8000/accounts/google/login/callback/` for local development
and `https://tracked.zohirhamid.com/accounts/google/login/callback/` in
production. Django Allauth owns the OAuth redirect and callback; the client
secret remains server-side.
