# Contact page backend

The homepage Get In Touch form also submits enquiries, using `POST /api/enquiries`. Name, email, phone and message are validated and saved in the same `consultations` collection with source `homepage` and status `New`. No area or arrival window is invented for this shorter form. The live admin enquiries page labels the source and supports the same search, filters and status updates for both forms. Submit the homepage through `http://localhost:5000/`. Success appears only after saving; failed submissions keep the visitor's entries. No appointment is created. Email notifications can be enabled as described below.

Requires Node.js 22.9 or newer and a running MongoDB database.

## Enquiry email notifications

Both forms support a business notification and a separate customer acknowledgement using Nodemailer. SMTP is provider-independent. Your existing `.env` is left unchanged. Copy the settings from `email.env.example` into `.env`, filling in your SMTP provider's values:

```dotenv
EMAIL_ENABLED=true
SMTP_HOST=your-provider-smtp-host
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASSWORD=your-smtp-password
MAIL_FROM=your-verified-sender@example.com
BUSINESS_NOTIFICATION_EMAIL=your-business-inbox@example.com
```

Use a single plain email address for each address setting. Port 587 uses STARTTLS (`SMTP_SECURE=false`); port 465 normally uses implicit TLS (`SMTP_SECURE=true`). Use the credentials and sender verification required by your provider. Do not put SMTP credentials in frontend files or commit `.env`.

Restart the backend after configuring email. Submit a test enquiry using an inbox you control and check both inboxes, including spam. Automated tests use fake transports; they do not send actual mail. The business email includes the submitted details with Reply-To set to the customer. The acknowledgement includes a reference and makes clear that no appointment is booked.

Enquiries are saved before attempting either email. Each recipient is attempted independently. SMTP failures log only a generic recipient label; they do not remove enquiries or turn saved submissions into failures. Disabled or invalid SMTP configuration leaves forms working without email. There is no persistent mail queue or automatic retry in this version, so delivery may be lost on a process interruption or SMTP failure. Delivery acknowledgement from SMTP does not guarantee inbox placement. When email is enabled, the two public form endpoints share a per-process limit of 10 requests per IP per 15 minutes.

From `backend/`, run `npm install`. Copy `.env.example` to `.env`, then set `MONGODB_URI` to your MongoDB connection string. Keep `.env` private. No email or storage credentials are needed for this first page.

Run `npm start` and open `http://localhost:5000/contact/`. Open the page through this server so the page and API share an origin; a separate Live Server does not forward API requests.

`POST /api/consultations` validates and saves contact form fields in the MongoDB `consultations` collection with a New status. It returns success only after saving. No appointment is booked. Email delivery is optional. No public endpoint lists customer details.

Run `npm test` for API tests using an injected persistence function; these tests do not require MongoDB. A real database submission still needs to be checked with your configured MongoDB instance. Add abuse controls before public deployment.

## Admin login and live requests

### Unified admin navigation

Open `/admin/` to enter the live workspace. The entry page opens `/admin/overview.html`; protected API requests redirect unsigned visitors to login. Overview, Enquiries, Appointments, Team, Projects and Services share a sidebar, active-section indicator, header, website link and sign-out action. On mobile, use **Menu**; the drawer supports keyboard focus, Escape, a close button and the backdrop. Existing form elements are retained when the shared layout is created, so their handlers and entered values remain intact.

The previous browser-local sample dashboard is archived at `/admin/sample.html` and is no longer linked from live navigation. Its original script and local-storage key remain unchanged; no browser data is cleared or imported into MongoDB. Old `/admin/#enquiries`, `#appointments`, `#team`, `#projects`, `#services`, `#settings` and `#overview` links open the corresponding live section. Unsupported old sections open the overview. JavaScript-disabled entry pages provide direct links to overview and sign-in.

### Account settings

Open **Account settings** in the sidebar or `/admin/settings.html` to view and update your own admin sign-in email or password. Both changes require the current password. Passwords must contain 12–256 characters and the new password must be different; confirmation must match. Email addresses are normalized to lowercase and must be unique across admin accounts. Passwords are stored as salted scrypt hashes, never returned by account APIs, and never written to browser storage.

