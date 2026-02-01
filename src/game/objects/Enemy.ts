export class Enemy extends Phaser.GameObjects.Sprite {
    private targetX: number = 0;
    private targetY: number = 0;
    private speed: number = 150;
    private enemyState:
        | "idle"
        | "moving_up"
        | "moving_to_side"
        | "moving_to_target"
        | "attracted_to_trap" = "idle";
    private goingLeft: boolean = false;
    private enemyId: string;
    private startTime: number = 0;
    private createdAt: number = Date.now();
    public radius: number = 10; // Half of 20px for collision
    public enemyType: number = 0; // 0, 1, 2, or 3
    public isAttractedToTrap: boolean = false;
    public trapX: number = 0;
    public trapY: number = 0;
    private targetIsCity: boolean = false;
    private hasReachedFinalTarget: boolean = false;
    private cityPenaltyApplied: boolean = false;

    // Seeded random for synchronization across clients
    private seededRandom(seed: string): number {
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            const char = seed.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        const x = Math.sin(hash) * 10000;
        return x - Math.floor(x);
    }

    constructor(config: {
        scene: Phaser.Scene;
        x: number;
        y: number;
        enemyId: string;
        goingLeft: boolean;
        enemyType?: number;
        startTime?: number;
    }) {
        super(config.scene, config.x, config.y, "");

        this.enemyId = config.enemyId;
        this.goingLeft = config.goingLeft;
        this.enemyType = config.enemyType || 0;
        this.startTime = config.startTime || 0;

        // Create colored squares based on type (20x20 = 0.5x0.5 grid cell)
        const graphics = config.scene.add.graphics();
        let color = 0xff0000; // Red for type 0
        if (this.enemyType === 1) {
            color = 0x0000ff; // Blue for type 1
        } else if (this.enemyType === 2) {
            color = 0xffff00; // Yellow for type 2
        } else if (this.enemyType === 3) {
            color = 0x00ff00; // Green for type 3
        }

        graphics.fillStyle(color, 1);
        graphics.fillRect(0, 0, 20, 20);
        graphics.generateTexture(`enemy-${this.enemyId}`, 20, 20);
        graphics.destroy();

        this.setTexture(`enemy-${this.enemyId}`);

        config.scene.add.existing(this);
        config.scene.physics.add.existing(this);

        // Minimal physics - just track position
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setCollideWorldBounds(false);
        body.setDrag(0, 0); // No friction

        // Set initial target: keep same X (move straight up), turn at tile 5 Y
        this.targetX = config.x; // Keep starting X position
        this.targetY = 5 * 40 + 20; // Tile 5, centered in grid cell
    }

    update() {
        const body = this.body as Phaser.Physics.Arcade.Body;
        if (!body) return;

        // Check if enemy should start moving
        const elapsedTime = Date.now() - this.createdAt;
        if (elapsedTime < this.startTime) {
            body.setVelocity(0, 0);
            return;
        }

        // If attracted to trap, move toward trap
        if (this.isAttractedToTrap) {
            this.enemyState = "attracted_to_trap";
            const distance = Phaser.Math.Distance.Between(
                this.x,
                this.y,
                this.trapX,
                this.trapY,
            );

            if (distance < 5) {
                // Reached trap, stop moving
                body.setVelocity(0, 0);
            } else {
                // Move toward trap
                const angle = Phaser.Math.Angle.Between(
                    this.x,
                    this.y,
                    this.trapX,
                    this.trapY,
                );
                body.setVelocity(
                    Math.cos(angle) * this.speed,
                    Math.sin(angle) * this.speed,
                );
            }
            return;
        }

        // Transition to moving_up state after delay
        if (this.enemyState === "idle") {
            this.enemyState = "moving_up";
        }

        if (this.enemyState === "moving_up") {
            const distance = Phaser.Math.Distance.Between(
                this.x,
                this.y,
                this.targetX,
                this.targetY,
            );

            if (distance < 15) {
                // Reached top (20%), now move left/right straight
                this.enemyState = "moving_to_side";

                // Calculate side movement X based on enemy type
                // Grid positions: Left [10,6,6,10], Right [19,23,23,19] (40px grid)
                // Add 20 to center in grid cell (40px cell, center at +20)
                const leftXPositions = [
                    10 * 40 + 20,
                    6 * 40 + 20,
                    6 * 40 + 20,
                    10 * 40 + 20,
                ]; // [420, 260, 260, 420]
                const rightXPositions = [
                    19 * 40 + 20,
                    23 * 40 + 20,
                    23 * 40 + 20,
                    19 * 40 + 20,
                ]; // [780, 940, 940, 780]

                if (this.enemyType === 0) {
                    // Type 0 (Red): Grid column 10 (left) or 19 (right)
                    this.targetX = this.goingLeft
                        ? leftXPositions[0]
                        : rightXPositions[0];
                } else if (this.enemyType === 1) {
                    // Type 1 (Blue): Grid column 6 (left) or 23 (right)
                    this.targetX = this.goingLeft
                        ? leftXPositions[1]
                        : rightXPositions[1];
                } else if (this.enemyType === 2) {
                    // Type 2 (Yellow): Grid column 6 (left) or 23 (right)
                    this.targetX = this.goingLeft
                        ? leftXPositions[2]
                        : rightXPositions[2];
                } else if (this.enemyType === 3) {
                    // Type 3 (Green): Grid column 10 (left) or 19 (right)
                    this.targetX = this.goingLeft
                        ? leftXPositions[3]
                        : rightXPositions[3];
                }
                // Add vertical spread variation (±20px = ±0.5 grid cell)
                const randomYOffset =
                    (this.seededRandom(this.enemyId + "sideY") - 0.5) * 40;
                this.targetY = 5 * 40 + 20 + randomYOffset;
            } else {
                const angle = Phaser.Math.Angle.Between(
                    this.x,
                    this.y,
                    this.targetX,
                    this.targetY,
                );
                body.setVelocity(
                    Math.cos(angle) * this.speed,
                    Math.sin(angle) * this.speed,
                );
            }
        } else if (this.enemyState === "moving_to_side") {
            // Move toward side target (X,Y) until reaching it
            const distanceToSideTarget = Phaser.Math.Distance.Between(
                this.x,
                this.y,
                this.targetX,
                this.targetY,
            );

            if (distanceToSideTarget < 15) {
                // Reached side X position, now sharp turn to final target
                this.enemyState = "moving_to_target";

                // Farm grid positions: Left [(6,1), (10,1), (6,7), (10,7)], Right [(23,1), (19,1), (23,7), (19,7)]
                // Farm types: [wheat(yellow), carrot(red), sunflower(blue), potato(green)]
                // Enemy type mapping: 0=Red→Carrot(1), 1=Blue→Sunflower(2), 2=Yellow→Wheat(0), 3=Green→Potato(3)

                const mainScene = this.scene as any;
                const farmIndexByEnemyType = [1, 2, 0, 3];
                const farmIndex = farmIndexByEnemyType[this.enemyType] ?? 0;
                const side = this.goingLeft ? "left" : "right";
                const farmId = `farm-${side}-${farmIndex}`;
                const farm = mainScene?.farms?.get(farmId);

                // Use seeded random for synchronization across clients
                const randomOffsetX =
                    (this.seededRandom(this.enemyId + "X") - 0.5) * 120; // 3x3 farm spread
                const randomOffsetY =
                    (this.seededRandom(this.enemyId + "Y") - 0.5) * 120;

                if (farm && farm.level > 0) {
                    this.targetIsCity = false;
                    const farmCenterX = farm.x + 60;
                    const farmCenterY = farm.y + 60;
                    this.targetX = farmCenterX + randomOffsetX;
                    this.targetY = farmCenterY + randomOffsetY;
                } else {
                    this.targetIsCity = true;
                    const gridSize = 40;
                    const cityTargetSize = 4 * gridSize;
                    const cityTargetRow = 3;
                    const leftCityX = 0 * gridSize;
                    const rightCityX = 28 * gridSize;
                    const cityTopX = this.goingLeft ? leftCityX : rightCityX;
                    const cityTopY = cityTargetRow * gridSize;
                    const cityCenterX = cityTopX + cityTargetSize / 2;
                    const cityCenterY = cityTopY + cityTargetSize / 2;
                    const cityOffsetX =
                        (this.seededRandom(this.enemyId + "cityX") - 0.5) *
                        cityTargetSize;
                    const cityOffsetY =
                        (this.seededRandom(this.enemyId + "cityY") - 0.5) *
                        cityTargetSize;
                    this.targetX = cityCenterX + cityOffsetX;
                    this.targetY = cityCenterY + cityOffsetY;
                }
            } else {
                const angle = Phaser.Math.Angle.Between(
                    this.x,
                    this.y,
                    this.targetX,
                    this.targetY,
                );
                body.setVelocity(
                    Math.cos(angle) * this.speed,
                    Math.sin(angle) * this.speed,
                );
            }
        } else if (this.enemyState === "moving_to_target") {
            // Move to final target position based on type
            const distance = Phaser.Math.Distance.Between(
                this.x,
                this.y,
                this.targetX,
                this.targetY,
            );

            if (distance < 15) {
                body.setVelocity(0, 0);
                if (this.targetIsCity && !this.hasReachedFinalTarget) {
                    this.hasReachedFinalTarget = true;
                    this.cityPenaltyApplied = true;
                    const mainScene = this.scene as any;
                    if (
                        typeof mainScene?.handleCityTargetReached === "function"
                    ) {
                        mainScene.handleCityTargetReached(
                            this.goingLeft ? 1 : 2,
                        );
                    }
                }
            } else {
                const angle = Phaser.Math.Angle.Between(
                    this.x,
                    this.y,
                    this.targetX,
                    this.targetY,
                );
                body.setVelocity(
                    Math.cos(angle) * this.speed,
                    Math.sin(angle) * this.speed,
                );
            }
        }
    }

    destroy(fromScene?: boolean) {
        if (this.cityPenaltyApplied) {
            const mainScene = this.scene as any;
            if (typeof mainScene?.handleCityTargetCleared === "function") {
                mainScene.handleCityTargetCleared(this.goingLeft ? 1 : 2);
            }
            this.cityPenaltyApplied = false;
        }
        super.destroy(fromScene);
    }
}

