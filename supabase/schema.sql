-- Furniture or Living — store schema
-- Run once (Supabase SQL editor) if the MCP migration couldn't be applied.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price integer not null default 0,
  dims text default '',
  tag text default '',
  img text default '',
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null,
  message text default '',
  product text default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  contact text not null,
  address text not null,
  note text default '',
  payment text default 'Pay on delivery',
  items jsonb not null default '[]',
  total integer not null default 0,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value text not null
);

create table if not exists public.admin_config (
  key text primary key,
  value text not null
);

alter table public.products enable row level security;
alter table public.enquiries enable row level security;
alter table public.orders enable row level security;
alter table public.site_settings enable row level security;
alter table public.admin_config enable row level security;

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

insert into public.site_settings (key, value) values
  ('hero_image', 'images/hero.jpg'),
  ('whatsapp', ''),
  ('tagline', 'Your home deserves better.')
on conflict (key) do nothing;

insert into public.admin_config (key, value) values
  ('admin_key', 'fol-admin-8Kx2wQ7mZ')
on conflict (key) do nothing;

insert into public.products (name, price, dims, tag, img, position)
select * from (values
  ('Oslo Center Table', 85000, '100 × 60 × 35 cm', 'Best seller', 'images/center-table.jpg', 1),
  ('Aria Wardrobe', 185000, '120 × 60 × 200 cm', 'New', 'images/wardrobe.jpg', 2),
  ('Atlas Study Desk', 95000, '120 × 60 × 75 cm', '', 'images/desk.jpg', 3),
  ('Malmö TV Console', 120000, '160 × 40 × 50 cm', '', 'images/tv-stand.jpg', 4),
  ('Vika Chest of Drawers', 75000, '80 × 40 × 100 cm', 'Sale', 'images/drawers.jpg', 5),
  ('Natt Nightstand', 38000, '45 × 40 × 55 cm', '', 'images/nightstand.jpg', 6)
) as v(name, price, dims, tag, img, position)
where not exists (select 1 from public.products);
