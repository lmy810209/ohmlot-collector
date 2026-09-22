-- Personal-robot price & FCC archive. Run once in the Supabase SQL editor.

create table if not exists models (
  id text primary key,                 -- slug, e.g. 'unitree-g1'
  name text not null,
  manufacturer text not null,
  hq_country text,
  category text check (category in ('humanoid','quadruped','desktop','arm','other')),
  status text,                         -- shipping / preorder / not_for_sale / discontinued
  price_usd_min numeric,
  price_usd_max numeric,
  price_model text,                    -- purchase / subscription / lease / quote
  subscription_usd_month numeric,
  launch_year int,
  weight_kg numeric,
  height_cm numeric,
  official_url text,
  buy_url text,
  fcc_grantee_code text,
  fcc_ids text[] default '{}',
  fcc_grant_date date,
  resale_policy_note text,
  sources text[] default '{}',
  data_source_license text,
  updated_at timestamptz default now()
);

create table if not exists price_snapshots (
  date date not null,
  model_id text not null references models(id),
  seller text not null,
  variant text not null,
  price_usd numeric not null,
  available boolean,
  url text not null,
  flags text[] default '{}',           -- e.g. 'placeholder_price'
  collected_at timestamptz default now(),
  primary key (date, seller, url, variant)
);
create index if not exists price_snapshots_model_date on price_snapshots (model_id, date);

create table if not exists fcc_grants (
  fcc_id text primary key,
  grantee_code text not null,
  grant_date date,
  description text,
  after_covered_list boolean,          -- grant_date >= 2026-07-28 (FCC DA 26-786)
  first_seen date not null
);

-- Public read, service-role write
alter table models enable row level security;
alter table price_snapshots enable row level security;
alter table fcc_grants enable row level security;
create policy "public read models" on models for select using (true);
create policy "public read prices" on price_snapshots for select using (true);
create policy "public read fcc" on fcc_grants for select using (true);

-- Convenience view: latest non-placeholder price per model/seller
create or replace view latest_prices as
select distinct on (model_id, seller, variant) *
from price_snapshots
where not ('placeholder_price' = any(flags))
order by model_id, seller, variant, date desc;
