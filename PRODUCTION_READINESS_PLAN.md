# TRACKED Production Readiness & 100+ User Launch Plan

**Document type:** Production readiness action plan  
**Baseline date:** 31 October 2026  
**Target:** Safely support the first 100+ registered users under normal daily usage  
**Current recommendation:** Suitable for a controlled beta after the P0 launch gates below are complete; not yet ready for an unrestricted public launch.

## 1. Purpose

This plan turns the current readiness review into a sequence of concrete engineering, operational, security, and product actions. It is intended to be the single checklist used to decide whether TRACKED is ready to accept real user data.

This plan distinguishes between:

- **100 registered users:** a modest workload that the current Django/React architecture should handle comfortably when deployed with PostgreSQL and sensible process settings.
- **100 simultaneously active users:** a materially higher load that has not yet been demonstrated and is not the initial launch target.

The initial capacity target used throughout this document is:

- 100–250 registered users.
- Up to 25 concurrently active users during a short peak.
- Up to 20 trackers per typical user.
- Daily use, including month reads, tracker edits, and entry creation.
- No data loss during ordinary deploys, restarts, or a single application-instance failure.

## 2. How to use this plan

Priority definitions:

- **P0 — launch gate:** Must be complete before inviting 100 users.
- **P1 — early production:** Strongly recommended before launch; if deferred, record who accepted the risk and the completion date.
- **P2 — improvement:** Can follow after the first users if the system is monitored and stable.

Status definitions:

- `[ ]` Not started.
- `[~]` In progress or partially implemented.
- `[x]` Complete and verified with evidence.

Every completed P0 item should have evidence: a passing automated test, screenshot, monitoring link, restore log, deployment setting, or written runbook.

## 3. Current readiness summary

### Already working

- [x] Live frontend and backend respond over HTTPS.
- [x] Railway redirects HTTP traffic to HTTPS.
- [x] Live Google OAuth reaches a valid Google sign-in page and uses the custom-domain callback.
- [x] Live CORS accepts the documented frontend origin and `X-Session-Token` header.
- [x] Per-user tracker and entry isolation is covered by backend tests.
- [x] CSRF behavior is covered for browser sessions.
- [x] Backend migrations are currently in sync with models.
- [x] Backend test suite passes: 17 tests at the readiness baseline.
- [x] Frontend unit suite passes: 14 tests at the readiness baseline.
- [x] Production frontend bundle builds successfully.
- [x] Desktop email/password journey and mobile logging journey pass locally.

### Known launch gaps

- [ ] The current `main` GitHub Actions run is failing in the browser journey.
- [ ] Email/password accounts accept weak passwords because no Django password validators are configured.
- [ ] Email ownership verification is disabled.
- [ ] Users do not have a usable password-reset journey.
- [ ] Production can silently fall back to SQLite when `DATABASE_URL` is absent.
- [ ] Ongoing database backups and a verified restore process are not evidenced.
- [ ] Error tracking, useful readiness checks, and alerting are not in place.
- [ ] There is no privacy notice, account deletion workflow, or user-data export.
- [ ] No staging load test has demonstrated the target workload.
- [ ] `npm audit --omit=dev` reports two moderate vulnerabilities through `serve-handler`/`minimatch`.
- [ ] HSTS and a Content Security Policy are not present on live responses.

## 4. Recommended delivery sequence

For a solo builder, the remaining P0/P1 work is approximately **7–12 focused engineering days**, excluding delays for DNS/email-provider verification or policy review. This is an estimate, not a deadline.

| Phase | Outcome | Priority | Indicative effort |
|---|---|---:|---:|
| 1 | Restore a trustworthy green release pipeline | P0 | 0.5–1 day |
| 2 | Make accounts secure and recoverable | P0 | 1.5–3 days |
| 3 | Prove database durability and safe deploys | P0 | 1–2 days |
| 4 | Add production visibility and incident basics | P0 | 1–2 days |
| 5 | Set privacy and user-control minimums | P0/P1 | 1–2 days |
| 6 | Prove performance for the target workload | P0 | 1–2 days |
| 7 | Harden the public edge and dependencies | P1 | 1–2 days |
| 8 | Staged launch and observation | P0 | 2–7 elapsed days |

Phases 1–5 can overlap where there are no dependencies. Do not run the final load test until the production-like staging database, process count, and cache are configured.

## 5. Phase 1 — trustworthy release pipeline

