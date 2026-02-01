import { supabase } from "../../services/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

export class NetworkManager {
    private roomId: string;
    private playerId: string;
    private channel: RealtimeChannel | null = null;
    private sequenceNumber: number = 0;
    private actionQueue: any[] = [];
    private onHeroMoveCallback: ((data: any) => void) | null = null;

    constructor(roomId: string, playerId: string) {
        this.roomId = roomId;
        this.playerId = playerId;
    }

    setChannel(channel: RealtimeChannel) {
        this.channel = channel;
    }

    async sendAction(actionType: string, actionData: any) {
        this.sequenceNumber++;

        const action = {
            room_id: this.roomId,
            player_id: this.playerId,
            action_type: actionType,
            action_data: actionData,
            sequence_number: this.sequenceNumber,
            timestamp: new Date().toISOString(),
        };

        this.actionQueue.push(action);

        // For real-time actions like movement, use broadcast only (fast)
        // For important state changes, also save to database
        const skipDatabase = [
            "hero_move",
            "spawn_enemies",
            "toggle_mask",
            "enemies_killed_batch",
            "toggle_book",
            "food_gold_sync",
            "farm_upgrade",
            "tower_upgrade",
            "trap_upgrade",
            "game_state_sync",
            "spawn_elements",
            "element_pickup",
            "mask_activated",
            "mask_expired",
            "book_activated",
        ];

        if (this.channel) {
            await this.channel.send({
                type: "broadcast",
                event: "action",
                payload: action,
            });
        }

        if (!skipDatabase.includes(actionType)) {
            const { data, error } = await supabase
                .from("actions")
                .insert(action)
                .select();

            if (error) {
                console.error(`❌ Error inserting action:`, error);
            }
        }

        return action;
    }

    onHeroMove(callback: (data: any) => void) {
        this.onHeroMoveCallback = callback;
    }

    processAction(action: any, gameScene: any) {
        switch (action.action_type) {
            case "hero_move":
                // Call the registered callback if it exists
                if (this.onHeroMoveCallback) {
                    this.onHeroMoveCallback({
                        playerId: action.player_id,
                        x: action.action_data.x,
                        y: action.action_data.y,
                    });
                }
                // Also call the game scene method if it exists
                if (gameScene.updateHeroPosition) {
                    gameScene.updateHeroPosition(
                        action.player_id,
                        action.action_data.x,
                        action.action_data.y,
                    );
                }
                break;
            case "send_enemy":
                gameScene.spawnEnemy(
                    action.action_data.enemyType,
                    action.player_id,
                );
                break;
            case "spawn_enemies":
                if (gameScene.spawnEnemies) {
                    gameScene.spawnEnemies(action.action_data.enemies);
                }
                break;
            case "build_tower":
                // Emit event for tower building
                window.dispatchEvent(
                    new CustomEvent("towerBuilt", {
                        detail: {
                            towerId: action.action_data.towerId,
                            x: action.action_data.x,
                            y: action.action_data.y,
                            playerNumber: action.action_data.playerNumber,
                            gold: action.action_data.gold,
                        },
                    }),
                );
                break;
            case "build_trap":
                // Emit event for trap tower building
                window.dispatchEvent(
                    new CustomEvent("trapBuilt", {
                        detail: {
                            trapId: action.action_data.trapId,
                            x: action.action_data.x,
                            y: action.action_data.y,
                            trapType: action.action_data.trapType,
                            playerNumber: action.action_data.playerNumber,
                        },
                    }),
                );
                break;
            case "food_gold_sync":
                // Emit event for food and gold sync
                window.dispatchEvent(
                    new CustomEvent("foodGoldSync", {
                        detail: {
                            playerNumber: action.action_data.playerNumber,
                            food: action.action_data.food,
                            gold: action.action_data.gold,
                        },
                    }),
                );
                break;
            case "farm_upgrade":
                // Emit event for farm upgrade
                window.dispatchEvent(
                    new CustomEvent("farmUpgrade", {
                        detail: {
                            farmId: action.action_data.farmId,
                            level: action.action_data.level,
                            playerNumber: action.action_data.playerNumber,
                            gold: action.action_data.gold,
                        },
                    }),
                );
                break;
            case "tower_upgrade":
                // Emit event for tower upgrade
                window.dispatchEvent(
                    new CustomEvent("towerUpgrade", {
                        detail: {
                            towerId: action.action_data.towerId,
                            level: action.action_data.level,
                            playerNumber: action.action_data.playerNumber,
                            gold: action.action_data.gold,
                        },
                    }),
                );
                break;
            case "trap_upgrade":
                // Emit event for trap tower upgrade
                window.dispatchEvent(
                    new CustomEvent("trapUpgrade", {
                        detail: {
                            trapId: action.action_data.trapId,
                            level: action.action_data.level,
                            playerNumber: action.action_data.playerNumber,
                            gold: action.action_data.gold,
                        },
                    }),
                );
                break;
            case "game_state_sync":
                // Emit event for full game state sync
                window.dispatchEvent(
                    new CustomEvent("gameStateSync", {
                        detail: action.action_data,
                    }),
                );
                break;
        }
    }
}

