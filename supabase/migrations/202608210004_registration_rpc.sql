create or replace function public.complete_player_registration(
  p_telegram_id text,
  p_username text
)
returns public.players
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_player public.players;
begin
  update public.players
  set username = left(trim(p_username), 32),
      is_registered = true,
      total_tokens = case when is_registered then total_tokens else round(total_tokens + 100, 2) end
  where telegram_id = p_telegram_id
  returning * into updated_player;

  if updated_player.telegram_id is null then
    raise exception 'Player % not found', p_telegram_id;
  end if;

  return updated_player;
end;
$$;

grant execute on function public.complete_player_registration(text, text) to anon, authenticated;
