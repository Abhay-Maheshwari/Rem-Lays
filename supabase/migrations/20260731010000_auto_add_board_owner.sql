-- Create a trigger to automatically add the board owner to board_members
create or replace function public.add_board_owner_to_members()
returns trigger as $$
begin
  insert into public.board_members (board_id, user_id, role)
  values (NEW.id, NEW.owner_id, 'owner')
  on conflict do nothing;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_board_created on public.boards;
create trigger on_board_created
  after insert on public.boards
  for each row execute procedure public.add_board_owner_to_members();

-- Also backfill any existing boards where the owner isn't in board_members
insert into public.board_members (board_id, user_id, role)
select id, owner_id, 'owner' from public.boards
on conflict do nothing;
