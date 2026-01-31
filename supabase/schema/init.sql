create table rooms (
    room_id uuid primary key default gen_random_uuid(),
    host_id uuid not null,
    code text not null,
    status text not null check(status in ('waiting', 'playing', 'finished')),
    max_players int not null default 2,
    current_players int default 1,
    created_at timestamptz default now(),
    started_at timestamptz
);

-- ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

create table room_players (
    room_player_id uuid primary key default gen_random_uuid();
    room_id uuid references rooms(room_id) not null on delete cascade,
    player_id uuid not null,
    player_number int not null,
    username text not null,
    is_ready boolean default false,
    health int default 100,
    gold int default 500,
    last_heartbeat timestamptz not null default now(),
    created_at timestamptz default now(),
    unique(room_id, player_number)
);

-- ALTER TABLE room_players ENABLE ROW LEVEL SECURITY;

create table states (
  state_id uuid primary key default uuid_generate_v4(),
  room_id uuid references rooms(room_id) on delete cascade,
  game_tick integer default 0,
  timestamp timestamp with time zone default now(),
  state_data jsonb not null -- stores game state snapshot
);

-- ALTER TABLE states ENABLE ROW LEVEL SECURITY;

create table actions (
  action_id uuid primary key default uuid_generate_v4(),
  room_id uuid references rooms(room_id) on delete cascade,
  player_id uuid references room_players(room_player_id) on delete cascade,
  action_type text not null, -- hero_move, send_enemy, build_tower, upgrade_tower
  action_data jsonb not null,
  sequence_number bigint not null,
  timestamp timestamptz default now()
);

-- ALTER TABLE actions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_rooms_code ON rooms(code);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_players_room ON romm_players(room_id);
CREATE INDEX idx_actions_room_seq ON actions(room_id, sequence_number);
CREATE INDEX idx_states_room ON states(room_id);