**Goal:** No release is considered deployable unless the same commit has passed all automated checks.

### P0 actions

- [ ] Fix the Google OAuth end-to-end assertion.
  - Capture the outbound `accounts.google.com/o/oauth2/...` request or Django's original `302 Location` header.
  - Assert its `client_id` exists and its `redirect_uri` ends in `/accounts/google/login/callback/`.
  - Do not inspect the final Google page URL; Google may redirect to an error or login page that no longer includes the original query parameters.
  - Keep the local fake OAuth client so CI never requires a real Google secret.
- [ ] Run the full suite locally and in GitHub Actions.
- [ ] Require the CI job to pass before merging to `main`.
- [ ] Confirm Railway deploys only the intended commit and exposes that commit identifier in deployment metadata or logs.
- [ ] Add a post-deploy smoke job against staging, not production.
  - Check frontend load.
  - Check `/api/health/`.
  - Create a disposable account.
  - Create a tracker and entry.
  - Sign out and sign back in.
  - Verify Google provider redirect without completing Google authentication.
- [ ] Ensure staging test data is deleted or the staging database is periodically reset.

### Exit criteria

- The latest `main` commit has a green GitHub Actions run.
- Railway reports successful frontend and backend deployments for that same commit.
- A production-like staging smoke test passes from outside the Railway network.

## 6. Phase 2 — secure and recoverable accounts

**Goal:** A user cannot accidentally choose a trivially weak password, lose access permanently, or register another person's email without a deliberate product decision.

### Decide the launch authentication policy

Choose and document one of these options:

- [ ] **Recommended: Google plus verified email/password.** Configure transactional email, verification, and password reset before launch.
- [ ] **Temporary fallback: Google-only beta.** Hide email/password signup until verified email and password recovery are complete. Existing email users need a documented support route.

Do not leave public, unverified email signup enabled without a recovery mechanism.

### P0 actions for email/password accounts

- [ ] Configure Django password validators.
  - Minimum length of at least 10–12 characters.
  - Reject common passwords.
  - Reject entirely numeric passwords.
  - Reject passwords too similar to account attributes.
- [ ] Add frontend password guidance and show backend validation messages clearly.
- [ ] Add tests proving passwords such as `123456`, `password`, and the user's email are rejected.
- [ ] Select and configure a transactional email provider.
  - Store credentials only in Railway secrets.
  - Configure sender domain, SPF, DKIM, and DMARC.
  - Use a monitored sender/reply-to address.
- [ ] Change Allauth email verification from `none` to `mandatory` or a deliberately chosen verified-by-code flow.
- [ ] Build the password-reset request and completion UI.
- [ ] Test password reset end to end using staging email delivery.
- [ ] Test expired, reused, malformed, and already-consumed reset links.
- [ ] Prevent account enumeration in signup, login, and password-reset responses.
- [ ] Confirm Google sign-in and email/password sign-in for the same verified email resolve to the intended account.

### Rate limiting and sessions

- [ ] Make Allauth rate limits explicit in settings rather than relying only on library defaults.
- [ ] Configure a shared Redis-backed Django cache so rate limits work consistently across multiple Gunicorn workers or instances.
- [ ] Cover at least signup, login, failed login, password reset, and verification resend.
- [ ] Add application-level throttles or quotas for tracker creation and entry writes.
- [ ] Decide whether app-session tokens should remain in `localStorage`.
  - Preferred long-term direction: same-origin, `HttpOnly`, secure session cookies.
  - If retaining local storage, a strict CSP and XSS review become higher priority.
- [ ] Verify logout invalidates the server-side credential, not only local browser state.

### Exit criteria

- Weak-password tests fail safely.
- A new email user must prove email ownership before normal use.
- A user can reset a forgotten password from the public UI.
- Authentication abuse receives `429` responses at documented thresholds.
- Google and email sign-in are verified on staging and production.

## 7. Phase 3 — database durability and safe deploys

**Goal:** User data survives deploys, restarts, configuration mistakes, and a recoverable database incident.

### P0 actions

- [ ] Confirm the live backend is using PostgreSQL.
  - Record the Railway database service name and region.
  - Record how the application receives `DATABASE_URL`.
  - Verify the database is persistent across an application redeploy.
- [ ] Change production startup to fail fast when `DATABASE_URL` is missing.
  - SQLite fallback should remain available only when `DJANGO_DEBUG=True` or an explicit local-development flag is set.
