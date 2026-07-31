-- Rem-Lays initial schema
-- auth.users already exists (managed by Supabase Auth) — no need to redefine it.

create table public.devices (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  device_name       text not null,
  device_type       text not null check (device_type in ('desktop','phone')),
  fcm_token         text,
  last_synced_at    timestamptz,
  last_seen_at      timestamptz,
  created_at        timestamptz not null default now(),
  revoked_at        timestamptz
);

create table public.items (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  source_device_id  uuid references public.devices(id),
  type              text not null check (type in ('image','video','reel','link','text')),
  payload           jsonb not null,
  storage_key       text,
  thumbnail_key     text,
  status            text not null default 'unseen' check (status in ('unseen','seen','deleted')),
  created_at        timestamptz not null default now(),
  seen_at           timestamptz
);

create index idx_items_user_status_created on public.items (user_id, status, created_at desc);
create index idx_devices_user on public.devices (user_id);

-- Row Level Security: every table a client can touch must have this,
-- or the anon key (which is public by design) would expose every user's rows.
alter table public.devices enable row level security;
alter table public.items   enable row level security;

create policy "users manage their own devices"
  on public.devices for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users manage their own items"
  on public.items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Enable Realtime on items so postgres_changes subscriptions work.
alter publication supabase_realtime add table public.items;

-- Storage bucket for media (images/video/reel thumbnails).
-- Private by default — clients only ever get in/out via signed URLs from
-- the presign-upload Edge Function, never a public bucket URL.
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

create policy "users manage their own media objects"
  on storage.objects for all
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
