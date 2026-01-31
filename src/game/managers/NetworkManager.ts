import { supabase } from "../../services/supabase";

export class NetworkManager {
    private roomId: string;
    private playerId: string;
    private sequenceNumber: number = 0;
    private actionQueue: any[] = [];

    constructor(roomId: string, playerId: string) {
        this.roomId = roomId;
        this.playerId = playerId;
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

        await supabase.channel(`room:${this.roomId}`).send({
            type: "broadcast",
            event: "action",
            payload: action,
        });

        await supabase.from("actions").insert(action);

        return action;
    }

    processAction(action: any, gameScene: any) {
        switch (action.action_type) {
            case "hero_move":
                gameScene.updateHeroPosition(
                    action.player_id,
                    action.action_data.x,
                    action.action_data.y,
                );
                break;
            case "send_enemy":
                gameScene.spawnEnemy(
                    action.action_data.enemyType,
                    action.player_id,
                );
                break;
            case "build_tower":
                gameScene.buildTower(
                    action.player_id,
                    action.action_data.towerType,
                    action.action_data.x,
                    action.action_data.y,
                );
                break;
        }
    }
}

