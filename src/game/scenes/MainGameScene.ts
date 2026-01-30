import { EventBus } from "../EventBus";
import Phaser from "phaser";

export class MainGameScene extends Phaser.Scene {
    gameText: Phaser.GameObjects.Text;

    constructor() {
        super("MainGameScene");
    }

    create() {
        this.cameras.main.setBackgroundColor(0x3a9d23);

        // Create tilemap
        const map = this.make.tilemap({ key: "map" });

        // Debug: log what tilesets are actually in the map
        console.log(
            "Available tilesets:",
            map.tilesets.map((t) => t.name),
        );

        // Get the actual tileset names from the loaded map
        const tilesetNames = map.tilesets.map((t) => t.name);

        // Add the tilesets using the actual names found
        const tileset1 = map.addTilesetImage(tilesetNames[0], "mvp2-farm");
        const tileset2 = map.addTilesetImage(
            tilesetNames[1] || tilesetNames[0],
            "mvp2-grass",
        );

        if (tileset1 && tileset2) {
            const layer = map.createLayer(
                "Tile Layer 1",
                [tileset1, tileset2],
                0,
                0,
            );
            if (layer) {
                console.log("Layer created successfully");
            }
        } else {
            console.error("Failed to create tileset");
            console.log("tileset1:", tileset1);
            console.log("tileset2:", tileset2);
        }

        const midX = this.scale.width * 0.5;

        this.add
            .rectangle(
                midX,
                this.scale.height * 0.5,
                4,
                this.scale.height,
                0xffffff,
            )
            .setDepth(1);

        EventBus.emit("current-scene-ready-3", this);
    }
}
