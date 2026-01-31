import { supabase } from "./supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

interface GameAction {
    action_id: string;
    room_id: string;
    player_id: string;
    action_type: string;
    action_data: any;
    sequence_number: number;
    timestamp: string;
}

interface PlayerPresence {
    player_id: string;
    online_at: string;
}

export class RoomService {
    private channel: RealtimeChannel | null = null;
    private dbChannels: RealtimeChannel[] = [];
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private currentRoomId: string | null = null;
    private currentPlayerId: string | null = null;

    public onPresenceUpdate?: (players: PlayerPresence[]) => void;
    public onPlayerDisconnected?: (playerId: string) => void;
    public onGameAction?: (action: GameAction) => void;
    public onStateSync?: (state: any) => void;
    public onPlayerJoined?: (player: any) => void;
    public onRoomStatusChanged?: (status: string) => void;

    generateRoomCode(): string {
        const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        let code = "";
        for (let i = 0; i < 5; i++) {
            code += characters.charAt(
                Math.floor(Math.random() * characters.length),
            );
        }
        return code;
    }

    async createRoom(playerId: string, username: string) {
        const roomCode = this.generateRoomCode();

        const { data: room, error } = await supabase
            .from("rooms")
            .insert({
                code: roomCode,
                host_id: playerId,
                status: "waiting",
            })
            .select()
            .single();

        if (error) throw error;

        const { data: player, error: playerError } = await supabase
            .from("room_players")
            .insert({
                room_id: room.room_id,
                player_id: playerId,
                player_number: 1,
                username,
            })
            .select()
            .single();

        if (playerError) throw playerError;

        await this.connectToRoom(room.room_id, playerId);

        return { room, roomCode, player };
    }

    async joinRoom(roomCode: string, playerId: string, username: string) {
        const { data: room, error: roomError } = await supabase
            .from("rooms")
            .select("*, room_players (*)")
            .eq("code", roomCode)
            .eq("status", "waiting")
            .single();

        if (roomError || !room) {
            throw new Error("Room not found or already started");
        }

        if (room.current_players >= room.max_players) {
            throw new Error("Room is full");
        }

        const existingPlayer = room.room_players.find(
            (p: any) => p.player_id === playerId,
        );

        if (existingPlayer) {
            throw new Error("You are already in this room");
        }

        const { data: player, error: joinError } = await supabase
            .from("room_players")
            .insert({
                room_id: room.room_id,
                player_id: playerId,
                player_number: 2,
                username,
            })
            .select()
            .single();

        if (joinError) throw joinError;

        await supabase
            .from("rooms")
            .update({ current_players: 2 })
            .eq("room_id", room.room_id);

        await this.connectToRoom(room.room_id, playerId);

        return { room, player };
    }

