import { EventBus } from "../EventBus";
import Phaser from "phaser";
import { Character } from "../objects/Character";
import { Enemy } from "../objects/Enemy";
import { Tower } from "../objects/Tower";
import { TrapTower } from "../objects/TrapTower";
import { Farm } from "../objects/Farm";
import { FarmPopup } from "../objects/FarmPopup";
import { TowerSelectionPopup } from "../objects/TowerSelectionPopup";
import { NetworkManager } from "../managers/NetworkManager";

interface MainGameSceneData {
    playerId: string;
    roomPlayerId: string;
    playerNumber: number;
    roomId: string;
    networkManager: NetworkManager;
}

export class MainGameScene extends Phaser.Scene {
    gameText: Phaser.GameObjects.Text;
    characters: Map<number, Character> = new Map();
    enemies: Map<string, Enemy> = new Map();
    towers: Map<string, Tower> = new Map();
    trapTowers: Map<string, TrapTower> = new Map();
    farms: Map<string, Farm> = new Map();
    farmPopup: FarmPopup | null = null;
    towerSelectionPopup: TowerSelectionPopup | null = null;
    networkManager: NetworkManager | null = null;
    playerId: string = "";
    roomPlayerId: string = "";
    playerNumber: number = 0;
    roomId: string = "";
    // Target positions for visual reference (enemies aim for these)
    targetPositions: Array<{ x: number; y: number }> = [];
    // Food inventory system (per player)
    playerFood: Map<number, number> = new Map([
        [1, 10],
        [2, 10],
    ]);
    playerTotalFood: Map<number, number> = new Map([
        [1, 10],
        [2, 10],
    ]);
    private farmLastFood: Map<string, number> = new Map();
    foodBarBgs: Map<number, Phaser.GameObjects.Rectangle> = new Map();
    foodBars: Map<number, Phaser.GameObjects.Rectangle> = new Map();
    foodTexts: Map<number, Phaser.GameObjects.Text> = new Map();
    private foodBarWidth: number = 576; // 90% of player side (640 * 0.9)
    private foodBarHeight: number = 40;
    private foodBarMaxValue: number = 1000;
    // Food consumption system (per player)
    private consumptionTimers: Map<number, number> = new Map([
        [1, 0],
        [2, 0],
    ]);
    private gameTime: number = 0; // Track game time in milliseconds
    // Gold inventory system (per player)
    playerGold: Map<number, number> = new Map([
        [1, 10],
        [2, 10],
    ]);
    goldTexts: Map<number, Phaser.GameObjects.Text> = new Map();
    // Gold production timer (same as consumption)
    private goldProductionTimers: Map<number, number> = new Map([
        [1, 0],
        [2, 0],
    ]);

    constructor() {
        super("MainGameScene");
    }

    init(data: MainGameSceneData) {
        this.playerId = data.playerId;
        this.roomPlayerId = data.roomPlayerId;
        this.playerNumber = data.playerNumber;
        this.roomId = data.roomId;
        this.networkManager = data.networkManager;

        console.log("MainGameScene init:", {
            playerId: this.playerId,
            roomPlayerId: this.roomPlayerId,
            playerNumber: this.playerNumber,
            roomId: this.roomId,
        });
    }

