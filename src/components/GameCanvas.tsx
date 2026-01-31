import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { supabase } from "../services/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

interface GameCanvasProps {
    roomId: string;
    playerId: string;
    playerNumber: number;
}

export function GameCanvas({
    roomId,
    playerId,
    playerNumber,
}: GameCanvasProps) {
    const gameRef = useRef<Phaser.Game | null>(null);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const [connected, setConnected] = useState(false);
    const [latency, setLatency] = useState(0);
    const [messageCount, setMessageCount] = useState(0);

    useEffect(() => {
        initializeGame();

        setupRealtimeConnection();

        setupEventListeners();

        return () => {
            cleanup();
        };
    }, []);

    const initializeGame = () => {
        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.AUTO,
            parent: "phaser-container",
            width: 1920,
            height: 1080,
            backgroundColor: "#1a1a2e",
            scene: [],
            scale: {
                mode: Phaser.Scale.FIT,
                autoCenter: Phaser.Scale.CENTER_BOTH,
            },
        };

        gameRef.current = new Phaser.Game(config);

        gameRef.current.scene.start("TestGameScene", {
            roomId,
            playerId,
            playerNumber,
        });
    };

    const setupRealtimeConnection = async () => {
        const channel = supabase.channel(`game:${roomId}`, {
            config: {
                broadcast: { self: false, ack: true },
                presence: { key: playerId },
            },
        });

        // Listen for hero movements
        channel.on("broadcast", { event: "hero_move" }, ({ payload }) => {
            console.log("Received hero move:", payload);
            setMessageCount((prev) => prev + 1);

            // Calculate latency
            if (payload.timestamp) {
                const latency = Date.now() - payload.timestamp;
                setLatency(latency);
            }

            // Send to Phaser
            window.dispatchEvent(
                new CustomEvent("heroMoved", {
                    detail: payload,
                }),
            );
        });

        // Track presence
        channel.on("presence", { event: "sync" }, () => {
            const state = channel.presenceState();
            console.log("Presence sync:", state);
            setConnected(Object.keys(state).length > 1);
        });

        channel.on("presence", { event: "join" }, ({ key }) => {
            console.log("Player joined:", key);
        });

        channel.on("presence", { event: "leave" }, ({ key }) => {
            console.log("Player left:", key);
            setConnected(false);
        });

        // Subscribe
        await channel.subscribe(async (status) => {
            console.log("Subscription status:", status);

            if (status === "SUBSCRIBED") {
                await channel.track({
                    user_id: playerId,
                    player_number: playerNumber,
                    online_at: new Date().toISOString(),
                });
                setConnected(true);

                // Notify Phaser
                window.dispatchEvent(
                    new CustomEvent("connectionStatus", {
                        detail: { connected: true },
                    }),
                );
            }
        });

        channelRef.current = channel;
    };

    const setupEventListeners = () => {
        // Listen for hero movement from Phaser
        const handleSendHeroMove = async (e: Event) => {
            const customEvent = e as CustomEvent;
            const { playerNumber, x, y, timestamp } = customEvent.detail;

            if (!channelRef.current) return;

            // Broadcast to other player
            await channelRef.current.send({
                type: "broadcast",
                event: "hero_move",
                payload: {
                    playerNumber,
                    x,
                    y,
                    timestamp,
                },
            });

            console.log("Sent hero move:", { playerNumber, x, y });
        };

        window.addEventListener("sendHeroMove", handleSendHeroMove);

        // Cleanup
        return () => {
            window.removeEventListener("sendHeroMove", handleSendHeroMove);
        };
    };

    const cleanup = async () => {
        if (channelRef.current) {
            await supabase.removeChannel(channelRef.current);
        }
        if (gameRef.current) {
            gameRef.current.destroy(true);
        }
    };

    return (
        <div className="relative w-full h-screen bg-slate-900">
            {/* Phaser Game Container */}
            <div id="phaser-container" className="w-full h-full" />

            {/* Connection Stats Overlay */}
            <div className="absolute top-4 right-4 space-y-2 pointer-events-none">
                {/* Connection Status */}
                <div
                    className={`px-4 py-2 rounded-lg backdrop-blur-sm ${
                        connected
                            ? "bg-green-500/20 border border-green-500"
                            : "bg-red-500/20 border border-red-500"
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <div
                            className={`w-3 h-3 rounded-full ${
                                connected
                                    ? "bg-green-500 animate-pulse"
                                    : "bg-red-500"
                            }`}
                        />
                        <span className="text-white font-semibold">
                            {connected ? "Connected" : "Disconnected"}
                        </span>
                    </div>
                </div>

                {/* Stats */}
                <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg p-4 space-y-2">
                    <div className="text-slate-300 text-sm">
                        <span className="font-semibold">Room:</span>{" "}
                        {roomId.slice(0, 8)}...
                    </div>
                    <div className="text-slate-300 text-sm">
                        <span className="font-semibold">Player:</span>{" "}
                        {playerNumber}
                    </div>
                    <div className="text-slate-300 text-sm">
                        <span className="font-semibold">Latency:</span>{" "}
                        {latency}ms
                    </div>
                    <div className="text-slate-300 text-sm">
                        <span className="font-semibold">Messages:</span>{" "}
                        {messageCount}
                    </div>
                </div>
            </div>

            {/* Instructions */}
            <div className="absolute bottom-4 left-4 bg-slate-800/90 backdrop-blur-sm rounded-lg p-4 max-w-md pointer-events-none">
                <h3 className="text-white font-bold mb-2">
                    Testing Connection:
                </h3>
                <ul className="text-slate-300 text-sm space-y-1">
                    <li>• Use WASD or Arrow Keys to move your hero</li>
                    <li>• Click anywhere on your side to move there</li>
                    <li>• Your hero is on Player {playerNumber}'s side</li>
                    <li>
                        • Watch the other hero move when your opponent moves
                    </li>
                    <li>• Check latency in the top-right corner</li>
                </ul>
            </div>

            {/* Back Button */}
            <button
                onClick={() => window.location.reload()}
                className="absolute top-4 left-4 bg-slate-800 hover:bg-slate-700 
                   px-4 py-2 rounded-lg text-white font-semibold transition-colors
                   pointer-events-auto"
            >
                ← Leave Game
            </button>
        </div>
    );
}

