import Phaser from "phaser";

export type ElementType = "food" | "mask" | "book";

export interface SpawnableElementConfig {
    scene: Phaser.Scene;
    x: number;
    y: number;
    elementType: ElementType;
    elementId: string;
}

export class SpawnableElement extends Phaser.Physics.Arcade.Sprite {
    private elementType: ElementType;
    private elementId: string;
    private bobOffset: number = 0;
    private bobSpeed: number = 0.05;
    private baseY: number;
    private lifeTimer: number = 8000; // 5 seconds before disappearing
    private maxLifetime: number = 8000;

    constructor(config: SpawnableElementConfig) {
        super(config.scene, config.x, config.y, "spawnable_element");
        this.elementType = config.elementType;
        this.elementId = config.elementId;
        this.baseY = config.y;

        // Add to scene and physics
        config.scene.add.existing(this);
        config.scene.physics.add.existing(this);

        // Set frame based on element type
        this.updateFrame();

        // Set collision properties
        this.setImmovable(true);
        this.setDisplaySize(30, 30);

        // Add glow effect with scale animation
        this.scene.tweens.add({
            targets: this,
            scale: { from: 1, to: 1.1 },
            duration: 800,
            yoyo: true,
            repeat: -1,
        });

        console.log(
            `✨ Spawned ${this.elementType} element at (${config.x}, ${config.y}) - expires in 5s`,
        );
    }

    private updateFrame() {
        // Frame indices: 0=food, 1=mask, 2=book
        const frameMap = {
            food: 0,
            mask: 1,
            book: 2,
        };
        this.setFrame(frameMap[this.elementType]);

        // Set tint color based on type
        const colorMap = {
            food: 0xff8800, // Orange
            mask: 0x9932cc, // Purple
            book: 0x00aaff, // Cyan
        };
        this.setTint(colorMap[this.elementType]);
    }

    update() {
        // Bob up and down effect
        this.bobOffset += this.bobSpeed;
        this.y = this.baseY + Math.sin(this.bobOffset) * 5;

        // Decrease lifetime
        this.lifeTimer -= 16.67; // ~60fps

        // Fade out in last 1 second
        if (this.lifeTimer < 1000) {
            const alpha = this.lifeTimer / 1000;
            this.setAlpha(alpha);
        }

        // Destroy if lifetime expired
        if (this.lifeTimer <= 0) {
            console.log(`⏰ Element ${this.elementType} expired and destroyed`);
            this.destroy();
        }
    }

    getLifetimePercent(): number {
        return this.lifeTimer / this.maxLifetime;
    }

    getElementType(): ElementType {
        return this.elementType;
    }

    getElementId(): string {
        return this.elementId;
    }

    destroy() {
        super.destroy();
    }
}

