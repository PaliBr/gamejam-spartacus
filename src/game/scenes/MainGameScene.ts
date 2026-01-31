import { EventBus } from "../EventBus";
import Phaser from "phaser";
import { Character } from "../objects/Character";
import { Enemy } from "../objects/Enemy";
import { Tower } from "../objects/Tower";
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
    networkManager: NetworkManager | null = null;
    playerId: string = "";
    roomPlayerId: string = "";
    playerNumber: number = 0;
    roomId: string = "";
    // Target positions for visual reference (enemies aim for these)
    targetPositions: Array<{ x: number; y: number }> = [];

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

        // Initialize target positions on left side
        targetColors.forEach((color, index) => {
            const x = targetLeftXGrid[index] * 40;
            const y = targetLeftYGrid[index] * 40;
            this.targetPositions.push({ x, y });

            this.add
                .rectangle(x, y, targetSize, targetSize, color, 0.3)
                .setStrokeStyle(3, color, 1)
                .setDepth(0);
        });

        // Initialize target positions on right side
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

        // Add input listener for tower placement anywhere
        this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
            this.tryBuildTower(pointer.x, pointer.y);
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

    update() {
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
    }

    private tryBuildTower(clickX: number, clickY: number) {
        // Snap to grid (40px grid cells, tower is 2x2 = 80px)
        const gridSize = 40;
        const snappedX = Math.round(clickX / gridSize) * gridSize;
        const snappedY = Math.round(clickY / gridSize) * gridSize;

        // Check if clicking on a target square (160px = targetSize, 4x4 grid cells)
        const targetSize = 160;
        for (const targetPos of this.targetPositions) {
            if (
                Math.abs(snappedX - targetPos.x) < targetSize / 2 &&
                Math.abs(snappedY - targetPos.y) < targetSize / 2
            ) {
                console.log(`❌ Cannot build on target squares`);
                return;
            }
        }

        // Check if any character is within 2 tiles (80 pixels at 40px per tile)
        let canBuild = false;
        this.characters.forEach((character) => {
            const distance = Phaser.Math.Distance.Between(
                character.x,
                character.y,
                snappedX,
                snappedY,
            );
            if (distance <= 80) {
                // 2 tiles = 80 pixels
                canBuild = true;
            }
        });

        if (!canBuild) {
            console.log(`❌ Character must be within 2 tiles to build tower`);
            return;
        }

        // Check if a tower already exists at this position (towers are 80px = 2 grid cells)
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

        // Build the tower
        const towerId = `tower-${Date.now()}`;
        const tower = new Tower({
            scene: this,
            x: snappedX,
            y: snappedY,
            towerId,
            playerNumber: this.playerNumber,
            networkManager: this.networkManager,
        });

        this.towers.set(towerId, tower);

        // Broadcast tower build to other player
        if (this.networkManager) {
            this.networkManager.sendAction("build_tower", {
                towerId,
                x: snappedX,
                y: snappedY,
                playerNumber: this.playerNumber,
            });
        }

        console.log(`🏗️ Tower built at (${snappedX}, ${snappedY})`);
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
}

