-- Add order_index to board_members for custom sidebar sorting
alter table public.board_members add column order_index integer not null default 0;

-- Create function to update order_index for a set of boards for the current user
create or replace function update_board_order(board_ids uuid[])
returns void as $$
begin
  update public.board_members bm
  set order_index = t.ordinality
  from unnest(board_ids) with ordinality as t(id, ordinality)
  where bm.board_id = t.id
    and bm.user_id = auth.uid();
end;
$$ language plpgsql security invoker;
