import { useState } from "react";
import { RoomService } from "../services/roomService";
import { v4 as uuidv4 } from "uuid";

interface JoinRoomProps {
    onRoomJoined: (
        roomId: string,
        roomCode: string,
        playerId: string,
        roomPlayerId: string,
        playerNumber: number,
    ) => void;
    onError?: (error: string) => void;
}

export function JoinRoom({ onRoomJoined, onError }: JoinRoomProps) {
    const [username, setUsername] = useState("");
    const [roomCode, setRoomCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleJoin = async () => {
        if (!username.trim()) {
            setError("Please enter a username");
            return;
        }

        if (!roomCode.trim()) {
            setError("Please enter a room code");
            return;
        }

        if (roomCode.length !== 5) {
            setError("Room code must be 5 characters");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const playerId = uuidv4();

            const roomService = new RoomService();
            const { room, player } = await roomService.joinRoom(
                roomCode.toUpperCase(),
                playerId,
                username,
            );

            console.log("Successfully joined room:", {
                room,
                roomCode,
                player,
            });
            console.log(
                "Calling onRoomJoined with:",
                room.room_id,
                roomCode.toUpperCase(),
                playerId,
                player.room_player_id,
                2,
            );
            onRoomJoined(
                room.room_id,
                roomCode.toUpperCase(),
                playerId,
                player.room_player_id,
                2,
            );
        } catch (err: any) {
            const errorMessage = err.message || "Failed to join room";
            setError(errorMessage);

            if (onError) {
                onError(errorMessage);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRoomCodeChange = (value: string) => {
        const formatted = value.toUpperCase().slice(0, 5);
        setRoomCode(formatted);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !loading) {
            handleJoin();
        }
    };

    return (
        <div className="p-8 bg-slate-800 rounded-lg shadow-xl max-w-md w-full">
            <h2 className="text-3xl font-bold mb-6 text-center text-white">
                Join Room
            </h2>

            <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                    Username
                </label>
                <input
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={handleKeyPress}
                    maxLength={20}
                    className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 
                     text-white placeholder-slate-400 focus:outline-none 
                     focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    disabled={loading}
                />
            </div>

            <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                    Room Code
                </label>
                <input
                    type="text"
                    placeholder="ABCDEF"
                    value={roomCode}
                    onChange={(e) => handleRoomCodeChange(e.target.value)}
                    onKeyDown={handleKeyPress}
                    maxLength={5}
                    className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 
                     text-white placeholder-slate-400 focus:outline-none 
                     focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50
                     font-mono text-2xl text-center tracking-widest"
                    disabled={loading}
                />
                <p className="text-xs text-slate-400 mt-2 text-center">
                    Enter the 5-character room code
                </p>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg">
                    <p className="text-red-300 text-sm text-center">{error}</p>
                </div>
            )}

            <button
                onClick={handleJoin}
                disabled={loading || !username || !roomCode}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 
                   disabled:cursor-not-allowed p-3 rounded-lg text-white font-semibold
                   transition-colors duration-200 flex items-center justify-center gap-2"
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
                        <span>Joining...</span>
                    </>
                ) : (
                    "Join Room"
                )}
            </button>
        </div>
    );
}

