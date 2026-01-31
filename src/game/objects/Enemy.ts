export class Enemy extends Phaser.GameObjects.Sprite {
    private targetX: number = 0;
    private targetY: number = 0;
    private speed: number = 150;
    private enemyState:
        | "idle"
        | "moving_up"
        | "moving_to_side"
        | "moving_to_target" = "idle";
    private goingLeft: boolean = false;
    private enemyId: string;
    private startTime: number = 0;
    private createdAt: number = Date.now();
    public radius: number = 10; // Half of 20px for collision
    public enemyType: number = 0; // 0, 1, 2, or 3

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

                // Grid positions: X [11,17,11,17] / [32,38,32,38], Y [4,4,12,12] (40px grid)
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
                const yPositions = [
                    4 * 40 + 20,
                    4 * 40 + 20,
                    12 * 40 + 20,
                    12 * 40 + 20,
                ]; // [180, 180, 500, 500]

                // Use seeded random for synchronization across clients
                const randomOffsetX =
                    (this.seededRandom(this.enemyId + "X") - 0.5) * 160;
                const randomOffsetY =
                    (this.seededRandom(this.enemyId + "Y") - 0.5) * 160;

                if (this.enemyType === 0) {
                    // Type 0 (Red): Grid [11,32] x 4 (top, outer columns)
                    this.targetX =
                        (this.goingLeft
                            ? leftXPositions[0]
                            : rightXPositions[0]) + randomOffsetX;
                    this.targetY = yPositions[0] + randomOffsetY;
                } else if (this.enemyType === 1) {
                    // Type 1 (Blue): Grid [17,38] x 4 (top, inner columns)
                    this.targetX =
                        (this.goingLeft
                            ? leftXPositions[1]
                            : rightXPositions[1]) + randomOffsetX;
                    this.targetY = yPositions[1] + randomOffsetY;
                } else if (this.enemyType === 2) {
                    // Type 2 (Yellow): Grid [11,32] x 12 (bottom, outer columns)
                    this.targetX =
                        (this.goingLeft
                            ? leftXPositions[2]
                            : rightXPositions[2]) + randomOffsetX;
                    this.targetY = yPositions[2] + randomOffsetY;
                } else if (this.enemyType === 3) {
                    // Type 3 (Green): Grid [17,38] x 12 (bottom, inner columns)
                    this.targetX =
                        (this.goingLeft
                            ? leftXPositions[3]
                            : rightXPositions[3]) + randomOffsetX;
                    this.targetY = yPositions[3] + randomOffsetY;
                }
            } else {
                // Continue moving straight to side X
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

