import Phaser from "phaser";
import { Enemy } from "./Enemy";

interface FarmConfig {
    scene: Phaser.Scene;
    x: number;
    y: number;
    farmId: string;
    farmType: "wheat" | "carrot" | "sunflower" | "potato"; // Corresponds to colors: yellow, red, blue, green
    playerNumber: number; // 1 or 2
}

export class Farm extends Phaser.GameObjects.Rectangle {
    farmId: string;
    farmType: "wheat" | "carrot" | "sunflower" | "potato";
    playerNumber: number;
    level: number; // 0-3
    productionRate: number; // Food per second
    totalFood: number = 0;
    productionTimer: number = 0;
    enemiesOnFarm: Set<string> = new Set(); // Set of enemy IDs currently on this farm
    private levelIcon: Phaser.GameObjects.Graphics | null = null;
    private productionText: Phaser.GameObjects.Text | null = null;
    scene: Phaser.Scene;
    private isSelected: boolean = false;

    // Farm type colors and starting levels
    private static readonly FARM_CONFIG = {
        wheat: { color: 0xffff00, startLevel: 1, icon: "wheat" },
        carrot: { color: 0xff0000, startLevel: 0, icon: "carrot" },
        sunflower: { color: 0x0000ff, startLevel: 0, icon: "sunflower" },
        potato: { color: 0x00ff00, startLevel: 0, icon: "potato" },
    };

    constructor(config: FarmConfig) {
        const color = Farm.FARM_CONFIG[config.farmType].color;
        super(
            config.scene,
            config.x,
            config.y,
            160, // 4x4 grid cells
            160,
            color,
            0.3,
        );

        this.farmId = config.farmId;
        this.farmType = config.farmType;
        this.playerNumber = config.playerNumber;
        this.scene = config.scene;
        this.level = Farm.FARM_CONFIG[config.farmType].startLevel;

        // Add to scene
        config.scene.add.existing(this);

        // Visual setup
        this.setStrokeStyle(3, color, 1);
        this.setDepth(0);
        this.setInteractive(
            new Phaser.Geom.Rectangle(config.x - 80, config.y - 80, 160, 160),
            Phaser.Geom.Rectangle.Contains,
        );
        this.setData("isClickable", true);

        // Add hover effects to highlight the clickable area
        this.on("pointerover", () => {
            this.setStrokeStyle(4, color, 1);
            this.setFillStyle(color, 0.5);
        });

        this.on("pointerout", () => {
            this.setStrokeStyle(3, color, 1);
            this.setFillStyle(color, 0.3);
        });

        // Create level indicator
        this.createLevelIndicator();

        // Create production rate display
        this.createProductionText();

        console.log(
            `🌾 Farm created: ${this.farmType} (${config.farmId}) at level ${this.level}`,
        );
    }

    private createLevelIndicator() {
        if (this.levelIcon) {
            this.levelIcon.destroy();
        }

        this.levelIcon = this.scene.add.graphics();
        this.levelIcon.setDepth(11);
        this.updateLevelIcon();
    }

    private updateLevelIcon() {
        if (!this.levelIcon) return;

        this.levelIcon.clear();

        // Draw level indicator at top-left of farm
        const iconX = this.x - 75;
        const iconY = this.y - 75;

        if (this.level === 0) {
            // Draw crop icon based on farm type
            this.drawCropIcon(iconX, iconY);
        } else {
            // Draw level number in a circle
            this.levelIcon.fillStyle(0xffffff, 0.9);
            this.levelIcon.fillCircle(iconX, iconY, 12);

            // Level text
            const levelText = this.scene.add.text(
                iconX,
                iconY,
                this.level.toString(),
                {
                    fontSize: "16px",
                    color: "#000000",
                    fontStyle: "bold",
                },
            );
            levelText.setOrigin(0.5);
            levelText.setDepth(12);
        }
    }