- [ ] Configure automated PostgreSQL backups.
  - Recommended initial policy: daily backups, at least seven daily restore points, and longer retention as the user base grows.
  - Confirm backups are stored independently of the application filesystem.
- [ ] Perform and document a restore drill into a separate database.
  - Restore the latest backup.
  - Compare user, tracker, snapshot, and entry counts.
  - Open the restored app and verify a representative user journey.
  - Record duration and any manual steps.
- [ ] Create a short migration runbook.
  - Backup before destructive or ownership-changing migrations.
  - Run `manage.py migrate` as a controlled release step.
  - Confirm migrations before sending normal traffic to a new release.
  - Define rollback behavior when code can roll back but schema cannot.
- [ ] Remove or rotate obsolete migration-only environment flags after successful use.
- [ ] Verify `SECRET_KEY`, database credentials, OAuth secrets, and email credentials exist only in the deployment secret store.

### Data-integrity improvements

- [ ] Add tests for concurrent writes to the same tracker/date cell.
- [ ] Ensure an entry's user always agrees with its tracker and daily snapshot owner.
- [ ] Avoid creating empty `DailySnapshot` rows when clearing a cell that does not exist.
- [ ] Set reasonable product limits.
  - Maximum trackers per account.
  - Maximum note length.
  - Maximum group/name/unit lengths already enforced by the model should be mirrored in the UI.
  - Maximum accepted request body size at the proxy and Django edge.
- [ ] Define whether users may create entries arbitrarily far in the past or future.

### Exit criteria

- Production cannot boot with SQLite accidentally.
- Automated backups are visible and current.
- A backup has been restored and validated successfully.
- Migration and rollback steps are documented well enough to follow during an incident.

## 8. Phase 4 — observability, health, and incident response

**Goal:** The operator learns about failures before multiple users report them and has enough context to diagnose them.

### P0 actions

- [ ] Add an application error tracker such as Sentry or an equivalent service.
  - Capture backend exceptions.
  - Capture frontend runtime errors and failed API requests without recording sensitive entry contents.
  - Include release/commit identifier and environment.
  - Scrub passwords, session tokens, cookies, OAuth values, emails where appropriate, and user-entered tracker data.
- [ ] Create two health concepts.
  - **Liveness:** process is running.
  - **Readiness:** application can query the database and required configuration is present.
- [ ] Ensure the custom-domain health-monitor URL reaches the backend check rather than the frontend SPA fallback.
- [ ] Configure external uptime checks for:
  - Public frontend.
  - Backend readiness endpoint.
  - Authentication public configuration endpoint.
- [ ] Configure alerts for:
  - Sustained 5xx responses.
  - Readiness failures.
  - Elevated response latency.
  - Database connection failures.
  - Backup failures.
- [ ] Add structured logs with timestamp, severity, request ID, route, status, duration, and release identifier.
- [ ] Do not log passwords, tokens, cookies, OAuth secrets, or entry text.
- [ ] Write a one-page incident runbook.
  - How to identify the affected release.
  - How to pause invites.
  - How to roll back application code.
  - How to restore the database.
  - How to communicate with affected users.

### Initial service objectives

Use these as operating targets, not contractual guarantees:

- Availability: at least 99.5% during the beta.
- Server error rate: below 1% over a rolling 15-minute window.
- Month-view p95: below 750 ms at the backend under the target staging load.
- Entry-write p95: below 500 ms at the backend under the target staging load.
- Error alerts delivered within five minutes.
- Recovery point objective: no more than 24 hours once daily backups are enabled; improve later if needed.

### Exit criteria

- A deliberately triggered staging exception appears in error tracking with the correct release.
- An unavailable staging database makes readiness fail and generates an alert.
- Logs can trace one request across frontend proxy and backend without exposing sensitive data.

## 9. Phase 5 — privacy, user control, and support

**Goal:** Users understand what is stored and have a practical way to control or remove their data.

TRACKED can hold sensitive personal information, including wellbeing notes and religious-practice data. Obtain appropriate legal review for the jurisdictions in which the product will be offered; this checklist is a product/engineering baseline, not legal advice.

### P0 before a public launch

- [ ] Publish a plain-language privacy notice linked from signup and the footer.
  - Data collected.
  - Purpose of collection.
  - Hosting and important processors.
  - Retention approach.
  - User rights/contact route.
  - Security and breach-contact information.
