# 🏢 HOMI — Integrated Home & Community Management Solutions

A **production-shaped MERN stack Society Management System** (MongoDB · Express · React · Node) with
**real-time visitor gate-pass approval over Socket.io**, **Razorpay billing with HMAC-SHA256
verification**, **automated monthly invoices via node-cron**, and **role-based access control (JWT + bcrypt)**.

Built as a faithful, fully-working clone of the HOMI reference app and branded for
**Khodaldham Society, Ahmedabad**.

---

## 🏢 Society Layout & Data Formats

**Building structure — 3 blocks × 5 floors × 4 flats = 60 homes**

| Block | Floor 1 | Floor 2 | … | Floor 5 |
| --- | --- | --- | --- | --- |
| **A** | A-101, A-102, A-103, A-104 | A-201 … A-204 | … | A-501 … A-504 |
| **B** | B-101, B-102, B-103, B-104 | B-201 … B-204 | … | B-501 … B-504 |
| **C** | C-101, C-102, C-103, C-104 | C-201 … C-204 | … | C-501 … C-504 |

* Every flat carries `block` + `floor` + `unit` + a generated `flatId`, so the directory, the visual
  building view and the cascading Block → Floor → Flat pickers all come from one source of truth.
* Seeded society: **60 flats — 2 occupied / 58 vacant** (only the two demo homes), 3 demo logins,
  19 maintenance invoices, 5 notices, 5 tickets and live gate telemetry.
* `flatId` pattern is `Block-Floor-Unit`: floor `1` + unit `3` → **A-103**; floor `5` + unit `4` → **C-504**.

**Data formats enforced on both tiers** (`server/src/utils/validators.js` ↔ `client/src/lib/validation.js`)

| Field | Rule | Example |
| --- | --- | --- |
| Mobile number | Exactly **10 digits**, first digit 6-9 (Indian numbering plan) | `98765 43210` → stored `9876543210`, shown `+91 98765 43210` |
| Vehicle number | `SS-DD-LL-NNNN` — state, district, series, 4-digit number | `GJ-11-EC-2929` (auto-formatted while typing) |

* `+91 98765 43210`, `09876543210` and `9876543210` all normalise to the same 10-digit local number.
* The API **rejects** malformed values: `987654321` → *“Enter a valid 10-digit mobile number starting
  with 6, 7, 8 or 9”*, `GJ11EC29` → *“Vehicle number: Use the format GJ-11-EC-2929”*.
* Residents never see other owners' phone numbers — the flats API projects contacts for admins only.

---

## ✨ Feature Matrix

| Module | Resident | Admin / Secretary | Gate Guard |
| --- | --- | --- | --- |
| **Real-time gate approval** | Approve / Deny popup (<50 ms) | Live telemetry feed | Dispatch request, see APPROVED/ DENIED instantly |
| **QR Gate Pass** | Generate pre-approved QR pass | Monitor passes | Scan QR or key 10-digit code, validate & auto-admit |
| **Maintenance billing** | Pay via Razorpay (UPI / Card / NetBanking), download invoices | Revenue ledger, KPIs, charts, CSV export, offline settlements | — |
| **Automated invoices** | Live notification on generation | "Run Monthly Cron Bill" manual trigger | — |
| **Notices** | Digital notice board with priority & pins | Publish / pin / delete (broadcast over sockets) | — |
| **Helpdesk** | Raise tickets, track status | Queue with status workflow + remarks | — |
| **Flats directory** | Own flat stats, block/floor context | **Visual building directory** (blocks × floors × flats), block/floor/occupancy filters, add & edit flats | — |
| **Emergency SOS** | Panic broadcast (category + note) | Siren alert on command center | Siren alert on terminal |

---

## 🏗️ Architecture