    preload() {
        // Load map.png if not already loaded
        if (!this.textures.exists("map")) {
            this.load.image("map", "assets/map.png");
            console.log("⏳ Loading map.png in MainGameScene...");
        } else {
            console.log("✅ map texture already exists");
        }

        // Create farmer character sprite sheet if not already created
        if (!this.textures.exists("farmer")) {
            const frameWidth = 40;
            const frameHeight = 80;
            const totalFrames = 4; // 4 walking frames

            const graphics = this.add.graphics();

            // Draw all 4 frames side by side WITHOUT clearing between frames
            for (let i = 0; i < totalFrames; i++) {
                const xOffset = i * frameWidth;
                const legOffset = i % 2 === 0 ? 0 : 5; // Leg movement
                const armOffset = i % 2 === 0 ? 0 : -5; // Arm movement

                // Body (brown)
                graphics.fillStyle(0x8b4513, 1);
                graphics.fillRect(xOffset + 10, 20, 20, 35);

                // Head (peach)
                graphics.fillStyle(0xffdbac, 1);
                graphics.fillCircle(xOffset + 20, 15, 8);

                // Hat (straw yellow)
                graphics.fillStyle(0xf4a460, 1);
                graphics.fillRect(xOffset + 12, 5, 16, 4);
                graphics.fillRect(xOffset + 15, 8, 10, 3);

                // Left arm
                graphics.fillStyle(0xffdbac, 1);
                graphics.fillRect(xOffset + 5, 25 + armOffset, 5, 15);

                // Right arm
                graphics.fillRect(xOffset + 30, 25 - armOffset, 5, 15);

                // Left leg
                graphics.fillStyle(0x654321, 1);
                graphics.fillRect(xOffset + 12, 55, 6, 20 + legOffset);

                // Right leg
                graphics.fillRect(xOffset + 22, 55, 6, 20 - legOffset);

                // Feet (darker brown)
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

            // Add the texture as a sprite sheet with frame configuration
            const texture = this.textures.get("farmer");
            texture.setFilter(Phaser.Textures.FilterMode.NEAREST);

            // Add frame definitions to the texture
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

            console.log("✅ Farmer sprite sheet created in MainGameScene");
        } else {
            console.log("✅ farmer texture already exists");
        }

        // Create walking animation if not exists
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

        // Create idle animation
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
        // Add map.png as background (scaled to fit screen)
        const bg = this.add.image(
            this.scale.width / 2,
            this.scale.height / 2,
            "map",
        );
        bg.setDisplaySize(this.scale.width, this.scale.height);
        bg.setDepth(-100);
        console.log("🖼️ Background image created:", {
            texture: bg.texture.key,
            width: bg.displayWidth,
            height: bg.displayHeight,
            depth: bg.depth,
            visible: bg.visible,
            alpha: bg.alpha,
        });

        const midX = this.scale.width * 0.5;

        // Draw grid - 32x18 (40px each cell for 1280x720)
        const gridSize = 40; // Grid cell size in pixels
        const graphics = this.add.graphics();
        graphics.lineStyle(2, 0xffffff, 0.5);

        // Vertical grid lines
        for (let x = 0; x <= this.scale.width; x += gridSize) {
            graphics.lineBetween(x, 0, x, this.scale.height);
        }

        // Horizontal grid lines
        for (let y = 0; y <= this.scale.height; y += gridSize) {
            graphics.lineBetween(0, y, this.scale.width, y);
        }

        graphics.setDepth(-1);

        this.add
            .rectangle(
                midX,
                this.scale.height * 0.5,
                4,
                this.scale.height,
                0xffffff,
            )
            .setDepth(1);

        // Create target squares on each side
        const targetSize = 160; // 4x4 grid cells (40px * 4)
        const targetColors = [0xff0000, 0x0000ff, 0xffff00, 0x00ff00]; // Red, Blue, Yellow, Green
        // Left side: 4x4 grid, aligned to 40px grid
        // Using grid coordinates (each grid cell = 40px)
        // 1280x720 = 32 columns × 18 rows
        const targetLeftXGrid = [11, 17, 11, 17]; // Grid positions from left
        const targetLeftYGrid = [4, 4, 12, 12]; // Grid positions from top
        // Right side: mirrored
        const targetRightXGrid = [32, 38, 32, 38]; // Grid positions from left (32 columns)
        const targetRightYGrid = [4, 4, 12, 12]; // Grid positions from top

        // Create farms on left side
        // Wheat (yellow), Carrot (red), Sunflower (blue), Potato (green)
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

        // Create farms on right side
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
                playerNumber: 2,
            });