- [ ] Publish terms of service or beta terms appropriate to the launch.
- [ ] Add a monitored support email or support form.
- [ ] Add an authenticated account-deletion workflow.
  - Require recent authentication or clear confirmation.
  - Explain what is deleted and when.
  - Delete or anonymize trackers, snapshots, entries, sessions, and connected identities consistently.
  - Test that cascading deletion removes private data.
- [ ] Define a manual fallback for deletion requests while the automated flow is being built.
- [ ] Document incident/user-notification ownership.

### P1 actions

- [ ] Add a user-data export in a portable format such as CSV plus JSON metadata.
- [ ] Document retention for inactive accounts, logs, backups, and deleted-account backups.
- [ ] Add an account page showing email, username, connected login methods, and deletion/export actions.
- [ ] Add a concise explanation that TRACKED is a personal reflection tool, not medical advice.

### Exit criteria

- Privacy and terms links are visible before account creation.
- A user can request support and delete their account.
- A test deletion proves another user cannot access any deleted data and the deleted user cannot authenticate.

## 10. Phase 6 — capacity and performance proof

**Goal:** Demonstrate that the deployed configuration can handle the expected first-user workload with acceptable latency and error rates.

### Production configuration

- [ ] Run at least two Gunicorn workers if the Railway service resources permit it.
- [ ] Make worker count configurable through `WEB_CONCURRENCY` or an equivalent setting.
- [ ] Set and document request timeout, graceful shutdown timeout, and worker recycling behavior.
- [ ] Confirm database connection counts remain below the PostgreSQL plan limit.
- [ ] Add timeouts to the frontend proxy's backend requests.
- [ ] Set request and response body limits so one request cannot consume unbounded memory.
- [ ] Confirm static assets have sensible cache headers and fingerprinted filenames.

### Staging dataset

- [ ] Create a repeatable seed command for performance testing.
- [ ] Seed at least:
  - 100 users.
  - 20 trackers per user.
  - 12 months of representative entries.
  - A mix of tracker types, including notes and prayer values.
- [ ] Ensure generated content contains no real personal data.

### Load scenarios

Use k6, Locust, or an equivalent tool against staging.

- [ ] Baseline: 5 concurrent users for 10 minutes.
- [ ] Expected peak: 25 concurrent users for 15 minutes.
- [ ] Short stress test: ramp to 50 concurrent users for 5 minutes.
- [ ] Each virtual user should:
  - Authenticate using a pre-created test account.
  - Load the current month.
  - Navigate to another month.
  - Create or update an entry.
  - Occasionally list or update trackers.
- [ ] Record p50, p95, p99, throughput, 4xx/5xx rates, CPU, memory, database connections, and slow queries.
- [ ] Stop the test if error rate exceeds 5%, database connections approach their limit, or production-like data integrity is at risk.

### Performance investigation checklist

- [ ] Confirm month view uses a bounded number of queries rather than per-day/per-cell queries.
- [ ] Add query-count regression tests for month view and entry writes.
- [ ] Capture slow-query plans for the largest seeded accounts.
- [ ] Verify indexes cover user/month tracker and entry lookups.
- [ ] Confirm serialized response size remains reasonable for 20–50 trackers.

### Exit criteria

- Expected-peak test completes with no data corruption.
- Server error rate remains below 1%.
- p95 targets in the observability section are met or consciously revised with evidence.
- CPU, memory, and database connections retain enough headroom for a traffic spike.

## 11. Phase 7 — security and dependency hardening

**Goal:** Remove known avoidable weaknesses at the public edge without destabilizing the release.

### P0/P1 actions

- [ ] Resolve the `serve-handler`/`minimatch` audit finding.
  - Do not apply a forced breaking downgrade blindly.
  - Evaluate upgrading/replacing the static server or serving the built frontend from Django/WhiteNoise as already documented.
  - Re-run frontend tests, proxy tests, build, and OAuth redirect checks.
- [ ] Run `npm audit --omit=dev` in CI and define which severity fails the build.
- [ ] Add Python dependency vulnerability scanning in CI using a maintained scanner.
- [ ] Run `manage.py check --deploy` in CI with production-shaped settings.
- [ ] Resolve or explicitly document every production check warning.
- [ ] Add HSTS gradually after confirming every relevant host is HTTPS-only.
  - Start with a short duration.
  - Increase after observation.
  - Add subdomains/preload only after deliberate review.
