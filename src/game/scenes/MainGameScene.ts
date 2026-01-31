import { EventBus } from "../EventBus";
import Phaser from "phaser";
import { Character } from "../objects/Character";
import { NetworkManager } from "../managers/NetworkManager";

interface MainGameSceneData {
    playerId: string;
    playerNumber: number;
    roomId: string;
    networkManager: NetworkManager;
}

export class MainGameScene extends Phaser.Scene {
    gameText: Phaser.GameObjects.Text;
    characters: Map<number, Character> = new Map();
    networkManager: NetworkManager | null = null;
    playerId: string = "";
    playerNumber: number = 0;
    roomId: string = "";

    constructor() {
        super("MainGameScene");
    }

    init(data: MainGameSceneData) {
        this.playerId = data.playerId;
        this.playerNumber = data.playerNumber;
        this.roomId = data.roomId;
        this.networkManager = data.networkManager;
    }

    create() {
        // Create simple grass background
        const grassColor = 0x4a9d3e; // Nice grass green
        this.cameras.main.setBackgroundColor(grassColor);

        // Add a grass texture pattern
        const graphics = this.add.graphics();
        graphics.fillStyle(0x3d8b35, 0.3); // Darker green for variation

        // Create grass stripe pattern
        for (let y = 0; y < this.scale.height; y += 20) {
            graphics.fillRect(0, y, this.scale.width, 10);
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

        // Log connection status
        console.log(
            `✓ Connected to Room ${this.roomId} | Player ${this.playerNumber}/2`,
        );

        // Setup network callbacks for remote character updates
        if (this.networkManager) {
            this.networkManager.onHeroMove((data: any) => {
                const playerNum =
                    data.playerNumber || (data.playerId === "player1" ? 1 : 2);
                const char = this.characters.get(playerNum);
                if (char && !char.isLocalPlayer) {
                    char.updateRemotePosition(data.x, data.y);
                }
            });
        }

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

