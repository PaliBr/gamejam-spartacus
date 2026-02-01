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
            120, // 3x3 grid cells
            120,
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
        this.setOrigin(0, 0); // Set origin to top-left for grid alignment
        this.setStrokeStyle(3, color, 1);
        this.setDepth(0);
        this.setInteractive(
            new Phaser.Geom.Rectangle(0, 0, 120, 120),
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
        // Icons disabled - no level indicator
        if (this.levelIcon) {
            this.levelIcon.destroy();
            this.levelIcon = null;
        }
    }

    private updateLevelIcon() {
        // Icons disabled - no level indicator
        return;
    }

    private drawCropIcon(x: number, y: number) {
        // Icons disabled - no crop icon
        return;
    }

    private createProductionText() {
        this.productionText = this.scene.add.text(
            this.x + 60,
            this.y - 10,
            "+0",
            {
                fontSize: "20px",
                color: "#ffffff",
                fontStyle: "bold",
                fontFamily: "Arial",
            },
        );
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

            // Check if enemy is within farm rectangular bounds (3x3 grid = 120x120)
            const isInFarm =
                enemy.x >= this.x &&
                enemy.x <= this.x + 120 &&
                enemy.y >= this.y &&
                enemy.y <= this.y + 120;

            if (isInFarm) {
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

