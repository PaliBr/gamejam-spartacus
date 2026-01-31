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
    private speed: number = 250;
    public isLocalPlayer: boolean;
    private networkManager: NetworkManager | null;
    public playerId: string;
    public playerNumber: number;
    public hasMask: boolean = false;

    setHasMask(value: boolean) {
        this.hasMask = value;
    }

    getHasMask(): boolean {
        return this.hasMask;
    }

    constructor(config: CharacterConfig) {
        super(config.scene, config.x, config.y, "farmer");

        this.isLocalPlayer = config.isLocalPlayer;
        this.networkManager = config.networkManager;
        this.playerId = config.playerId;
        this.playerNumber = config.playerNumber;
        this.targetX = config.x;
        this.targetY = config.y;

        // Add to scene and enable physics
        config.scene.add.existing(this);
        config.scene.physics.add.existing(this);

        // Visual setup - 40x80 (1x2 grid cells)
        this.setDisplaySize(40, 80);
        this.setCollideWorldBounds(true);
        this.setBounce(0.2);
        this.setDepth(10); // Make sure character appears above other layers
        this.setAlpha(1); // Ensure full opacity
        this.setOrigin(0.5, 0.5); // Center the sprite

        // Start with idle animation if it exists
        if (config.scene.anims.exists("farmer_idle")) {
            this.play("farmer_idle");
        }

        console.log(
            `Character created: ${config.playerId} at (${config.x}, ${config.y}), isLocal: ${config.isLocalPlayer}`,
        );
        console.log(`Character visible: ${this.visible}, alpha: ${this.alpha}`);
        console.log(`Character texture: ${this.texture.key}`);

        // Setup mouse click handler for local player
        if (this.isLocalPlayer) {
            console.log(
                `🖱️ Setting up click handler for local player ${this.playerNumber}`,
            );
            config.scene.input.on(
                "pointerdown",
                (pointer: Phaser.Input.Pointer) => {
                    console.log(
                        `🎯 Click detected at (${pointer.worldX}, ${pointer.worldY}) for player ${this.playerNumber}`,
                    );
                    this.moveTo(pointer.worldX, pointer.worldY);

                    // Notify network manager of movement
                    if (this.networkManager) {
                        console.log(
                            `📤 Sending hero_move action via NetworkManager`,
                        );
                        this.networkManager.sendAction("hero_move", {
                            x: pointer.worldX,
                            y: pointer.worldY,
                            playerNumber: this.playerNumber,
                        });
                    } else {
                        console.warn(`⚠️ NetworkManager not available!`);
                    }
                },
            );
        } else {
            console.log(
                `👁️ This is a remote player ${this.playerNumber}, no click handler`,
            );
        }
    }

    moveTo(x: number, y: number) {
        const midX = this.scene.scale.width / 2;

        // Check if trying to cross middle line without mask
        if (!this.hasMask) {
            const currentSide = this.x < midX ? "left" : "right";
            const targetSide = x < midX ? "left" : "right";

            // If trying to cross to other side, don't move at all
            if (currentSide !== targetSide) {
                console.log(`🚫 Cannot cross middle line without mask!`);
                return;
            }
        }

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
            // Play idle animation when not moving
            if (
                this.anims &&
                this.scene.anims.exists("farmer_idle") &&
                this.anims.currentAnim?.key !== "farmer_idle"
            ) {
                this.play("farmer_idle");
            }
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

            // Play idle animation when stopped
            if (this.anims && this.scene.anims.exists("farmer_idle")) {
                this.play("farmer_idle");
            }

            // Broadcast final position to network for sync
            if (this.isLocalPlayer && this.networkManager) {
                this.networkManager.sendAction("hero_move", {
                    x: this.targetX,
                    y: this.targetY,
                    playerNumber: this.playerNumber,
                });
            }
            return;
        }

        // Play walking animation when moving
        if (
            this.anims &&
            this.scene.anims.exists("farmer_walk") &&
            this.anims.currentAnim?.key !== "farmer_walk"
        ) {
            this.play("farmer_walk");
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

