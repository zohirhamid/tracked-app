# API contract

All application endpoints are rooted at `/api/v1`. Protected requests use the
Allauth headless app session returned as `meta.session_token` and send it back
in the `X-Session-Token` header.

## Authentication

- `POST /_allauth/app/v1/auth/login` — `{ "email": string, "password": string }`
- `POST /_allauth/app/v1/auth/signup` — `{ "email": string, "password": string }`
- `GET /_allauth/app/v1/auth/session` — returns the current user in `data.user`
- `DELETE /_allauth/app/v1/auth/session` — signs out
- `POST /_allauth/app/v1/auth/provider/token` — exchanges a Google ID token

## Month view

`GET /tracker/month/<year>/<month>/`

```json
{
  "trackers": [
    {
      "id": 1,
      "name": "Mood",
      "tracker_type": "rating",
      "unit": null,
      "display_order": 1,
      "is_active": true,
      "min_value": 1,
      "max_value": 5
    }
  ],
  "weeks": [
    [
      {
        "date": "2026-10-01",
        "day": 1,
        "entries": {
          "1": {
            "id": 10,
            "tracker": 1,
            "rating_value": 4
          }
        }
      }
    ]
  ],
  "summaries": [
    {
      "tracker_id": 1,
      "tracker_type": "rating",
      "count": 1,
      "value": 4.0,
      "display": "4.0/5"
    }
  ],
  "month_name": "October",
  "total_days": 31,
  "today": "2026-10-06",
  "prev_year": 2026,
  "prev_month": 9,
  "next_year": 2026,
  "next_month": 11
}
```

`entries` is keyed by tracker ID. A month read never creates snapshots or
entries. Tracker types are `binary`, `number`, `time`, `duration`, `text`,
`rating`, and `prayer`.

Summary rules are type-specific: binary and prayer values return completion
percentages; number, rating, time, and duration values return arithmetic
averages; text trackers return the number of non-empty notes. Each summary also
includes the number of entry records considered for that tracker.

## Entry upsert

`POST /tracker/entries/create/` accepts `tracker_id`, an ISO `date`, and the
field matching the tracker type:

- `binary_value`: boolean
- `number_value`: number
- `time_value`: `HH:MM`
- `duration_minutes`: integer
- `text_value`: string
- `rating_value`: integer
- `prayer_values`: object containing `fajr`, `dhuhr`, `asr`, `maghrib`, `isha`

Send `delete_entry: true` with `tracker_id` and `date` to clear a cell.

## Tracker management

- `GET /tracker/trackers/`
- `POST /tracker/trackers/create/`
- `PATCH /tracker/trackers/<id>/`
- `DELETE /tracker/trackers/<id>/delete/`

Tracker writes accept `name`, `tracker_type`, `unit`, `display_order`,
`is_active`, `min_value`, and `max_value`.
