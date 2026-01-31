import { useState } from "react";
import { RoomService } from "../services/roomService";
import { v4 as uuidv4 } from "uuid";

interface CreateRoomProps {
    onRoomCreated: (
        roomId: string,
        roomCode: string,
        playerId: string,
        roomPlayerId: string,
    ) => void;
    onError?: (error: string) => void;
}

export function CreateRoom({ onRoomCreated, onError }: CreateRoomProps) {
    const [username, setUsername] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCreate = async () => {
        if (!username.trim()) {
            setError("Please enter a username");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const playerId = uuidv4();

            const roomService = new RoomService();
            const { room, roomCode, player } = await roomService.createRoom(
                playerId,
                username,
            );

            console.log("Room created:", { room, roomCode, player });
            console.log("Room ID:", room.room_id);
            console.log(
                "Calling onRoomCreated with:",
                room.room_id,
                roomCode,
                playerId,
                player.room_player_id,
            );

            onRoomCreated(
                room.room_id,
                roomCode,
                playerId,
                player.room_player_id,
            );
        } catch (err: any) {
            const errorMessage = err.message || "Failed to create room";
            setError(errorMessage);

            if (onError) {
                onError(errorMessage);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !loading) {
            handleCreate();
        }
    };

    return (
        <div className="p-8 bg-slate-800 rounded-lg shadow-xl max-w-md w-full">
            <h2 className="text-3xl font-bold mb-6 text-center text-white">
                Create Room
            </h2>

            <div className="mb-6">
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

            {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg">
                    <p className="text-red-300 text-sm text-center">{error}</p>
                </div>
            )}

            <button
                onClick={handleCreate}
                disabled={loading || !username}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-600 
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
                        <span>Creating...</span>
                    </>
                ) : (
                    "Create Room"
                )}
            </button>

            <div className="mt-6 p-4 bg-slate-700/50 rounded-lg">
                <h3 className="text-sm font-semibold text-slate-300 mb-2">
                    How it works:
                </h3>
                <ul className="text-xs text-slate-400 space-y-1">
                    <li>• You'll receive a unique 5-character room code</li>
                    <li>• Share the code with your friend</li>
                    <li>• Game starts when both players are ready</li>
                </ul>
            </div>
        </div>
    );
}

