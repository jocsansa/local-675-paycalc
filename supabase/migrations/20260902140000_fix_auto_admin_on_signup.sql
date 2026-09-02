-- SECURITY FIX: handle_new_user() previously seeded every new signup with the
-- 'admin' role. Since account creation is open to the public (see the "Create
-- account" tab on /login) and the "_admin" RLS policies on agreements,
-- rate_tables, rate_items, rate_tiers and rate_rules all gate on
-- has_role(auth.uid(),'admin'), this meant any anonymous visitor could
-- self-register and immediately gain write access to shared pricing data used
-- to calculate every user's pay.
--
-- Only the very first account (the one that bootstraps an otherwise-empty
-- deployment) is seeded as admin now. Every later signup gets no role until an
-- existing admin grants one explicitly via public.user_roles.
--
-- NOTE: this migration does not retroactively revoke 'admin' from accounts
-- that self-registered under the old trigger. Audit public.user_roles for
-- unexpected admin rows and delete the ones that were not intentionally
-- granted.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_first_user boolean;
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;

  select not exists (select 1 from public.user_roles) into is_first_user;
  if is_first_user then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;

  return new;
end;
$$;
