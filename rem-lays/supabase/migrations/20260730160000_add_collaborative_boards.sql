-- Create boards table
create table public.boards (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references auth.users(id) on delete cascade,
  name              text not null,
  invite_token      uuid default gen_random_uuid(),
  created_at        timestamptz not null default now()
);

-- Create board members table
create table public.board_members (
  board_id          uuid not null references public.boards(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  role              text not null default 'member' check (role in ('owner','member')),
  joined_at         timestamptz not null default now(),
  primary key (board_id, user_id)
);

-- Add board_id to items
alter table public.items add column board_id uuid references public.boards(id) on delete cascade;

-- RLS setup
alter table public.boards enable row level security;
alter table public.board_members enable row level security;

-- Boards Policies
create policy "members can view boards" on public.boards for select
  using (exists (select 1 from public.board_members where board_members.board_id = boards.id and board_members.user_id = auth.uid()));

create policy "users can create boards" on public.boards for insert
  with check (auth.uid() = owner_id);

create policy "owners can update boards" on public.boards for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "owners can delete boards" on public.boards for delete
  using (auth.uid() = owner_id);

-- Board Members Policies
create policy "members can view board members" on public.board_members for select
  using (exists (select 1 from public.board_members bm where bm.board_id = board_members.board_id and bm.user_id = auth.uid()));

create policy "owners can manage board members" on public.board_members for all
  using (exists (select 1 from public.board_members bm where bm.board_id = board_members.board_id and bm.user_id = auth.uid() and bm.role = 'owner'));

create policy "members can leave board" on public.board_members for delete
  using (auth.uid() = user_id);

-- Items Policies Extensions
create policy "board members can view board items" on public.items for select
  using (board_id is not null and exists (select 1 from public.board_members where board_members.board_id = items.board_id and board_members.user_id = auth.uid()));

create policy "board owner can delete board items" on public.items for delete
  using (board_id is not null and exists (select 1 from public.board_members where board_members.board_id = items.board_id and board_members.user_id = auth.uid() and board_members.role = 'owner'));

-- RPC for joining a board with a token
create or replace function join_board(token uuid)
returns uuid as $$
declare
  b_id uuid;
begin
  select id into b_id from public.boards where invite_token = token;
  if b_id is null then
    raise exception 'Invalid invite token';
  end if;

  insert into public.board_members (board_id, user_id, role)
  values (b_id, auth.uid(), 'member')
  on conflict do nothing;

  return b_id;
end;
$$ language plpgsql security definer;