- [ ] Add a Content Security Policy compatible with the React bundle, Google Fonts, and Google OAuth.
- [ ] Add/refine `Referrer-Policy`, `Permissions-Policy`, frame protection, and MIME-sniffing protection.
- [ ] Review the frontend proxy for:
  - Header forwarding rules.
  - Host spoofing.
  - Request smuggling edge cases.
  - Timeouts.
  - Maximum body size.
  - Safe error responses.
- [ ] Confirm `DJANGO_DEBUG=False`, secure cookies, allowed hosts, trusted CSRF origins, and CORS origins in the live environment.
- [ ] Rotate any credential suspected of having been copied into logs, local files, or screenshots.
- [ ] Enable automated dependency-update pull requests with CI required.

### Exit criteria

- Production dependency scans have no unaccepted high/critical findings.
- `manage.py check --deploy` is clean or every remaining warning has a documented upstream mitigation.
- Security headers are visible on both frontend and API responses.
- A basic unauthenticated/authenticated security regression suite passes.

## 12. Phase 8 — staged launch

**Goal:** Increase exposure gradually so failures affect as few people as possible.

### Before the first invite

- [ ] Freeze non-launch feature work.
- [ ] Confirm all P0 exit criteria.
- [ ] Record the release commit.
- [ ] Confirm current database backup and restore instructions.
- [ ] Confirm alert destinations and who will respond.
- [ ] Confirm support contact and response expectations.
- [ ] Run staging smoke and expected-peak load tests.
- [ ] Deploy during a period when the operator can monitor for at least two hours.

### Launch cohorts

- [ ] **Cohort 1: internal/test accounts (up to 5).** Observe for one full day.
- [ ] **Cohort 2: trusted users (10–20 total).** Observe for 48 hours.
- [ ] **Cohort 3: expanded beta (50 total).** Observe for 3–5 days.
- [ ] **Cohort 4: 100+ users.** Open only if previous cohorts meet the hold criteria.

### Hold criteria between cohorts

- No unresolved data-loss or cross-user privacy issue.
- No repeated authentication failure.
- No unexplained 5xx spike.
- No sustained breach of latency targets.
- Backups remain current.
- Support volume is manageable.
- Known issues are documented and communicated where necessary.

### Immediate rollback/stop conditions

- Any user can access another user's data.
- Entries, trackers, or accounts disappear unexpectedly.
- Authentication can be bypassed.
- OAuth or password login fails for a meaningful share of users.
- Database errors are sustained or backups stop completing.
- A secret is exposed.
- Error rate exceeds 5% for more than five minutes during ordinary use.

## 13. Launch-day checklist

### One hour before deploy

- [ ] Latest `main` CI is green.
- [ ] Release commit is recorded.
- [ ] Staging smoke test is green.
- [ ] Production database backup is current.
- [ ] Railway environment variables have been reviewed without copying secret values into chat or tickets.
- [ ] Maintenance/rollback commands are available.

### Immediately after deploy

- [ ] Frontend loads on the custom domain.
- [ ] Backend readiness passes.
- [ ] Email signup/verification works, if enabled.
- [ ] Password reset email arrives and completes.
- [ ] Google sign-in reaches the correct callback.
- [ ] A disposable production smoke account can create, edit, clear, and delete an entry.
- [ ] Sign-out invalidates access.
- [ ] Error tracker shows the correct release and no new spike.
- [ ] Logs show normal request latency and no secret values.
- [ ] Disposable smoke data is removed.

### Two hours after deploy

- [ ] Review 4xx/5xx counts.
- [ ] Review p95 latency, CPU, memory, and database connections.
- [ ] Review authentication failures.
- [ ] Review error tracker and support messages.
- [ ] Decide explicitly: continue invites, hold, or roll back.

## 14. First 30 days of operation

### Daily for the first week

- [ ] Review errors, uptime, latency, and failed logins.
- [ ] Confirm backup completion.
- [ ] Review support messages and repeated UX confusion.
- [ ] Check account growth and database size.
- [ ] Record incidents and near misses.

### Weekly

- [ ] Review dependency alerts.
- [ ] Review slow routes and slow queries.
- [ ] Test one representative account journey.
- [ ] Triage product feedback separately from reliability work.
- [ ] Confirm alert contacts and support inbox ownership.

### Within 30 days

