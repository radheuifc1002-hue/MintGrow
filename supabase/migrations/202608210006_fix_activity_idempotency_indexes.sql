-- PostgreSQL unique indexes allow multiple NULLs, so a normal unique index
-- is sufficient and can be inferred by ON CONFLICT(column).
drop index if exists public.game_sessions_client_session_id_uidx;
drop index if exists public.ad_events_client_event_id_uidx;

create unique index if not exists game_sessions_client_session_id_uidx
  on public.game_sessions(client_session_id);

create unique index if not exists ad_events_client_event_id_uidx
  on public.ad_events(client_event_id);
