import { EventBus } from "../EventBus";
import Phaser from "phaser";
import { Character } from "../objects/Character";
import { NetworkManager } from "../managers/NetworkManager";

interface MainGameSceneData {
    playerId: string;
    roomPlayerId: string;
    playerNumber: number;
    roomId: string;
    networkManager: NetworkManager;
}

export class MainGameScene extends Phaser.Scene {
    gameText: Phaser.GameObjects.Text;
    characters: Map<number, Character> = new Map();
    networkManager: NetworkManager | null = null;
    playerId: string = "";
    roomPlayerId: string = "";
    playerNumber: number = 0;
    roomId: string = "";

    constructor() {
        super("MainGameScene");
    }

    init(data: MainGameSceneData) {
        this.playerId = data.playerId;
        this.roomPlayerId = data.roomPlayerId;
        this.playerNumber = data.playerNumber;
        this.roomId = data.roomId;
        this.networkManager = data.networkManager;

        console.log("MainGameScene init:", {
            playerId: this.playerId,
            roomPlayerId: this.roomPlayerId,
            playerNumber: this.playerNumber,
            roomId: this.roomId,
        });
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

        // Create characters at spawn points
        const char1 = new Character({
            scene: this,
            x: midX * 0.5,
            y: this.scale.height * 0.5,
            playerId: "player1",
            playerNumber: 1,
            isLocalPlayer: this.playerNumber === 1,
            networkManager: this.networkManager,
        });

        const char2 = new Character({
            scene: this,
            x: midX * 1.5,
            y: this.scale.height * 0.5,
            playerId: "player2",
            playerNumber: 2,
            isLocalPlayer: this.playerNumber === 2,
            networkManager: this.networkManager,
        });

        this.characters.set(1, char1);
        this.characters.set(2, char2);

        // Listen for incoming hero movements from other players
        const handleHeroMoved = (event: Event) => {
            const customEvent = event as CustomEvent;
            const { playerNumber, x, y } = customEvent.detail;
            console.log(`Hero moved event for player ${playerNumber}`, {
                x,
                y,
            });

            const char = this.characters.get(playerNumber);
            if (char && !char.isLocalPlayer) {
                console.log(
                    `Updating remote position for player ${playerNumber}`,
                );
                char.updateRemotePosition(x, y);
            }
        };

        window.addEventListener("heroMoved", handleHeroMoved);

        // Clean up listener on shutdown
        this.events.on("shutdown", () => {
            window.removeEventListener("heroMoved", handleHeroMoved);
        });

        EventBus.emit("current-scene-ready-3", this);
    }

    update() {
        // Update all characters' movement
        this.characters.forEach((character) => {
            character.update();
        });
    }

    shutdown() {
        this.characters.forEach((char) => {
            char.destroy();
        });
        this.characters.clear();
    }
}