- [ ] Perform a second restore drill using a production backup.
- [ ] Review whether worker count and database plan still have headroom.
- [ ] Review rate-limit effectiveness and false positives.
- [ ] Review deletion/export requests and adjust the workflow.
- [ ] Convert recurring manual checks into automation.

## 15. Release evidence register

Fill this table before approving the 100-user cohort.

| Evidence | Link or location | Date | Owner | Result |
|---|---|---|---|---|
| Green `main` CI run |  |  |  |  |
| Frontend Railway deployment |  |  |  |  |
| Backend Railway deployment |  |  |  |  |
| Staging smoke test |  |  |  |  |
| Expected-peak load-test report |  |  |  |  |
| Production dependency scan |  |  |  |  |
| PostgreSQL backup configuration |  |  |  |  |
| Restore-drill record |  |  |  |  |
| Error-tracking test event |  |  |  |  |
| Readiness-alert test |  |  |  |  |
| Privacy notice |  |  |  |  |
| Terms/beta terms |  |  |  |  |
| Account-deletion test |  |  |  |  |
| Launch approval |  |  |  |  |

## 16. Risk register

| Risk | Current likelihood | Impact | Required mitigation |
|---|---:|---:|---|
| Production accidentally uses SQLite | Medium until verified | Critical | Fail closed without `DATABASE_URL`; verify PostgreSQL |
| User cannot recover account | High for forgotten passwords | High | Transactional email and reset flow, or Google-only beta |
| Weak password compromise | High over time | High | Password validators, rate limits, verification |
| Data loss without usable backup | Unknown | Critical | Automated backups and restore drill |
| Regression deployed despite red CI | High under current process | High | Fix E2E and require green CI |
| Failure goes unnoticed | High without alerts | High | Error tracking, readiness, uptime alerts |
| One user abuses unlimited writes/notes | Medium | Medium | Quotas, body limits, shared throttling |
| XSS exposes local-storage session token | Low/unknown | High | CSP, XSS review, move toward HttpOnly sessions |
| Frontend proxy hangs or buffers large bodies | Medium under abuse | Medium | Timeouts and body limits |
| Legal/privacy expectations are unmet | Medium | High | Privacy notice, terms, deletion/export, review |
| Single worker becomes a bottleneck | Medium during peaks | Medium | Multiple workers and staging load test |

## 17. Final go/no-go decision

The launch approver should answer each question explicitly:

- [ ] Is the exact deployed commit green in CI?
- [ ] Can every offered login method complete successfully?
- [ ] Can email users verify and recover their account, or is email signup disabled?
- [ ] Is production definitely using PostgreSQL?
- [ ] Is there a current backup that has been proven restorable?
- [ ] Would the operator be alerted to an outage or exception?
- [ ] Can a user understand, export, and request deletion of their data?
- [ ] Has staging met the 25-concurrent-user target without material errors?
- [ ] Are all P0 risks closed or explicitly accepted in writing?
- [ ] Is someone available to monitor and support the staged launch?

**Go:** Every question is yes and evidence is recorded.  
**Hold:** One or more answers are unknown or depend on an untested assumption.  
**No-go:** There is an unresolved data-isolation, data-loss, authentication-bypass, secret-exposure, or backup-recovery problem.

## 18. Useful verification commands

Run from the repository root unless noted otherwise.

```bash
# Backend correctness
cd backend
.venv/bin/python manage.py makemigrations --check --dry-run
.venv/bin/python manage.py check
.venv/bin/python manage.py test

# Production settings review; use non-secret temporary values locally
DJANGO_DEBUG=False COOKIE_SECURE=True SECRET_KEY='<long-random-test-value>' \
  .venv/bin/python manage.py check --deploy

# Frontend correctness
cd ../frontend
npm ci
npm test
npm run build
npm run test:e2e

# Production dependency audit
npm audit --omit=dev
```

Never paste real production secrets into command history, test output, issue trackers, or this document.

## 19. Items intentionally not required for the first 100 users

These may be valuable, but they should not distract from the P0 launch gates:

- Native mobile applications.
- Offline-first support.
- Multi-region deployment.
- Microservices.
- Kubernetes.
- A dedicated data warehouse.
- Sophisticated product analytics.
- Billing, unless payment is part of the initial launch.
- Real-time collaboration.

The right first-production architecture remains a small Django/React application with PostgreSQL, a shared cache for rate limiting, multiple application workers, reliable backups, clear monitoring, and a disciplined release process.
