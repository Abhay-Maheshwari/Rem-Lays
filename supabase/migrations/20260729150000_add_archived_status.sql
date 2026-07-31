alter table public.items drop constraint items_status_check;
alter table public.items add constraint items_status_check check (status in ('unseen','seen','deleted','archived'));
