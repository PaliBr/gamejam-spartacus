import Phaser from "phaser";
import { Enemy } from "./Enemy";

interface TowerConfig {
    scene: Phaser.Scene;
    x: number;
    y: number;
    towerId: string;
    playerNumber: number;
    networkManager?: any;
}

export class Tower extends Phaser.GameObjects.Sprite {
    private towerId: string;
    private range: number = 150; // Shooting range
    private fireRate: number = 500; // ms between shots (base speed)
    private lastShotTime: number = 0;
    private networkManager: any;
    private playerNumber: number;
    private killedEnemies: string[] = [];
    private lastFlushTime: number = 0;
    private flushInterval: number = 1000; // milliseconds
    public level: number = 1; // Tower level (1-5)
    private isShooting: boolean = false; // Track shooting state

    constructor(config: TowerConfig) {
        super(config.scene, config.x, config.y, "tower");

        this.towerId = config.towerId;
        this.networkManager = config.networkManager;
        this.playerNumber = config.playerNumber;

        // Create tower_shoot animation if not exists
        if (!config.scene.anims.exists("tower_shoot")) {
            config.scene.anims.create({
                key: "tower_shoot",
                frames: config.scene.anims.generateFrameNumbers("tower", {
                    start: 1, // Frames 1-6 for shooting (frame 0 is idle)
                    end: 6,
                }),
                frameRate: 8,
                repeat: 0, // Play once then stop
            });
        }

        this.setTexture("tower");
        this.setFrame(0); // Start at frame 0 (idle state)
        this.setOrigin(0, 0);
        this.setDisplaySize(40, 80); // 1x2 grid cells
        config.scene.add.existing(this);
        this.setDepth(5);
        this.setInteractive(
            new Phaser.Geom.Rectangle(0, 0, 40, 80),
            Phaser.Geom.Rectangle.Contains,
        );
        this.setData("isClickable", true);

        console.log(
            `🏗️ Tower ${this.towerId} built at (${config.x}, ${config.y})`,
        );
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
                console.log(
                    `❌ Not enough gold to upgrade tower (need ${upgradeCost}, have ${currentGold})`,
                );
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
            // Increase fire rate (decrease fire delay)
            // Level 1: 500ms, Level 2: 400ms, Level 3: 333ms, Level 4: 285ms, Level 5: 250ms
            this.fireRate = 500 / this.level;

            // Broadcast upgrade to network
            if (mainScene.networkManager) {
                mainScene.networkManager.sendAction("tower_upgrade", {
                    towerId: this.towerId,
                    level: this.level,
                    playerNumber: this.playerNumber,
                    gold: newGold,
                });
            }

            console.log(
                `⬆️ Tower upgraded to level ${this.level} for ${upgradeCost} gold. Fire rate: ${this.fireRate.toFixed(0)}ms`,
            );
            return true;
        }
        return false;
    }

    downgrade(): boolean {
        if (this.level > 1) {
            this.level--;
            this.fireRate = 500 / this.level;
            console.log(
                `⬇️ Tower downgraded to level ${this.level}. Fire rate: ${this.fireRate.toFixed(0)}ms`,
            );
            return true;
        }
        return false;
    }

    update(enemies: Map<string, Enemy>) {
        const now = Date.now();

        // Check if enough time has passed to shoot
        if (now - this.lastShotTime > this.fireRate) {
            // Find nearest enemy in range
            let nearestEnemy: Enemy | null = null;
            let nearestDistance = this.range;

            enemies.forEach((enemy) => {
                // Only target enemies from the opposite side
                // Player 1 targets enemies going left, Player 2 targets enemies going right
                const enemyGoingLeft = (enemy as any).goingLeft;
                const targetEnemy =
                    (this.playerNumber === 1 && enemyGoingLeft) ||
                    (this.playerNumber === 2 && !enemyGoingLeft);

                if (!targetEnemy) return;

                const distance = Phaser.Math.Distance.Between(
                    this.x,
                    this.y,
                    enemy.x,
                    enemy.y,
                );

                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestEnemy = enemy;
                }
            });

            // Shoot the nearest enemy
            if (nearestEnemy) {
                this.shoot(nearestEnemy);
                this.lastShotTime = now;
            }
        }
    }

    private shoot(enemy: Enemy) {
        // Play shooting animation
        this.play("tower_shoot");

        // Create projectile effect (line from tower to enemy)
        const graphics = this.scene.add.graphics();
        graphics.lineStyle(2, 0x6666ff, 1);
        graphics.lineBetween(this.x, this.y, enemy.x, enemy.y);

        // Fade out and destroy
        this.scene.tweens.add({
            targets: graphics,
            alpha: 0,
            duration: 100,
            onComplete: () => graphics.destroy(),
        });

        // Queue enemy for bulk sending
        this.killedEnemies.push((enemy as any).enemyId);

        // Remove enemy
        enemy.destroy();
        console.log(`💥 Enemy eliminated by tower ${this.towerId}`);
    }

    flushKilledEnemies() {
        const now = Date.now();
        // Flush if interval passed or if many enemies queued
        if (
            this.killedEnemies.length > 0 &&
            (now - this.lastFlushTime >= this.flushInterval ||
                this.killedEnemies.length > 10)
        ) {
            if (this.networkManager) {
                this.networkManager.sendAction("enemies_killed_batch", {
                    enemyIds: this.killedEnemies,
                    towerId: this.towerId,
                });
            }
            this.killedEnemies = [];
            this.lastFlushTime = now;
        }
    }

    getRange(): number {
        return this.range;
    }
}

