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
- `migrations/…_roles.sql` the admin role (everything a manager can do, plus data management in later steps)
- `migrations/…_schedules_assistant.sql` opening hours and capacity per place, and everything the assistant needs (proposals, 3-minute hold, read helpers)
- `functions/assistant/` the آف‌بات Edge Function (`core.js` holds the logic and is tested in Node; `index.ts` is the Deno wrapper)
- `seed.sql` units, providers and menus (regenerate with `node scripts/make-seed.mjs`)
- `../scripts/create-users.mjs` creates the accounts (Ali, Navid, Admin) and sample activity for every unit
- `../tests/` database tests on a local Postgres: `cd tests && npm install && npm test`

## Set up a new project
1. Create a project at supabase.com. Put its URL and publishable key in `config.js`.
2. SQL editor: run the migrations in order, then `seed.sql`.
3. Authentication → Sign In / Providers: switch **off** "Allow new users to sign up".
4. Terminal: `node scripts/create-users.mjs`. It asks for the secret key (hidden) and prints the
   one-time passwords. Never put the secret key in this repository.

Residents sign in with their unit code; the app turns it into `<code>@afarinesh.test` for Supabase.
The script creates `ali` (unit 1204), `navid` (unit 907) and `admin` (whole building). Ali and Navid get the password 123456 for testing;
the script asks you to type the Admin password. Managers and admins get the manager screens: summary, requests, orders,
bookings and units. Roles: `resident`, `manager`, `admin`; change one with
`update profiles set app_role = 'manager' where id = '<user id>';`

## The assistant (آف‌بات)
1. Run the migrations (including `…_schedules_assistant.sql`).
2. Supabase → Edge Functions → Secrets → add `OPENAI_API_KEY`. Optional: `OPENAI_MODEL` (default `gpt-4.1-mini`, falls back to `gpt-4o-mini`) and `OPENAI_BASE_URL` (default `https://api.openai.com/v1`).
3. Deploy once from a terminal (needs Node):
   `npx supabase@latest login` then
   `npx supabase@latest functions deploy assistant --project-ref <your project ref> --use-api`
The function never writes data itself. It creates a *proposal*; the resident approves it in the app and `approve_proposal` runs the same checked functions as the buttons. While a proposal is open, its slot is held for 3 minutes.

## Tests
`cd tests && npm install && npm test` runs the database rules and the assistant logic on a local Postgres with a scripted stand-in for OpenAI (no key needed). `bash tests/function/run.sh` (needs Deno) runs the real Edge Function wrapper against mock servers.

## Notes
- Online payment is simulated. `app_settings.demo_payments` switches it off:
  `update app_settings set value = 'false' where key = 'demo_payments';`
- Managers change request, order and booking status from the app. The resident's screen updates live and they get a notification.
