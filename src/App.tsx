import { useState, useEffect } from "react";
import { CreateRoom } from "./components/CreateRoom";
import { JoinRoom } from "./components/JoinRoom";
import { GameLobby } from "./components/GameLobby";
import { GameCanvas } from "./components/GameCanvas";
import { v4 as uuidv4 } from "uuid";
import "./style.css";

type GameState = "menu" | "lobby" | "playing";

const isDev = import.meta.env.VITE_ENV === "dev";

export default function App() {
    const [gameState, setGameState] = useState<GameState>("menu");
    const [roomId, setRoomId] = useState<string | null>(null);
    const [roomCode, setRoomCode] = useState<string | null>(null);
    const [playerId, setPlayerId] = useState<string>(uuidv4());
    const [roomPlayerId, setRoomPlayerId] = useState<string | null>(null);
    const [playerNumber, setPlayerNumber] = useState<number>(0);
    const [isHost, setIsHost] = useState(false);

    // In dev mode, bypass menu and go straight to playing
    useEffect(() => {
        if (isDev) {
            setGameState("playing");
            setRoomId("dev-room");
            setRoomPlayerId("dev-player");
            setPlayerNumber(1);
        }
    }, []);

    const handleRoomCreated = (
        id: string,
        code: string,
        pId: string,
        rPlayerId: string,
    ) => {
        console.log("handleRoomCreated called with:", {
            id,
            code,
            pId,
            rPlayerId,
        });
        setRoomId(id);
        setRoomCode(code);
        setPlayerId(pId);
        setRoomPlayerId(rPlayerId);
        setPlayerNumber(1);
        setIsHost(true);
        setGameState("lobby");
        console.log("State updated to lobby");
    };

    const handleRoomJoined = (
        id: string,
        code: string,
        pId: string,
        rPlayerId: string,
        pNum: number,
    ) => {
        console.log("handleRoomJoined called with:", {
            id,
            code,
            pId,
            rPlayerId,
            pNum,
        });
        setRoomId(id);
        setRoomCode(code);
        setPlayerId(pId);
        setRoomPlayerId(rPlayerId);
        setPlayerNumber(pNum);
        setIsHost(false);
        setGameState("lobby");
        console.log("State updated to lobby");
    };

    const handleGameStart = () => {
        setGameState("playing");
    };

    return (
        <div
            className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 
                    flex items-center justify-center p-4"
        >
            {/* In dev mode, skip menu and lobby */}
            {!isDev && gameState === "menu" && (
                <div className="space-y-6">
                    <div className="text-center mb-8">
                        <h1 className="text-5xl font-bold text-white mb-2">
                            Tower Defense Multiplayer Name TBD
                        </h1>
                        <p className="text-slate-400">
                            Connection Test Version
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <CreateRoom
                            onRoomCreated={handleRoomCreated}
                            onError={(err) => console.error(err)}
                        />
                        <JoinRoom
                            onRoomJoined={handleRoomJoined}
                            onError={(err) => console.error(err)}
                        />
                    </div>
                </div>
            )}

            {!isDev && gameState === "lobby" && roomId && roomCode && (
                <GameLobby
                    roomId={roomId}
                    roomCode={roomCode}
                    currentPlayerId={playerId}
                    isHost={isHost}
                    onGameStart={handleGameStart}
                />
            )}

            {gameState === "playing" && roomId && playerId && roomPlayerId && (
                <GameCanvas
                    roomId={roomId}
                    playerId={playerId}
                    roomPlayerId={roomPlayerId}
                    playerNumber={playerNumber}
                />
            )}
        </div>
    );
}