```
homi-clone/
├── package.json                 # npm workspaces monorepo (client + server)
├── server/                      # Node + Express + Socket.io REST API (MVC)
│   ├── .env.example
│   └── src/
│       ├── config/env.js        # dotenv loader
│       ├── config/db.js         # Mongoose connect + automatic in-memory fallback
│       ├── models/              # User, Flat, Visitor, Bill, Notice, Complaint, GatePass
│       ├── controllers/         # auth, flat, visitor, maintenance, notice, complaint, payment
│       ├── routes/              # /api/auth, /api/flats, /api/visitors, /api/maintenance ...
│       ├── middleware/auth.js   # protect (JWT) · authorize (RBAC) · scopeToFlat
│       ├── utils/validators.js  # 10-digit mobile + GJ-11-EC-2929 plate rules
│       ├── utils/helpers.js     # BLOCKS/FLOORS/UNITS · flatIdFor() · bill math
│       ├── realtime/socket.js   # rooms: flat_<FLAT_ID>, guard_feed, admin_feed
│       ├── services/billingService.js   # shared by node-cron AND the manual trigger
│       ├── store/               # Mongo-compatible in-memory engine (offline demo mode)
│       └── seed/                # society master data + seed CLI
└── client/                      # React 19 + Vite + Tailwind CSS v4 SPA
    └── src/
        ├── lib/validation.js    # client mirror of the server validators
        ├── components/BuildingDirectory.jsx  # Blocks A/B/C × 5 floors × 4 flats
        ├── context/             # AuthContext · SocketContext · ToastContext
        ├── components/          # TopHeader, ToastStack, IncomingVisitorModal, ui, Logo
        ├── pages/Login.jsx
        └── pages/{admin,resident,guard}/
```

**Data flow**

```
React (Vite dev proxy / Express static in prod)
   │  REST  /api/*            ▲  JWT Bearer (Authorization header)
   ▼                          │
Express controllers ──► db.* proxy ──► Mongoose ──► MongoDB
   │                                    └─► In-memory Mongo-compatible store (fallback)
   └── Socket.io ──► flat_A-101 · guard_feed · admin_feed
```

---

## 🚀 Quick Start

```bash
# 1) install (installs both workspaces)
npm install

# 2) environment
cp server/.env.example server/.env        # optional: add MONGODB_URI + Razorpay keys

# 3) seed the society (60 flats across 3 blocks, 2 occupied demo homes, notices, gate logs)
npm run seed

# 4) run API (:5000) + Vite client (:5173) together
npm run dev
```

Open **http://localhost:5173**.

### Single-port production mode

```bash
npm run preview     # builds the SPA, then serves UI + API + Socket.io on :5000
```

### Demo credentials

| Role | Email | Password | Extras |
| --- | --- | --- | --- |
| Resident | `resident@homi.com` | `resident123` | **Flat A-101**, Block A, Floor 1 (Aarav Patel) |
| Admin | `admin@homi.com` | `admin123` | **Flat A-201**, Block A, Floor 2 (Rajesh Trivedi) • master code `ADM-001` |
| Guard | `guard@homi.com` | `guard123` | staff code `SEC-001` |

…or just tap the **1-Click Demo Evaluation Logins** on the login screen, and use the header
**Quick Demo Switcher (Viva)** to jump between portals.

Only the two demo homes are occupied in the seed — **A-101** (resident account) and **A-201**
(admin account, who is also the owner on record in that flat). Every other flat is **cleared**:
no owner, no contact, no parking slot, no invoices — 58 of 60 flats sit empty and ready to claim.

Registration requires a real 10-digit mobile and a flat with **no account yet**; the picker only
offers unclaimed flats and the API rejects a claimed one with `409`.

**New registrations need admin approval.** A resident or guard who signs up gets a
*"Registration sent for admin approval"* confirmation instead of portal access; the request lands in
**Admin → User Approvals** (sidebar badge updates live over Socket.io). The applicant can sign in
only after the admin hits **Approve** — **Reject** blocks the login and frees the flat again.

---

## 💾 MongoDB

Set `MONGODB_URI` in `server/.env` to use real MongoDB (Atlas or local):

```env
MONGODB_URI=mongodb+srv://user:pass@cluster0.mongodb.net/homi_society
```

Leave it **blank** and the server transparently boots an **in-memory Mongo-compatible store** —
the exact same controllers, queries, `$set` updates and socket broadcasts run, so the demo works
with zero infrastructure. Logs:

```
[DB] MONGODB_URI not set → booting in-memory Mongo-compatible store
[STORE] Restored 562 documents from snapshot (saved 2026-09-15T10:39:12.395Z)
```

The fallback store is **durable**: every write schedules a snapshot to
`server/.data/homi-memory.json` (250 ms debounce, flushed on shutdown), which is re-hydrated on the
next boot — so logins, bills and gate logs survive a server restart or a sandbox recycle. Set
`HOMI_PERSIST=false` to opt out, or run `npm run seed -- --force` to reset the snapshot.

---

## ⚡ Real-time approval sequence (Socket.io)

```js
// server/src/realtime/socket.js — JWT handshake + isolated rooms
io.use((socket, next) => { socket.user = verifyToken(socket.handshake.auth.token); next(); });
io.on('connection', (socket) => {
  if (socket.user.role === 'GUARD') socket.join('guard_feed');
  if (socket.user.role === 'ADMIN') socket.join('admin_feed');
  if (socket.user.flatId) socket.join(`flat_${socket.user.flatId}`);
});

// server/src/controllers/visitorController.js
emitToFlat(flat.flatId, 'new_visitor_request', telemetry);   // resident popup + chime
emitToGuards('visitor_request_logged', telemetry);           // gate tablet
emitToAdmins('visitor_request_logged', telemetry);           // command center
```

