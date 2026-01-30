import { GameObjects, Scene } from "phaser";

import { EventBus } from "../EventBus";

export class MainMenu extends Scene {
    logo: GameObjects.Image;
    title: GameObjects.Text;
    logoTween: Phaser.Tweens.Tween | null;
    createRoomButton: GameObjects.Text;
    joinRoomButton: GameObjects.Text;

    constructor() {
        super("MainMenu");
    }

    create() {
        this.createRoomButton = this.add
            .text(this.scale.width * 0.5, 344, "Create Room", {
                fontFamily: "Arial Black",
                fontSize: 28,
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 6,
                align: "center",
            })
            .setOrigin(0.5)
            .setDepth(100)
            .setInteractive({ useHandCursor: true })
            .on("pointerover", () => {
                this.createRoomButton.setColor("#ffff00");
            })
            .on("pointerout", () => {
                this.createRoomButton.setColor("#ffffff");
            })
            .on("pointerdown", () => {
                this.createRoom();
            });

        this.joinRoomButton = this.add
            .text(this.scale.width * 0.5, 424, "Join Room", {
                fontFamily: "Arial Black",
                fontSize: 28,
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 6,
                align: "center",
            })
            .setOrigin(0.5)
            .setDepth(100)
            .setInteractive({ useHandCursor: true })
            .on("pointerover", () => {
                this.joinRoomButton.setColor("#ffff00");
            })
            .on("pointerout", () => {
                this.joinRoomButton.setColor("#ffffff");
            })
            .on("pointerdown", () => {
                this.joinRoom();
            });

        EventBus.emit("current-scene-ready", this);
    }

    createRoom() {
        if (this.logoTween) {
            this.logoTween.stop();
            this.logoTween = null;
        }

        this.scene.start("CreateRoom");
    }

    joinRoom() {
        if (this.logoTween) {
            this.logoTween.stop();
            this.logoTween = null;
        }

        this.scene.start("JoinRoom");
    }

    changeScene() {
        if (this.logoTween) {
            this.logoTween.stop();
            this.logoTween = null;
        }

        this.scene.start("Game");
    }
}

