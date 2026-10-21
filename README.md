# TRACKED

TRACKED is a Django REST API and static frontend for spreadsheet-style life tracking. Signed-in users can create shared tracker columns and record typed values against calendar dates.

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
python3 -m http.server 5173
```

Open `http://localhost:5173`. The API is available at
`http://localhost:8000/api/v1/`.

The static frontend reads its API origin from the `api-base-url` meta tag in
`frontend/index.html`. When the tag is empty, local hosts default to port 8000
and deployed builds default to the same origin under `/api/v1`.

## Deployment

The production Django process serves the frontend and collected static files
through WhiteNoise, so no separate frontend server or Node build is required.

From the `backend` directory, collect Django's static files and start Gunicorn:

```bash
python manage.py collectstatic --noinput
gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000}
```

The frontend is available at `/`, the account setup page at `/username.html`,
and the deployment health check at `/health/`.

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
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```