    private drawCropIcon(x: number, y: number) {
        if (!this.levelIcon) return;

        const iconSize = 8;

        switch (this.farmType) {
            case "wheat":
                // Golden wheat stalks
                this.levelIcon.fillStyle(0xffcc00, 1);
                this.levelIcon.fillRect(x - 2, y - 6, 1, 8);
                this.levelIcon.fillRect(x + 1, y - 6, 1, 8);
                // Wheat heads
                this.levelIcon.fillCircle(x - 2, y - 8, 2);
                this.levelIcon.fillCircle(x + 1, y - 8, 2);
                break;

            case "carrot":
                // Orange carrot
                this.levelIcon.fillStyle(0xff8800, 1);
                this.levelIcon.fillTriangle(
                    x - 3,
                    y + 3,
                    x + 3,
                    y + 3,
                    x,
                    y - 5,
                );
                // Green tops
                this.levelIcon.fillStyle(0x00aa00, 1);
                this.levelIcon.fillTriangle(
                    x - 2,
                    y - 5,
                    x + 2,
                    y - 5,
                    x,
                    y - 10,
                );
                break;

            case "sunflower":
                // Yellow petals
                this.levelIcon.fillStyle(0xffff00, 1);
                this.levelIcon.fillCircle(x, y, 5);
                // Brown center
                this.levelIcon.fillStyle(0x8b4513, 1);
                this.levelIcon.fillCircle(x, y, 2);
                break;

            case "potato":
                // Brown potato
                this.levelIcon.fillStyle(0x8b6914, 1);
                this.levelIcon.fillEllipse(x, y, 6, 4);
                // Small bumps
                this.levelIcon.fillStyle(0x654321, 0.8);
                this.levelIcon.fillCircle(x - 2, y, 1);
                this.levelIcon.fillCircle(x + 2, y, 1);
                break;
        }
    }

    private createProductionText() {
        this.productionText = this.scene.add.text(this.x, this.y - 85, "+0", {
            fontSize: "20px",
            color: "#ffffff",
            fontStyle: "bold",
            fontFamily: "Arial",
        });
        this.productionText.setOrigin(0.5, 0.5);
        this.productionText.setDepth(12);
    }

    private updateProductionText() {
        if (!this.productionText) return;

        const production = this.getProductionRate();
        let color = "#ffffff";

        // Color based on production
        if (production === 0) {
            color = "#ff6666"; // Red if no production
        } else if (this.enemiesOnFarm.size > 0) {
            color = "#ffcc00"; // Gold if enemies are affecting it
        } else {
            color = "#66ff66"; // Green if full production
        }

        this.productionText.setText(`+${production.toFixed(1)}`);
        this.productionText.setColor(color);
    }

    upgrade() {
        if (this.level < 3) {
            this.level++;
            this.productionTimer = 0;
            this.updateLevelIcon();
            console.log(
                `⬆️ Farm ${this.farmType} upgraded to level ${this.level}`,
            );
        }
    }

    downgrade() {
        // Wheat cannot be downgraded below level 1
        if (this.farmType === "wheat" && this.level <= 1) {
            console.log(`⛔ Wheat cannot be downgraded below level 1`);
            return;
        }

        if (this.level > 0) {
            this.level--;
            this.productionTimer = 0;
            this.updateLevelIcon();
            console.log(
                `⬇️ Farm ${this.farmType} downgraded to level ${this.level}`,
            );
        }
    }

    addEnemyOnFarm(enemyId: string) {
        this.enemiesOnFarm.add(enemyId);
        console.log(
            `🐛 Enemy added to ${this.farmType} farm. Total: ${this.enemiesOnFarm.size}`,
        );
    }

    removeEnemyFromFarm(enemyId: string) {
        this.enemiesOnFarm.delete(enemyId);
        console.log(
            `✅ Enemy removed from ${this.farmType} farm. Total: ${this.enemiesOnFarm.size}`,
        );
    }

    getProductionRate(): number {
        if (this.level === 0) return 0;

        // Base production: 1, 2, 3 food per second for levels 1, 2, 3
        let baseProduction = this.level === 3 ? this.level + 1 : this.level;

        // Apply enemy penalty: each enemy reduces production by 10%
        const penaltyPercent = this.enemiesOnFarm.size * 10;
        const reduction = baseProduction * (penaltyPercent / 100);

        return Math.max(0, baseProduction - reduction);
    }

    update(dt: number, enemies: Map<string, Enemy>) {
        // Check which enemies are on this farm
        this.enemiesOnFarm.clear();
        enemies.forEach((enemy, enemyId) => {
            const distance = Phaser.Math.Distance.Between(
                enemy.x,
                enemy.y,
                this.x,
                this.y,
            );

            if (distance < 80) {
                // 2 tiles radius
                this.addEnemyOnFarm(enemyId);
            }
        });

        // Generate food
        this.productionTimer += dt;
        const productionRate = this.getProductionRate();

        if (productionRate > 0 && this.productionTimer >= 5000) {
            this.totalFood += productionRate;
            this.totalFood = Math.round(this.totalFood * 10) / 10;
            this.productionTimer -= 5000;
            console.log(
                `🌾 ${this.farmType} produced ${productionRate} food. Total: ${this.totalFood}`,
            );
        }

        // Update production rate display
        this.updateProductionText();
    }

    destroy() {
        if (this.levelIcon) {
            this.levelIcon.destroy();
            this.levelIcon = null;
        }
        if (this.productionText) {
            this.productionText.destroy();
            this.productionText = null;
        }
        this.enemiesOnFarm.clear();
        super.destroy();
    }
}

