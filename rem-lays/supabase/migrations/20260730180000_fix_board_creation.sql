-- Allow the board creator (owner_id) to view the board immediately upon creation
-- This fixes the issue where INSERT ... RETURNING fails because the user isn't in board_members yet.
create policy "owners can view their own boards" on public.boards for select
  using (auth.uid() = owner_id);
