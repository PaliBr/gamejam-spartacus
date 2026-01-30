import Phaser from "phaser";
import { supabase } from "../../lib/supabase/client";

export class MainGameScene extends Phaser.Scene {
    gameText: Phaser.GameObjects.Text;

    private channel!: any;
    private localPlayerId!: string;
    private roomCode!: string;
    private roomId?: string;
    private pollTimer?: Phaser.Time.TimerEvent;
    private roomInitAttempts = 0;

    private lastBroadcast = 0;
    private BROADCAST_INTERVAL = 50;

    constructor() {
        super("MainGameScene");
    }

    init(data: any) {
        this.localPlayerId = data.localPlayerId;
        this.roomCode = data.roomCode;
        this.channel = data.channel;
    }

    private async updateRoomPlayersCount() {
        if (!this.roomId) return;

        const { data, count, error } = await supabase
            .from("room_players")
            .select("room_player_id", { count: "exact" })
            .eq("room_id", this.roomId);

        if (error) {
            console.error("room_players count error:", error);
        }

        const total = typeof count === "number" ? count : (data?.length ?? 0);

        if (total >= 2) {
            this.gameText.setText("Ready to play");
        } else {
            this.gameText.setText(`Your room code: ${this.roomCode}`);
        }
    }

    private async initRoomPlayersWatcher() {
        const { data: room, error } = await supabase
            .from("rooms")
            .select("room_id")
            .eq("code", this.roomCode)
            .single();

        if (error || !room) {
            this.roomInitAttempts += 1;
            if (this.roomInitAttempts <= 20) {
                this.time.delayedCall(500, () => this.initRoomPlayersWatcher());
            }
            return;
        }

        this.roomId = room.room_id;

        await this.updateRoomPlayersCount();

        // Use the SAME channel passed from CreateRoom/JoinRoom
        this.channel
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "room_players",
                    filter: `room_id=eq.${this.roomId}`,
                },
                async () => {
                    await this.updateRoomPlayersCount();
                },
            )
            .subscribe();

        this.pollTimer = this.time.addEvent({
            delay: 1000,
            loop: true,
            callback: () => this.updateRoomPlayersCount(),
        });

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.pollTimer?.remove();
        });
    }

    create() {
        this.gameText = this.add
            .text(
                this.scale.width * 0.5,
                this.scale.height * 0.477,
                `Your room code: ${this.roomCode}`,
                {
                    fontFamily: "Arial Black",
                    fontSize: 38,
                    color: "#ffffff",
                    stroke: "#000000",
                    strokeThickness: 8,
                    align: "center",
                },
            )
            .setOrigin(0.5)
            .setDepth(100);

        this.initRoomPlayersWatcher();
    }
}