            this.farms.set(farm.farmId, farm);
        });

        // Create common target area at bottom center (12x6 grid cells = 480x240px)
        // Centered: 6 tiles left and 6 tiles right from middle (tiles 10-22)
        // Bottom: last 6 rows (rows 12-17 in 0-indexed, y from 480 to 720)
        const commonTargetWidth = 12 * gridSize; // 480px
        const commonTargetHeight = 6 * gridSize; // 240px
        const commonTargetX = midX; // Center at middle
        const commonTargetY = this.scale.height - commonTargetHeight / 2; // Bottom, centered vertically in the 6 rows

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

        // Create food bar UI at top
        this.createFoodBar();

        // Add input listener for farm interaction
        this.farmPopup = new FarmPopup(this);
        this.towerSelectionPopup = new TowerSelectionPopup(this);

        this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
            // Close tower selection popup if clicking outside
            if (
                this.towerSelectionPopup &&
                this.towerSelectionPopup.isActive()
            ) {
                this.towerSelectionPopup.hide();
                return;
            }

            // Close farm popup if clicking outside
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
                const char = this.characters.get(this.playerNumber);
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
                this.showTowerSelectionMenu(pointer);
            }
        });

        // Create characters at spawn points
        const char1 = new Character({
            scene: this,
            x: midX * 0.5,
            y: this.scale.height * 0.5,
            playerId: "player1",
            playerNumber: 1,
            isLocalPlayer: this.playerNumber === 1,
            networkManager: this.networkManager,
        });

        const char2 = new Character({
            scene: this,
            x: midX * 1.5,
            y: this.scale.height * 0.5,
            playerId: "player2",
            playerNumber: 2,
            isLocalPlayer: this.playerNumber === 2,
            networkManager: this.networkManager,
        });

        this.characters.set(1, char1);
        this.characters.set(2, char2);

        // Listen for incoming hero movements from other players
        const handleHeroMoved = (event: Event) => {
            const customEvent = event as CustomEvent;
            const { playerNumber, x, y } = customEvent.detail;
            console.log(`Hero moved event for player ${playerNumber}`, {
                x,
                y,
            });

            const char = this.characters.get(playerNumber);
            if (char && !char.isLocalPlayer) {
                console.log(
                    `Updating remote position for player ${playerNumber}`,
                );
                char.updateRemotePosition(x, y);
            }
        };

        window.addEventListener("heroMoved", handleHeroMoved);

        // Listen for enemy spawn events
        const handleEnemySpawn = (event: Event) => {
            const customEvent = event as CustomEvent;
            const { enemies } = customEvent.detail;
            console.log(`🐛 Spawning ${enemies.length} enemies`);
            this.spawnEnemies(enemies);
        };

        window.addEventListener("spawnEnemies", handleEnemySpawn);

        // Listen for enemy killed events
        const handleEnemyKilled = (event: Event) => {
            const customEvent = event as CustomEvent;
            const { enemyId } = customEvent.detail;
            console.log(`💥 Enemy ${enemyId} killed by remote tower`);
            const enemy = this.enemies.get(enemyId);
            if (enemy) {
                enemy.destroy();
                this.enemies.delete(enemyId);
            }
        };

        window.addEventListener("enemyKilled", handleEnemyKilled);

        // Listen for tower building events
        const handleTowerBuilt = (event: Event) => {
            const customEvent = event as CustomEvent;
            const { towerId, x, y, playerNumber } = customEvent.detail;
            console.log(`🏗️ Remote tower built at (${x}, ${y})`);
            if (this.towers.has(towerId)) {
                return;
            }
            const tower = new Tower({
                scene: this,
                x,
                y,
                towerId,
                playerNumber,
                networkManager: this.networkManager,
            });
            this.towers.set(towerId, tower);
        };

        window.addEventListener("towerBuilt", handleTowerBuilt);

        // Listen for mask toggle events
        const handleMaskToggled = (event: Event) => {
            const customEvent = event as CustomEvent;
            const { playerNumber, hasMask } = customEvent.detail;
            console.log(
                `🎭 Mask toggled for player ${playerNumber}: ${hasMask}`,
            );
            const char = this.characters.get(playerNumber);
            if (char) {
                char.setHasMask(hasMask);
            }
        };

        window.addEventListener("maskToggled", handleMaskToggled);

        // Listen for book toggle events
        const handleBookToggled = (event: Event) => {
            const customEvent = event as CustomEvent;
            const { playerNumber, hasBook } = customEvent.detail;
            console.log(
                `📕 Book toggled for player ${playerNumber}: ${hasBook}`,
            );
            const char = this.characters.get(playerNumber);
            if (char) {
                char.setHasBook(hasBook);
            }
        };

        window.addEventListener("bookToggled", handleBookToggled);

        // Player 1 spawns the initial 20 enemies
        if (this.playerNumber === 1) {
            // Spawn after a short delay to ensure everything is set up
            this.time.delayedCall(1000, () => {
                this.spawnInitialEnemies();
            });
        }

        // Create mask toggle button in bottom left
        this.createMaskToggleButton();

        // Create book toggle button next to mask button
        this.createBookToggleButton();

        // Create gold display next to buttons
        this.createGoldDisplay();

        // Clean up listener on shutdown
        this.events.on("shutdown", () => {
            window.removeEventListener("heroMoved", handleHeroMoved);
            window.removeEventListener("spawnEnemies", handleEnemySpawn);
            window.removeEventListener("enemyKilled", handleEnemyKilled);
            window.removeEventListener("towerBuilt", handleTowerBuilt);
            window.removeEventListener("maskToggled", handleMaskToggled);
            window.removeEventListener("bookToggled", handleBookToggled);
        });

        EventBus.emit("current-scene-ready-3", this);
    }

    update(time: number, dt: number) {
        // Track game time for consumption scaling
        this.gameTime += dt;

        // Update all characters' movement
        this.characters.forEach((character) => {
            character.update();
        });

        // Update all enemies
        this.enemies.forEach((enemy) => {
            enemy.update();
        });

        // Update all towers
        this.towers.forEach((tower) => {
            tower.update(this.enemies);
            // Flush queued killed enemies (250ms batch)
            tower.flushKilledEnemies();
        });

        // Update all trap towers
        this.trapTowers.forEach((trapTower) => {
            trapTower.update(this.enemies, dt);
        });

        // Update all farms (production, enemy detection)
        this.farms.forEach((farm) => {
            farm.update(dt, this.enemies);
        });

        // Apply farm production deltas to player food
        this.farms.forEach((farm) => {
            const last = this.farmLastFood.get(farm.farmId) || 0;
            const delta = farm.totalFood - last;
            if (delta > 0) {
                const currentFood = this.playerFood.get(farm.playerNumber) || 0;
                const nextFood = Math.round((currentFood + delta) * 10) / 10;
                this.playerFood.set(farm.playerNumber, nextFood);
            }
            this.farmLastFood.set(farm.farmId, farm.totalFood);
        });

        // Food consumption system (per player)
        [1, 2].forEach((playerNum) => {
            const consumptionTimer = this.consumptionTimers.get(playerNum) || 0;
            const newTimer = consumptionTimer + dt;

            if (newTimer >= 5000) {
                // Calculate consumption based on game time (adds 2 each minute, max 16)
                const minutesPassed = Math.floor(this.gameTime / 60000);
                const scaledConsumption = Math.min(2 + 2 * minutesPassed, 16);

                const currentFood = this.playerFood.get(playerNum) || 0;
                const nextFood = Math.max(0, currentFood - scaledConsumption);
                const roundedNextFood = Math.round(nextFood * 10) / 10;
                this.playerFood.set(playerNum, roundedNextFood);
                this.consumptionTimers.set(playerNum, newTimer - 5000);

                // Show floating text for food consumption
                this.showFloatingText(
                    playerNum,
                    `-${scaledConsumption}`,
                    0xff0000,
                    "food",
                );

                console.log(
                    `🍽️ Player ${playerNum} consumed ${scaledConsumption} food (minute ${minutesPassed}). Remaining: ${roundedNextFood.toFixed(1)}`,
                );
            } else {
                this.consumptionTimers.set(playerNum, newTimer);
            }
        });

        // Gold production system (per player) - same timing and scaling as food consumption
        [1, 2].forEach((playerNum) => {
            const goldTimer = this.goldProductionTimers.get(playerNum) || 0;
            const newTimer = goldTimer + dt;

            if (newTimer >= 5000) {
                // Calculate gold production based on game time (same as consumption: 2 + 2*minute, max 16)
                const minutesPassed = Math.floor(this.gameTime / 60000);
                const goldProduction = Math.min(2 + 2 * minutesPassed, 16);

                const currentGold = this.playerGold.get(playerNum) || 0;
                const nextGold =
                    Math.round((currentGold + goldProduction) * 10) / 10;
                this.playerGold.set(playerNum, nextGold);
                this.goldProductionTimers.set(playerNum, newTimer - 5000);

                // Update gold display
                const goldText = this.goldTexts.get(playerNum);
                if (goldText) {
                    goldText.setText(`${Math.floor(nextGold)}`);
                }

                // Show floating text for gold production
                this.showFloatingText(
                    playerNum,
                    `+${goldProduction}`,
                    0xffd700,
                    "gold",
                );

                console.log(
                    `💰 Player ${playerNum} produced ${goldProduction} gold (minute ${minutesPassed}). Total: ${Math.floor(nextGold)}`,
                );
            } else {
                this.goldProductionTimers.set(playerNum, newTimer);
            }
        });

        // Update food bar display
        this.updateFoodBar();

        // Apply hunger effects for local player
        this.applyHungerEffects();

        // Remove dead enemies from map
        const deadEnemies: string[] = [];
        this.enemies.forEach((enemy, id) => {
            if (!enemy.active) {
                deadEnemies.push(id);
            }
        });
        deadEnemies.forEach((id) => this.enemies.delete(id));
    }

    spawnInitialEnemies() {
        console.log(
            `🎮 Player ${this.playerNumber} spawning initial enemies with 4 types`,
        );

        const enemies = [];
        const midX = this.scale.width / 2;
        const startY = this.scale.height - 50; // Bottom of screen

        // Create 20 enemies: 4 types, split simultaneously to both sides
        // Pairs: 0&10 (Red), 1&11 (Blue), 2&12 (Yellow), 3&13 (Green), 4&14 (Red), etc.

        for (let i = 0; i < 10; i++) {
            // Determine enemy type based on index (cycles through 4 types)
            const enemyType = i % 4;

            const startTime = i * 100; // Stagger pairs by 100ms
            const spreadX = Math.random() * 60 - 30; // Random horizontal spread

            // Left-going enemy (starts 2 tiles left from center)
            enemies.push({
                enemyId: `enemy-${Date.now()}-L${i}`,
                x: midX - 80 + spreadX, // 2 tiles left (80px)
                y: startY,
                goingLeft: true,
                enemyType,
                startTime,
            });

            // Right-going enemy (starts 2 tiles right from center)
            enemies.push({
                enemyId: `enemy-${Date.now()}-R${i}`,
                x: midX + 80 + spreadX, // 2 tiles right (80px)
                y: startY,
                goingLeft: false,
                enemyType,
                startTime,
            });
        }

        // Spawn locally
        this.spawnEnemies(enemies);

        // Broadcast to other player
        if (this.networkManager) {
            this.networkManager.sendAction("spawn_enemies", {
                enemies,
            });
        }
    }

    spawnEnemies(
        enemiesData: Array<{
            enemyId: string;
            x: number;
            y: number;
            goingLeft: boolean;
            enemyType?: number;
            startTime?: number;
        }>,
    ) {
        let spawnedCount = 0;
        enemiesData.forEach((data) => {
            // Check if enemy already exists
            if (this.enemies.has(data.enemyId)) {
                console.log(
                    `⚠️ Enemy ${data.enemyId} already exists, skipping`,
                );
                return;
            }

            const enemy = new Enemy({
                scene: this,
                x: data.x,
                y: data.y,
                enemyId: data.enemyId,
                goingLeft: data.goingLeft,
                enemyType: data.enemyType || 0,
                startTime: data.startTime || 0,
            });

            this.enemies.set(data.enemyId, enemy);
            spawnedCount++;
        });

        console.log(
            `✅ Spawned ${spawnedCount}/${enemiesData.length} enemies. Total enemies: ${this.enemies.size}`,
        );
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

        this.trapTowers.forEach((trapTower) => {
            trapTower.destroy();
        });
        this.trapTowers.clear();

        this.farms.forEach((farm) => {
            farm.destroy();
        });
        this.farms.clear();

        if (this.farmPopup) {
            this.farmPopup.destroy();
            this.farmPopup = null;
        }

        if (this.towerSelectionPopup) {
            this.towerSelectionPopup.destroy();
            this.towerSelectionPopup = null;
        }
    }

    createMaskToggleButton() {
        const buttonX = 60;
        const buttonY = this.scale.height - 60;
        const buttonSize = 80;

        // Create button background
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

        // Create mask icon (simple mask shape using graphics)
        const maskIcon = this.add.graphics();
        maskIcon.setDepth(101);

        // Draw a simple mask shape
        maskIcon.fillStyle(0xffffff, 1);
        maskIcon.fillEllipse(buttonX, buttonY - 10, 30, 20);
        maskIcon.fillEllipse(buttonX - 15, buttonY - 5, 10, 12);
        maskIcon.fillEllipse(buttonX + 15, buttonY - 5, 10, 12);
        maskIcon.fillRect(buttonX - 20, buttonY, 40, 15);

        // Cross indicator when no mask
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

        // Get local player character
        const localChar = this.characters.get(this.playerNumber);

        // Click handler
        buttonBg.on("pointerdown", () => {
            if (localChar) {
                const newMaskState = !localChar.getHasMask();
                localChar.setHasMask(newMaskState);
                crossIcon.setVisible(!newMaskState);

                // Broadcast mask state to network
                if (this.networkManager) {
                    this.networkManager.sendAction("toggle_mask", {
                        playerNumber: this.playerNumber,
                        hasMask: newMaskState,
                    });
                }

                console.log(`🎭 Mask toggled: ${newMaskState}`);
            }
        });

        // Hover effects
        buttonBg.on("pointerover", () => {
            buttonBg.setFillStyle(0x666666, 0.8);
        });

        buttonBg.on("pointerout", () => {
            buttonBg.setFillStyle(0x444444, 0.8);
        });
    }

    createBookToggleButton() {
        const buttonX = 160; // Next to mask button (60 + 80 + 20 spacing)
        const buttonY = this.scale.height - 60;
        const buttonSize = 80;

        // Create button background
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

        // Create book icon
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

        // Cross indicator when no book
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

        // Get local player character
        const localChar = this.characters.get(this.playerNumber);

        // Click handler
        buttonBg.on("pointerdown", () => {
            if (localChar) {
                const newBookState = !localChar.getHasBook();
                localChar.setHasBook(newBookState);
                crossIcon.setVisible(!newBookState);

                // Broadcast book state to network
                if (this.networkManager) {
                    this.networkManager.sendAction("toggle_book", {
                        playerNumber: this.playerNumber,
                        hasBook: newBookState,
                    });
                }

                console.log(`📕 Book toggled: ${newBookState}`);
            }
        });

        // Hover effects
        buttonBg.on("pointerover", () => {
            buttonBg.setFillStyle(0x666666, 0.8);
        });

        buttonBg.on("pointerout", () => {
            buttonBg.setFillStyle(0x444444, 0.8);
        });
    }

    createGoldDisplay() {
        // Display gold amount next to book button (right side)
        const goldX = 240; // Next to book button (160 + 80)
        const goldY = this.scale.height - 60;

        // Create gold coin icon
        const coinIcon = this.add.graphics();
        coinIcon.setDepth(100);

        // Draw gold coin
        coinIcon.fillStyle(0xffd700, 1); // Gold color
        coinIcon.fillCircle(goldX - 30, goldY, 20);
        coinIcon.fillStyle(0xffed4e, 1); // Lighter gold highlight
        coinIcon.fillCircle(goldX - 35, goldY - 5, 8);

        // Create gold text
        const goldAmount = this.playerGold.get(this.playerNumber) || 0;
        const goldText = this.add.text(goldX, goldY - 10, `${goldAmount}`, {
            fontSize: "32px",
            fontFamily: "Arial",
            color: "#ffd700",
            fontStyle: "bold",
            stroke: "#000000",
            strokeThickness: 4,
        });
        goldText.setOrigin(0, 0.5);
        goldText.setDepth(101);

        this.goldTexts.set(this.playerNumber, goldText);
    }

    private createFoodBar() {
        // Create food bars for both players - Mortal Kombat style
        [1, 2].forEach((playerNum) => {
            // Player 1 on left, Player 2 on right (centered in their 640px side)
            const x = playerNum === 1 ? 320 : this.scale.width - 320;
            const y = 30;

            // Outer black border (shadow/depth effect)
            this.add
                .rectangle(
                    x,
                    y + 2,
                    this.foodBarWidth + 8,
                    this.foodBarHeight + 8,
                    0x000000,
                    0.8,
                )
                .setDepth(998);

            // Background bar (dark gray/black)
            const foodBarBg = this.add
                .rectangle(
                    x,
                    y,
                    this.foodBarWidth,
                    this.foodBarHeight,
                    0x1a1a1a,
                    1,
                )
                .setStrokeStyle(4, 0x000000, 1)
                .setDepth(1000);
            this.foodBarBgs.set(playerNum, foodBarBg);

            // Inner border (bright accent)
            this.add
                .rectangle(
                    x,
                    y,
                    this.foodBarWidth - 4,
                    this.foodBarHeight - 4,
                    0x000000,
                    0,
                )
                .setStrokeStyle(2, 0xffdd00, 1)
                .setDepth(999);

            // Food fill bar - create with small initial width
            const foodBar = this.add
                .rectangle(
                    x - this.foodBarWidth / 2 + 1,
                    y,
                    2,
                    this.foodBarHeight - 8,
                    0xffdd00,
                    1,
                )
                .setOrigin(0.5, 0.5)
                .setDepth(1001);
            this.foodBars.set(playerNum, foodBar);

            // Food text label
            const foodText = this.add.text(x, y, `P${playerNum}: 10.0`, {
                fontSize: "18px",
                color: "#ffffff",
                fontStyle: "bold",
                fontFamily: "Arial",
                stroke: "#000000",
                strokeThickness: 3,
            });
            foodText.setOrigin(0.5, 0.5);
            foodText.setDepth(1002);
            this.foodTexts.set(playerNum, foodText);
        });
    }

    private updateFoodBar() {
        // Update food bars for both players
        [1, 2].forEach((playerNum) => {
            const totalFood = this.playerFood.get(playerNum) || 0;
            this.playerTotalFood.set(playerNum, totalFood);

            const foodBar = this.foodBars.get(playerNum);
            const foodText = this.foodTexts.get(playerNum);

            if (!foodBar || !foodText) return;

            // Calculate bar fill width (proportional to foodBarWidth)
            const fillPercentage = Math.min(
                totalFood / this.foodBarMaxValue,
                1,
            );
            const barFillWidth = this.foodBarWidth * fillPercentage;

            // Player 1 on left, Player 2 on right
            const baseX = playerNum === 1 ? 320 : this.scale.width - 320;
            const barX = baseX - this.foodBarWidth / 2 + barFillWidth / 2;

            // Update bar position and width by destroying and recreating
            foodBar.destroy();

            // MK-style bar fill with gradient effect
            const newFoodBar = this.add
                .rectangle(
                    barX,
                    30,
                    barFillWidth,
                    this.foodBarHeight - 8,
                    0xffdd00,
                    1,
                )
                .setOrigin(0.5, 0.5)
                .setDepth(1001);
            this.foodBars.set(playerNum, newFoodBar);

            // Update text
            foodText.setText(`P${playerNum}: ${totalFood.toFixed(1)}`);

            // Mortal Kombat color scheme - yellow to orange to red
            if (fillPercentage < 0.15) {
                newFoodBar.setFillStyle(0xff0000, 1); // Bright red when critical
            } else if (fillPercentage < 0.35) {
                newFoodBar.setFillStyle(0xff3300, 1); // Red-orange when low
            } else if (fillPercentage < 0.6) {
                newFoodBar.setFillStyle(0xff9900, 1); // Orange when medium
            } else {
                newFoodBar.setFillStyle(0xffdd00, 1); // Yellow/gold when healthy
            }
        });
    }

    private applyHungerEffects() {
        const totalFood = this.playerTotalFood.get(this.playerNumber) || 0;
        const char = this.characters.get(this.playerNumber);

        if (!char) return;

        if (totalFood <= 0) {
            char.setSpeedMultiplier(0.5);
        } else {
            char.setSpeedMultiplier(1);
        }
    }

    private showFloatingText(
        playerNum: number,
        text: string,
        color: number,
        type: "food" | "gold",
    ) {
        // Position text in middle row of player's zone
        // Middle row is around y = 360 (half of 720)
        const midY = this.scale.height / 2;
        const midX = this.scale.width / 2;

        // Player 1 on left side, Player 2 on right side
        const x = playerNum === 1 ? midX / 2 : midX + midX / 2;
        const y = midY;

        // Create floating text
        const floatingText = this.add.text(x, y, text, {
            fontSize: "48px",
            fontFamily: "Arial",
            color: `#${color.toString(16).padStart(6, "0")}`,
            fontStyle: "bold",
            stroke: "#000000",
            strokeThickness: 4,
        });
        floatingText.setOrigin(0.5, 0.5);
        floatingText.setDepth(1500);

        // Animate upward fade out
        this.tweens.add({
            targets: floatingText,
            y: y - 50,
            alpha: 0,
            duration: 1000,
            ease: "Power2",
            onComplete: () => {
                floatingText.destroy();
            },
        });
    }

    private isInCommonTargetArea(x: number, y: number): boolean {
        const midX = this.scale.width / 2;
        const commonTargetMinY = this.scale.height - 240; // last 6 rows
        const commonTargetMinX = midX - 240;
        const commonTargetMaxX = midX + 240;

        return (
            y >= commonTargetMinY &&
            x >= commonTargetMinX &&
            x <= commonTargetMaxX
        );
    }

    private isInPlayerHalf(
        x: number,
        y: number,
        playerNumber: number,
    ): boolean {
        const midX = this.scale.width / 2;

        // Player 1 is on left half, Player 2 is on right half
        if (playerNumber === 1) {
            return x < midX;
        } else {
            return x >= midX;
        }
    }

    private showTowerSelectionMenu(pointer: Phaser.Input.Pointer) {
        const gridSize = 40;
        const x = Math.round(pointer.worldX / gridSize) * gridSize;
        const y = Math.round(pointer.worldY / gridSize) * gridSize;

        // Must be outside commonTarget area and in own half
        if (this.isInCommonTargetArea(x, y)) {
            return;
        }

        if (!this.isInPlayerHalf(x, y, this.playerNumber)) {
            return;
        }

        // Check if location is valid for building
        if (!this.isValidBuildLocation(x, y)) {
            return;
        }

        // Show tower selection popup
        if (this.towerSelectionPopup) {
            this.towerSelectionPopup.show(x, y, (type, trapType) => {
                if (type === "regular") {
                    this.buildRegularTower(x, y);
                } else if (type === "trap" && trapType !== undefined) {
                    this.buildTrapTower(x, y, trapType);
                }
            });
        }
    }

    private isValidBuildLocation(x: number, y: number): boolean {
        // Prevent building on top of farms
        let overlapsFarm = false;
        this.farms.forEach((farm) => {
            const distance = Phaser.Math.Distance.Between(farm.x, farm.y, x, y);
            if (distance < 80) {
                overlapsFarm = true;
            }
        });
        if (overlapsFarm) return false;

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
        if (overlapsTower) return false;

        // Prevent building on top of trap towers
        let overlapsTrapTower = false;
        this.trapTowers.forEach((trapTower) => {
            const distance = Phaser.Math.Distance.Between(
                trapTower.x,
                trapTower.y,
                x,
                y,
            );
            if (distance < 40) {
                overlapsTrapTower = true;
            }
        });
        if (overlapsTrapTower) return false;

        return true;
    }

    private buildRegularTower(x: number, y: number) {
        const totalFood = this.playerTotalFood.get(this.playerNumber) || 0;
        if (totalFood <= 0) {
            console.log("❌ Not enough food to build tower");
            return;
        }

        const towerId = `tower-${this.playerNumber}-${Date.now()}`;
        const tower = new Tower({
            scene: this,
            x,
            y,
            towerId,
            playerNumber: this.playerNumber,
            networkManager: this.networkManager,
        });
        this.towers.set(towerId, tower);

        if (this.networkManager) {
            this.networkManager.sendAction("build_tower", {
                towerId,
                x,
                y,
                playerNumber: this.playerNumber,
            });
        }
    }

    private buildTrapTower(x: number, y: number, trapType: number) {
        const currentGold = this.playerGold.get(this.playerNumber) || 0;
        const trapCost = 3;

        if (currentGold < trapCost) {
            console.log(
                `❌ Not enough gold to build trap (need ${trapCost}, have ${currentGold})`,
            );
            return;
        }

        // Deduct gold
        const newGold = currentGold - trapCost;
        this.playerGold.set(this.playerNumber, newGold);

        // Update gold display
        const goldText = this.goldTexts.get(this.playerNumber);
        if (goldText) {
            goldText.setText(`${Math.floor(newGold)}`);
        }

        const trapId = `trap-${this.playerNumber}-${trapType}-${Date.now()}`;
        const trapTower = new TrapTower({
            scene: this,
            x,
            y,
            trapId,
            trapType,
            playerNumber: this.playerNumber,
            networkManager: this.networkManager,
        });
        this.trapTowers.set(trapId, trapTower);

        if (this.networkManager) {
            this.networkManager.sendAction("build_trap", {
                trapId,
                x,
                y,
                trapType,
                playerNumber: this.playerNumber,
            });
        }

        console.log(
            `✅ Built trap tower type ${trapType} for ${trapCost} gold`,
        );
    }
}

