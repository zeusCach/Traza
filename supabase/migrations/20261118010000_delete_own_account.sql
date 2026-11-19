create function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_id uuid := auth.uid();
begin
  if account_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  delete from auth.users where id = account_id;
end;
$$;

revoke execute on function public.delete_own_account() from public, anon, authenticated;
grant execute on function public.delete_own_account() to authenticated;
