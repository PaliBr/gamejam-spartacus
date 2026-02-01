import { EventBus } from "../EventBus";
import Phaser from "phaser";
import { Character } from "../objects/Character";
import { Enemy } from "../objects/Enemy";
import { Tower } from "../objects/Tower";
import { TrapTower } from "../objects/TrapTower";
import { Farm } from "../objects/Farm";
import { FarmPopup } from "../objects/FarmPopup";
import { TowerPopup } from "../objects/TowerPopup";
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
    towerPopup: TowerPopup | null = null;
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
    private cityTargetHitCount: Map<number, number> = new Map([
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
        const targetLeftXGrid = [6, 10, 6, 10]; // Grid positions from left
        const targetLeftYGrid = [1, 1, 7, 7]; // Grid positions from top
        // Right side: mirrored
        const targetRightXGrid = [23, 19, 23, 19]; // Grid positions from left (32 columns, mirrored)
        const targetRightYGrid = [1, 1, 7, 7]; // Grid positions from top

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

        // Highlight actual farm detection areas (for debugging)
        this.farms.forEach((farm) => {
            this.add
                .rectangle(farm.x, farm.y, 120, 120, 0x00ffff, 0)
                .setOrigin(0, 0)
                .setStrokeStyle(2, 0x00ffff, 0.8)
                .setDepth(1);
        });

        // Create cityTarget areas (4x4 grid squares = 160x160px)
        // Left side: row 7, column 3 from left edge (column 3)
        // Right side: row 7, column 3 from right edge (mirrored)
        const cityTargetSize = 4 * gridSize; // 160px (4x4 grid)
        const cityTargetRow = 3; // Row 7
        const cityTargetColFromEdge = 0; // 3 columns from edge

        // Left city target (player 1)
        const leftCityX = cityTargetColFromEdge * gridSize;
        const leftCityY = cityTargetRow * gridSize;
        this.add
            .rectangle(
                leftCityX,
                leftCityY,
                cityTargetSize,
                cityTargetSize,
                0x888888,
                0.4,
            )
            .setOrigin(0, 0)
            .setStrokeStyle(3, 0xaaaaaa, 1)
            .setDepth(0);

        // Right city target (player 2) - mirrored position
        // 160px from right edge: (1280 - 160) / 40 = 28
        const rightCityX = 28 * gridSize;
        const rightCityY = cityTargetRow * gridSize;
        this.add
            .rectangle(
                rightCityX,
                rightCityY,
                cityTargetSize,
                cityTargetSize,
                0x888888,
                0.4,
            )
            .setOrigin(0, 0)
            .setStrokeStyle(3, 0xaaaaaa, 1)
            .setDepth(0);

        // Create common target area at bottom center (8x5 grid cells = 320x200px)
        // Shifted 1 tile left: 4 tiles left and 4 tiles right from middle (tiles 11-18)
        // Bottom: last 5 rows (rows 13-17 in 0-indexed, y from 520 to 720)
        const commonTargetWidth = 8 * gridSize; // 320px
        const commonTargetHeight = 5 * gridSize; // 200px
        const commonTargetX = midX - gridSize; // Shift left by 1 tile
        const commonTargetY = this.scale.height - commonTargetHeight / 2; // Bottom, centered vertically in the 5 rows

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

        const leftMenuWidth = 12 * gridSize;
        const rightMenuWidth = 12 * gridSize;
        const sideMenuHeight = 5 * gridSize;

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

        // Define restricted zones
        const restrictedZones = [
            {
                rows: [5],
                columns: Array.from({ length: 11 }, (_, i) => i + 4).concat(
                    Array.from({ length: 11 }, (_, i) => i + 17),
                ), // Columns 4-13 and 16-21
            },
            {
                rows: Array.from({ length: 7 }, (_, i) => i + 6),
                columns: [14, 17],
            },
        ];

        // Highlight restricted zones
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

        // Add input listener for farm interaction
        this.farmPopup = new FarmPopup(this);
        this.towerPopup = new TowerPopup(this);
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

            // Close tower popup if clicking outside
            if (this.towerPopup && this.towerPopup.isActive()) {
                this.towerPopup.hide();
                return;
            }

            // Check if clicking on a farm
            let handled = false;
            this.farms.forEach((farm) => {
                // Check if click is within farm rectangular bounds (3x3 = 120x120)
                const isInFarm =
                    pointer.worldX >= farm.x &&
                    pointer.worldX <= farm.x + 120 &&
                    pointer.worldY >= farm.y &&
                    pointer.worldY <= farm.y + 120;

                // Check if character is standing on the farm
                const char = this.characters.get(this.playerNumber);
                if (char) {
                    const charOnFarm =
                        char.x >= farm.x &&
                        char.x <= farm.x + 120 &&
                        char.y >= farm.y &&
                        char.y <= farm.y + 120;

                    if (charOnFarm && isInFarm) {
                        // Character on farm and clicking on farm area
                        this.farmPopup!.show(farm);
                        handled = true;
                    }
                }
            });

            // Check if clicking on a tower or trap tower
            if (!handled) {
                this.towers.forEach((tower) => {
                    // Tower is 1x2 (40x80), origin at 0,0
                    const isInTower =
                        pointer.worldX >= tower.x &&
                        pointer.worldX <= tower.x + 40 &&
                        pointer.worldY >= tower.y &&
                        pointer.worldY <= tower.y + 80;

                    if (isInTower) {
                        this.towerPopup!.show(tower);
                        handled = true;
                    }
                });
            }

            if (!handled) {
                this.trapTowers.forEach((trapTower) => {
                    // Trap tower is 1x1 (40x40), origin at 0.5,0.5 (centered)
                    const isInTrap =
                        pointer.worldX >= trapTower.x - 20 &&
                        pointer.worldX <= trapTower.x + 20 &&
                        pointer.worldY >= trapTower.y - 20 &&
                        pointer.worldY <= trapTower.y + 20;

                    if (isInTrap) {
                        this.towerPopup!.show(trapTower);
                        handled = true;
                    }
                });
            }

            if (!handled) {
                this.showTowerSelectionMenu(pointer);
            }
        });

        // Add mousemove listener to change cursor when in allowed building area
        this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
            const gridSize = 40;
            const x = Math.floor(pointer.worldX / gridSize) * gridSize;
            const y = Math.floor(pointer.worldY / gridSize) * gridSize;

            const char = this.characters.get(this.playerNumber);
            if (char) {
                const distance = Phaser.Math.Distance.Between(
                    char.x,
                    char.y,
                    x,
                    y,
                );
                const maxBuildDistance = 100; // 2 grid squares away

                if (distance <= maxBuildDistance) {
                    this.input.setDefaultCursor("crosshair");
                } else {
                    this.input.setDefaultCursor("default");
                }
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
            const { towerId, x, y, playerNumber, gold } = customEvent.detail;
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

            // Update gold for remote player
            if (playerNumber !== this.playerNumber && gold !== undefined) {
                this.playerGold.set(playerNumber, gold);
                const goldText = this.goldTexts.get(playerNumber);
                if (goldText) {
                    goldText.setText(`${Math.floor(gold)}`);
                }
            }
        };

        window.addEventListener("towerBuilt", handleTowerBuilt);

        // Listen for trap tower building events
        const handleTrapBuilt = (event: Event) => {
            const customEvent = event as CustomEvent;
            const { trapId, x, y, trapType, playerNumber, gold } =
                customEvent.detail;
            console.log(
                `🪤 Remote trap built at (${x}, ${y}) type ${trapType}`,
            );
            if (this.trapTowers.has(trapId)) {
                return;
            }
            const trapTower = new TrapTower({
                scene: this,
                x,
                y,
                trapId,
                trapType,
                playerNumber,
                networkManager: this.networkManager,
            });
            this.trapTowers.set(trapId, trapTower);

            // Update gold for remote player
            if (playerNumber !== this.playerNumber && gold !== undefined) {
                this.playerGold.set(playerNumber, gold);
                const goldText = this.goldTexts.get(playerNumber);
                if (goldText) {
                    goldText.setText(`${Math.floor(gold)}`);
                }
            }
        };

        window.addEventListener("trapBuilt", handleTrapBuilt);

        // Listen for food/gold sync events
        const handleFoodGoldSync = (event: Event) => {
            const customEvent = event as CustomEvent;
            const { playerNumber, food, gold } = customEvent.detail;

            if (playerNumber !== this.playerNumber) {
                this.playerFood.set(playerNumber, food);
                this.playerTotalFood.set(playerNumber, food);
                this.playerGold.set(playerNumber, gold);

                // Update gold display if exists
                const goldText = this.goldTexts.get(playerNumber);
                if (goldText) {
                    goldText.setText(`${Math.floor(gold)}`);
                }
            }
        };

        window.addEventListener("foodGoldSync", handleFoodGoldSync);

        // Listen for farm upgrade events
        const handleFarmUpgrade = (event: Event) => {
            const customEvent = event as CustomEvent;
            const { farmId, level, playerNumber, gold } = customEvent.detail;

            if (playerNumber !== this.playerNumber) {
                const farm = this.farms.get(farmId);
                if (farm) {
                    farm.level = level;
                    farm.productionTimer = 0;
                }
                this.playerGold.set(playerNumber, gold);
                const goldText = this.goldTexts.get(playerNumber);
                if (goldText) {
                    goldText.setText(`${Math.floor(gold)}`);
                }
            }
        };

        window.addEventListener("farmUpgrade", handleFarmUpgrade);

        // Listen for tower upgrade events
        const handleTowerUpgrade = (event: Event) => {
            const customEvent = event as CustomEvent;
            const { towerId, level, playerNumber, gold } = customEvent.detail;

            if (playerNumber !== this.playerNumber) {
                const tower = this.towers.get(towerId);
                if (tower) {
                    tower.level = level;
                    (tower as any).fireRate = 500 / level;
                }
                this.playerGold.set(playerNumber, gold);
                const goldText = this.goldTexts.get(playerNumber);
                if (goldText) {
                    goldText.setText(`${Math.floor(gold)}`);
                }
            }
        };

        window.addEventListener("towerUpgrade", handleTowerUpgrade);

        // Listen for trap tower upgrade events
        const handleTrapUpgrade = (event: Event) => {
            const customEvent = event as CustomEvent;
            const { trapId, level, playerNumber, gold } = customEvent.detail;

            if (playerNumber !== this.playerNumber) {
                const trapTower = this.trapTowers.get(trapId);
                if (trapTower) {
                    trapTower.level = level;
                    (trapTower as any).maxCapacity = 3 + (level - 1);
                }
                this.playerGold.set(playerNumber, gold);
                const goldText = this.goldTexts.get(playerNumber);
                if (goldText) {
                    goldText.setText(`${Math.floor(gold)}`);
                }
            }
        };

        window.addEventListener("trapUpgrade", handleTrapUpgrade);

        // Listen for full game state sync from player 1
        const handleGameStateSync = (event: Event) => {
            const customEvent = event as CustomEvent;
            const state = customEvent.detail;

            // Only process if we're player 2 receiving state from player 1
            if (this.playerNumber !== 2 || state.playerNumber !== 1) return;

            // Update player 1's resources
            this.playerGold.set(1, state.gold);
            this.playerFood.set(1, state.food);
            this.playerTotalFood.set(1, state.totalFood);
            this.cityTargetHitCount.set(1, state.cityHitCount);

            // Update gold display
            const goldText = this.goldTexts.get(1);
            if (goldText) {
                goldText.setText(`${Math.floor(state.gold)}`);
            }

            console.log(
                `📊 Game state synced from player 1: ${state.towersCount} towers, ${state.trapTowersCount} traps, ${state.farmsCount} farms, ${state.enemiesCount} enemies`,
            );
        };

        window.addEventListener("gameStateSync", handleGameStateSync);

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
            window.removeEventListener("trapBuilt", handleTrapBuilt);
            window.removeEventListener("foodGoldSync", handleFoodGoldSync);
            window.removeEventListener("farmUpgrade", handleFarmUpgrade);
            window.removeEventListener("towerUpgrade", handleTowerUpgrade);
            window.removeEventListener("trapUpgrade", handleTrapUpgrade);
            window.removeEventListener("gameStateSync", handleGameStateSync);
            window.removeEventListener("maskToggled", handleMaskToggled);
            window.removeEventListener("bookToggled", handleBookToggled);
        });

        EventBus.emit("current-scene-ready-3", this);
    }

    update(time: number, dt: number) {
        // Track game time for consumption scaling
        this.gameTime += dt;

        // Broadcast game state every 1 second (player 1 to player 2)
        if (this.playerNumber === 1 && time % 1000 < dt) {
            this.broadcastGameState();
        }

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
                const baseConsumption = Math.min(2 + 2 * minutesPassed, 16);
                const hitCount = this.cityTargetHitCount.get(playerNum) || 0;
                const consumptionMultiplier = 1 + hitCount * 0.02;
                const scaledConsumption =
                    Math.round(baseConsumption * consumptionMultiplier * 10) /
                    10;

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

                // Sync food and gold to other players
                if (this.networkManager && playerNum === this.playerNumber) {
                    this.networkManager.sendAction("food_gold_sync", {
                        playerNumber: playerNum,
                        food: this.playerFood.get(playerNum) || 0,
                        gold: nextGold,
                    });
                }
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

    handleCityTargetReached(targetPlayerNumber: number) {
        if (targetPlayerNumber !== this.playerNumber) return;

        const current = this.cityTargetHitCount.get(targetPlayerNumber) || 0;
        const next = current + 1;
        this.cityTargetHitCount.set(targetPlayerNumber, next);
        console.log(
            `🏰 City target reached for player ${targetPlayerNumber}. Consumption +${
                next * 2
            }%`,
        );
    }

    // Broadcast comprehensive game state to player 2
    broadcastGameState() {
        if (!this.networkManager || this.playerNumber !== 1) return;

        // Collect all towers data
        const towersData: any[] = [];
        this.towers.forEach((tower, id) => {
            towersData.push({
                id,
                x: tower.x,
                y: tower.y,
                level: tower.level,
                playerNumber: tower.playerNumber,
            });
        });

        // Collect all trap towers data
        const trapTowersData: any[] = [];
        this.trapTowers.forEach((trap, id) => {
            trapTowersData.push({
                id,
                x: trap.x,
                y: trap.y,
                level: trap.level,
                trapType: (trap as any).trapType || 1,
                playerNumber: trap.playerNumber,
            });
        });

        // Collect all farms data
        const farmsData: any[] = [];
        this.farms.forEach((farm, id) => {
            farmsData.push({
                id,
                x: farm.x,
                y: farm.y,
                level: farm.level,
                totalFood: farm.totalFood,
                playerNumber: farm.playerNumber,
            });
        });

        // Collect all enemies data
        const enemiesData: any[] = [];
        this.enemies.forEach((enemy, id) => {
            enemiesData.push({
                id,
                x: enemy.x,
                y: enemy.y,
                health: (enemy as any).health || 100,
                targetPlayerNumber: enemy.targetPlayerNumber,
            });
        });

        const gameState = {
            playerNumber: this.playerNumber,
            gold: this.playerGold.get(this.playerNumber) || 0,
            food: this.playerFood.get(this.playerNumber) || 0,
            totalFood: this.playerTotalFood.get(this.playerNumber) || 0,
            cityHitCount: this.cityTargetHitCount.get(this.playerNumber) || 0,
            gameTime: this.gameTime,
            towers: towersData,
            trapTowers: trapTowersData,
            farms: farmsData,
            enemies: enemiesData,
            towersCount: this.towers.size,
            trapTowersCount: this.trapTowers.size,
            farmsCount: this.farms.size,
            enemiesCount: this.enemies.size,
        };

        this.networkManager.sendAction("game_state_sync", gameState);
    }

    handleCityTargetCleared(targetPlayerNumber: number) {
        if (targetPlayerNumber !== this.playerNumber) return;

        const current = this.cityTargetHitCount.get(targetPlayerNumber) || 0;
        const next = Math.max(0, current - 1);
        this.cityTargetHitCount.set(targetPlayerNumber, next);
        console.log(
            `🏰 City target cleared for player ${targetPlayerNumber}. Consumption +${
                next * 2
            }%`,
        );
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

        if (this.towerPopup) {
            this.towerPopup.destroy();
            this.towerPopup = null;
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
        buttonBg.on(
            "pointerdown",
            (
                _pointer: Phaser.Input.Pointer,
                _localX: number,
                _localY: number,
                event: Phaser.Types.Input.EventData,
            ) => {
                event.stopPropagation();
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
            },
        );

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
        buttonBg.on(
            "pointerdown",
            (
                _pointer: Phaser.Input.Pointer,
                _localX: number,
                _localY: number,
                event: Phaser.Types.Input.EventData,
            ) => {
                event.stopPropagation();
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
            },
        );

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
        // Position text at grid square 4 for left (column 4), grid square 28 for right (column 28)
        // Gold: 1 row above middle, Food: 1 row below middle
        const midY = this.scale.height / 2;
        const gridSize = 40;

        // Player 1 on left side (grid 4), Player 2 on right side (grid 28)
        const x =
            playerNum === 1
                ? 4 * gridSize + gridSize / 2
                : 28 * gridSize + gridSize / 2;
        const yOffset = type === "gold" ? -gridSize : gridSize; // Gold 1 row up, food 1 row down
        const y = midY + yOffset;

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
            duration: 2000,
            ease: "Power2",
            onComplete: () => {
                floatingText.destroy();
            },
        });
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
        const gridX = Math.floor(pointer.worldX / gridSize);
        const gridY = Math.floor(pointer.worldY / gridSize);
        const x = gridX * gridSize;
        const y = gridY * gridSize;

        // Check if player character is within allowed building distance and not moving
        const char = this.characters.get(this.playerNumber);
        if (char) {
            // Prevent building while moving
            if (char.getIsMoving()) {
                return;
            }

            const distance = Phaser.Math.Distance.Between(char.x, char.y, x, y);
            const maxBuildDistance = 100; // 2 grid squares away
            if (distance > maxBuildDistance) {
                console.log(
                    `❌ Too far to build. Distance: ${Math.round(distance)}, Max: ${maxBuildDistance}`,
                );
                return;
            }
        }

        // Must be outside commonTarget area and in own half
        if (this.isInCommonTargetArea(x, y)) {
            return;
        }

        if (!this.isInPlayerHalf(x, y, this.playerNumber)) {
            return;
        }

        // Check if location is valid for building
        if (!this.isValidBuildLocation(gridX, gridY)) {
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

    private isValidBuildLocation(gridX: number, gridY: number): boolean {
        const gridSize = 40;
        const sceneWidth = this.scale.width;
        const sceneHeight = this.scale.height;
        const midX = sceneWidth / 2;

        // Check if in restricted area (match highlighted zones)
        const restrictedZones = [
            {
                rows: [5],
                columns: Array.from({ length: 11 }, (_, i) => i + 4).concat(
                    Array.from({ length: 11 }, (_, i) => i + 17),
                ), // Columns 4-14 and 17-27
            },
            {
                rows: Array.from({ length: 4 }, (_, i) => i + 6),
                columns: [14, 17],
            },
        ];

        const towerRows = [gridY, gridY + 1];
        const towerCols = [gridX];
        const inRestrictedZone = restrictedZones.some(
            (zone) =>
                towerRows.some((row) => zone.rows.includes(row)) &&
                towerCols.some((col) => zone.columns.includes(col)),
        );
        if (inRestrictedZone) {
            console.log(
                `❌ Cannot build in restricted area at column ${gridX}, row ${gridY}`,
            );
            return false;
        }

        // Convert grid coords to world coords for overlap checks (tower is 1x2 grid cells = 40x80)
        const x = gridX * gridSize + gridSize / 2; // Center of 1x2 tower
        const y = gridY * gridSize + gridSize;

        const towerBounds = {
            left: gridX * gridSize,
            right: gridX * gridSize + 40,
            top: gridY * gridSize,
            bottom: gridY * gridSize + 80,
        };

        const overlapsRect = (rect: {
            left: number;
            right: number;
            top: number;
            bottom: number;
        }) =>
            !(
                towerBounds.right <= rect.left ||
                towerBounds.left >= rect.right ||
                towerBounds.bottom <= rect.top ||
                towerBounds.top >= rect.bottom
            );

        // Prevent building on city targets
        const cityTargetSize = 4 * gridSize;
        const cityTargetRow = 3;
        const cityTargetColFromEdge = 0;
        const leftCityBounds = {
            left: cityTargetColFromEdge * gridSize,
            right: cityTargetColFromEdge * gridSize + cityTargetSize,
            top: cityTargetRow * gridSize,
            bottom: cityTargetRow * gridSize + cityTargetSize,
        };
        const rightCityBounds = {
            left: 28 * gridSize,
            right: 28 * gridSize + cityTargetSize,
            top: cityTargetRow * gridSize,
            bottom: cityTargetRow * gridSize + cityTargetSize,
        };

        if (overlapsRect(leftCityBounds) || overlapsRect(rightCityBounds)) {
            console.log(`❌ Cannot build on city target area`);
            return false;
        }

        // Prevent building on common target area
        const commonTargetWidth = 8 * gridSize;
        const commonTargetHeight = 5 * gridSize;
        const commonTargetBounds = {
            left: midX - commonTargetWidth / 2 - gridSize,
            right: midX + commonTargetWidth / 2 - gridSize,
            top: sceneHeight - commonTargetHeight,
            bottom: sceneHeight,
        };

        if (overlapsRect(commonTargetBounds)) {
            console.log(`❌ Cannot build on common target area`);
            return false;
        }

        // Prevent building on top of farms (3x3 grid = 120x120)
        let overlapsFarm = false;
        this.farms.forEach((farm) => {
            // Check if tower overlaps with farm rectangular bounds
            const farmBounds = {
                left: farm.x,
                right: farm.x + 120,
                top: farm.y,
                bottom: farm.y + 120,
            };
            if (overlapsRect(farmBounds)) {
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
            if (distance < 20) {
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
            if (distance < 20) {
                overlapsTrapTower = true;
            }
        });
        if (overlapsTrapTower) return false;

        return true;
    }

    private buildRegularTower(x: number, y: number) {
        const currentGold = this.playerGold.get(this.playerNumber) || 0;
        const towerCost = 10;

        if (currentGold < towerCost) {
            console.log(
                `❌ Not enough gold to build tower (need ${towerCost}, have ${currentGold})`,
            );
            return;
        }

        // Deduct gold
        const newGold = currentGold - towerCost;
        this.playerGold.set(this.playerNumber, newGold);

        // Update gold display
        const goldText = this.goldTexts.get(this.playerNumber);
        if (goldText) {
            goldText.setText(`${Math.floor(newGold)}`);
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
                gold: newGold,
            });
        }

        // Close tower selection menu after building
        if (this.towerSelectionPopup) {
            this.towerSelectionPopup.hide();
        }

        console.log(
            `✅ Built regular tower for ${towerCost} gold. Gold remaining: ${newGold}`,
        );
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

        // Center trap tower inside grid square (add half grid size)
        const trapX = x + 20;
        const trapY = y + 20;

        const trapId = `trap-${this.playerNumber}-${trapType}-${Date.now()}`;
        const trapTower = new TrapTower({
            scene: this,
            x: trapX,
            y: trapY,
            trapId,
            trapType,
            playerNumber: this.playerNumber,
            networkManager: this.networkManager,
        });
        this.trapTowers.set(trapId, trapTower);

        if (this.networkManager) {
            this.networkManager.sendAction("build_trap", {
                trapId,
                x: trapX,
                y: trapY,
                trapType,
                playerNumber: this.playerNumber,
                gold: newGold,
            });
        }

        // Close tower selection menu after building
        if (this.towerSelectionPopup) {
            this.towerSelectionPopup.hide();
        }

        console.log(
            `✅ Built trap tower type ${trapType} for ${trapCost} gold`,
        );
    }
}

