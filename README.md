# Afarinesh Resident App

Responsive resident app (desktop and mobile, iPhone-first) for the Afarinesh Sabz tower. Persian, right-to-left, with light and dark themes.

**Live app:** https://navidnajmabadi.github.io/afarinesh-resident-app/

Sign in with your unit code and the password issued to you. See `supabase/README.md` for how accounts are created.

## What works
- First login asks whether you want the short guide; skipping it skips every tour for good (Profile → راهنمای برنامه shows it again)
- **آف‌بات**, the start page: a chat assistant (OpenAI, Persian and English, Grok-like personality) that books, orders and sends requests from plain sentences. It shows a confirm card first; nothing happens until you approve, and the slot is held for 3 minutes meanwhile
- Services ordered by how much each resident uses them; the most used appear first on Services and Home
- Login with validation, building rules consent, password change, logout
- Home: balance, live request tracking, upcoming bookings, announcements
- Booking flow (time → details → payment) for spa, classes, housekeeping and spaces, using each place's real opening hours and capacity (the pool takes several people per slot), with cancellation and refunds
- Service requests (technical, rent & sale) with photo upload and status updates
- Café, kitchen and car-wash ordering with a cart
- Activity tab to follow every request, booking and order
- Finance: unit balance, spending trend, breakdown, transactions with receipts; building income/expense charts by month, facility performance, owners' report
- Weekly report preview and PDF export (`report.html`), plus a ready [sample PDF](weekly-report-sample.pdf)
- Desktop layout with a sidebar and two-column dashboards; mobile layout with a bottom tab bar
- Add bookings to the phone or computer calendar (.ics)
- Add to Home Screen on iPhone for a full-screen app

Data lives in a Supabase database (real login, per-unit privacy rules, live updates). Online payment and report emails are still simulated; there is no payment gateway or mail server connected yet.

## Manager screens
Accounts with the manager or admin role (`admin`) see: summary, requests, orders, bookings and units. Staff assign a request, change its status, mark orders delivered, and mark or cancel bookings (cancelling refunds in full). Residents are notified automatically.

## Files
- `index.html`, `styles.css`, `app.js`, `chat.js`, `manager.js`, `config.js` — the app and its public Supabase settings
- `supabase/` — database structure, rules, server functions and sample data
- `shared.js` — sample data, state, charts and report layout (used by the app and the report)
- `report.html` — printable A4 weekly report, receipts and documents
