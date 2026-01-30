import Phaser from "phaser";
import { supabase } from "../../lib/supabase/client";
import { EventBus } from "../EventBus";
import { v4 as uuidv4 } from "uuid";

export class JoinRoom extends Phaser.Scene {
    background: Phaser.GameObjects.Image;
    private errorText?: Phaser.GameObjects.Text;
    private inputElement!: HTMLInputElement;

    private channel!: any;
    private localPlayerId!: string;
    private roomCode!: string;

    private removeInputField() {
        if (this.inputElement && this.inputElement.parentNode) {
            this.inputElement.parentNode.removeChild(this.inputElement);
        }
    }

    constructor() {
        super("JoinRoom");
    }

    showError(message: string) {
        if (this.errorText) {
            this.errorText.destroy();
        }

        this.errorText = this.add
            .text(this.scale.width * 0.5, this.scale.height * 0.6, message, {
                fontFamily: "Arial Black",
                fontSize: 20,
                color: "#ff0000",
                stroke: "#000000",
                strokeThickness: 4,
                align: "center",
            })
            .setOrigin(0.5)
            .setDepth(100);

        if (this.inputElement) {
            this.inputElement.value = "";
            this.inputElement.focus();
        }
    }

    private cleanup() {
        if (this.channel) {
            this.channel.unsubscribe();
            this.channel = null;
        }
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
                        .select("*, room_players(*)")
                        .eq("code", this.roomCode)
                        .single();

                    if (room_error || !room) {
                        console.error("Room error:", room_error);
                        this.showError(
                            "Room not found. Please check the code.",
                        );
                        this.cleanup();
                        return;
                    }

                    if (
                        room.room_players &&
                        room.room_players.length >= (room.max_players || 2)
                    ) {
                        this.showError("Room is full.");
                        this.cleanup();
                        return;
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
                        console.error(
                            "Error creating player:",
                            error_room_player,
                        );
                        this.showError(
                            "Failed to join room. Please try again.",
                        );
                        this.cleanup();
                        return;
                    }

                    this.removeInputField();
                    this.scene.start("RoomInit", {
                        localPlayerId: this.localPlayerId,
                        roomCode: this.roomCode,
                        channel: this.channel,
                    });

                    this.scene.stop("JoinRoom");
                }
            });
    }

    joinRoom() {
        if (this.errorText) {
            this.errorText.destroy();
            this.errorText = undefined;
        }

        this.initSupabase();

        console.log(this.roomCode);
    }

    createInputField() {
        this.inputElement = document.createElement("input");
        this.inputElement.type = "text";
        this.inputElement.placeholder = "Enter room code";
        this.inputElement.maxLength = 5;
        this.inputElement.style.position = "absolute";
        this.inputElement.style.left = "50%";
        this.inputElement.style.top = "50%";
        this.inputElement.style.transform = "translate(-50%, -50%)";
        this.inputElement.style.padding = "10px";
        this.inputElement.style.fontSize = "18px";
        this.inputElement.style.width = "200px";
        this.inputElement.style.textAlign = "center";
        this.inputElement.style.textTransform = "uppercase";
        this.inputElement.style.border = "2px solid #fff";
        this.inputElement.style.borderRadius = "5px";
        this.inputElement.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
        this.inputElement.style.color = "#fff";

        this.inputElement.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                this.roomCode = this.inputElement.value.toUpperCase();
                if (this.roomCode.length === 5) {
                    this.joinRoom();
                }
            }
        });

        document.body.appendChild(this.inputElement);
        this.inputElement.focus();
    }

    create() {
        this.localPlayerId = uuidv4();

        this.createInputField();

        EventBus.emit("current-scene-ready-2", this);
    }
}