A successful email or password change rotates the account's session version, clears the current login cookie and redirects to sign-in. All other sessions for that account are rejected on their next protected API request, including after backend restarts. Sign in again with the updated details. Older accounts and sessions without a version remain compatible until the first change. Concurrent credential updates check the current version and password hash before writing. Failed current-password checks and duplicate emails leave credentials and sessions unchanged. Account change requests share a per-IP limit of 10 attempts per 15 minutes.

If you cannot sign in, use **Forgot password?** on `/admin/login.html`. Enter the admin sign-in email and follow the reset link sent to that address. Reset links expire after 30 minutes, work once, and set a 12–256 character password; resetting revokes all existing sessions. The response does not reveal whether an email belongs to an admin account. Password recovery requires the existing SMTP email settings to be enabled and valid; without them, the page reports that recovery is unavailable. If an SMTP send fails, the server logs a generic error and the reset token is cleared.

These settings update the MongoDB admin account only. They do not change SMTP credentials, sender addresses, business notification inboxes or `.env` values. `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` are bootstrap inputs for the create-admin script, not the source of truth for an existing login; remove the bootstrap password after creating the account. Do not rerun create-admin with an old email unless you intend to create an additional account.

Protected endpoints: `GET /api/admin/account`, `PATCH /api/admin/account/email` with email/currentPassword, and `PATCH /api/admin/account/password` with currentPassword/newPassword/confirmPassword. Public recovery endpoints are `POST /api/admin/forgot-password` with email and `POST /api/admin/reset-password` with token/newPassword/confirmPassword. Reset tokens are stored only as SHA-256 hashes. The account is always taken from the session for protected account changes; callers cannot supply another admin ID. Changes require same-origin JSON requests. Listing, inviting or deleting other admins is not included. Automated tests use fake accounts and do not change your real credentials.

### Service catalogue

Open `/admin/services.html` or **Manage services** in the overview. Create or edit service cards with a title, description, one or more categories (Residential, Commercial, Specialty), up to eight features, optional image URL and description, optional badge, display order and Active/Hidden visibility. New forms default to Hidden. Save as Active to show the card on `/services/`; save as Hidden to remove it from that page. Lower display order values appear first. Search and visibility filters apply before pagination (25 per admin page).

The first updated backend startup initializes six services copied from the existing Services page into the `services` collection. Stable seed keys and insert-only writes preserve later admin edits and hidden statuses on restart; no old customer data is changed. The database user needs index creation and write access for initialization. There is no hard-delete action. Image upload is not included: use an http(s) URL or an existing path under `/assets/`. The public page retains category filtering and Request Service links.

This catalogue controls only the main Services page card grid. Homepage cards, pricing tiers, process sections and form project-type choices remain unchanged. It does not import the old sample dashboard's browser-local services. Changing a service does not alter saved enquiries, projects or appointments.

`GET /api/services` returns only Active public card fields, in display order, without login. Hidden records and seed metadata are excluded. The page loads through the backend; if the API is unavailable it shows a contact message rather than restoring obsolete hidden cards. Admin `GET /api/admin/services` supports page/search/status; `POST` creates a service and `PUT /api/admin/services/:id` updates it. Writes require an admin session and the expected JSON origin. Service text renders as text rather than executable HTML. Automated tests validate the seed and visibility behavior without seeding your live database; restart and verify a card edit in your browser.

### Projects

Mark an enquiry **Won**, then click **Create / view project** on its enquiry card. Enter a title, select an active team member, optionally set planned start and target completion dates, and add the scope of work. Save as Planned, In progress, Completed or Cancelled. The projects list at `/admin/projects.html` supports title/customer search, status filters and 25 results per page. The overview shows project totals with links to each status filter.

Projects are private admin records in the `projects` collection. Each enquiry can have one project, enforced by a unique index. Existing projects can still be edited if the enquiry status is later changed. Planned and In progress projects require an active assigned member; a current inactive member can be retained for Completed or Cancelled records. Names are snapshots refreshed when explicitly saving a project; team edits do not rewrite project records automatically. Dates are calendar dates, and the target date cannot be before the planned start.

