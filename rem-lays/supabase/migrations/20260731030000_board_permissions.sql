-- 1. Alter the check constraint on role to allow 'owner', 'editor', 'viewer'
-- First, drop the existing constraint. We need to find its name, usually it's `board_members_role_check`.
-- If we don't know the exact name, we can drop it by looking it up dynamically, or just drop the table and recreate if we can't (not safe).
-- Actually, Postgres constraint is usually named `board_members_role_check`. Let's assume that, or we can use a PL/pgSQL block to drop it dynamically.

DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.board_members'::regclass AND conname LIKE '%role%';
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.board_members DROP CONSTRAINT ' || constraint_name;
    END IF;
END $$;

-- 2. Migrate existing 'member' roles to 'editor' before adding constraint
UPDATE public.board_members SET role = 'editor' WHERE role = 'member';

-- Add the new constraint
ALTER TABLE public.board_members ADD CONSTRAINT board_members_role_check CHECK (role in ('owner', 'editor', 'viewer'));

-- 3. Modify the join_board RPC to use 'editor' instead of 'member'
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
  values (b_id, auth.uid(), 'editor')
  on conflict do nothing;

  return b_id;
end;
$$ language plpgsql security definer;

-- 4. Update the items RLS policy for insert/update to allow owner and editor, but viewer only read.
-- Wait, currently there is no policy for board items insertion.
-- The existing `users manage their own items` policy:
-- `create policy "users manage their own items" on public.items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);`
-- This policy allows users to insert items with their own user_id, and if they supply a board_id, it just works.
-- To prevent them from adding items to boards they shouldn't add to, we should modify it, but that's complex.
-- Instead, let's just make sure viewers can't insert.
-- We can add a trigger on public.items to ensure board item inserts are authorized.
CREATE OR REPLACE FUNCTION check_board_item_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_role text;
BEGIN
  IF NEW.board_id IS NOT NULL THEN
    SELECT role INTO v_role FROM public.board_members WHERE board_id = NEW.board_id AND user_id = auth.uid();
    IF v_role IS NULL THEN
      RAISE EXCEPTION 'You are not a member of this board.';
    END IF;
    IF v_role = 'viewer' THEN
      RAISE EXCEPTION 'Viewers cannot add items to the board.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_board_item_insert_trigger ON public.items;
CREATE TRIGGER check_board_item_insert_trigger
BEFORE INSERT OR UPDATE ON public.items
FOR EACH ROW EXECUTE FUNCTION check_board_item_insert();


-- 5. RPC functions for Managing Members

-- Get board members with emails
CREATE OR REPLACE FUNCTION get_board_members(b_id uuid)
RETURNS TABLE (
  user_id uuid,
  email text,
  role text,
  joined_at timestamptz
) AS $$
BEGIN
  -- Check if caller is a member
  IF NOT EXISTS (SELECT 1 FROM public.board_members WHERE board_id = b_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT bm.user_id, u.email::text, bm.role, bm.joined_at
  FROM public.board_members bm
  JOIN auth.users u ON u.id = bm.user_id
  WHERE bm.board_id = b_id
  ORDER BY 
    CASE WHEN bm.role = 'owner' THEN 1 ELSE 2 END,
    bm.joined_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update member role
CREATE OR REPLACE FUNCTION update_board_member_role(b_id uuid, target_user_id uuid, new_role text)
RETURNS void AS $$
BEGIN
  -- Check if caller is owner
  IF NOT EXISTS (SELECT 1 FROM public.board_members WHERE board_id = b_id AND user_id = auth.uid() AND role = 'owner') THEN
    RAISE EXCEPTION 'Only board owners can change roles';
  END IF;

  -- Ensure we don't change owner role this way, or we must ensure there's at least one owner.
  -- Simpler: prevent changing owner's role here.
  IF EXISTS (SELECT 1 FROM public.board_members WHERE board_id = b_id AND user_id = target_user_id AND role = 'owner') THEN
    RAISE EXCEPTION 'Cannot change owner role';
  END IF;

  IF new_role NOT IN ('editor', 'viewer') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  UPDATE public.board_members
  SET role = new_role
  WHERE board_id = b_id AND user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove member
CREATE OR REPLACE FUNCTION remove_board_member(b_id uuid, target_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Check if caller is owner
  IF NOT EXISTS (SELECT 1 FROM public.board_members WHERE board_id = b_id AND user_id = auth.uid() AND role = 'owner') THEN
    RAISE EXCEPTION 'Only board owners can remove members';
  END IF;

  -- Cannot remove owner
  IF EXISTS (SELECT 1 FROM public.board_members WHERE board_id = b_id AND user_id = target_user_id AND role = 'owner') THEN
    RAISE EXCEPTION 'Cannot remove owner';
  END IF;

  DELETE FROM public.board_members
  WHERE board_id = b_id AND user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
