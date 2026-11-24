create table public.online_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 3 and 24),
  avatar_url text,
  active_car_id uuid,
  terms_version integer not null check (terms_version > 0),
  terms_accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index online_profiles_nickname_idx on public.online_profiles(lower(nickname));

create table public.online_wallets (
  user_id uuid primary key references public.online_profiles on delete cascade,
  cr_balance integer not null check (cr_balance >= 0),
  version integer not null default 0,
  updated_at timestamptz not null default now()
);

create table public.online_ratings (
  user_id uuid primary key references public.online_profiles on delete cascade,
  rp integer not null,
  highest_rp integer not null check (highest_rp >= rp),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  draws integer not null default 0 check (draws >= 0),
  total_races integer generated always as (wins + losses + draws) stored,
  win_streak integer not null default 0 check (win_streak >= 0),
  updated_at timestamptz not null default now()
);
create index online_ratings_rank_idx on public.online_ratings(rp desc, wins desc, user_id);

create table public.online_cars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.online_profiles on delete cascade,
  base_car_id text not null,
  nickname text,
  paint text check (paint ~ '^#[0-9a-fA-F]{6}$'),
  purchase_price integer not null check (purchase_price >= 0),
  build_version integer not null check (build_version in (1, 2)),
  build_revision integer not null default 0 check (build_revision >= 0),
  created_at timestamptz not null default now(),
  sold_at timestamptz,
  unique (user_id, id)
);
create index online_cars_garage_idx on public.online_cars(user_id, created_at, id) where sold_at is null;
alter table public.online_profiles add constraint online_profiles_active_fk
  foreign key (user_id, active_car_id) references public.online_cars(user_id, id) deferrable initially deferred;

create table public.online_car_parts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  car_id uuid not null,
  part_id text not null,
  physical_slot text not null,
  installed_at timestamptz not null default now(),
  unique(car_id, physical_slot),
  foreign key(user_id, car_id) references public.online_cars(user_id, id) on delete cascade
);

create table public.online_car_tunes (
  car_id uuid primary key references public.online_cars on delete cascade,
  tune jsonb not null default '{}' check (jsonb_typeof(tune) = 'object'),
  revision integer not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);

create table public.online_inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.online_profiles on delete cascade,
  base_car_id text not null,
  part_id text not null,
  quantity integer not null check (quantity > 0),
  unique (user_id, base_car_id, part_id)
);

create table public.online_car_progression (
  car_id uuid primary key references public.online_cars on delete cascade,
  pp_balance integer not null default 0 check (pp_balance >= 0),
  pp_earned_total integer not null default 0 check (pp_earned_total >= 0),
  pp_spent_total integer not null default 0 check (pp_spent_total >= 0),
  tree_id text not null,
  tree_version integer not null check (tree_version > 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  draws integer not null default 0 check (draws >= 0),
  total_races integer generated always as (wins + losses + draws) stored,
  updated_at timestamptz not null default now(),
  unique (car_id, tree_id, tree_version),
  check (pp_balance = pp_earned_total - pp_spent_total)
);

create table public.online_preparation_nodes (
  tree_id text not null,
  tree_version integer not null check (tree_version > 0),
  node_id text not null,
  branch_id text not null,
  tier integer not null check (tier >= 0),
  cost_pp integer not null check (cost_pp >= 0),
  definition jsonb not null check (jsonb_typeof(definition) = 'object'),
  primary key(tree_id, tree_version, node_id)
);

create table public.online_car_unlocks (
  car_id uuid not null,
  tree_id text not null,
  tree_version integer not null,
  node_id text not null,
  pp_spent integer not null check (pp_spent >= 0),
  unlocked_at timestamptz not null default now(),
  primary key(car_id, tree_version, node_id),
  foreign key(car_id, tree_id, tree_version) references public.online_car_progression(car_id, tree_id, tree_version) on delete cascade,
  foreign key(tree_id, tree_version, node_id) references public.online_preparation_nodes
);

create table public.online_matches (
  id uuid primary key,
  status text not null check (status in ('running', 'completed', 'cancelled')),
  track_id text not null,
  distance_id text not null,
  seed integer not null,
  simulation_version integer not null,
  catalog_version integer not null,
  reward_policy_version integer not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  winner_user_id uuid references public.online_profiles on delete set null,
  cancellation_reason text
);

create table public.online_match_players (
  match_id uuid not null references public.online_matches on delete cascade,
  user_id uuid not null,
  car_id uuid not null,
  build_snapshot jsonb not null,
  build_hash text not null,
  lane smallint not null check (lane in (0, 1)),
  reaction_time double precision,
  elapsed_time double precision,
  total_time double precision,
  trap_speed double precision,
  details jsonb,
  outcome text check (outcome in ('win', 'loss', 'draw', 'forfeit', 'cancelled')),
  cr_reward integer not null default 0 check (cr_reward >= 0),
  rp_delta integer not null default 0,
  pp_reward integer not null default 0 check (pp_reward >= 0),
  reward_reason text,
  primary key(match_id, user_id),
  unique(match_id, lane),
  foreign key(user_id, car_id) references public.online_cars(user_id, id) on delete cascade
);
create index online_match_players_user_idx on public.online_match_players(user_id, match_id);
create index online_match_players_car_idx on public.online_match_players(car_id, match_id);

create table public.online_currency_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.online_profiles on delete cascade,
  car_id uuid,
  currency text not null check (currency in ('CR', 'RP', 'PP')),
  amount integer not null,
  balance_after integer not null,
  reason text not null,
  reference_id text not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique(user_id, currency, idempotency_key),
  foreign key(user_id, car_id) references public.online_cars(user_id, id) on delete cascade,
  check (currency <> 'PP' or car_id is not null)
);
create index online_currency_ledger_user_idx on public.online_currency_ledger(user_id, created_at desc);

create table public.online_operations (
  user_id uuid not null references public.online_profiles on delete cascade,
  operation_id uuid not null,
  request_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(user_id, operation_id)
);

create table public.online_reward_holds (
  user_id uuid primary key references public.online_profiles on delete cascade,
  reward_percent integer not null check (reward_percent between 0 and 99),
  reason text not null check (length(trim(reason)) between 3 and 240),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'online_profiles', 'online_wallets', 'online_ratings', 'online_cars', 'online_car_parts',
    'online_car_tunes', 'online_inventory', 'online_car_progression', 'online_preparation_nodes',
    'online_car_unlocks', 'online_matches', 'online_match_players', 'online_currency_ledger', 'online_operations', 'online_reward_holds'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from public, anon, authenticated', table_name);
    if table_name not in ('online_operations', 'online_reward_holds') then
      execute format('grant select on public.%I to authenticated', table_name);
    end if;
  end loop;
  foreach table_name in array array[
    'online_profiles', 'online_wallets', 'online_ratings', 'online_cars', 'online_car_parts',
    'online_inventory', 'online_match_players', 'online_currency_ledger'
  ] loop
    execute format('create policy read_own on public.%I for select to authenticated using (user_id = (select auth.uid()))', table_name);
  end loop;
  foreach table_name in array array['online_car_tunes', 'online_car_progression', 'online_car_unlocks'] loop
    execute format('create policy read_own on public.%I for select to authenticated using (exists (select 1 from public.online_cars c where c.id = car_id and c.user_id = (select auth.uid())))', table_name);
  end loop;
end;
$$;

create policy read_catalog on public.online_preparation_nodes for select to authenticated using (true);
create policy read_own on public.online_matches for select to authenticated using (
  exists (select 1 from public.online_match_players player where player.match_id = id and player.user_id = (select auth.uid()))
);
