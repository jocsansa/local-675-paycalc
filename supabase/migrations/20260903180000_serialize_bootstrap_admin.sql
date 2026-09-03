-- SECURITY FIX: close the race in the bootstrap-admin check.
--
-- handle_new_user() seeds the very first account as admin by testing whether
-- public.user_roles is empty. Read committed gives each concurrent signup its
-- own snapshot, so two sign-ups arriving together both see an empty table and
-- both insert an 'admin' row. Since account creation is open to the public
-- (the "Create account" tab on /login) that is enough for an attacker who can
-- observe or provoke the first legitimate signup to land a second admin
-- alongside it — and admin grants write access to the shared rate tables that
-- price every user's pay.
--
-- Taking an EXCLUSIVE lock before the test serializes signups against each
-- other: the second transaction blocks until the first commits, then sees the
-- row it inserted and takes no role. EXCLUSIVE still permits concurrent
-- SELECTs, and the lock is released at commit, so a signup only ever waits on
-- another signup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_first_user boolean;
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;

  lock table public.user_roles in exclusive mode;

  select not exists (select 1 from public.user_roles) into is_first_user;
  if is_first_user then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;

  return new;
end;
$$;
