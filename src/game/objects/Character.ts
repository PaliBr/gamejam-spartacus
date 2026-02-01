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
    private baseSpeed: number = 250;
    private speedMultiplier: number = 1;
    private speed: number = 250;
    public isLocalPlayer: boolean;
    private networkManager: NetworkManager | null;
    public playerId: string;
    public playerNumber: number;
    public hasMask: boolean = false;
    public hasBook: boolean = false;
    private maskGraphic: Phaser.GameObjects.Graphics | null = null;

    setHasMask(value: boolean) {
        this.hasMask = value;
        this.updateMaskVisual();
    }

    getHasMask(): boolean {
        return this.hasMask;
    }

    setHasBook(value: boolean) {
        this.hasBook = value;
    }

    getHasBook(): boolean {
        return this.hasBook;
    }

    getIsMoving(): boolean {
        return this.isMoving;
    }

    getSpeedMultiplier(): number {
        return this.speedMultiplier;
    }

    setSpeedMultiplier(multiplier: number) {
        const clamped = Math.max(0, multiplier);
        this.speedMultiplier = clamped;
        this.speed = this.baseSpeed * this.speedMultiplier;
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

        // Create mask graphic (initially hidden)
        this.maskGraphic = config.scene.add.graphics();
        this.maskGraphic.setDepth(11); // Above character sprite
        this.updateMaskVisual();

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
                            playerNumber: this.playerNumber,
                        });
                    } else {
                        console.warn(`⚠️ NetworkManager not available!`);
                    }
                },
            );
        }
    }

    moveTo(x: number, y: number) {
        const midX = this.scene.scale.width / 2;
        const sceneHeight = this.scene.scale.height;
        const sceneWidth = this.scene.scale.width;
        const gridSize = 40;

        // Menu area restrictions:
        // Left menu: 12 columns from left, 5 rows from bottom = 0-480px width, last 5 rows (520-720px height)
        // Right menu: 12 columns from right, 5 rows from bottom = 800-1280px width, last 5 rows (520-720px height)

        const leftMenuMaxX = 12 * gridSize; // 480px (columns 0-11)
        const rightMenuMinX = sceneWidth - 12 * gridSize; // 800px (columns 20-31)
        const sideMenuMinY = sceneHeight - 5 * gridSize; // 520px (last 5 rows)

        // Check if target is in menu areas
        const inLeftMenu = x < leftMenuMaxX && y >= sideMenuMinY;
        const inRightMenu = x > rightMenuMinX && y >= sideMenuMinY;

        if (inLeftMenu || inRightMenu) {
            console.log(`🚫 Cannot move into menu area!`);
            return;
        }

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

        // Check if trying to enter common target area without book
        // Common target area: reduced by 2 grid squares from both sides and 1 from top
        // Original: bottom 6 rows, 12 tiles wide. Now: bottom 5 rows, 8 tiles wide
        const commonTargetMinY = sceneHeight - 200; // 520px (5 rows from bottom)
        const commonTargetMinX = midX - 160 - gridSize; // shift left by 1 tile
        const commonTargetMaxX = midX + 160 - gridSize;

        if (!this.hasBook) {
            const inCommonTarget =
                y >= commonTargetMinY &&
                x >= commonTargetMinX &&
                x <= commonTargetMaxX;

            if (inCommonTarget) {
                console.log(`📕 Cannot enter common target area without book!`);
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

    private updateMaskVisual() {
        if (!this.maskGraphic) return;

        this.maskGraphic.clear();

        if (this.hasMask) {
            // Draw mask on character's face - covers whole face
            const maskX = this.x;
            const maskY = this.y - 25; // Position on face

            // Determine mask color based on player number
            const maskColor = this.playerNumber === 1 ? 0x9932cc : 0xff8800; // Purple for P1, Orange for P2

            // Full face mask (larger ellipse to cover whole face)
            this.maskGraphic.fillStyle(maskColor, 0.9);
            this.maskGraphic.fillEllipse(maskX, maskY, 18, 12);

            // Eye holes (darker/black)
            this.maskGraphic.fillStyle(0x000000, 1);
            this.maskGraphic.fillCircle(maskX - 6, maskY - 2, 3);
            this.maskGraphic.fillCircle(maskX + 6, maskY - 2, 3);

            // Mask strings (match mask color but lighter)
            this.maskGraphic.lineStyle(1, maskColor, 0.8);
            if (this.flipX) {
                this.maskGraphic.lineBetween(
                    maskX - 18,
                    maskY,
                    maskX - 22,
                    maskY,
                );
            } else {
                this.maskGraphic.lineBetween(
                    maskX + 18,
                    maskY,
                    maskX + 22,
                    maskY,
                );
            }
        }
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

        // Flip character based on horizontal movement direction
        if (Math.abs(dx) > 5) {
            // Only flip if moving significantly horizontally
            this.setFlipX(dx < 0); // Flip when moving left
        }

        // Update mask position to follow character
        this.updateMaskVisual();
    }

    destroy() {
        if (this.maskGraphic) {
            this.maskGraphic.destroy();
            this.maskGraphic = null;
        }
        super.destroy();
    }
}

