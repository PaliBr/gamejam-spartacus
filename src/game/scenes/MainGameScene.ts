import Phaser from "phaser";
import { supabase } from "../../lib/supabase/client";
import { EventBus } from "../EventBus";

export class MainGameScene extends Phaser.Scene {
    gameText: Phaser.GameObjects.Text;

    private channel!: any;
    private localPlayerId!: string;
    private roomCode!: string;

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

    private updateReadyText() {
        const state = this.channel?.presenceState?.() ?? {};
        const count = Object.keys(state).length;

        if (count >= 2) {
            console.log("2");
            this.gameText.setText("Ready to play");
        } else {
            console.log("1");
            this.gameText.setText(`Your room code: ${this.roomCode}`);
        }
    }

    private setupPresenceHandlers() {
        if (!this.channel) return;

        this.channel.on("presence", { event: "sync" }, () => {
            this.updateReadyText();
        });

        this.channel.on("presence", { event: "join" }, () => {
            this.updateReadyText();
        });

        this.channel.on("presence", { event: "leave" }, () => {
            this.updateReadyText();
        });

        this.updateReadyText();
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

        this.setupPresenceHandlers();
    }
}

