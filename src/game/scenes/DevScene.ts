import { EventBus } from "../EventBus";
import Phaser from "phaser";
import { Character } from "../objects/Character";
import { Enemy } from "../objects/Enemy";
import { Tower } from "../objects/Tower";

export class DevScene extends Phaser.Scene {
    characters: Map<number, Character> = new Map();
    enemies: Map<string, Enemy> = new Map();
    towers: Map<string, Tower> = new Map();
    targetPositions: Array<{ x: number; y: number }> = [];
    private enemySpawnButton: Phaser.GameObjects.Rectangle | null = null;
    private enemySpawnText: Phaser.GameObjects.Text | null = null;

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

        // Targets
        const targetSize = 160;
        const targetColors = [0xff0000, 0x0000ff, 0xffff00, 0x00ff00];
        const targetLeftXGrid = [11, 17, 11, 17];
        const targetLeftYGrid = [4, 4, 12, 12];
        const targetRightXGrid = [32, 38, 32, 38];
        const targetRightYGrid = [4, 4, 12, 12];

        targetColors.forEach((color, index) => {
            const x = targetLeftXGrid[index] * 40;
            const y = targetLeftYGrid[index] * 40;
            this.targetPositions.push({ x, y });
            this.add
                .rectangle(x, y, targetSize, targetSize, color, 0.3)
                .setStrokeStyle(3, color, 1)
                .setDepth(0);
        });

        targetColors.forEach((color, index) => {
            const x = targetRightXGrid[index] * 40;
            const y = targetRightYGrid[index] * 40;
            this.targetPositions.push({ x, y });
            this.add
                .rectangle(x, y, targetSize, targetSize, color, 0.3)
                .setStrokeStyle(3, color, 1)
                .setDepth(0);
        });

        // Create common target area at bottom center (12x6 grid cells = 480x240px)
        const gridSize = 40;
        const commonTargetWidth = 12 * gridSize; // 480px
        const commonTargetHeight = 6 * gridSize; // 240px
        const commonTargetX = midX; // Center at middle
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
        const leftMenuWidth = 19 * gridSize; // 760px (19 columns)
        const rightMenuWidth = 19 * gridSize; // 760px (19 columns)
        const sideMenuHeight = 7 * gridSize; // 280px (7 rows from bottom)
        const bottomMenuHeight = 2 * gridSize; // 80px (2 rows)
        const bottomMenuWidth = 20 * gridSize; // 800px (20 columns from 6 to 26)

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

        // Bottom menu area (centered, 19 columns wide, 2 rows)
        this.add
            .rectangle(
                midX,
                this.scale.height - bottomMenuHeight / 2,
                bottomMenuWidth,
                bottomMenuHeight,
                0x222222,
                0.6,
            )
            .setStrokeStyle(2, 0x666666, 0.8)
            .setDepth(0);

        // Tower placement
        this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
            this.tryBuildTower(pointer.x, pointer.y);
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

    update() {
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
    }

    private tryBuildTower(clickX: number, clickY: number) {
        const gridSize = 40;
        const snappedX = Math.round(clickX / gridSize) * gridSize;
        const snappedY = Math.round(clickY / gridSize) * gridSize;

        let canBuild = false;

        this.characters.forEach((character) => {
            const distance = Phaser.Math.Distance.Between(
                character.x,
                character.y,
                snappedX,
                snappedY,
            );
            if (distance <= 80) {
                canBuild = true;
            }
        });

        if (!canBuild) {
            console.log(`❌ Character must be within 2 tiles to build tower`);
            return;
        }

        const towerSize = 80;
        let overlapping = false;
        this.towers.forEach((tower) => {
            const distance = Phaser.Math.Distance.Between(
                tower.x,
                tower.y,
                snappedX,
                snappedY,
            );
            if (distance < towerSize) {
                overlapping = true;
            }
        });

        if (overlapping) {
            console.log(`❌ Cannot place tower - overlaps with existing tower`);
            return;
        }

        const towerId = `tower-${Date.now()}`;
        const tower = new Tower({
            scene: this,
            x: snappedX,
            y: snappedY,
            towerId,
            playerNumber: 1,
            networkManager: null, // No network in dev mode
        });

        this.towers.set(towerId, tower);
        console.log(`🏗️ Tower built at (${snappedX}, ${snappedY})`);
    }
}

