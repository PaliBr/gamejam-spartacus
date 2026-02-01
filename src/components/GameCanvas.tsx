import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { supabase } from "../services/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";
import { MainGameScene } from "../game/scenes/MainGameScene";
import { NetworkManager } from "../game/managers/NetworkManager";

interface GameCanvasProps {
    roomId: string;
    playerId: string;
    roomPlayerId: string;
    playerNumber: number;
}

const isDev = import.meta.env.VITE_ENV === "dev";

export function GameCanvas({
    roomId,
    playerId,
    roomPlayerId,
    playerNumber,
}: GameCanvasProps) {
    const gameRef = useRef<Phaser.Game | null>(null);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const networkManagerRef = useRef<NetworkManager | null>(null);
    const [connected, setConnected] = useState(false);
    const [latency, setLatency] = useState(0);
    const [messageCount, setMessageCount] = useState(0);
    const [isPortrait, setIsPortrait] = useState(
        window.innerHeight > window.innerWidth,
    );
    const isMobile =
        /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent,
        );

    useEffect(() => {
        const initialize = async () => {
            initializeGame();

            // Skip network setup in dev mode
            if (!isDev) {
                await setupRealtimeConnection();
                setupEventListeners();
            }
        };

        initialize();

        // Mobile orientation listener
        const handleOrientationChange = () => {
            const newIsPortrait = window.innerHeight > window.innerWidth;
            setIsPortrait(newIsPortrait);

            // Request fullscreen when landscape
            if (!newIsPortrait && isMobile) {
                const element = document.documentElement;
                if (element.requestFullscreen) {
                    element.requestFullscreen().catch((err) => {
                        console.log("Fullscreen request failed:", err);
                    });
                }
            }
        };

        window.addEventListener("orientationchange", handleOrientationChange);
        window.addEventListener("resize", handleOrientationChange);

        return () => {
            window.removeEventListener(
                "orientationchange",
                handleOrientationChange,
            );
            window.removeEventListener("resize", handleOrientationChange);
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
            scene: [MainGameScene],
            physics: {
                default: "arcade",
                arcade: {
                    debug: false,
                },
            },
            scale: {
                mode: Phaser.Scale.FIT,
                autoCenter: Phaser.Scale.CENTER_BOTH,
            },
        };

        gameRef.current = new Phaser.Game(config);

        // Create network manager
        const networkManager = new NetworkManager(roomId, roomPlayerId);
        networkManagerRef.current = networkManager;

        // Start MainGameScene with proper data
        gameRef.current.scene.start("MainGameScene", {
            roomId,
            playerId,
            roomPlayerId,
            playerNumber,
            networkManager,
        });
    };

    const setupRealtimeConnection = async () => {
        const channel = supabase.channel(`game:${roomId}`, {
            config: {
                broadcast: { self: false, ack: false }, // Disable ack for faster broadcast
                presence: { key: playerId },
            },
        });

        // Listen for broadcast actions (fast, no database)
        channel.on("broadcast", { event: "action" }, ({ payload }) => {
            console.log("⚡ Broadcast action received:", payload);

            // Only process if it's not from this player
            if (payload.player_id !== roomPlayerId) {
                setMessageCount((prev) => prev + 1);

                // Calculate latency
                if (payload.timestamp) {
                    const latency =
                        Date.now() - new Date(payload.timestamp).getTime();
                    setLatency(latency);
                }

                // Handle different action types
                if (payload.action_type === "hero_move") {
                    // Send to Phaser
                    window.dispatchEvent(
                        new CustomEvent("heroMoved", {
                            detail: {
                                playerId: payload.player_id,
                                playerNumber: payload.action_data.playerNumber,
                                x: payload.action_data.x,
                                y: payload.action_data.y,
                            },
                        }),
                    );
                } else if (payload.action_type === "send_enemy") {
                    window.dispatchEvent(
                        new CustomEvent("enemySent", {
                            detail: {
                                playerId: payload.player_id,
                                enemyType: payload.action_data.enemyType,
                            },
                        }),
                    );
                } else if (payload.action_type === "spawn_enemies") {
                    window.dispatchEvent(
                        new CustomEvent("spawnEnemies", {
                            detail: {
                                enemies: payload.action_data.enemies,
                            },
                        }),
                    );
                } else if (payload.action_type === "build_tower") {
                    window.dispatchEvent(
                        new CustomEvent("towerBuilt", {
                            detail: {
                                playerId: payload.player_id,
                                towerId: payload.action_data.towerId,
                                x: payload.action_data.x,
                                y: payload.action_data.y,
                                playerNumber: payload.action_data.playerNumber,
                            },
                        }),
                    );
                } else if (payload.action_type === "build_trap") {
                    window.dispatchEvent(
                        new CustomEvent("trapBuilt", {
                            detail: {
                                playerId: payload.player_id,
                                trapId: payload.action_data.trapId,
                                x: payload.action_data.x,
                                y: payload.action_data.y,
                                trapType: payload.action_data.trapType,
                                playerNumber: payload.action_data.playerNumber,
                            },
                        }),
                    );
                } else if (payload.action_type === "food_gold_sync") {
                    window.dispatchEvent(
                        new CustomEvent("foodGoldSync", {
                            detail: {
                                playerNumber: payload.action_data.playerNumber,
                                food: payload.action_data.food,
                                gold: payload.action_data.gold,
                            },
                        }),
                    );
                } else if (payload.action_type === "enemy_killed") {
                    window.dispatchEvent(
                        new CustomEvent("enemyKilled", {
                            detail: {
                                enemyId: payload.action_data.enemyId,
                            },
                        }),
                    );
                } else if (payload.action_type === "enemies_killed_batch") {
                    // Handle bulk killed enemies
                    payload.action_data.enemyIds.forEach((enemyId: string) => {
                        window.dispatchEvent(
                            new CustomEvent("enemyKilled", {
                                detail: {
                                    enemyId: enemyId,
                                },
                            }),
                        );
                    });
                } else if (payload.action_type === "toggle_mask") {
                    window.dispatchEvent(
                        new CustomEvent("maskToggled", {
                            detail: {
                                playerNumber: payload.action_data.playerNumber,
                                hasMask: payload.action_data.hasMask,
                            },
                        }),
                    );
                } else if (payload.action_type === "toggle_book") {
                    window.dispatchEvent(
                        new CustomEvent("bookToggled", {
                            detail: {
                                playerNumber: payload.action_data.playerNumber,
                                hasBook: payload.action_data.hasBook,
                            },
                        }),
                    );
                }
            }
        });

        // Track presence
        channel.on("presence", { event: "sync" }, () => {
            const state = channel.presenceState();
            const playerCount = Object.keys(state).length;
            console.log(
                `🔄 Presence Sync | ${playerCount}/2 players | State:`,
                state,
            );
            setConnected(playerCount >= 2);
        });

        channel.on("presence", { event: "join" }, ({ key, newPresences }) => {
            const state = channel.presenceState();
            const playerCount = Object.keys(state).length;
            console.log(
                `✅ Player Joined: ${key} | ${playerCount}/2 players | Presences:`,
                newPresences,
            );
            setConnected(playerCount >= 2);
        });

        channel.on("presence", { event: "leave" }, ({ key, leftPresences }) => {
            const state = channel.presenceState();
            const playerCount = Object.keys(state).length;
            console.log(
                `❌ Player Left: ${key} | ${playerCount}/2 players | Presences:`,
                leftPresences,
            );
            setConnected(playerCount >= 2);
        });

        // Subscribe
        await channel.subscribe(async (status) => {
            console.log(`📡 Channel subscription status: ${status}`);
            if (status === "SUBSCRIBED") {
                console.log(
                    `📍 Tracking presence for player ${playerNumber} (${playerId})`,
                );
                const trackResult = await channel.track({
                    user_id: playerId,
                    player_number: playerNumber,
                    online_at: new Date().toISOString(),
                });
                console.log("📍 Track result:", trackResult);

                // Set channel in NetworkManager for broadcasting
                if (networkManagerRef.current) {
                    networkManagerRef.current.setChannel(channel);
                }

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
        // No additional listeners needed - NetworkManager handles broadcasts directly
    };

    const restartWave = () => {
        if (gameRef.current) {
            const scene = gameRef.current.scene.getScene(
                "MainGameScene",
            ) as any;
            if (scene && scene.spawnInitialEnemies) {
                console.log("🔄 Restarting wave...");
                scene.spawnInitialEnemies();
            }
        }
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
            {/* Mobile Portrait Instruction Overlay */}
            {isMobile && isPortrait && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="text-center text-white space-y-6">
                        <div className="text-5xl">📱</div>
                        <h1 className="text-3xl font-bold">
                            Turn to Landscape
                        </h1>
                        <p className="text-xl text-gray-300">
                            Please rotate your device to landscape mode to play
                        </p>
                        <div className="text-6xl animate-bounce">⤴️</div>
                    </div>
                </div>
            )}

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
                        <button
                            onClick={restartWave}
                            className="absolute top-4 left-40 bg-purple-800 hover:bg-purple-700 
                   px-4 py-2 rounded-lg text-white font-semibold transition-colors
                   pointer-events-auto"
                        >
                            🔄 Restart Wave
                        </button>{" "}
                        {messageCount}
                    </div>
                </div>
            </div>

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

