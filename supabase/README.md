# Supabase backend

The app talks to a Supabase project: real login, one shared database, file storage and live updates.
Residents never write bookings, orders or balances directly. They call the functions in
`migrations/20261012010000_actions.sql`, which check the unit, the price and the slot. The AI
assistant will call the same functions as the signed-in resident.

## Files
- `migrations/…_init.sql` tables and row-level security (each unit sees only its own data)
- `migrations/…_actions.sql` booking, cancel, order and payment functions, manager actions
- `migrations/…_storage.sql` private bucket for request photos and receipts
- `seed.sql` units, providers and menus (regenerate with `node scripts/make-seed.mjs`)
- `../scripts/create-users.mjs` creates the sample resident accounts and demo activity

## Set up a new project
1. Create a project at supabase.com. Put its URL and publishable key in `config.js`.
2. SQL editor: run the three migrations in order, then `seed.sql`.
3. Authentication → Sign In / Providers: switch **off** "Allow new users to sign up".
4. Terminal: `node scripts/create-users.mjs`. It asks for the secret key (hidden) and prints the
   one-time passwords. Never put the secret key in this repository.

Residents sign in with their unit code; the app turns it into `<code>@afarinesh.test` for Supabase.

## Notes
- Online payment is simulated. `app_settings.demo_payments` switches it off:
  `update app_settings set value = 'false' where key = 'demo_payments';`
- To make someone a manager (sees the whole building, can update request status):
  `update profiles set app_role = 'manager' where id = '<user id>';`
- Managers update a request with `select set_request_status('<request id>', 'in_progress', 'Name');`
  and the resident's screen updates live.
