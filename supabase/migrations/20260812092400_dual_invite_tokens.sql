-- Add viewer_invite_token to boards table
alter table public.boards add column viewer_invite_token uuid default gen_random_uuid();

-- Update join_board RPC to support joining as viewer or editor
create or replace function join_board(token uuid)
returns uuid as $$
declare
  b_id uuid;
  assigned_role text;
begin
  -- Check if token matches editor token
  select id into b_id from public.boards where invite_token = token;
  
  if b_id is not null then
    assigned_role := 'editor';
  else
    -- Check if token matches viewer token
    select id into b_id from public.boards where viewer_invite_token = token;
    
    if b_id is not null then
      assigned_role := 'viewer';
    end if;
  end if;

  if b_id is null then
    raise exception 'Invalid invite token';
  end if;

  insert into public.board_members (board_id, user_id, role)
  values (b_id, auth.uid(), assigned_role)
  on conflict do nothing;

  return b_id;
end;
$$ language plpgsql security definer;
