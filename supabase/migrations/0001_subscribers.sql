-- task-prelaunch.md §B: email collection for "Track this robot" / "Notify me". Run this against the real
-- Supabase project before setting NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example).
--
-- Design: the public API (the anon key, used from the browser) never touches `subscribers` directly — not
-- even insert. Every public interaction goes through one of the two SECURITY DEFINER functions at the
-- bottom (`subscribe`, `unsubscribe`), which are the only things granted EXECUTE. This is deliberately
-- stricter than "an insert-only RLS policy" for two reasons:
--   1. Rate limiting (§B.2 "같은 IP 분당 제출 제한") needs to run *before* the insert and needs to persist
--      its own log even when it rejects the request. A rejection inside a trigger (RAISE EXCEPTION) rolls
--      back everything in that transaction, including a same-transaction log write of the very attempt that
--      got rejected — so the log would never grow and the limiter would do nothing. Ordinary control flow
--      inside a function (no exception) doesn't have that problem: `subscribe()` logs the attempt, checks
--      the count, and only then decides whether to insert — the log write commits either way.
--   2. Unsubscribe-by-token can't be a plain "delete your own row" RLS policy: RLS decides which rows are
--      *visible*, not how narrowly the client's own WHERE clause was written, so a policy permissive enough
--      to let a token holder delete "their" row would just as easily let anyone delete every row with a
--      broad filter. `unsubscribe(token)` deletes only the one row that matches the exact token, server-side.

create extension if not exists pgcrypto;

create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  model_id text,                       -- null = "all robots" alert, not scoped to one model
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,            -- null until a double opt-in step exists (not built this pass)
  unsubscribe_token text not null default encode(gen_random_bytes(24), 'hex'),
  source_page text                     -- which page the signup happened on, for our own reference only
);

-- coalesce(model_id, '') so two "all robots" (model_id null) signups from the same email collide correctly —
-- a plain UNIQUE(email, model_id) would treat NULL as distinct from NULL and let that duplicate through.
create unique index if not exists subscribers_email_model_uidx
  on public.subscribers (email, coalesce(model_id, ''));
create unique index if not exists subscribers_unsubscribe_token_uidx
  on public.subscribers (unsubscribe_token);

alter table public.subscribers enable row level security;
revoke all on public.subscribers from anon, authenticated;
-- No RLS policy at all for anon/authenticated on this table — default-deny covers select/insert/update/
-- delete. The explicit revoke above is belt-and-suspenders against any default schema-level grant; RLS with
-- zero policies already blocks everything on its own.

create table if not exists public.signup_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,               -- sha256 of the caller's IP — never the raw IP itself
  attempted_at timestamptz not null default now()
);
create index if not exists signup_attempts_ip_time_idx on public.signup_attempts (ip_hash, attempted_at);
alter table public.signup_attempts enable row level security;
revoke all on public.signup_attempts from anon, authenticated;
-- Same treatment: nothing on the public API can read or write this table directly, only the function below.

-- Cleans up old rows so this table doesn't grow forever; call this from a daily job (e.g. alongside the
-- price collector) once that's wired up — not required for §B itself to work.
create or replace function public.prune_signup_attempts() returns void
language sql security definer set search_path = public as $$
  delete from public.signup_attempts where attempted_at < now() - interval '1 day';
$$;

-- p_email, p_model_id (null = all-robots), p_source_page: the fields a public visitor can supply.
-- Returns 'subscribed' | 'already_subscribed' | 'rate_limited' | 'invalid_email'. Never raises, so a
-- rejected attempt still leaves its signup_attempts row committed for the *next* call's count to see.
create or replace function public.subscribe(p_email text, p_model_id text default null, p_source_page text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_ip text;
  v_ip_hash text;
  v_recent_count int;
  v_email text := lower(trim(p_email));
begin
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return 'invalid_email';
  end if;

  -- Supabase's PostgREST gateway forwards the caller's IP in this request header (or x-forwarded-for on
  -- some setups); see https://supabase.com/docs/guides/database/postgres/row-level-security#accessing-request-headers.
  -- Falls back to a constant (never errors) when the header is absent, e.g. a direct SQL session — that
  -- just means every such caller shares one bucket, not that the function breaks.
  v_ip := coalesce(
    nullif(current_setting('request.headers', true), '')::json ->> 'cf-connecting-ip',
    nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for',
    'unknown'
  );
  v_ip_hash := encode(digest(v_ip, 'sha256'), 'hex');

  insert into public.signup_attempts (ip_hash) values (v_ip_hash);

  select count(*) into v_recent_count
    from public.signup_attempts
    where ip_hash = v_ip_hash and attempted_at > now() - interval '60 seconds';

  if v_recent_count > 3 then
    return 'rate_limited';
  end if;

  insert into public.subscribers (email, model_id, source_page)
    values (v_email, p_model_id, p_source_page)
    on conflict (email, coalesce(model_id, '')) do nothing;

  if not found then
    return 'already_subscribed';
  end if;
  return 'subscribed';
end;
$$;

revoke all on function public.subscribe(text, text, text) from public;
grant execute on function public.subscribe(text, text, text) to anon, authenticated;

-- Deletes the one row matching p_token, if any. Returns whether a row was actually deleted — the
-- /unsubscribe page uses this to show "you're unsubscribed" vs "that link has already been used". Never
-- returns row data, so it can't be used to read the list either.
create or replace function public.unsubscribe(p_token text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_deleted int;
begin
  delete from public.subscribers where unsubscribe_token = p_token;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

revoke all on function public.unsubscribe(text) from public;
grant execute on function public.unsubscribe(text) to anon, authenticated;
