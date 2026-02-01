import { EventBus } from "../EventBus";
import Phaser from "phaser";
import { Character } from "../objects/Character";
import { Enemy } from "../objects/Enemy";
import { Tower } from "../objects/Tower";
import { Farm } from "../objects/Farm";
import { FarmPopup } from "../objects/FarmPopup";

export class DevScene extends Phaser.Scene {
    characters: Map<number, Character> = new Map();
    enemies: Map<string, Enemy> = new Map();
    towers: Map<string, Tower> = new Map();
    farms: Map<string, Farm> = new Map();
    farmPopup: FarmPopup | null = null;
    targetPositions: Array<{ x: number; y: number }> = [];
    private enemySpawnButton: Phaser.GameObjects.Rectangle | null = null;
    private enemySpawnText: Phaser.GameObjects.Text | null = null;
    // Food inventory system
    totalFood: number = 10;
    private baseFood: number = 10;
    private farmLastFood: Map<string, number> = new Map();
    foodBarBg: Phaser.GameObjects.Rectangle | null = null;
    foodBar: Phaser.GameObjects.Rectangle | null = null;
    foodText: Phaser.GameObjects.Text | null = null;
    private foodBarWidth: number = 300;
    private foodBarHeight: number = 30;
    private foodBarMaxValue: number = 1000;
    // Food consumption system
    private consumptionTimer: number = 0;
    private gameTime: number = 0; // Track game time in milliseconds

    constructor() {
        super("DevScene");
    }

    preload() {
        // Load map.png if not already loaded
        if (!this.textures.exists("map")) {
            this.load.image("map", "assets/map.png");
            console.log("⏳ Loading map.png in DevScene...");
        }

        // Create farmer character sprite sheet if not already created
        if (!this.textures.exists("farmer")) {
            const frameWidth = 40;
            const frameHeight = 80;
            const totalFrames = 4;

            const graphics = this.add.graphics();

            for (let i = 0; i < totalFrames; i++) {
                const xOffset = i * frameWidth;
                const legOffset = i % 2 === 0 ? 0 : 5;
                const armOffset = i % 2 === 0 ? 0 : -5;

                graphics.fillStyle(0x8b4513, 1);
                graphics.fillRect(xOffset + 10, 20, 20, 35);

                graphics.fillStyle(0xffdbac, 1);
                graphics.fillCircle(xOffset + 20, 15, 8);

                graphics.fillStyle(0xf4a460, 1);
                graphics.fillRect(xOffset + 12, 5, 16, 4);
                graphics.fillRect(xOffset + 15, 8, 10, 3);

                graphics.fillStyle(0xffdbac, 1);
                graphics.fillRect(xOffset + 5, 25 + armOffset, 5, 15);
                graphics.fillRect(xOffset + 30, 25 - armOffset, 5, 15);

                graphics.fillStyle(0x654321, 1);
                graphics.fillRect(xOffset + 12, 55, 6, 20 + legOffset);
                graphics.fillRect(xOffset + 22, 55, 6, 20 - legOffset);

                graphics.fillStyle(0x3e2723, 1);
                graphics.fillRect(xOffset + 12, 73 + legOffset, 6, 4);
                graphics.fillRect(xOffset + 22, 73 - legOffset, 6, 4);
            }

            graphics.generateTexture(
                "farmer",
                frameWidth * totalFrames,
                frameHeight,
            );
            graphics.destroy();

            const texture = this.textures.get("farmer");
            texture.setFilter(Phaser.Textures.FilterMode.NEAREST);

            texture.add(
                "__BASE",
                0,
                0,
                0,
                frameWidth * totalFrames,
                frameHeight,
            );
            for (let i = 0; i < totalFrames; i++) {
                texture.add(i, 0, i * frameWidth, 0, frameWidth, frameHeight);
            }
        }

        if (!this.anims.exists("farmer_walk")) {
            this.anims.create({
                key: "farmer_walk",
                frames: this.anims.generateFrameNumbers("farmer", {
                    start: 0,
                    end: 3,
                }),
                frameRate: 8,
                repeat: -1,
            });
        }

        if (!this.anims.exists("farmer_idle")) {
            this.anims.create({
                key: "farmer_idle",
                frames: [{ key: "farmer", frame: 0 }],
                frameRate: 1,
                repeat: -1,
            });
        }
    }