| Step | Actor | Event |
| --- | --- | --- |
| 1 | Guard | `POST /api/visitors/check-in` → `approvalStatus: PENDING` |
| 2 | Server | `io.to('flat_A-101').emit('new_visitor_request')` |
| 3 | Resident | Pops Approve/Deny modal (60 s auto-close) |
| 4 | Resident | `PATCH /api/visitors/:id/decision` **or** `socket.emit('visitor_decision')` |
| 5 | Server | Broadcast to `guard_feed` + `admin_feed` + flat room |
| 6 | Guard | Audio chime, status flips to `APPROVED` in <50 ms |

---

## 💳 Razorpay & HMAC-SHA256

```js
// server/src/controllers/paymentController.js
const expectedSignature = crypto
  .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
  .update(`${razorpay_order_id}|${razorpay_payment_id}`)
  .digest('hex');

if (!crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(razorpay_signature))) {
  return res.status(400).json({ message: 'HMAC signature mismatch — payment rejected' });
}
bill.status = 'PAID';            // ledger mutated ONLY after verification
bill.paymentTxnid = razorpay_payment_id;
```

* With `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` set → real Razorpay Orders API.
* Without keys → an order is signed locally and verified through the **identical** HMAC code path, so
  the cryptography is demonstrable offline. Try the **tampered signature** rejection via the API tests below.

---

## ⏰ Automated monthly billing (node-cron)

```js
cron.schedule('0 0 1 * *', () => runMonthlyBilling(), { timezone: 'Asia/Kolkata' });
// Manual demo trigger: POST /api/maintenance/generate-cron-bills  { "month": "November", "year": 2026 }
```

Computes `base maintenance + parking + water + security` for every occupied flat, stamps a due date
of the 10th, writes `PENDING` invoices and pushes `bill_generated` to each resident over Socket.io.

---

## 🔐 Security

* **bcrypt** password hashing (10 salt rounds), `password` field is `select: false`.
* **JWT Bearer** tokens (`protect` middleware) with 7-day expiry.
* **RBAC** via `authorize('ADMIN', 'GUARD')`; residents are additionally scoped with
  `flatId: req.user.flatId` so they can only ever read their own flat's data.
* **Master passkeys** (`ADM-001`, `SEC-001`) gate privileged self-registration.
* **Admin approval gate** — residents and guards who self-register are created with
  `approvalStatus: PENDING`; no JWT is issued at sign-up and `/api/auth/login` returns `403`
  until an admin approves them. `protect` also refuses any token belonging to an un-approved
  account, and a rejected registration releases its flat back into the sign-up pool.
* **Timing-safe** HMAC comparison for payments.
* **Durable sessions across restarts** — the Mongo-compatible in-memory store keeps a debounced
  snapshot at `server/.data/homi-memory.json` (loaded on boot, flushed on SIGINT/SIGTERM), so a
  server restart no longer invalidates issued JWTs. Disable with `HOMI_PERSIST=false`.
* **Graceful 401 handling** — any protected call that returns 401 clears the token and signs the
  user out with a single *"Session Expired"* notice plus a redirect to `/login`; feature pages no
  longer stack "Not authorized — no token provided" errors on top of one another.

---

## 🔎 Directory & filtering API

```bash
# Whole society with the building structure (blocks → floors → flats)
GET /api/flats/directory/summary
#   summary.structure → { blocks: ['A','B','C'], floors: [1..5], unitsPerFloor: 4 }
#   summary.byBlock[i].floors[j] → { floor, flatIds, flatDetails, occupied, vacant }

# Filter by block, floor, occupancy or free text
GET /api/flats?block=C&floor=5
GET /api/flats?block=A&occupancy=VACANT&search=patel

# Add a flat by block + floor + unit (id is generated: B-305)
POST /api/flats   { "block": "B", "floor": 3, "unit": 5 }   // unit 5 → 400 “1 … 4”

# PUBLIC — flats with no login account yet (drives the New Registration picker)
GET /api/flats/available
#   → { totalFlats: 60, claimed: 2, availableCount: 58,
#       available: ['A-102','A-103', …], byBlock: [{ block, flatIds, floors }] }
```

**Registration approval API** (ADMIN):

