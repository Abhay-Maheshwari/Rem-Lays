CREATE OR REPLACE FUNCTION get_board_members(b_id uuid)
RETURNS TABLE (
  user_id uuid,
  email text,
  role text,
  joined_at timestamptz
) AS $$
BEGIN
  -- Check if caller is a member
  IF NOT EXISTS (SELECT 1 FROM public.board_members bm WHERE bm.board_id = b_id AND bm.user_id = auth.uid()) THEN
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
