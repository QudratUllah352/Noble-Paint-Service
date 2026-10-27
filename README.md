# Noble Paint Service

Website and admin workspace for Noble Paint Service, a painting business.

- **Public website**: home, about, services, team and contact pages. Visitors can send enquiries and consultation requests.
- **Admin area** (`/admin/`): sign in to manage enquiries, appointments, projects, team members and the services catalogue. Includes account settings, password reset, audit history and recovery tools.

## Project layout

```
backend/    Node.js + Express API, MongoDB models, tests, admin scripts
frontend/   Static HTML/CSS/JS pages served by the backend
```

## Requirements

- Node.js 22.9 or newer
- A running MongoDB database
- SMTP account (optional, only for sending emails)

## Getting started

```bash
cd backend
npm install
cp .env.example .env        # then edit .env with your own values
```

In `.env`, set at least `MONGODB_URI` and `SESSION_SECRET`. To create the first admin account, also set `ADMIN_EMAIL` and `ADMIN_PASSWORD`, then run:

```bash
node --env-file=.env scripts/createAdmin.js
```

Remove `ADMIN_PASSWORD` from `.env` afterwards.

Start the server:

```bash
npm start        # or: npm run dev  (restarts on file changes)
```

Open:

- Website: http://localhost:5000/
- Admin: http://localhost:5000/admin/login.html

Always open the site through this server, so pages and the API share the same address.

## Tests

```bash
cd backend
npm test
```

Tests use fake storage and fake email, so they don't touch your database or send real mail.

## More detail

See [backend/SETUP.md](backend/SETUP.md) for full setup, email, admin and recovery instructions.
