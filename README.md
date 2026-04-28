# CrmOne Server-Rendered Web Project

This repository contains two separate Express + EJS applications that share one PostgreSQL database:

- `admin-panel/` runs on port `3001`
- `user-web/` runs on port `3000`
- `db/` contains the PostgreSQL schema and seed data

## Prerequisites

- Node.js 18+
- PostgreSQL

## Database setup

1. Create the database:

   ```bash
   createdb crmone
   ```

2. Apply the schema:

   ```bash
   psql -d crmone -f db/schema.sql
   ```

3. Seed the database:

   ```bash
   psql -d crmone -f db/seed.sql
   ```

## Run the admin panel

```bash
cd admin-panel
npm install
npm start
```

The admin panel will be available at `http://localhost:3001`.

## Run the user web app

```bash
cd user-web
npm install
npm start
```

The user web app will be available at `http://localhost:3000`.

## Default admin login

- Email: `admin@crmone.com`
- Password: `Admin@123`
