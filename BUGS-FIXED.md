# 🐛 Bug Fix Report — HOMI Society Management

Full project reviewed (server + client, every controller, route, model, context and page),
API smoke-tested end-to-end, and Socket.io flows exercised with a live client. **10 bugs found
and fixed.**

---

## Server fixes

| # | File | Bug | Fix |
| --- | --- | --- | --- |
| 1 | `server/src/controllers/flatController.js` | **Admin could never clear an owner contact.** Sending `ownerContact: ""` (e.g. when marking a flat vacant) was silently ignored — the old number stayed on the flat. | Empty / `—` values now clear the stored contact; non-empty values are still validated as 10-digit mobiles. |
| 2 | `server/src/realtime/socket.js` | **`visitor_decision` socket event never persisted the decision.** It only relayed a message to the feeds, so the visitor log stayed `PENDING` in the database (the README documents this event as a full alternative to the REST endpoint). | The handler now validates the resident (own flat only, only `PENDING` logs), persists `APPROVED`/`DENIED` + `approvedBy` + `guardNote`, and broadcasts `visitor_updated` to `guard_feed`, `admin_feed` and the flat room. Non-resident sockets are ignored. |
| 3 | `server/src/controllers/paymentController.js` | **Double-payment possible.** `POST /api/payments/verify` and `/api/payments/record-offline` would happily re-mark an already `PAID` bill and overwrite its transaction reference. | Both endpoints now reject an already-paid bill with `400`. |
| 4 | `server/src/store/memory.js` | **`options.new === false` was ignored** by `findByIdAndUpdate` / `findOneAndUpdate` (both branches returned the post-update copy), diverging from Mongoose behaviour. | Pre-update snapshots are returned when `new: false`, matching Mongoose. |
| 5 | `server/src/models/Visitor.js` | **`checkedOutBy` was silently dropped** on MongoDB (field missing from the schema) while the in-memory store kept it — guard exit attribution differed between backends. | Added `checkedOutBy` to the Visitor schema. |

## Client fixes

| # | File | Bug | Fix |
| --- | --- | --- | --- |
| 6 | `client/src/components/ui.jsx` | **`SectionCard` ignored `title`, `subtitle` and `action` props.** On **Admin → User Approvals** this silently dropped the card heading *and* the status filter + Refresh button — they never rendered. | `SectionCard` now renders an optional header row with title/subtitle/action. |
| 7 | `client/src/pages/admin/AdminOverview.jsx` | **Block-Wise Occupancy chart had no x-axis labels** — the BarChart read `dataKey="wing"` but the directory summary returns `block`. | `dataKey="block"` (also kept the `byWing` legacy alias working). |
| 8 | `client/src/context/SocketContext.jsx` | **Socket.io disconnect/reconnect storm.** The connection effect depended on the toast context object, whose identity changes on every toast push/dismiss — so each toast tore down and re-created the whole socket, dropping live gate events in between. | Toasts are now read through a ref inside the socket lifecycle effect; the connection only re-establishes on login/logout. |
| 9 | `client/src/components/IncomingVisitorModal.jsx` | **"Auto-close 0:00" popup never auto-closed.** The countdown stopped at 0 but the modal stayed open forever (README/UI advertise a 60 s auto-close). | Countdown now dismisses the popup at 0, and the timer no longer resets when unrelated toasts arrive mid-countdown. |
| 10 | `client/src/pages/resident/ResidentQrPass.jsx` | **Deprecated `includeMargin` prop** on `QRCodeCanvas` (qrcode.react v4 removed it in favour of `marginSize`) plus an unused `flatIdFor` import. | `marginSize={4}`, unused import removed. |

---

## Verification

* `npm run build` — client compiles clean.
* API smoke tests (all green): demo logins · maintenance stats/KPIs · RBAC (resident → admin route `403`) ·
  visitor check-in with `+91 98765 43210` → `9876543210` and `gj-11-ec-2929` → `GJ-11-EC-2929` ·
  9-digit mobile / malformed plate rejected `400` · registration → admin approval → first login ·
  one-account-per-flat `409` · QR pass issue / validate / reuse `409` · Razorpay order + HMAC verify ·
  tampered signature rejected · double payment rejected · complaints / notices / pin / delete ·
  cron bill batch · flat create (`unit 5` → `400`, duplicate → `409`) · owner contact clear/set/validate.
* Socket.io tests: resident `visitor_decision` persists `APPROVED` with `approvedBy: <resident>` and
  streams `visitor_updated` to the guard feed; guard sockets cannot decide.

---

### Run

```bash
npm install
npm run seed        # (or: npm run seed -- --force  to reset)
npm run dev         # API :5000 + Vite :5173
# or single port:
npm run preview     # build + serve everything on :5000
```
