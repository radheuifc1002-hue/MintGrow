-- Lock newly added power-up RPCs to the verified service-role gateway.
revoke execute on function public.grant_powerup(text,text,text) from public, anon, authenticated;
revoke execute on function public.consume_powerup(text,text) from public, anon, authenticated;
grant execute on function public.grant_powerup(text,text,text) to service_role;
grant execute on function public.consume_powerup(text,text) to service_role;
