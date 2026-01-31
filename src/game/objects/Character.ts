import Phaser from "phaser";
import { NetworkManager } from "../managers/NetworkManager";

interface CharacterConfig {
    scene: Phaser.Scene;
    x: number;
    y: number;
    playerId: string;
    playerNumber: number;
    isLocalPlayer: boolean;
    networkManager: NetworkManager | null;
}

export class Character extends Phaser.Physics.Arcade.Sprite {
    private isMoving: boolean = false;
    private targetX: number;
    private targetY: number;
    private speed: number = 150;
    public isLocalPlayer: boolean;
    private networkManager: NetworkManager | null;
    public playerId: string;
    public playerNumber: number;

    constructor(config: CharacterConfig) {
        super(config.scene, config.x, config.y, "character");

        this.isLocalPlayer = config.isLocalPlayer;
        this.networkManager = config.networkManager;
        this.playerId = config.playerId;
        this.playerNumber = config.playerNumber;
        this.targetX = config.x;
        this.targetY = config.y;

        // Add to scene and enable physics
        config.scene.add.existing(this);
        config.scene.physics.add.existing(this);

        // Visual setup
        this.setDisplaySize(32, 32);
        this.setCollideWorldBounds(true);
        this.setBounce(0.2);
        this.setDepth(10); // Make sure character appears above other layers

        // Setup mouse click handler for local player
        if (this.isLocalPlayer) {
            config.scene.input.on(
                "pointerdown",
                (pointer: Phaser.Input.Pointer) => {
                    this.moveTo(pointer.worldX, pointer.worldY);

                    // Notify network manager of movement
                    if (this.networkManager) {
                        this.networkManager.sendAction("hero_move", {
                            x: pointer.worldX,
                            y: pointer.worldY,
                        });
                    }
                },
            );
        }
    }

    moveTo(x: number, y: number) {
        this.targetX = x;
        this.targetY = y;
        this.isMoving = true;
    }

    updateRemotePosition(x: number, y: number) {
        this.moveTo(x, y);
    }

    update() {
        if (!this.isMoving) {
            this.setVelocity(0, 0);
            return;
        }

        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Stop moving if close to target
        if (distance < 5) {
            this.isMoving = false;
            this.x = this.targetX;
            this.y = this.targetY;
            this.setVelocity(0, 0);
            return;
        }

        // Calculate velocity towards target
        const angle = Math.atan2(dy, dx);
        const vx = Math.cos(angle) * this.speed;
        const vy = Math.sin(angle) * this.speed;

        this.setVelocity(vx, vy);
    }

    destroy() {
        super.destroy();
    }
}

