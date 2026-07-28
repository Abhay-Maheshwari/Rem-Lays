-- Basic write-rate limiting: rejects a burst of more than 30 item
-- inserts from the same user within a rolling minute. Deliberately
-- simple — a personal project doesn't need sophisticated throttling,
-- just a guardrail against a buggy client or compromised device
-- hammering writes. 30/minute is generous enough that no normal sharing
-- session would ever hit it (that's one item every two seconds,
-- continuously, for a full minute).

create or replace function public.enforce_items_rate_limit()
returns trigger
language plpgsql
as $$
declare
  recent_count integer;
begin
  select count(*) into recent_count
  from public.items
  where user_id = new.user_id
    and created_at > now() - interval '1 minute';

  if recent_count >= 30 then
    raise exception 'Rate limit exceeded: too many items created in the last minute';
  end if;

  return new;
end;
$$;

create trigger items_rate_limit_trigger
before insert on public.items
for each row
execute function public.enforce_items_rate_limit();
