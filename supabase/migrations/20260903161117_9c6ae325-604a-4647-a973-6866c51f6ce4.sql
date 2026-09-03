grant execute on function public.has_role(uuid, public.app_role) to authenticated;

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