    create() {
        console.log("🔧 DEV MODE: Running DevScene (no network)");

        // Background
        const bg = this.add.image(
            this.scale.width / 2,
            this.scale.height / 2,
            "map",
        );
        bg.setDisplaySize(this.scale.width, this.scale.height);
        bg.setDepth(-100);

        const midX = this.scale.width * 0.5;

        // Grid
        const gridSize = 40;
        const graphics = this.add.graphics();
        graphics.lineStyle(2, 0xffffff, 0.5);

        for (let x = 0; x <= this.scale.width; x += gridSize) {
            graphics.lineBetween(x, 0, x, this.scale.height);
        }

        for (let y = 0; y <= this.scale.height; y += gridSize) {
            graphics.lineBetween(0, y, this.scale.width, y);
        }

        graphics.setDepth(-1);

        // Middle line
        this.add
            .rectangle(
                midX,
                this.scale.height * 0.5,
                4,
                this.scale.height,
                0xffffff,
            )
            .setDepth(1);

        // Create farms
        const targetSize = 160;
        const targetColors = [0xff0000, 0x0000ff, 0xffff00, 0x00ff00];
        const targetLeftXGrid = [6, 10, 6, 10];
        const targetLeftYGrid = [1, 1, 7, 7];
        const targetRightXGrid = [23, 19, 23, 19];
        const targetRightYGrid = [1, 1, 7, 7];
        const farmTypes: Array<"wheat" | "carrot" | "sunflower" | "potato"> = [
            "wheat",
            "carrot",
            "sunflower",
            "potato",
        ];

        targetColors.forEach((color, index) => {
            const x = targetLeftXGrid[index] * 40;
            const y = targetLeftYGrid[index] * 40;
            this.targetPositions.push({ x, y });

            const farm = new Farm({
                scene: this,
                x,
                y,
                farmId: `farm-left-${index}`,
                farmType: farmTypes[index],
                playerNumber: 1,
            });

            this.farms.set(farm.farmId, farm);
        });

        targetColors.forEach((color, index) => {
            const x = targetRightXGrid[index] * 40;
            const y = targetRightYGrid[index] * 40;
            this.targetPositions.push({ x, y });

            const farm = new Farm({
                scene: this,
                x,
                y,
                farmId: `farm-right-${index}`,
                farmType: farmTypes[index],
                playerNumber: 1,
            });

            this.farms.set(farm.farmId, farm);
        });

        // Create common target area at bottom center (8x5 grid cells = 320x200px)
        const commonTargetWidth = 8 * gridSize; // 320px
        const commonTargetHeight = 5 * gridSize; // 200px
        const commonTargetX = midX - gridSize; // Shift left by 1 tile
        const commonTargetY = this.scale.height - commonTargetHeight / 2; // Bottom

        this.add
            .rectangle(
                commonTargetX,
                commonTargetY,
                commonTargetWidth,
                commonTargetHeight,
                0xff8800,
                0.3,
            )
            .setStrokeStyle(3, 0xff8800, 1)
            .setDepth(0);

        // Draw menu areas (restricted movement zones)
        const leftMenuWidth = 12 * gridSize; // 480px (12 columns)
        const rightMenuWidth = 12 * gridSize; // 480px (12 columns)
        const sideMenuHeight = 5 * gridSize; // 200px (5 rows from bottom)

        // Left menu area (bottom-left corner)
        this.add
            .rectangle(
                leftMenuWidth / 2,
                this.scale.height - sideMenuHeight / 2,
                leftMenuWidth,
                sideMenuHeight,
                0x222222,
                0.6,
            )
            .setStrokeStyle(2, 0x666666, 0.8)
            .setDepth(0);

        // Right menu area (bottom-right corner)
        this.add
            .rectangle(
                this.scale.width - rightMenuWidth / 2,
                this.scale.height - sideMenuHeight / 2,
                rightMenuWidth,
                sideMenuHeight,
                0x222222,
                0.6,
            )
            .setStrokeStyle(2, 0x666666, 0.8)
            .setDepth(0);

        // Define restricted zones (match MainGameScene)
        const restrictedZones = [
            {
                rows: [5],
                columns: Array.from({ length: 11 }, (_, i) => i + 4).concat(
                    Array.from({ length: 11 }, (_, i) => i + 17),
                ),
            },
            {
                rows: Array.from({ length: 4 }, (_, i) => i + 6),
                columns: [14, 17],
            },
        ];

        restrictedZones.forEach((zone) => {
            zone.rows.forEach((row) => {
                zone.columns.forEach((col) => {
                    this.add
                        .rectangle(
                            col * gridSize + gridSize / 2,
                            row * gridSize + gridSize / 2,
                            gridSize,
                            gridSize,
                            0xff0000,
                            0.3,
                        )
                        .setStrokeStyle(2, 0xff0000, 0.8)
                        .setDepth(0);
                });
            });
        });

        // Create food bar UI at top
        this.createFoodBar();

        // Tower placement and farm interaction
        this.farmPopup = new FarmPopup(this);

        this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
            // Close popup if clicking outside
            if (this.farmPopup && this.farmPopup.isActive()) {
                this.farmPopup.hide();
                return;
            }

            // Check if clicking on a farm
            let handled = false;
            this.farms.forEach((farm) => {
                const distance = Phaser.Math.Distance.Between(
                    farm.x,
                    farm.y,
                    pointer.worldX,
                    pointer.worldY,
                );

                // Check if player is within 1 tile (40px) of farm and click on farm area
                const char = this.characters.get(1);
                if (char) {
                    const charDistance = Phaser.Math.Distance.Between(
                        char.x,
                        char.y,
                        farm.x,
                        farm.y,
                    );

                    if (charDistance <= 40 && distance < 160) {
                        // Player within 1 tile and click on farm (160px = 4x4 grid)
                        this.farmPopup!.show(farm);
                        handled = true;
                    }
                }
            });

            if (!handled) {
                this.tryBuildTower(pointer);
            }
            if (!handled) {
                this.tryBuildTower(pointer);
            }
        });

        // Create single player character
        const char1 = new Character({
            scene: this,
            x: midX * 0.5,
            y: this.scale.height * 0.5,
            playerId: "dev-player",
            playerNumber: 1,
            isLocalPlayer: true,
            networkManager: null, // No network in dev mode
        });

        this.characters.set(1, char1);

        // Enemy spawn button
        this.createEnemySpawnButton();

        // Mask toggle button
        this.createMaskToggleButton();

        // Book toggle button
        this.createBookToggleButton();

        EventBus.emit("current-scene-ready", this);
    }

    createEnemySpawnButton() {
        const buttonX = this.scale.width - 100;
        const buttonY = 60;
        const buttonWidth = 160;
        const buttonHeight = 50;

        this.enemySpawnButton = this.add.rectangle(
            buttonX,
            buttonY,
            buttonWidth,
            buttonHeight,
            0x00ff00,
            0.8,
        );
        this.enemySpawnButton.setStrokeStyle(2, 0xffffff);
        this.enemySpawnButton.setInteractive({ cursor: "pointer" });
        this.enemySpawnButton.setDepth(100);

        this.enemySpawnText = this.add.text(buttonX, buttonY, "Spawn Enemies", {
            fontSize: "16px",
            color: "#000000",
            fontStyle: "bold",
        });
        this.enemySpawnText.setOrigin(0.5);
        this.enemySpawnText.setDepth(101);

        this.enemySpawnButton.on("pointerdown", () => {
            this.spawnInitialEnemies();
        });

        this.enemySpawnButton.on("pointerover", () => {
            this.enemySpawnButton?.setFillStyle(0x00cc00, 0.8);
        });

        this.enemySpawnButton.on("pointerout", () => {
            this.enemySpawnButton?.setFillStyle(0x00ff00, 0.8);
        });
    }

    createMaskToggleButton() {
        const buttonX = 60;
        const buttonY = this.scale.height - 60;
        const buttonSize = 80;

        const buttonBg = this.add.rectangle(
            buttonX,
            buttonY,
            buttonSize,
            buttonSize,
            0x444444,
            0.8,
        );
        buttonBg.setStrokeStyle(2, 0xffffff);
        buttonBg.setInteractive({ cursor: "pointer" });
        buttonBg.setDepth(100);

        const maskIcon = this.add.graphics();
        maskIcon.setDepth(101);

        maskIcon.fillStyle(0xffffff, 1);
        maskIcon.fillEllipse(buttonX, buttonY - 10, 30, 20);
        maskIcon.fillEllipse(buttonX - 15, buttonY - 5, 10, 12);
        maskIcon.fillEllipse(buttonX + 15, buttonY - 5, 10, 12);
        maskIcon.fillRect(buttonX - 20, buttonY, 40, 15);

        const crossIcon = this.add.graphics();
        crossIcon.setDepth(102);
        crossIcon.lineStyle(3, 0xff0000, 1);
        crossIcon.beginPath();
        crossIcon.moveTo(buttonX - 25, buttonY - 25);
        crossIcon.lineTo(buttonX + 25, buttonY + 25);
        crossIcon.moveTo(buttonX + 25, buttonY - 25);
        crossIcon.lineTo(buttonX - 25, buttonY + 25);
        crossIcon.strokePath();
        crossIcon.setVisible(true);

        const localChar = this.characters.get(1);

        buttonBg.on("pointerdown", () => {
            if (localChar) {
                const newMaskState = !localChar.getHasMask();
                localChar.setHasMask(newMaskState);
                crossIcon.setVisible(!newMaskState);
                console.log(`🎭 Mask toggled: ${newMaskState}`);
            }
        });

        buttonBg.on("pointerover", () => {
            buttonBg.setFillStyle(0x666666, 0.8);
        });

        buttonBg.on("pointerout", () => {
            buttonBg.setFillStyle(0x444444, 0.8);
        });
    }

    createBookToggleButton() {
        const buttonX = 160; // Next to mask button
        const buttonY = this.scale.height - 60;
        const buttonSize = 80;

        const buttonBg = this.add.rectangle(
            buttonX,
            buttonY,
            buttonSize,
            buttonSize,
            0x444444,
            0.8,
        );
        buttonBg.setStrokeStyle(2, 0xffffff);
        buttonBg.setInteractive({ cursor: "pointer" });
        buttonBg.setDepth(100);

        const bookIcon = this.add.graphics();
        bookIcon.setDepth(101);

        // Draw a simple book shape
        bookIcon.fillStyle(0x8b4513, 1); // Brown book cover
        bookIcon.fillRect(buttonX - 20, buttonY - 25, 40, 50);

        bookIcon.fillStyle(0xf4e4c1, 1); // Lighter pages
        bookIcon.fillRect(buttonX - 18, buttonY - 23, 36, 46);

        // Book spine
        bookIcon.fillStyle(0x654321, 1);
        bookIcon.fillRect(buttonX - 20, buttonY - 25, 8, 50);

        // Page lines
        bookIcon.lineStyle(1, 0x8b4513, 0.5);
        for (let i = 0; i < 4; i++) {
            const lineY = buttonY - 15 + i * 10;
            bookIcon.lineBetween(buttonX - 10, lineY, buttonX + 15, lineY);
        }

        const crossIcon = this.add.graphics();
        crossIcon.setDepth(102);
        crossIcon.lineStyle(3, 0xff0000, 1);
        crossIcon.beginPath();
        crossIcon.moveTo(buttonX - 25, buttonY - 25);
        crossIcon.lineTo(buttonX + 25, buttonY + 25);
        crossIcon.moveTo(buttonX + 25, buttonY - 25);
        crossIcon.lineTo(buttonX - 25, buttonY + 25);
        crossIcon.strokePath();
        crossIcon.setVisible(true);

        const localChar = this.characters.get(1);

        buttonBg.on("pointerdown", () => {
            if (localChar) {
                const newBookState = !localChar.getHasBook();
                localChar.setHasBook(newBookState);
                crossIcon.setVisible(!newBookState);
                console.log(`📕 Book toggled: ${newBookState}`);
            }
        });

        buttonBg.on("pointerover", () => {
            buttonBg.setFillStyle(0x666666, 0.8);
        });

        buttonBg.on("pointerout", () => {
            buttonBg.setFillStyle(0x444444, 0.8);
        });
    }

    spawnInitialEnemies() {
        const enemies: Array<{
            id: string;
            type: number;
            goingLeft: boolean;
            enemyId?: number;
            startTime?: number;
        }> = [];

        // Spawn 10 enemies on each side
        for (let i = 0; i < 10; i++) {
            enemies.push({
                id: `enemy-left-${Date.now()}-${i}`,
                type: i % 4,
                goingLeft: true,
                enemyId: i % 4,
                startTime: Date.now() + i * 1000,
            });

            enemies.push({
                id: `enemy-right-${Date.now()}-${i}`,
                type: i % 4,
                goingLeft: false,
                enemyId: i % 4,
                startTime: Date.now() + i * 1000,
            });
        }

        this.spawnEnemies(enemies);
        console.log(`🐛 Spawned ${enemies.length} enemies in DEV mode`);
    }

    spawnEnemies(
        enemies: Array<{
            id: string;
            type: number;
            goingLeft: boolean;
            enemyId?: number;
            startTime?: number;
        }>,
    ) {
        const midX = this.scale.width / 2;

        enemies.forEach((enemyData) => {
            const delay = enemyData.startTime
                ? enemyData.startTime - Date.now()
                : 0;

            this.time.delayedCall(Math.max(0, delay), () => {
                const startX = enemyData.goingLeft ? midX - 80 : midX + 80;

                const enemy = new Enemy({
                    scene: this,
                    x: startX,
                    y: this.scale.height - 40,
                    enemyId: enemyData.id,
                    enemyType: enemyData.type,
                    goingLeft: enemyData.goingLeft,
                });

                this.enemies.set(enemyData.id, enemy);
            });
        });
    }

    update(time: number, dt: number) {
        // Track game time for consumption scaling
        this.gameTime += dt;

        this.characters.forEach((character) => {
            character.update();
        });

        this.enemies.forEach((enemy) => {
            enemy.update();
        });

        this.towers.forEach((tower) => {
            tower.update(this.enemies);
            tower.flushKilledEnemies();
        });

        // Update all farms (production, enemy detection)
        this.farms.forEach((farm) => {
            farm.update(dt, this.enemies);
        });

        // Apply farm production deltas
        this.farms.forEach((farm) => {
            const last = this.farmLastFood.get(farm.farmId) || 0;
            const delta = farm.totalFood - last;
            if (delta > 0) {
                this.baseFood = Math.round((this.baseFood + delta) * 10) / 10;
            }
            this.farmLastFood.set(farm.farmId, farm.totalFood);
        });

        // Food consumption system
        this.consumptionTimer += dt;
        if (this.consumptionTimer >= 5000) {
            // Calculate consumption based on game time (adds 2 each minute, max 16)
            const minutesPassed = Math.floor(this.gameTime / 60000);
            const scaledConsumption = Math.min(2 + 2 * minutesPassed, 16);

            const nextFood = Math.max(0, this.baseFood - scaledConsumption);
            this.baseFood = Math.round(nextFood * 10) / 10;
            this.consumptionTimer -= 5000;

            console.log(
                `🍽️ Consumed ${scaledConsumption} food (minute ${minutesPassed}). Remaining: ${this.baseFood.toFixed(1)}`,
            );
        }

        // Update food bar display
        this.updateFoodBar();

        // Apply hunger effects for local player
        this.applyHungerEffects();

        const deadEnemies: string[] = [];
        this.enemies.forEach((enemy, id) => {
            if (!enemy.active) {
                deadEnemies.push(id);
            }
        });
        deadEnemies.forEach((id) => this.enemies.delete(id));
    }

    shutdown() {
        this.characters.forEach((char) => {
            char.destroy();
        });
        this.characters.clear();

        this.enemies.forEach((enemy) => {
            enemy.destroy();
        });
        this.enemies.clear();

        this.towers.forEach((tower) => {
            tower.destroy();
        });
        this.towers.clear();

        this.farms.forEach((farm) => {
            farm.destroy();
        });
        this.farms.clear();

        if (this.farmPopup) {
            this.farmPopup.destroy();
            this.farmPopup = null;
        }
    }

    private createFoodBar() {
        const x = this.scale.width / 2;
        const y = 25;

        // Background bar (dark)
        this.foodBarBg = this.add
            .rectangle(x, y, this.foodBarWidth, this.foodBarHeight, 0x333333, 1)
            .setStrokeStyle(2, 0xffffff, 1)
            .setDepth(1000);

        // Food fill bar (green/golden) - create with small initial width
        this.foodBar = this.add
            .rectangle(
                x - this.foodBarWidth / 2 + 1,
                y,
                2,
                this.foodBarHeight,
                0xffcc00,
                1,
            )
            .setOrigin(0.5, 0.5)
            .setDepth(1001);

        // Food text label
        this.foodText = this.add.text(x, y, "Food: 10.0", {
            fontSize: "16px",
            color: "#ffffff",
            fontStyle: "bold",
            fontFamily: "Arial",
        });
        this.foodText.setOrigin(0.5, 0.5);
        this.foodText.setDepth(1002);
    }

    private updateFoodBar() {
        this.totalFood = this.baseFood;

        if (!this.foodBar || !this.foodText) return;

        // Calculate bar fill width (proportional to foodBarWidth)
        const fillPercentage = Math.min(
            this.totalFood / this.foodBarMaxValue,
            1,
        );
        const barFillWidth = this.foodBarWidth * fillPercentage;
        const barX =
            this.scale.width / 2 - this.foodBarWidth / 2 + barFillWidth / 2;

        // Update bar position and width by destroying and recreating
        this.foodBar.destroy();
        this.foodBar = this.add
            .rectangle(barX, 25, barFillWidth, this.foodBarHeight, 0xffcc00, 1)
            .setOrigin(0.5, 0.5)
            .setDepth(1001);

        // Update text
        this.foodText.setText(`Food: ${this.totalFood.toFixed(1)}`);

        // Change color based on amount
        if (fillPercentage < 0.25) {
            this.foodBar.setFillStyle(0xff6666, 1); // Red when low
        } else if (fillPercentage < 0.75) {
            this.foodBar.setFillStyle(0xffcc00, 1); // Gold when medium
        } else {
            this.foodBar.setFillStyle(0x66ff66, 1); // Green when high
        }
    }

    private applyHungerEffects() {
        const char = this.characters.get(1);
        if (!char) return;

        if (this.totalFood <= 0) {
            char.setSpeedMultiplier(0.5);
        } else {
            char.setSpeedMultiplier(1);
        }
    }

    private isInCommonTargetArea(x: number, y: number): boolean {
        const midX = this.scale.width / 2;
        const commonTargetWidth = 8 * 40;
        const commonTargetHeight = 5 * 40;
        const commonTargetMinY = this.scale.height - commonTargetHeight; // last 5 rows
        const commonTargetMinX = midX - commonTargetWidth / 2 - 40; // shift left by 1 tile
        const commonTargetMaxX = midX + commonTargetWidth / 2 - 40;

        return (
            y >= commonTargetMinY &&
            x >= commonTargetMinX &&
            x <= commonTargetMaxX
        );
    }

    private tryBuildTower(pointer: Phaser.Input.Pointer) {
        if (this.totalFood <= 0) {
            return;
        }

        const gridSize = 40;
        const x = Math.round(pointer.worldX / gridSize) * gridSize;
        const y = Math.round(pointer.worldY / gridSize) * gridSize;

        if (!this.isInCommonTargetArea(x, y)) {
            return;
        }

        // Prevent building on top of farms
        let overlapsFarm = false;
        this.farms.forEach((farm) => {
            const distance = Phaser.Math.Distance.Between(farm.x, farm.y, x, y);
            if (distance < 80) {
                overlapsFarm = true;
            }
        });
        if (overlapsFarm) return;

        // Prevent building on top of towers
        let overlapsTower = false;
        this.towers.forEach((tower) => {
            const distance = Phaser.Math.Distance.Between(
                tower.x,
                tower.y,
                x,
                y,
            );
            if (distance < 80) {
                overlapsTower = true;
            }
        });
        if (overlapsTower) return;

        const towerId = `tower-dev-${Date.now()}`;
        const tower = new Tower({
            scene: this,
            x,
            y,
            towerId,
            playerNumber: 1,
        });
        this.towers.set(towerId, tower);
    }
}

