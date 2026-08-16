# Supabase migrations

This is the minimal standard Supabase CLI migration layout — just enough structure to make the database reproducible from the repository, without actually requiring the CLI to be installed or the project to be linked.

```
supabase/
  migrations/
    20260815000000_create_project_inquiries.sql
```

## What's here

- `migrations/` — plain, numbered SQL files. Each one is meant to be readable and reviewable on its own, and safe to run in order against a fresh Supabase project.

## What's deliberately not here

There is no `supabase/config.toml` and no CLI project link. Generating those properly requires either running `supabase init` and `supabase link` (which prompts for authentication and picks a specific project) or hand-writing a config file that claims to be CLI-verified when it isn't. Per this milestone's instructions, the Supabase CLI wasn't installed, authenticated, or linked to any project — that's a manual account action, so it's being flagged here and in the audit report rather than done silently.

If the team later wants full CLI workflows (`supabase db push`, `supabase db diff`, local dev database, etc.), the next step is: install the CLI, run `supabase login`, then `supabase link --project-ref <ref>` against the real project — all of which need a human at the keyboard.

## How to apply this migration today

Without the CLI, the SQL in `migrations/` can be run directly in the Supabase SQL editor, in filename order. Each file is idempotent-safe (`if not exists` / `or replace` / `drop ... if exists` guards) so re-running one that's already applied should not error or duplicate objects.

See [`docs/supabase-database-permissions.md`](../docs/supabase-database-permissions.md) for why the schema and grants look the way they do, and for a safe checklist to verify the result against the live project.
