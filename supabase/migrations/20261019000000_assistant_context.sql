-- The assistant remembers what it looked up earlier in a conversation (free slots, menu ids, place ids).
-- The server keeps that "trace" inside each assistant message's meta, but never sends it to the app.
-- Safe to run more than once.
drop function if exists public.ai_history(text, int);
create or replace function public.ai_history(p_unit text, p_limit int default 30, p_with_trace boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_my_unit(p_unit);
  return (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'role', m.role, 'content', m.content,
                 'meta', case when p_with_trace then m.meta else m.meta - 'trace' end, 'at', m.created_at) order by m.created_at), '[]'::jsonb)
          from (select * from public.ai_messages where user_id = auth.uid() and unit_code = p_unit order by created_at desc limit least(p_limit, 100)) m);
end $$;
revoke all on function public.ai_history(text, int, boolean) from public, anon;
grant execute on function public.ai_history(text, int, boolean) to authenticated;