```bash
GET   /api/auth/pending-users              # full queue + counts { pending, approved, rejected }
PATCH /api/auth/users/:id/approval         # { "status": "APPROVED" | "REJECTED" | "PENDING" }
#   → 403 on login while PENDING: “Your registration is awaiting society admin approval …”
```

**One account per home** — a flat that already has a resident login is filtered out of the
sign-up picker *and* rejected server-side:

```bash
POST /api/auth/register  { "flatId": "A-101", … }
# → 409 “Flat A-101 is already registered to another resident — please choose an unclaimed flat”
```

---

## 🧪 API smoke test

```bash
B=http://localhost:5000

AT=$(curl -s -X POST $B/api/auth/demo-login -H 'Content-Type: application/json' -d '{"role":"ADMIN"}'    | jq -r .token)
RT=$(curl -s -X POST $B/api/auth/demo-login -H 'Content-Type: application/json' -d '{"role":"RESIDENT"}' | jq -r .token)
GT=$(curl -s -X POST $B/api/auth/demo-login -H 'Content-Type: application/json' -d '{"role":"GUARD"}'    | jq -r .token)

# KPIs + RBAC (resident → 403 on an admin route)
curl -s $B/api/maintenance/stats -H "Authorization: Bearer $AT"
curl -s -o /dev/null -w '%{http_code}\n' -X POST $B/api/maintenance/generate-cron-bills -H "Authorization: Bearer $RT"

# Gate flow — mobile normalised to 10 digits, plate accepted in any casing
curl -s -X POST $B/api/visitors/check-in -H "Authorization: Bearer $GT" -H 'Content-Type: application/json' \
  -d '{"guestName":"Viva Guest","phone":"+91 98765 43210","flatId":"A-101","purpose":"Delivery / Courier","vehicleNo":"gj-11-ec-2929"}'

# Validation rejects (both return 400)
curl -s -X POST $B/api/visitors/check-in -H "Authorization: Bearer $GT" -H 'Content-Type: application/json' \
  -d '{"guestName":"Bad","phone":"987654321","flatId":"A-101"}'          # 9-digit mobile → rejected
curl -s -X POST $B/api/visitors/check-in -H "Authorization: Bearer $GT" -H 'Content-Type: application/json' \
  -d '{"guestName":"Bad","phone":"9876543210","flatId":"A-101","vehicleNo":"GJ11EC29"}'   # bad plate → rejected
```

---

## ☁️ Deploy to Render.com

1. Push the repo to GitHub.
2. Render → **New → Web Service** → connect the repo.
3. **Build Command:** `npm install && npm run build` · **Start Command:** `npm start`
4. Environment: `MONGODB_URI`, `JWT_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `NODE_ENV=production`
5. MongoDB Atlas → Network Access → allow access from anywhere.
6. Deploy — Render injects `PORT`, which the Express server already reads.

---

## 📸 Screenshots

| # | Screen |
| --- | --- |
| 01 | Login — transparent HOMI mark, 1-click demo logins, role selector & A/B/C structure |
| 02 | Resident — QR gate pass (guest mobile + `GJ-11-EC-2929` validated) |
| 03 | Guard — walk-in check-in with auto-formatted plate & 10-digit mobile |
| 04 | Guard — Gate 1 security terminal (tablet touch UI) |
| 05 | Resident — live approval popup with Block/Floor context |
| 06 | Resident — Razorpay checkout (UPI/QR · HMAC-SHA256 verified server-side) |
| 06b | Resident — payment success toast, invoice flipped to PAID |
| 07 | Admin — Society command center & analytics |
| 08 | Admin — **Building directory** (Blocks A/B/C × 5 floors × 4 flats) |
| 09 | Admin — Maintenance accounts & revenue ledger |
| 10 | Guard — QR scanner with pre-approved passes on file |
| 11 | New Registration — only unclaimed flats are offered in the picker |
| 12 | Admin — User Approvals queue (residents & guards waiting for approval) |
| 13 | New Registration — "sent for admin approval" confirmation panel |

`docs/screenshots/` — 14 captures from the running app (1500×1000), covering every portal, the
building directory, data-format validation, the full billing flow, the flat-claiming rule at
registration and the admin approval gate.

---

## 📜 Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Express API (:5000) + Vite dev server (:5173) concurrently |
| `npm run build` | Production build of the React SPA → `client/dist` |
| `npm start` | Serve API + sockets + built SPA from one Express port |
| `npm run seed` | Seed society data (`-- --force` to reset) |
| `npm run preview` | `build` then `start` |

---

*HOMI © Khodaldham Society — Integrated Home & Community Management Solutions.*