Project dates do not reserve appointment slots. Continue to book individual visits through Appointments for conflict checks. Saving a project does not send email, create appointments, change the enquiry's status, or publish anything to the public website. This step does not add quotations, invoices, payments or progress history. Concurrent edits keep the most recently saved values. Sample projects in the old browser-local dashboard are not imported.

Protected API: `GET /api/admin/projects` accepts page/search/status. `GET /api/admin/consultations/:id/project` returns enquiry context and its project, if present. `PUT` to the same URL saves title, scope, assignedMember, startDate, targetDate and status. Customer and assignee names are resolved on the server. Startup initializes the project's unique index; tests use injected storage, so verify a saved project in your MongoDB after restarting.

### Appointments

Open **Schedule / edit appointment** on any live enquiry, or **Manage appointments** from the overview. Enter the confirmed visit time and address, choose a saved team member, then save. A new appointment starts as Scheduled. Existing appointments can be rescheduled or marked Completed or Cancelled. All appointment APIs require the same admin session and origin protections as enquiry updates.

Appointment time inputs use the browser's time zone, shown explicitly in the editor. Times are saved as UTC instants along with the zone and displayed in the saved zone. When another admin opens the editor, the instant is converted to that admin's browser zone. Check the displayed zone before entering a visit time. Scheduled visits must be in the future; historical visits can be marked Completed or Cancelled. The customer’s preferred date remains an unconfirmed preference until an admin schedules the visit.

Appointments are stored in a separate `appointments` collection, linked to their enquiry. A unique index enforces one appointment per enquiry; rescheduling updates that record. Appointment state is separate from enquiry status. Team assignments link to saved member records and retain a name snapshot for display and emails. Scheduled visits are checked for conflicts as described below. There is no appointment edit history yet. No confirmation emails are sent by saving or editing alone.

#### Scheduling conflicts

Set **Duration (minutes)** when saving a visit: 15–480 minutes in 15-minute steps. New forms default to 60 minutes. Dates are compared as UTC instants, so choosing another display time zone does not bypass a conflict. The same member cannot have two overlapping Scheduled visits. Back-to-back visits are allowed (for example, 09:00–10:00 and 10:00–11:00), as are overlapping visits assigned to different members. Include required travel time in the visit duration; no automatic travel buffer is added.

Conflict checks run on creation, rescheduling, duration changes, reassignment and returning a visit to Scheduled. The visit being edited is excluded from its own check. A rejected save returns HTTP 409, keeps the existing appointment intact, and leaves the attempted values in the form. Completed and Cancelled visits do not reserve time. Successful cancellation, completion, rescheduling or reassignment frees the former time automatically.

Legacy appointments without a duration are treated as 60 minutes without rewriting them. Scheduled records with only a typed assignment are also checked when that exact name matches the selected member. Link older records to saved team members when editing them; unmatched historical typed names cannot reliably identify a person, and existing overlaps are not automatically corrected. Duplicate member names may conservatively match the same older typed assignments.

All appointment saves share a short MongoDB lock in `operationlocks` so independent backend processes cannot pass the conflict check and then double-book simultaneously. A concurrent save may return a brief “save in progress” response; retry it. The lock is released on successful saves and handled failures. It has no automatic expiry: if a process stops abruptly mid-save, scheduling stays blocked rather than risking double bookings. Recovery requires stopping all backend instances, reviewing the appointment write outcome and reconciling the `appointment-scheduling` lock before restarting. The database user must be able to create and delete these lock documents. Tests cover interval boundaries and concurrent requests with injected storage; verify the flow against your MongoDB after restarting.

### Team management

Open `/admin/team.html` or **Manage team** from the live overview. Add and edit members with a name, role, optional email and phone, and a status of Active, On leave or Inactive. Search and status filters apply to the whole team before pagination (25 per page). Set Inactive to retire a member without removing appointment references. The public Team page lists active member names and roles only; it does not expose staff email addresses or phone numbers. This version does not delete team records, create staff login accounts, or import sample staff. A team member's role is a descriptive job title, not an admin permission.

