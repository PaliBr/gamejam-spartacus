import { useState, useEffect } from "react";
import { RoomService } from "../services/roomService";
import { supabase } from "../services/supabase";

interface Player {
    room_player_id: string;
    player_id: string;
    username: string;
    player_number: number;
    is_ready: boolean;
    health: number;
    last_heartbeat: string;
}

interface GameLobbyProps {
    roomId: string;
    roomCode: string;
    currentPlayerId: string;
    isHost: boolean;
    onGameStart: () => void;
}

export function GameLobby({
    roomId,
    roomCode,
    currentPlayerId,
    isHost,
    onGameStart,
}: GameLobbyProps) {
    const [players, setPlayers] = useState<Player[]>([]);
    const [roomService] = useState(() => new RoomService());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copiedCode, setCopiedCode] = useState(false);

    useEffect(() => {
        let cleanup: (() => void) | undefined;
        let pollInterval: NodeJS.Timeout;

        const initializeLobby = async () => {
            await loadPlayers();
            await roomService.connectToRoom(roomId, currentPlayerId);
            cleanup = setupRoomService();

            // Poll every 2 seconds as a fallback to ensure sync
            pollInterval = setInterval(() => {
                loadPlayers();
            }, 2000);
        };

        initializeLobby();

        return () => {
            if (cleanup) cleanup();
            if (pollInterval) clearInterval(pollInterval);
            roomService.disconnect();
        };
    }, []);

    const loadPlayers = async () => {
        try {
            const room = await roomService.getRoomDetails(roomId);

            // Check if game has started
            if (room.status === "playing") {
                onGameStart();
            }

            setPlayers(room.room_players || []);
        } catch (err) {
            console.error("Failed to load players:", err);
        }
    };

    const setupRoomService = () => {
        roomService.onPlayerJoined = (player: Player) => {
            setPlayers((prev) => {
                const exists = prev.find(
                    (p) => p.room_player_id === player.room_player_id,
                );
                if (exists) return prev;
                return [...prev, player];
            });
        };

        roomService.onPresenceUpdate = () => {
            loadPlayers();
        };

        roomService.onRoomStatusChanged = (status: string) => {
            if (status === "playing") {
                onGameStart();
            }
        };

        roomService.onPlayerDisconnected = (playerId: string) => {
            setPlayers((prev) =>
                prev.map((p) =>
                    p.player_id === playerId ? { ...p, is_ready: false } : p,
                ),
            );
        };

        // Subscribe to database changes for room_players table
        const playersSubscription = supabase
            .channel(`room_players_${roomId}`)
            .on(
                "postgres_changes",
                {
                    event: "*", // Listen to all events (INSERT, UPDATE, DELETE)
                    schema: "public",
                    table: "room_players",
                    filter: `room_id=eq.${roomId}`,
                },
                (payload) => {
                    loadPlayers();
                },
            )
            .subscribe();

        // Subscribe to room status changes
        const roomSubscription = supabase
            .channel(`rooms_${roomId}`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "rooms",
                    filter: `room_id=eq.${roomId}`,
                },
                (payload) => {
                    const newStatus = (payload.new as any)?.status;
                    if (newStatus === "playing") {
                        onGameStart();
                    }
                },
            )
            .subscribe();

        return () => {
            playersSubscription.unsubscribe();
            roomSubscription.unsubscribe();
        };
    };

    const handleReady = async () => {
        try {
            const currentPlayer = players?.find(
                (p) => p.player_id === currentPlayerId,
            );
            if (!currentPlayer) {
                return;
            }

            const newReadyState = !currentPlayer.is_ready;

            // Update database first
            await roomService.setPlayerReady(
                roomId,
                currentPlayerId,
                newReadyState,
            );

            // Reload from database to ensure we have the latest state
            await loadPlayers();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleStart = async () => {
        if (!isHost) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await roomService.startGame(roomId, currentPlayerId);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const copyRoomCode = () => {
        navigator.clipboard.writeText(roomCode);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
    };

    const allPlayersReady =
        players && players.length === 2 && players.every((p) => p.is_ready);
    const canStart = isHost && allPlayersReady;

    return (
        <div className="p-8 bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full">
            <div className="mb-8">
                <h2 className="text-2xl font-bold mb-3 text-center text-slate-300">
                    Room Code
                </h2>
                <div className="relative">
                    <div
                        className="text-6xl font-mono bg-slate-900 p-6 rounded-lg text-center 
                          text-white tracking-widest border-2 border-slate-700"
                    >
                        {roomCode}
                    </div>
                    <button
                        onClick={copyRoomCode}
                        className="absolute top-2 right-2 p-2 bg-slate-700 hover:bg-slate-600 
                       rounded-lg transition-colors"
                        title="Copy code"
                    >
                        {copiedCode ? (
                            <svg
                                className="w-6 h-6 text-green-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                />
                            </svg>
                        ) : (
                            <svg
                                className="w-6 h-6 text-slate-300"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                            </svg>
                        )}
                    </button>
                </div>
                <p className="text-center text-slate-400 text-sm mt-3">
                    Share this code with your friend to join
                </p>
            </div>

            <div className="mb-6">
                <h3 className="text-xl font-semibold mb-4 text-white flex items-center justify-between">
                    <span>Players ({players?.length || 0}/2)</span>
                    {players?.length === 2 && (
                        <span className="text-sm text-green-400">
                            Room Full
                        </span>
                    )}
                </h3>

                <div className="space-y-3">
                    {[1, 2].map((playerNum) => {
                        const player = players?.find(
                            (p) => p.player_number === playerNum,
                        );

                        if (!player) {
                            return (
                                <div
                                    key={playerNum}
                                    className="flex items-center gap-4 p-4 bg-slate-700/50 rounded-lg border-2 border-dashed border-slate-600"
                                >
                                    <div className="w-12 h-12 rounded-full bg-slate-600 flex items-center justify-center">
                                        <span className="text-slate-400 font-semibold">
                                            {playerNum}
                                        </span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-slate-400 italic">
                                            Waiting for player...
                                        </p>
                                    </div>
                                </div>
                            );
                        }

                        const isCurrentUser =
                            player.player_id === currentPlayerId;

                        return (
                            <div
                                key={player.player_id}
                                className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-colors
                  ${
                      isCurrentUser
                          ? "bg-blue-500/10 border-blue-500"
                          : "bg-slate-700 border-slate-600"
                  }`}
                            >
                                <div
                                    className={`w-12 h-12 rounded-full flex items-center justify-center font-bold
                  ${player.player_number === 1 ? "bg-green-600" : "bg-red-600"}`}
                                >
                                    <span className="text-white text-lg">
                                        {player.player_number}
                                    </span>
                                </div>

                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-white font-semibold">
                                            {player.username}
                                        </p>
                                        {isCurrentUser && (
                                            <span className="text-xs bg-blue-600 px-2 py-1 rounded">
                                                You
                                            </span>
                                        )}
                                        {player.player_id === roomId && (
                                            <span className="text-xs bg-yellow-600 px-2 py-1 rounded">
                                                Host
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-slate-400 text-sm">
                                        Player {player.player_number}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <div
                                        className={`w-3 h-3 rounded-full ${player.is_ready ? "bg-green-500" : "bg-gray-500"}`}
                                    />
                                    <span
                                        className={`text-sm font-medium ${player.is_ready ? "text-green-400" : "text-slate-400"}`}
                                    >
                                        {player.is_ready
                                            ? "Ready"
                                            : "Not Ready"}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg">
                    <p className="text-red-300 text-sm text-center">{error}</p>
                </div>
            )}

            <div className="space-y-3">
                <button
                    onClick={handleReady}
                    className={`w-full p-3 rounded-lg font-semibold transition-colors
            ${
                players?.find((p) => p.player_id === currentPlayerId)?.is_ready
                    ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
                >
                    {players?.find((p) => p.player_id === currentPlayerId)
                        ?.is_ready
                        ? "Cancel Ready"
                        : "Ready Up"}
                </button>

                {isHost && (
                    <button
                        onClick={handleStart}
                        disabled={!canStart || loading}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-600 
                       disabled:cursor-not-allowed p-3 rounded-lg text-white font-semibold
                       transition-colors flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <svg
                                    className="animate-spin h-5 w-5"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                        fill="none"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                </svg>
                                <span>Starting...</span>
                            </>
                        ) : (
                            <>
                                {canStart
                                    ? "Start Game"
                                    : "Waiting for players to be ready"}
                            </>
                        )}
                    </button>
                )}
            </div>

            <div className="mt-6 p-4 bg-slate-700/50 rounded-lg">
                <h4 className="text-sm font-semibold text-slate-300 mb-2">
                    Game Info:
                </h4>
                <ul className="text-xs text-slate-400 space-y-1">
                    <li>• Both players must click "Ready Up" to start</li>
                    <li>• Build towers to defend your territory</li>
                    <li>• Control your hero to support your defense</li>
                </ul>
            </div>
        </div>
    );
}

