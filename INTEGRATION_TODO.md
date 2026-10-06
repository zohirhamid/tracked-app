# Frontend–Backend Integration

## 1. Confirm and harden the API contract

- [x] Capture an authenticated response from `GET /api/v1/tracker/month/<year>/<month>/`.
- [x] Document the tracker, week, day, and entry response shapes used by the frontend.
- [x] Validate the year and month parameters and return a clear `400` response for invalid values.
- [x] Stop month `GET` requests from creating empty `DailySnapshot` records.
- [x] Remove avoidable per-day entry queries from the month-data builder.
- [x] Add backend tests for 28-, 29-, 30-, and 31-day months and user data isolation.

## 2. Add a frontend API layer

- [x] Move the inline JavaScript from `index.html` into `frontend/app.js`.
- [x] Define one configurable API base URL for local and deployed environments.
- [x] Add a shared `request()` helper with JSON parsing and consistent error handling.
- [x] Send cookies with `credentials: "include"`.
- [x] Use Allauth app-session authentication; cookie-mode CSRF bootstrap is not required.
- [x] Support the Allauth `X-Session-Token` header for protected writes.

## 3. Connect authentication

- [x] Add signed-out, loading, and signed-in application states.
- [x] Build email/password sign-in using the Allauth headless endpoints.
- [x] Add sign-out.
- [x] Handle expired sessions and `401` responses without leaving stale tracker data visible.
- [x] Add Google sign-in when a Google client ID is configured.

## 4. Render the monthly sheet from Django

- [x] Replace `sampleEntries` with `GET /api/v1/tracker/month/<year>/<month>/`.
- [x] Build table columns from the returned active `trackers`, ordered by `display_order`.
- [x] Flatten the returned `weeks` into one correctly ordered list of days.
- [x] Render every day returned by the API and preserve correct weekday labels.
- [x] Format each tracker type: binary, number, time, duration, text, rating, and prayer.
- [x] Keep the first date column and notes/text columns readable at narrow widths.
- [x] Use the backend's previous/next month metadata for navigation.
- [x] Highlight the date returned by the backend as `today`.

## 5. Add loading, empty, and failure states

- [x] Show a pulsing table loading treatment while a month is loading.
- [x] Show an empty-state prompt when the user has no active trackers.
- [x] Show an inline retry message for network or server failures.
- [x] Disable month navigation while a request is pending.
- [x] Prevent stale responses from replacing a newer selected month.

## 6. Connect entry creation and editing

- [x] Open an entry editor from `+ LOG ENTRY` and from a table cell.
- [x] Render the correct input for each tracker type.
- [x] Submit values to `POST /api/v1/tracker/entries/create/`.
- [x] Refresh the edited cell immediately after a successful response.
- [x] Display backend validation errors beside the relevant input.
- [x] Support clearing an entry with `delete_entry: true`.
- [x] Support direct deletion through `DELETE /api/v1/tracker/entries/<id>/delete/`.

## 7. Connect tracker management

- [x] Load all trackers from `GET /api/v1/tracker/trackers/`.
- [x] Create trackers with `POST /api/v1/tracker/trackers/create/`.
- [x] Edit names, types, units, rating bounds, ordering, and active state with `PATCH`.
- [x] Delete trackers only after confirmation.
- [x] Refresh the visible month after tracker changes.

## 8. Monthly summaries

- [x] Define summary rules for each tracker type in the backend.
- [x] Calculate completion rate for binary and prayer trackers.
- [x] Calculate averages for number, rating, time, and duration trackers.
- [x] Report the number of notes for text trackers instead of a numeric average.
- [x] Return summaries in the backend month payload.

## 9. Verification and cleanup

- [x] Test local frontend (`localhost:5173`) against local Django (`localhost:8000`).
- [ ] Verify authentication and CORS in the deployed environment.
- [x] Add frontend tests for formatting and monthly rendering.
- [ ] Add an end-to-end test for sign-in, month loading, entry editing, and month navigation.
- [x] Remove all frontend sample data and unused static rendering code.
- [x] Update the README with commands for running both services together.

## Recommended implementation order

1. API contract and backend read-path fixes.
2. API client and authentication.
3. Read-only monthly sheet.
4. Entry editing.
5. Tracker management.
6. Monthly summaries.
7. Automated tests and deployment verification.
