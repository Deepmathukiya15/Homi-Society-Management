# 🏢 HOMI — Khodaldham Society OS (MERN)

Integrated Home & Community Management Solutions — a full MERN-stack Society Management System
(MongoDB · Express · React · Node + Tailwind CSS) with **real-time gate approval over Socket.io**,
**Razorpay billing with HMAC-SHA256 verification**, **monthly cron invoices** and **JWT + RBAC**.

---

## 🚀 Run it in 3 commands

```bash
npm install                 # installs client + server workspaces
npm run seed                # seeds 60 flats, 2 demo homes, notices, gate logs
npm run dev                 # API on :5000 + Vite dev server on :5173
```

Open **http://localhost:5173**

Prefer one single port (Express serves the built React app)? The bundle is already built:

```bash
npm run build               # (optional — client/dist is included in this zip)
npm start                   # everything on http://localhost:5000
```

---

## 🔑 Demo logins

| Role | Email | Password | Home |
| --- | --- | --- | --- |
| Resident | `resident@homi.com` | `resident123` | **Flat A-101** (Aarav Patel) |
| Admin / Secretary | `admin@homi.com` | `admin123` | **Flat A-201** (master code `ADM-001`) |
| Guard | `guard@homi.com` | `guard123` | Gate 1 terminal (staff code `SEC-001`) |

…or just tap **1-Click Demo Evaluation Logins** on the login screen.

---

## 🏢 Society model

* 3 blocks **A / B / C** × 5 floors × 4 flats = **60 homes** (`A-101 … C-504`).
* Only **A-101 (resident)** and **A-201 (admin)** are occupied in the seed — the other **58 flats are
  cleared** and free to claim.
* **New registrations need admin approval**: a resident/guard who signs up gets
  *"Registration sent for admin approval"* and lands in **Admin → User Approvals**; they can sign in
  only after the admin approves (rejecting frees the flat again).
* Validation: mobile = exactly 10 digits (`6-9` prefix), vehicle = `GJ-11-EC-2929` format.
* No MongoDB installed? Set `MONGODB_URI=` blank in `server/.env` and the server boots a
  **Mongo-compatible in-memory store** that keeps a durable snapshot in `server/.data/`, so demo data
  and logins survive restarts.

---

## 📁 What's inside

```
client/          React 18 + Vite + Tailwind SPA (Resident / Admin / Guard portals, Recharts)
  dist/          pre-built bundle served by Express in single-port mode
server/          Express REST API + Socket.io + Mongoose models, controllers, middleware
  .data/         in-memory store snapshot (seeded society; delete or re-seed to reset)
docs/screenshots/  14 captures of every portal and flow
README.md        full documentation — API surface, architecture, security, screenshots
```

### Handy scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API + Vite dev server together |
| `npm run build` | production build of the React SPA → `client/dist` |
| `npm start` | Express serves API + built SPA on a single port (:5000) |
| `npm run seed` | seed the society (`npm run seed -- --force` resets everything) |

> Full details (API endpoints, Socket.io event map, Razorpay HMAC flow, validation rules,
> deployment to Render) are in **README.md**.
