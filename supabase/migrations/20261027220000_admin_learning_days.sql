-- Verwaltung: „Tage Serie im Schnitt“ wird zu „Lerntage im Schnitt“ (27.10.2026).
-- In der App zählt die Zahl unter „heute geübt“ jetzt die Lerntage: alle Tage mit Übung, Pausen ziehen nichts ab
-- (vorher: Tage in Folge, nach einem verpassten Tag wieder null). Die Übersicht zählt genauso.
-- overview() liefert dafür learning_days_avg/learning_days_users statt streak_avg/streak_users; die alte
-- Hilfsfunktion admin_private.streak fällt weg (nur overview() hat sie benutzt).
-- Gehört zusammen mit dist/admin.mjs (liest learning_days_avg) in denselben Schwung.

-- Lerntage eines Lernenden aus seinem Tageszähler: jeder gültige Tag mit Übung zählt einmal.
create function admin_private.learning_days(daily jsonb)
returns integer language sql immutable set search_path='' as $$
  select count(distinct admin_private.day(e.k))::integer
  from jsonb_each_text(case when jsonb_typeof(daily)='object' then daily else '{}'::jsonb end) e(k,v)
  where admin_private.day(e.k) is not null and admin_private.amount(e.v)>0
$$;
revoke all on function admin_private.learning_days(jsonb) from public,anon,authenticated;

create or replace function admin_private.overview()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  min_group constant integer:=5;
  today date:=(now() at time zone 'Europe/Berlin')::date;
  week0 date:=date_trunc('week',now() at time zone 'Europe/Berlin')::date;
  result jsonb; act jsonb; weekly jsonb; money jsonb; streaks record;
begin
  -- Aktivität je Lernendem nur als Zwischenergebnis; heraus gehen nur Summen.
  with days as (
    select l.user_id,admin_private.day(e.k) as d,admin_private.amount(e.v) as n
    from public.learning_state l,
      jsonb_each_text(case when jsonb_typeof(l.state->'daily')='object' then l.state->'daily' else '{}'::jsonb end) e(k,v)
  ), agg as (
    select user_id,
      sum(n) filter (where d=today) as n_today,
      sum(n) filter (where d between today-6 and today) as n_7,
      sum(n) filter (where d between today-13 and today-7) as n_prev7,
      max(d) filter (where n>0) as last_day
    from days where d is not null group by user_id
  ), per as (
    select coalesce(a.n_today,0) as n_today,coalesce(a.n_7,0) as n_7,coalesce(a.n_prev7,0) as n_prev7,a.last_day,
      admin_private.learning_days(l.state->'daily') as learned,
      (select count(*) from jsonb_object_keys(case when jsonb_typeof(l.state->'reviews')='object' then l.state->'reviews' else '{}'::jsonb end)) as cards
    from public.learning_state l left join agg a on a.user_id=l.user_id
  )
  select jsonb_build_object(
    'today',count(*) filter (where n_today>0),
    'd7',count(*) filter (where last_day>=today-6),
    'd30',count(*) filter (where last_day>=today-29),
    'practiced_today',case when count(*) filter (where n_today>0)>=min_group then sum(n_today) end,
    'practiced_7',case when count(*) filter (where n_7>0)>=min_group then sum(n_7) end,
    'practiced_prev7',case when count(*) filter (where n_prev7>0)>=min_group then sum(n_prev7) end,
    'learning_days_avg',case when count(*) filter (where learned>0)>=min_group then round(avg(learned) filter (where learned>0),1) end,
    'learning_days_users',count(*) filter (where learned>0),
    'cards_total',case when count(*) filter (where cards>0)>=min_group then sum(cards) end
  ) into act from per;

  select coalesce(jsonb_agg(jsonb_build_object('week',w,'n',coalesce(c.n,0)) order by w),'[]'::jsonb) into weekly
  from (select week0-7*i as w from generate_series(0,11) i) ws
  left join (select date_trunc('week',u.created_at at time zone 'Europe/Berlin')::date wk,count(*) n from auth.users u group by 1) c on c.wk=w;

  select jsonb_build_object(
    'months',coalesce((select jsonb_agg(jsonb_build_object('month',to_char(m.month,'YYYY-MM'),'gross',m.gross,'fees',m.fees,'payments',m.payments,'recurring',m.recurring) order by m.month)
      from admin_private.money_months m where m.month>(date_trunc('month',today)-interval '6 months')::date),'[]'::jsonb),
    'last_payment_at',(select max(last_payment_at) from admin_private.money_months),
    'last_ok',(select last_ok from admin_private.money_sync where id=1),
    'last_error',(select last_error from admin_private.money_sync where id=1),
    'goal',(select month_goal from admin_private.settings where id=1)
  ) into money;

  return jsonb_build_object(
    'min_group',min_group,
    'accounts',jsonb_build_object(
      'total',(select count(*) from auth.users),
      'new7',(select count(*) from auth.users where created_at>=now()-interval '7 days'),
      'with_email',(select count(*) from public.account_emails where verified_at is not null),
      'weekly',weekly),
    'activity',act,
    'classrooms',jsonb_build_object(
      'rooms',(select count(*) from classroom_private.rooms where not archived),
      'members',(select coalesce(sum(admin_private.room_people(r.id)),0) from classroom_private.rooms r where not r.archived)),
    'swarm',jsonb_build_object(
      'names',(select count(*) from support_private.names where active_from is not null and not contributor and (visible_until is null or visible_until>now())),
      'contributors',(select count(*) from support_private.names where contributor and active_from is not null)),
    'money',money,
    'todo',jsonb_build_object(
      'reports',(select count(*) from quality_private.reports where status='open'),
      'errors',(select count(*) from admin_private.client_errors where status='new'),
      'feedback',(select count(*) from admin_private.feedback where status='open'))
  );
end $$;

revoke all on function admin_private.overview() from public,anon,authenticated;

drop function admin_private.streak(jsonb,date);