    async connectToRoom(roomId: string, playerId: string) {
        this.currentRoomId = roomId;
        this.currentPlayerId = playerId;

        await this.cleanup();

        this.channel = supabase.channel(`room:${roomId}`, {
            config: {
                presence: { key: playerId },
                broadcast: { self: true, ack: true },
            },
        });

        this.channel
            .on("presence", { event: "sync" }, () => {
                const state = this.channel!.presenceState();
                this.handlePresenceSync(state);
            })
            .on("presence", { event: "join" }, ({ key, newPresences }) => {
                // Player joined
            })
            .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
                this.handlePlayerDisconnect(key);
            });

        this.channel
            .on("broadcast", { event: "game_action" }, ({ payload }) => {
                this.handleGameAction(payload);
            })
            .on("broadcast", { event: "sync_state" }, ({ payload }) => {
                this.handleStateSynchronization(payload);
            });

        await this.channel.subscribe(async (status) => {
            if (status === "SUBSCRIBED") {
                await this.channel!.track({
                    player_id: playerId,
                    online_at: new Date().toISOString(),
                });
                this.startHeartbeat(roomId, playerId);
            } else if (status === "CHANNEL_ERROR") {
                console.error("Channel subscription error");
                this.handleReconnection(roomId, playerId);
            } else if (status === "TIMED_OUT") {
                console.error("Channel subscription timed out");
                this.handleReconnection(roomId, playerId);
            }
        });

        this.setupDatabaseListeners(roomId);
    }

    private startHeartbeat(roomId: string, playerId: string) {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        this.heartbeatInterval = setInterval(async () => {
            try {
                await supabase
                    .from("room_players")
                    .update({ last_heartbeat: new Date().toISOString() })
                    .eq("room_id", roomId)
                    .eq("player_id", playerId);
            } catch (error) {
                console.error("Heartbeat failed:", error);
            }
        }, 3000);
    }

    private async handleReconnection(roomId: string, playerId: string) {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error("Max reconnection attempts reached");
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(
            1000 * Math.pow(2, this.reconnectAttempts - 1),
            10000,
        );

        await new Promise((resolve) => setTimeout(resolve, delay));

        try {
            await this.connectToRoom(roomId, playerId);
            this.reconnectAttempts = 0;
        } catch (error) {
            console.error("Reconnection failed:", error);
            this.handleReconnection(roomId, playerId);
        }
    }

    private setupDatabaseListeners(roomId: string) {
        const playersChannel = supabase
            .channel(`db-players:${roomId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "room_players",
                    filter: `room_id=eq.${roomId}`,
                },
                (payload) => {
                    this.handlePlayerChange(payload);
                },
            )
            .subscribe();

        this.dbChannels.push(playersChannel);

        const actionsChannel = supabase
            .channel(`db-actions:${roomId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "actions",
                    filter: `room_id=eq.${roomId}`,
                },
                (payload) => {
                    this.handleNewAction(payload);
                },
            )
            .subscribe();

        this.dbChannels.push(actionsChannel);

        const roomChannel = supabase
            .channel(`db-room:${roomId}`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "rooms",
                    filter: `room_id=eq.${roomId}`,
                },
                (payload) => {
                    this.handleRoomUpdate(payload);
                },
            )
            .subscribe();

        this.dbChannels.push(roomChannel);
    }

    private handlePresenceSync(state: Record<string, any[]>) {
        const players: PlayerPresence[] = [];

        Object.values(state).forEach((presences) => {
            presences.forEach((presence: any) => {
                players.push({
                    player_id: presence.player_id,
                    online_at: presence.online_at,
                });
            });
        });

        if (this.onPresenceUpdate) {
            this.onPresenceUpdate(players);
        }
    }

    private handlePlayerDisconnect(playerId: string) {
        if (this.onPlayerDisconnected) {
            this.onPlayerDisconnected(playerId);
        }

        // Update UI to show player as disconnected ... (10 seconds) for forfeit
    }

    private handleGameAction(action: GameAction) {
        if (this.onGameAction) {
            this.onGameAction(action);
        }
    }

    private handleStateSynchronization(state: any) {
        if (this.onStateSync) {
            this.onStateSync(state);
        }
    }

    private handlePlayerChange(payload: any) {
        if (payload.eventType === "INSERT") {
            if (this.onPlayerJoined) {
                this.onPlayerJoined(payload.new);
            }
        } else if (payload.eventType === "UPDATE") {
            const player = payload.new;

            const lastHeartbeat = new Date(player.last_heartbeat).getTime();
            const now = Date.now();
            const timeSinceHeartbeat = now - lastHeartbeat;

            if (timeSinceHeartbeat > 10000) {
                console.warn("Player heartbeat stale:", player.player_id);
                this.handlePlayerDisconnect(player.player_id);
            }
        } else if (payload.eventType === "DELETE") {
            if (this.onPlayerDisconnected) {
                this.onPlayerDisconnected(payload.old.player_id);
            }
        }
    }

    private handleNewAction(payload: any) {
        const action: GameAction = payload.new;

        if (this.onGameAction) {
            this.onGameAction(action);
        }
    }

    private handleRoomUpdate(payload: any) {
        const room = payload.new;

        if (this.onRoomStatusChanged) {
            this.onRoomStatusChanged(room.status);
        }
    }

    async setPlayerReady(roomId: string, playerId: string, isReady: boolean) {
        const { data, error } = await supabase
            .from("room_players")
            .update({ is_ready: isReady })
            .eq("room_id", roomId)
            .eq("player_id", playerId)
            .select();

        if (error) {
            console.error("setPlayerReady error:", error);
            throw error;
        }

        console.log("setPlayerReady success:", data);
        return data;
    }

    async startGame(roomId: string, hostId: string) {
        console.log(`startGame called: roomId=${roomId}, hostId=${hostId}`);

        const { data: room } = await supabase
            .from("rooms")
            .select("host_id")
            .eq("room_id", roomId)
            .single();

        console.log("Room data:", room);

        if (!room || room.host_id !== hostId) {
            throw new Error("Only host can start the game");
        }

        const { data: players } = await supabase
            .from("room_players")
            .select("*")
            .eq("room_id", roomId);

        console.log("Players data:", players);

        if (!players || players.length !== 2) {
            throw new Error("Need 2 players to start");
        }

        if (!players.every((p) => p.is_ready)) {
            console.error("Not all players ready:", players);
            throw new Error("All players must be ready");
        }

        console.log("Updating room status to playing...");
        const { data: updatedRoom, error } = await supabase
            .from("rooms")
            .update({
                status: "playing",
                started_at: new Date().toISOString(),
            })
            .eq("room_id", roomId)
            .select();

        if (error) {
            console.error("Error updating room:", error);
            throw error;
        }

        console.log("Room updated successfully:", updatedRoom);
    }

    async getRoomDetails(roomId: string) {
        const { data: room, error } = await supabase
            .from("rooms")
            .select("*, room_players (*)")
            .eq("room_id", roomId)
            .single();

        if (error) throw error;
        return room;
    }

    async leaveRoom(roomId: string, playerId: string) {
        // Get the current room status
        const { data: room } = await supabase
            .from("rooms")
            .select("status")
            .eq("room_id", roomId)
            .single();

        // Only delete player records if the game hasn't started yet
        if (room && room.status === "waiting") {
            await supabase
                .from("room_players")
                .delete()
                .eq("room_id", roomId)
                .eq("player_id", playerId);

            const { data: currentRoom } = await supabase
                .from("rooms")
                .select("current_players")
                .eq("room_id", roomId)
                .single();

            if (currentRoom) {
                await supabase
                    .from("rooms")
                    .update({
                        current_players: currentRoom.current_players - 1,
                    })
                    .eq("room_id", roomId);
            }
        }

        await this.cleanup();
    }

    private async cleanup() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        if (this.channel) {
            await supabase.removeChannel(this.channel);
            this.channel = null;
        }

        for (const channel of this.dbChannels) {
            await supabase.removeChannel(channel);
        }
        this.dbChannels = [];
    }

    async disconnect() {
        if (this.currentRoomId && this.currentPlayerId) {
            await this.leaveRoom(this.currentRoomId, this.currentPlayerId);
        }
        await this.cleanup();
    }
}

