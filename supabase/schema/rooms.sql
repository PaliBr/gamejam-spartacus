create table rooms (
    room_id uuid primary key default gen_random_uuid(),
    name text not null,
    code text not null,
    max_players int not null default 2,
    status text not null check(status in ('waiting', 'playing', 'finished'))
);

create table room_players (
    room_player_id uuid primary key default gen_random_uuid();
    room_id uuid references rooms(room_id) not null on delete cascade,
    player_id uuid not null,
    x int not null,
    y int not null,
    hp int not null,
    last_update timestamptz not null default now()
);