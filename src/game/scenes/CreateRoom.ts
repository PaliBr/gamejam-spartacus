import Phaser from "phaser";
import { supabase } from "../../lib/supabase/client";
import { v4 as uuidv4 } from "uuid";

export class CreateRoom extends Phaser.Scene {
    private channel!: any;
    private localPlayerId!: string;
    private roomCode!: string;

    background: Phaser.GameObjects.Image;

    constructor() {
        super("CreateRoom");
    }

    generateRoomCode(): string {
        const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        let code = "";
        for (let i = 0; i < 5; i++) {
            code += characters.charAt(
                Math.floor(Math.random() * characters.length),
            );
        }
        return code;
    }

    initSupabase() {
        this.channel = supabase.channel(`room:${this.roomCode}`, {
            config: { presence: { key: this.localPlayerId } },
        });

        this.channel
            .on("presence", { event: "join" }, ({ newPresences }) => {
                console.log("Newly joined presences: ", newPresences);
            })
            .subscribe(async (status) => {
                if (status === "SUBSCRIBED") {
                    await this.channel.track({
                        online_at: new Date().toISOString(),
                    });
                    const { data: room, error: room_error } = await supabase
                        .from("rooms")
                        .insert({ code: this.roomCode, status: "waiting" })
                        .select()
                        .single();

                    if (room_error) {
                        console.log(room_error);
                    }

                    const { error: error_room_player } = await supabase
                        .from("room_players")
                        .insert({
                            room_id: room.room_id,
                            player_id: this.localPlayerId,
                            x: 0,
                            y: 0,
                            hp: 100,
                        })
                        .select()
                        .single();

                    if (error_room_player) {
                        console.log(error_room_player);
                    }
                }
            });
    }

    create() {
        this.localPlayerId = uuidv4();
        this.roomCode = this.generateRoomCode();

        this.background = this.add.image(
            this.scale.width * 0.5,
            this.scale.height * 0.477,
            "background",
        );

        this.initSupabase();

        this.scene.start("MainGameScene", {
            localPlayerId: this.localPlayerId,
            roomCode: this.roomCode,
            channel: this.channel,
        });
    }
}

