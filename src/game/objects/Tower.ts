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
    private fireRate: number = 500; // ms between shots
    private lastShotTime: number = 0;
    private networkManager: any;
    private playerNumber: number;
    private killedEnemies: string[] = [];
    private lastFlushTime: number = 0;
    private flushInterval: number = 500; // milliseconds

    constructor(config: TowerConfig) {
        super(config.scene, config.x, config.y, "");

        this.towerId = config.towerId;
        this.networkManager = config.networkManager;
        this.playerNumber = config.playerNumber;
        // Create tower visual (blue square 2x2 grid cells = 80x80)
        const graphics = config.scene.add.graphics();
        graphics.fillStyle(0x6666ff, 1);
        graphics.fillRect(-40, -40, 80, 80);
        graphics.generateTexture(`tower-${this.towerId}`, 80, 80);
        graphics.destroy();

        this.setTexture(`tower-${this.towerId}`);
        config.scene.add.existing(this);
        this.setDepth(5);

        console.log(
            `🏗️ Tower ${this.towerId} built at (${config.x}, ${config.y})`,
        );
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

