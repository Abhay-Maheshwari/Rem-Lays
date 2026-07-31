-- Update the RPC to bypass RLS so both owners AND regular members can reorder their own sidebars
create or replace function update_board_order(board_ids uuid[])
returns void as $$
begin
  update public.board_members bm
  set order_index = t.ordinality
  from unnest(board_ids) with ordinality as t(id, ordinality)
  where bm.board_id = t.id
    and bm.user_id = auth.uid();
end;
$$ language plpgsql security definer;
