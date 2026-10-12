# Supabase backend

The app talks to a Supabase project: real login, one shared database, file storage and live updates.
Residents never write bookings, orders or balances directly. They call the functions in
`migrations/20261012010000_actions.sql`, which check the unit, the price and the slot. The AI
assistant will call the same functions as the signed-in resident.

## Files
- `migrations/…_init.sql` tables and row-level security (each unit sees only its own data)
- `migrations/…_actions.sql` booking, cancel, order and payment functions, manager actions
- `migrations/…_storage.sql` private bucket for request photos and receipts
- `migrations/…_manager.sql` manager action for bookings (done / cancel with full refund)
- `seed.sql` units, providers and menus (regenerate with `node scripts/make-seed.mjs`)
- `../scripts/create-users.mjs` creates the sample resident accounts and demo activity

## Set up a new project
1. Create a project at supabase.com. Put its URL and publishable key in `config.js`.
2. SQL editor: run the migrations in order, then `seed.sql`.
3. Authentication → Sign In / Providers: switch **off** "Allow new users to sign up".
4. Terminal: `node scripts/create-users.mjs`. It asks for the secret key (hidden) and prints the
   one-time passwords. Never put the secret key in this repository.

Residents sign in with their unit code; the app turns it into `<code>@afarinesh.test` for Supabase.
The script also creates the building office account `office` (a manager). Managers sign in the same way
and get the manager screens: summary, requests, orders, bookings and units. Make anyone a manager with
`update profiles set app_role = 'manager' where id = '<user id>';`

## Notes
- Online payment is simulated. `app_settings.demo_payments` switches it off:
  `update app_settings set value = 'false' where key = 'demo_payments';`
- Managers change request, order and booking status from the app. The resident's screen updates live and they get a notification.
