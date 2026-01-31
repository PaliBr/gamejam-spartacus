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

export function GameCanvas({
    roomId,
    playerId,
    roomPlayerId,
    playerNumber,
}: GameCanvasProps) {
    const gameRef = useRef<Phaser.Game | null>(null);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const actionsChannelRef = useRef<RealtimeChannel | null>(null);
    const [connected, setConnected] = useState(false);
    const [latency, setLatency] = useState(0);
    const [messageCount, setMessageCount] = useState(0);

    useEffect(() => {
        const initialize = async () => {
            initializeGame();

            await setupRealtimeConnection();
            await setupActionsListener();

            setupEventListeners();
        };

        initialize();

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
                broadcast: { self: false, ack: true },
                presence: { key: playerId },
            },
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

    const setupActionsListener = async () => {
        console.log(`🎧 Setting up actions listener for room: ${roomId}`);
        console.log(`   Current player roomPlayerId: ${roomPlayerId}`);
        console.log(`   Current player number: ${playerNumber}`);

        // First, check if there are any existing actions
        const { data: existingActions, error: queryError } = await supabase
            .from("actions")
            .select("*")
            .eq("room_id", roomId)
            .order("timestamp", { ascending: false })
            .limit(5);

        if (queryError) {
            console.error("❌ Error querying actions:", queryError);
        } else {
            console.log("📋 Existing actions in DB:", existingActions);
        }

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
                    const action = payload.new;
                    console.log("🔔 New action received:", action);
                    console.log("  - Action player_id:", action.player_id);
                    console.log(
                        "  - Action player_id type:",
                        typeof action.player_id,
                    );
                    console.log("  - Current roomPlayerId:", roomPlayerId);
                    console.log(
                        "  - Current roomPlayerId type:",
                        typeof roomPlayerId,
                    );
                    console.log(
                        "  - Exact match (===)?",
                        action.player_id === roomPlayerId,
                    );
                    console.log(
                        "  - Loose match (==)?",
                        action.player_id == roomPlayerId,
                    );

                    // Only process if it's not from this player
                    if (action.player_id !== roomPlayerId) {
                        console.log("✅ Processing action from other player");
                        setMessageCount((prev) => prev + 1);

                        if (action.action_type === "hero_move") {
                            console.log(
                                "🎮 Hero move action detected:",
                                action.action_data,
                            );

                            // Calculate latency
                            if (action.timestamp) {
                                const latency =
                                    Date.now() -
                                    new Date(action.timestamp).getTime();
                                setLatency(latency);
                            }

                            // Send to Phaser
                            console.log(
                                "📢 Dispatching heroMoved event with:",
                                {
                                    playerId: action.player_id,
                                    playerNumber:
                                        action.action_data.playerNumber,
                                    x: action.action_data.x,
                                    y: action.action_data.y,
                                },
                            );

                            window.dispatchEvent(
                                new CustomEvent("heroMoved", {
                                    detail: {
                                        playerId: action.player_id,
                                        playerNumber:
                                            action.action_data.playerNumber,
                                        x: action.action_data.x,
                                        y: action.action_data.y,
                                    },
                                }),
                            );
                        }
                    } else {
                        console.log("⏭️ Skipping action from this player");
                    }
                },
            )
            .subscribe((status, err) => {
                console.log(
                    `📡 Actions channel subscription status: ${status}`,
                );
                if (err) {
                    console.error(`❌ Subscription error:`, err);
                }
                if (status === "SUBSCRIBED") {
                    console.log(
                        `✅ Actions listener active for room ${roomId}`,
                    );
                } else if (status === "CHANNEL_ERROR") {
                    console.error(`❌ Actions channel error!`);
                } else if (status === "TIMED_OUT") {
                    console.error(`⏰ Actions channel timed out!`);
                } else if (status === "CLOSED") {
                    console.warn(`🚪 Actions channel closed`);
                }
            });

        actionsChannelRef.current = actionsChannel;
        console.log(`📌 Actions channel reference stored`);
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
        };

        window.addEventListener("sendHeroMove", handleSendHeroMove);

        // Cleanup
        return () => {
            window.removeEventListener("sendHeroMove", handleSendHeroMove);
        };
    };

    const cleanup = async () => {
        if (actionsChannelRef.current) {
            await supabase.removeChannel(actionsChannelRef.current);
        }
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

