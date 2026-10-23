# TRACKED

TRACKED is a Django REST API and React frontend for spreadsheet-style life tracking. Signed-in users can create tracker columns and record typed values against calendar dates.

## Features

- Email/password authentication through Django Allauth
- Authenticated API with shared trackers and entries
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

The tracker data is shared between authenticated users; the current schema does
not assign trackers or entries to individual accounts.

Start the frontend in another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The API is available at
`http://localhost:8000/api/v1/`.

The React frontend reads its API origin from the `api-base-url` meta tag in
`frontend/index.html`. When the tag is empty, local hosts default to port 8000
and deployed builds default to the same origin under `/api/v1`.

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

## Main endpoints

```text
       /api/v1/_allauth/app/v1/auth/
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
