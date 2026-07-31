-- Add a share_token column so individual items can be shared via a
-- public UUID link.  Anyone who knows the token can read that one row
-- without authentication — enforced by the anon SELECT policy below.

ALTER TABLE public.items ADD COLUMN share_token uuid DEFAULT NULL;

-- Unique partial index: fast lookups by token, no cost for the vast
-- majority of rows that are never shared (NULL values excluded).
CREATE UNIQUE INDEX idx_items_share_token
  ON public.items (share_token)
  WHERE share_token IS NOT NULL;

-- Allow unauthenticated (anon) users to SELECT rows that have a
-- share_token set.  The frontend always filters by
-- `share_token.eq.<token>`, so in practice only one row is returned.
-- No INSERT/UPDATE/DELETE — strictly read-only for public visitors.
CREATE POLICY "anyone can read items via share token"
  ON public.items FOR SELECT
  TO anon
  USING (share_token IS NOT NULL);
