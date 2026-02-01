import Phaser from "phaser";
import { Enemy } from "./Enemy";

interface TrapTowerConfig {
    scene: Phaser.Scene;
    x: number;
    y: number;
    trapId: string;
    playerNumber: number;
    trapType: number; // 0, 1, 2, or 3 (matching enemy types)
    networkManager?: any;
}

export class TrapTower extends Phaser.GameObjects.Sprite {
    private trapId: string;
    private trapType: number;
    private attractionRadius: number = 80; // 2 grid cells (40px * 2)
    private maxCapacity: number = 3; // Base capacity
    private trappedEnemies: Set<string> = new Set();
    private enemyTimers: Map<string, number> = new Map(); // Track time each enemy has been trapped
    private despawnTime: number = 3000; // 3 seconds in milliseconds
    private networkManager: any;
    private playerNumber: number;
    public level: number = 1; // Trap tower level (1-5)

    constructor(config: TrapTowerConfig) {
        super(config.scene, config.x, config.y, "");

        this.trapId = config.trapId;
        this.trapType = config.trapType;
        this.networkManager = config.networkManager;
        this.playerNumber = config.playerNumber;

        // Create trap visual (1x1 grid cell = 40x40) with color matching enemy type
        const graphics = config.scene.add.graphics();

        let color = 0xff0000; // Red for type 0
        if (this.trapType === 1) {
            color = 0x0000ff; // Blue for type 1
        } else if (this.trapType === 2) {
            color = 0xffff00; // Yellow for type 2
        } else if (this.trapType === 3) {
            color = 0x00ff00; // Green for type 3
        }

        // Draw trap with pattern (fill entire 40x40 texture)
        graphics.fillStyle(color, 0.6);
        graphics.fillRect(0, 0, 40, 40);

        // Add border
        graphics.lineStyle(2, color, 1);
        graphics.strokeRect(0, 0, 40, 40);

        // Add trap pattern (crosshatch)
        graphics.lineStyle(1, 0x000000, 0.5);
        graphics.lineBetween(0, 0, 40, 40);
        graphics.lineBetween(0, 40, 40, 0);

        graphics.generateTexture(`trap-${this.trapId}`, 40, 40);
        graphics.destroy();

        this.setTexture(`trap-${this.trapId}`);
        this.setOrigin(0.5, 0.5); // Center the sprite on the grid position
        config.scene.add.existing(this);
        this.setDepth(5);
        this.setInteractive(
            new Phaser.Geom.Circle(0, 0, 20),
            Phaser.Geom.Circle.Contains,
        );
        this.setData("isClickable", true);
    }

    upgrade(): boolean {
        if (this.level < 5) {
            // Calculate upgrade cost: level * 6 gold
            const upgradeCost = this.level * 6;

            // Get current gold from scene (MainGameScene)
            const mainScene = this.scene as any;
            const currentGold =
                mainScene.playerGold?.get(this.playerNumber) || 0;

            if (currentGold < upgradeCost) {
                return false;
            }

            // Deduct gold
            const newGold = currentGold - upgradeCost;
            mainScene.playerGold?.set(this.playerNumber, newGold);

            // Update gold display
            const goldText = mainScene.goldTexts?.get(this.playerNumber);
            if (goldText) {
                goldText.setText(`${Math.floor(newGold)}`);
            }

            this.level++;
            // Increase capacity by 1 per level (level 1: 3, level 2: 4, level 3: 5, level 4: 6, level 5: 7)
            this.maxCapacity = 3 + (this.level - 1);

            // Broadcast upgrade to network
            if (mainScene.networkManager) {
                mainScene.networkManager.sendAction("trap_upgrade", {
                    trapId: this.trapId,
                    level: this.level,
                    playerNumber: this.playerNumber,
                    gold: newGold,
                });
            }

            return true;
        }
        return false;
    }

    downgrade(): boolean {
        if (this.level > 1) {
            this.level--;
            this.maxCapacity = 3 + (this.level - 1);
            return true;
        }
        return false;
    }

    update(enemies: Map<string, Enemy>, dt: number) {
        // Check for enemies within attraction radius
        enemies.forEach((enemy) => {
            // Only attract enemies of matching type
            if ((enemy as any).enemyType !== this.trapType) {
                return;
            }

            // Check if already at capacity
            if (this.trappedEnemies.size >= this.maxCapacity) {
                return;
            }

            // Check if enemy is within attraction radius
            const distance = Phaser.Math.Distance.Between(
                this.x,
                this.y,
                enemy.x,
                enemy.y,
            );

            if (distance <= this.attractionRadius) {
                const enemyId = (enemy as any).enemyId;

                // Add enemy to trapped list if not already trapped
                if (!this.trappedEnemies.has(enemyId)) {
                    this.trappedEnemies.add(enemyId);
                    this.enemyTimers.set(enemyId, 0);

                    // Set enemy to attracted state
                    (enemy as any).isAttractedToTrap = true;
                    (enemy as any).trapX = this.x;
                    (enemy as any).trapY = this.y;
                }
            }
        });

        // Update timers for trapped enemies and despawn after 3 seconds
        const enemiesToRemove: string[] = [];
        this.enemyTimers.forEach((time, enemyId) => {
            const newTime = time + dt;

            if (newTime >= this.despawnTime) {
                // Despawn enemy
                const enemy = enemies.get(enemyId);
                if (enemy) {
                    enemy.destroy();
                }
                enemiesToRemove.push(enemyId);

                // Send network update for despawned enemy
                if (this.networkManager) {
                    this.networkManager.sendAction("enemy_trapped", {
                        enemyId,
                        trapId: this.trapId,
                    });
                }
            } else {
                this.enemyTimers.set(enemyId, newTime);
            }
        });

        // Clean up despawned enemies
        enemiesToRemove.forEach((enemyId) => {
            this.trappedEnemies.delete(enemyId);
            this.enemyTimers.delete(enemyId);
        });
    }

    getAttractionRadius(): number {
        return this.attractionRadius;
    }

    getTrapType(): number {
        return this.trapType;
    }

    isFull(): boolean {
        return this.trappedEnemies.size >= this.maxCapacity;
    }
}

