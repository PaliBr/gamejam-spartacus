import { Scene } from "phaser";

export class YouWin extends Scene {
    constructor() {
        super("YouWin");
        console.log("🎉 YouWin scene constructor called");
    }

    preload() {
        this.load.audio("winningMusic", "assets/winnig.mp3");
        this.load.on("loaderror", (file: Phaser.Loader.File) => {
            if (file.key === "winningMusic") {
                console.warn("⚠️ Failed to load winningMusic", file);
            }
        });
    }

    create() {
        // Play winning music if loaded
        if (this.cache.audio.exists("winningMusic")) {
            const music = this.sound.add("winningMusic", {
                loop: true,
                volume: 0.6,
            });
            music.play();
        } else {
            console.warn("⚠️ winningMusic not in cache, skipping playback");
        }
        console.log("🎉 YouWin scene create() called");
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;

        // Background
        this.add.rectangle(
            centerX,
            centerY,
            this.scale.width,
            this.scale.height,
            0x000000,
            0.8,
        );

        // Title
        this.add
            .text(centerX, centerY - 100, "You Win!", {
                fontFamily: "Arial Black",
                fontSize: 96,
                color: "#00ff00",
                stroke: "#000000",
                strokeThickness: 8,
                align: "center",
            })
            .setOrigin(0.5);

        // Message
        this.add
            .text(centerX, centerY + 50, "Both players overcame hunger", {
                fontFamily: "Arial",
                fontSize: 32,
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 4,
                align: "center",
            })
            .setOrigin(0.5);

        // Victory icon/decoration
        const graphics = this.add.graphics();
        graphics.fillStyle(0xffd700, 1);
        graphics.fillCircle(centerX, centerY - 200, 60);
        graphics.fillStyle(0xffed4e, 1);
        graphics.fillCircle(centerX - 20, centerY - 220, 20);
    }
}

