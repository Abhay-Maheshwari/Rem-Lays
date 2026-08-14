-- Add auto_assign_hashtags column to boards
alter table public.boards add column auto_assign_hashtags text[] default '{}';
