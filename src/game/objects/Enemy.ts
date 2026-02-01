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

        // Set initial target: keep same X (move straight up), turn at tile 9 Y
        this.targetX = config.x; // Keep starting X position
        this.targetY = 9 * 40 + 20; // Tile 9, centered in grid cell
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
                // Grid positions: Left [11,17,11,17], Right [32,38,32,38] (40px grid)
                // Add 20 to center in grid cell (40px cell, center at +20)
                const leftXPositions = [
                    11 * 40 + 20,
                    17 * 40 + 20,
                    11 * 40 + 20,
                    17 * 40 + 20,
                ]; // [460, 700, 460, 700]
                const rightXPositions = [
                    32 * 40 + 20,
                    38 * 40 + 20,
                    32 * 40 + 20,
                    38 * 40 + 20,
                ]; // [1300, 1540, 1300, 1540]

                if (this.enemyType === 0) {
                    // Type 0 (Red): Grid column 11 (left) or 32 (right)
                    this.targetX = this.goingLeft
                        ? leftXPositions[0]
                        : rightXPositions[0];
                } else if (this.enemyType === 1) {
                    // Type 1 (Blue): Grid column 17 (left) or 38 (right)
                    this.targetX = this.goingLeft
                        ? leftXPositions[1]
                        : rightXPositions[1];
                } else if (this.enemyType === 2) {
                    // Type 2 (Yellow): Grid column 11 (left) or 32 (right)
                    this.targetX = this.goingLeft
                        ? leftXPositions[2]
                        : rightXPositions[2];
                } else if (this.enemyType === 3) {
                    // Type 3 (Green): Grid column 17 (left) or 38 (right)
                    this.targetX = this.goingLeft
                        ? leftXPositions[3]
                        : rightXPositions[3];
                }
                // Keep Y at tile 8 during side movement
                this.targetY = 7 * 40 + 20;
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
            // Move straight left/right at 20% height until reaching target X
            const distanceToTargetX = Math.abs(this.x - this.targetX);

            if (distanceToTargetX < 15) {
                // Reached side X position, now sharp turn to final target
                this.enemyState = "moving_to_target";

                // Farm grid positions: Left [(9,3), (15,3), (9,10), (15,10)], Right [(30,3), (36,3), (30,10), (36,10)]
                // Farm types: [wheat(yellow), carrot(red), sunflower(blue), potato(green)]
                // Farms are 3x3 (120px), so center is at grid*40 + 60
                // Enemy type mapping: 0=Red→Carrot(1), 1=Blue→Sunflower(2), 2=Yellow→Wheat(0), 3=Green→Potato(3)

                // Use seeded random for synchronization across clients
                const randomOffsetX =
                    (this.seededRandom(this.enemyId + "X") - 0.5) * 120; // 3x3 farm spread
                const randomOffsetY =
                    (this.seededRandom(this.enemyId + "Y") - 0.5) * 120;

                if (this.enemyType === 0) {
                    // Type 0 (Red) → Carrot farm at (15,3) or (36,3)
                    this.targetX =
                        (this.goingLeft ? 15 * 40 + 60 : 36 * 40 + 60) +
                        randomOffsetX;
                    this.targetY = 3 * 40 + 60 + randomOffsetY;
                } else if (this.enemyType === 1) {
                    // Type 1 (Blue) → Sunflower farm at (9,10) or (30,10)
                    this.targetX =
                        (this.goingLeft ? 9 * 40 + 60 : 30 * 40 + 60) +
                        randomOffsetX;
                    this.targetY = 10 * 40 + 60 + randomOffsetY;
                } else if (this.enemyType === 2) {
                    // Type 2 (Yellow) → Wheat farm at (9,3) or (30,3)
                    this.targetX =
                        (this.goingLeft ? 9 * 40 + 60 : 30 * 40 + 60) +
                        randomOffsetX;
                    this.targetY = 3 * 40 + 60 + randomOffsetY;
                } else if (this.enemyType === 3) {
                    // Type 3 (Green) → Potato farm at (15,10) or (36,10)
                    this.targetX =
                        (this.goingLeft ? 15 * 40 + 60 : 36 * 40 + 60) +
                        randomOffsetX;
                    this.targetY = 10 * 40 + 60 + randomOffsetY;
                }
            } else {
                // Continue moving straight horizontally to side X
                if (this.x < this.targetX) {
                    // Moving right
                    body.setVelocity(this.speed, 0);
                } else {
                    // Moving left
                    body.setVelocity(-this.speed, 0);
                }
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
}