Appointment assignments now send `assignedMember` (the saved member's ID), not a typed `assignedTo` name. The backend resolves the name itself. Future Scheduled saves require an Active member. An already assigned On leave or Inactive member can be retained when marking a visit Completed or Cancelled, but cannot be newly assigned. Appointment dropdowns load all Active team members and retain the current inactive selection for historical edits. Refresh the appointments page after adding members in another tab.

Older appointments with typed names are left unchanged. Their names remain visible, but when you next save an appointment you must choose a saved member to link it. Renaming or deactivating a member does not automatically rewrite past appointment name snapshots, cancel visits, or send email. Choosing and saving an assignment records the member's current name and creates a new appointment version.

Public route: `GET /api/team` returns active member names and roles. Authenticated routes: `GET /api/admin/team` (optional page, search, status), `POST /api/admin/team`, and `GET`/`PUT /api/admin/team/:memberId`. Save bodies contain name, role, email, phone and status. Contacts can be empty strings or omitted. Private contact details remain available only through admin APIs and do not grant staff access to the admin area. Scheduled appointment saves also check that member's existing visits for time conflicts.

#### Sending appointment emails

After saving an appointment, review its card in the appointments list and click **Send confirmation email** for a future Scheduled visit **Send cancellation email** for a Cancelled visit, or **Send completion email** for a Completed visit. Emails go only to the linked enquiry's saved customer address, using the existing SMTP settings. They include the saved visit time with its time zone and address; confirmations also include the assigned team member. Internal enquiry notes are excluded. Completion emails state that the appointment has been marked completed and include the saved visit details.

The same email action appears directly below **Save appointment**, with a summary of the saved visit, even when that visit is on a different list page or excluded by a filter. The editor provides the matching button for Scheduled, Cancelled and Completed visits. Past Scheduled visits show an explanation asking you to reschedule first. Accepted emails disable both buttons for that saved version, including after a refresh.

Saving or rescheduling never sends email automatically. Unsaved editor changes are not emailed. If another admin changes the visit after the list loads, refresh and review the current saved details before sending. This action has a per-process rate limit of 10 requests per IP per 15 minutes. A MongoDB claim blocks simultaneous sends across server processes and prevents sending an already accepted saved version again. A subsequent appointment save creates a new version that can be emailed.

`POST /api/admin/consultations/:id/appointment/email` requires the same-origin admin session and only a `version` field containing the appointment's saved `updatedAt` timestamp. A successful response means SMTP accepted the email; check the inbox for delivery. Failure leaves the appointment intact, and you should check the inbox before retrying because SMTP errors can leave delivery uncertain. Automated tests use fake transports and send no real messages.

#### Appointment email history

The editor and appointment cards display the most recent 50 attempts per appointment, newest first. History includes the notice type, customer address, attempt time, outcome (Sending, Accepted by SMTP, or Failed / delivery unconfirmed), and a safe error code for failures. It is stored on the appointment in MongoDB and requires the same admin login as other appointment details. Emails sent before this feature was added cannot be reconstructed and are not listed.

History updates do not change the appointment's `updatedAt` version. Failed sends can be retried manually after checking the inbox; accepted versions are blocked persistently. SMTP credentials, raw SMTP responses and internal enquiry notes are excluded from history. There is no automatic retry queue or inbox-delivery tracking.

If the server stops mid-send or the outcome cannot be written to MongoDB, the appointment remains marked Sending with an unrecorded outcome. Sending and appointment edits stay blocked to avoid an accidental duplicate. Use Recovery tools below after checking delivery; there is no automatic timeout reset because the SMTP outcome may be unknown.

## Recovery tools

Open `/admin/recovery.html` from the shared admin navigation. The authenticated, uncached report shows the scheduling lock and up to 100 appointment emails awaiting an outcome. It does not expose customer email addresses or credentials. These records can represent active operations; their age alone does not establish that they are stuck. The page provides commands but cannot mutate records over HTTP.

From the `backend` folder, you can also inspect the same report without changing records:

```powershell
node --env-file=.env scripts/recovery.js report
```

Before applying recovery, stop **all** backend instances and workers, including instances on other machines. The script requires you to type `ALL BACKENDS STOPPED`; it cannot independently verify this operational prerequisite. Do not restart any instance until recovery finishes. For a scheduling lock, review whether the interrupted appointment write completed and reconcile appointments before releasing it. Copy the exact token from the report:

```powershell
node --env-file=.env scripts/recovery.js unlock <token>
```

For an email, check the customer inbox or SMTP provider logs first. Copy the appointment ID and attempt ID from the report. Choose exactly one outcome:

```powershell
# Customer receipt verified: keeps this saved version blocked against duplicate sends.
node --env-file=.env scripts/recovery.js email <appointmentId> <attemptId> received

# Delivery uncertain or not received: permits a later manual retry, which could duplicate delivery.
node --env-file=.env scripts/recovery.js email <appointmentId> <attemptId> retry
```

Replace angle-bracket placeholders with actual identifiers; the page displays ready-to-copy commands. Email recovery additionally requires `INBOX CHECKED`. Every mutation prompts for your current admin email and password, with password input hidden. It uses the stored account credentials, not the original ADMIN_PASSWORD environment variable. Run interactively; redirected input is rejected. Terminal/database access remains restricted to trusted operators, and invalid credentials do not change records.

Exact token/attempt comparisons reject changed or already resolved records. Recovery does not send mail, change visit details, or change the appointment version. Manual email resolutions record admin ID, time and resolution in the existing email history (subject to its existing 50-attempt retention); the appointment page labels them as manual outcomes rather than claiming SMTP acceptance. Lock recovery records an intent in `recoveryevents` before deleting the exact lock, then records Applied or Unchanged. If interrupted between these writes, Pending means the operator must inspect the current lock; it does not prove whether deletion occurred. The database user needs access to this collection.

Restart the backend after recovery, refresh the report, and review appointment details and history before sending anything. If the report reaches 100 unresolved emails, repeat after resolving the displayed items. Missing attempt identifiers require database operator inspection. Recovery is deliberately offline: clearing a live lock or email claim would defeat scheduling and duplicate-send protection. These tools do not provide database backup or restore.

## Audit history

Open `/admin/audit.html` from admin navigation. History starts when this feature is enabled; earlier actions cannot be reconstructed. The protected `GET /api/admin/audit` endpoint returns 25 entries per page, newest first, with filters for action, outcome, literal admin-email/record-ID search, and inclusive from/through dates in UTC. Entry times display in the browser time zone. No edit or delete API is provided.

Recorded actions include enquiry status and notes, appointment saves and email requests, team and service creation/updates, project saves, account email/password changes, and authenticated offline recovery commands. Login/logout, rejected input, public enquiry submissions, seed scripts, original admin creation, and direct database edits are outside this history. Existing recovery records retain their own history and are not backfilled. Automated tests use fake stores and do not change live accounts or send mail.

Entries contain the session admin ID and sign-in email at the time, action, target identifier, submitted field names, start time, outcome and finish time. Appointment/project/enquiry targets are enquiry IDs; team/service targets are their own record IDs; new records initially use `new` until their ID is available. Recovery email targets are appointment IDs; lock recovery targets are lock tokens. Field names indicate what was submitted, not a before/after diff or proof that every value changed. No passwords, hashes, field values, private notes, customer contact details, raw request bodies, session secrets or raw error messages are copied into audit history.

An audit intent must be persisted before an action runs. If that fails, the action is blocked. Outcomes are Pending (running or outcome unrecorded), Completed (the service returned successfully), No record (the target was not found), or Error (the service threw, which may still involve partial writes or uncertain email delivery). Completed for an email request means the sender service returned, not verified inbox delivery. A process crash or failed audit finalization can leave Pending after a business write succeeded. The UI warns to review the original record before retrying; writes and emails are never automatically replayed. Account changes may require signing in again even if their audit finalization fails.

Audit entries use the `auditevents` MongoDB collection with no automatic expiry. Grant the backend database user read/insert/update and index permissions. These entries are application history, not a transaction log, backup, rollback tool, or tamper-proof store; privileged database access can modify them. Business writes and audit finalization are separate writes so standalone MongoDB remains supported. Plan backups and retention for this collection with your database operator.

The appointments page filters by status and shows 25 visits per page. The overview shows up to five future Scheduled visits, earliest first. Past, Completed and Cancelled visits remain in the appointments page. Startup initializes the appointment indexes; the database user must have permission to create indexes. Automated tests use injected storage and model validation; verify persistence with your local MongoDB after restarting the backend.

Login opens `/admin/overview.html`, a live overview of total enquiries, counts for New/Contacted/Quoted/Won/Closed, and the five latest enquiries. Click a status count to open the enquiries page with that filter applied. Use **Refresh overview** for updated counts after changes. Older pending records are included in New. The overview API (`GET /api/admin/overview`) requires an admin session and uses no-store caching. The old sample workspace is archived at `/admin/sample.html`.

Keep your current `.env` values. Add these settings locally:

```dotenv
SESSION_SECRET=replace-with-a-random-secret-of-at-least-32-characters
PUBLIC_SITE_URL=http://localhost:5000
ADMIN_EMAIL=your-admin-email@example.com
ADMIN_PASSWORD=choose-a-unique-password-of-at-least-12-characters
```

Generate a session secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and paste it into `.env`. Do not use the example secret above. `PUBLIC_SITE_URL` must match the exact origin used in your browser, including the port.

From `backend/`, run `node --env-file=.env scripts/createAdmin.js` once. This creates a MongoDB admin with a salted scrypt password hash; an existing account is left unchanged. Remove `ADMIN_PASSWORD` from `.env` after creating the account. Restart with `npm start` and open `http://localhost:5000/admin/login.html`.

After signing in, the live requests page shows saved Contact requests, newest first, with 25 per page. Choose New, Contacted, Quoted, Won, or Closed and click **Save status** to update an enquiry. Status choices can be changed in either direction. `/admin/` now opens the live overview; browser-local sample records remain accessible only in the archived sample workspace.

New requests default to `New`. Older requests with a `pending` status display as New without rewriting existing records; saving a status stores the selected value. Status changes do not book appointments or send email. `PATCH /api/admin/consultations/:id/status` requires an admin session, a same-origin JSON request, and a body containing only `status`. Updates persist in MongoDB and are shown after refreshing.

Use **Apply filters** to search names, email addresses, or phone numbers and optionally select a status. Search matches literal text, ignores case, and accepts up to 120 characters. Phone search matches the stored formatting. Filters apply to all saved requests before pagination; **Clear** restores all requests. The New filter includes older pending requests. Changing an enquiry to a different status removes it from the current status filter. `GET /api/admin/consultations` accepts optional `search` and `status` parameters alongside `page`.

Each enquiry also has **Private admin notes**, a text field of up to 5,000 characters. Click **Save notes** before refreshing or navigating away. Saving replaces the previous notes; clearing the field and saving removes the text. Notes are available only through the authenticated admin API and are excluded from notification emails. Public forms cannot set them. `PATCH /api/admin/consultations/:id/notes` accepts only `{ "adminNotes": "your text" }`, requires the same-origin admin session, and preserves other enquiry fields. Failed saves keep the draft in its field. Simultaneous edits use the most recent saved text; there is no note history in this version.

Sessions are stored in MongoDB, expire after eight hours, and use HttpOnly, SameSite cookies. Login attempts are limited per IP. Logging out invalidates the server session. Customer records are only returned by the authenticated API; the HTML shell contains no customer data. Without `SESSION_SECRET`, admin APIs remain disabled while the Contact form continues working.

Production requires HTTPS for secure cookies. If deploying behind a reverse proxy, configure Express proxy trust to match your hosting network before deployment. Login rate limits in this version are per server process. These automated tests use test accounts and an in-memory session store, while the running application uses MongoDB. No real admin account is created by tests.
