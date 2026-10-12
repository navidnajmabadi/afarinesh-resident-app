# Afarinesh Resident App

Responsive resident app (desktop and mobile, iPhone-first) for the Afarinesh Sabz tower. Persian, right-to-left, with light and dark themes.

**Live app:** https://navidnajmabadi.github.io/afarinesh-resident-app/

Sample accounts: unit `1204` / password `1234`, unit `407` / password `4321`.

## What works
- Welcome screens on first login, plus a short guided tour the first time each section opens (Profile → راهنمای برنامه replays it)
- Services ordered by how much each resident uses them; the most used appear first on Services and Home
- Login with validation, building rules consent, password change, logout
- Home: balance, live request tracking, upcoming bookings, announcements
- Booking flow (time → details → payment) for spa, classes, housekeeping and spaces, with cancellation and refunds
- Service requests (technical, rent & sale) with photo upload and status updates
- Café, kitchen and car-wash ordering with a cart
- Activity tab to follow every request, booking and order
- Finance: unit balance, spending trend, breakdown, transactions with receipts; building income/expense charts by month, facility performance, owners' report
- Weekly report preview and PDF export (`report.html`), plus a ready [sample PDF](weekly-report-sample.pdf)
- Desktop layout with a sidebar and two-column dashboards; mobile layout with a bottom tab bar
- Add bookings to the phone or computer calendar (.ics)
- Add to Home Screen on iPhone for a full-screen app

All data is sample data, stored in the browser's localStorage. Payments and email sending are simulated; there is no backend.

## Files
- `index.html`, `styles.css`, `app.js` — the app
- `shared.js` — sample data, state, charts and report layout (used by the app and the report)
- `report.html` — printable A4 weekly report, receipts and documents
