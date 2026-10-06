# TRACKED

TRACKED is a Django REST API for spreadsheet-style life tracking. Users create custom tracker columns and record typed values against calendar dates.

## Features

- Email/password and Google authentication through Django Allauth
- User-owned trackers with configurable ordering and active state
- Binary, number, time, duration, text, rating, and prayer tracker types
- Monthly calendar data grouped into weeks
- Typed entry validation and per-user data isolation
- Django admin for profiles, trackers, daily snapshots, and entries
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
python manage.py create_demo_user
python manage.py runserver
```

Start the frontend in another terminal:

```bash
cd frontend
python3 -m http.server 5173
```

Open `http://localhost:5173`. The API is available at
`http://localhost:8000/api/v1/`.

The demo account is `demo@example.com` with password `london2024`. Its sample
entries are in January 2026.

The static frontend reads its API origin from the `api-base-url` meta tag in
`frontend/index.html`. When the tag is empty, local hosts default to port 8000
and deployed builds default to the same origin under `/api/v1`.

Run the integration-focused backend tests with:

```bash
cd backend
export SECRET_KEY=test-secret
export DJANGO_DEBUG=True
.venv/bin/python manage.py test apps.tracker.test_month_api
```

## Main endpoints

```text
GET    /api/v1/config/public/
GET    /api/v1/auth/csrf/
       /api/v1/_allauth/

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
USE_POSTGRES=False
DATABASE_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```
