import Phaser from "phaser";
import { Farm } from "./Farm";

export class FarmPopup {
    private scene: Phaser.Scene;
    private farm: Farm | null = null;
    private popupBg: Phaser.GameObjects.Rectangle | null = null;
    private upgradeButton: Phaser.GameObjects.Rectangle | null = null;
    private downgradeButton: Phaser.GameObjects.Rectangle | null = null;
    private upgradeText: Phaser.GameObjects.Text | null = null;
    private downgradeText: Phaser.GameObjects.Text | null = null;
    private titleText: Phaser.GameObjects.Text | null = null;
    private isVisible: boolean = false;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    show(farm: Farm) {
        if (this.isVisible) {
            this.hide();
        }

        this.farm = farm;
        this.isVisible = true;

        const popupX = farm.x;
        const popupY = farm.y - 120;
        const popupWidth = 140;
        const popupHeight = 100;

        // Semi-transparent background
        this.popupBg = this.scene.add.rectangle(
            popupX,
            popupY,
            popupWidth,
            popupHeight,
            0x333333,
            0.95,
        );
        this.popupBg.setStrokeStyle(2, 0xffffff);
        this.popupBg.setDepth(200);
        this.popupBg.setInteractive();

        // Title showing farm type and current level
        const farmName =
            farm.farmType.charAt(0).toUpperCase() + farm.farmType.slice(1);
        this.titleText = this.scene.add.text(
            popupX,
            popupY - 30,
            `${farmName}\nLevel ${farm.level}`,
            {
                fontSize: "14px",
                color: "#ffffff",
                align: "center",
            },
        );
        this.titleText.setOrigin(0.5);
        this.titleText.setDepth(201);

        // Upgrade button
        this.upgradeButton = this.scene.add.rectangle(
            popupX - 35,
            popupY + 15,
            60,
            40,
            0x00aa00,
            0.8,
        );
        this.upgradeButton.setStrokeStyle(2, 0xffffff);
        this.upgradeButton.setInteractive({ cursor: "pointer" });
        this.upgradeButton.setDepth(201);

        const upgradeText = this.scene.add.text(
            popupX - 35,
            popupY + 15,
            "⬆️\nUP",
            {
                fontSize: "12px",
                color: "#ffffff",
                align: "center",
                fontStyle: "bold",
            },
        );
        upgradeText.setOrigin(0.5);
        upgradeText.setDepth(202);
        this.upgradeText = upgradeText;

        // Downgrade button
        this.downgradeButton = this.scene.add.rectangle(
            popupX + 35,
            popupY + 15,
            60,
            40,
            0xaa0000,
            0.8,
        );
        this.downgradeButton.setStrokeStyle(2, 0xffffff);
        this.downgradeButton.setInteractive({ cursor: "pointer" });
        this.downgradeButton.setDepth(201);

        const downgradeText = this.scene.add.text(
            popupX + 35,
            popupY + 15,
            "⬇️\nDOWN",
            {
                fontSize: "12px",
                color: "#ffffff",
                align: "center",
                fontStyle: "bold",
            },
        );
        downgradeText.setOrigin(0.5);
        downgradeText.setDepth(202);
        this.downgradeText = downgradeText;

        // Button interactions
        this.upgradeButton.on("pointerdown", () => {
            farm.upgrade();
            this.show(farm); // Refresh popup
        });

        this.upgradeButton.on("pointerover", () => {
            this.upgradeButton!.setFillStyle(0x00dd00, 0.9);
        });

        this.upgradeButton.on("pointerout", () => {
            this.upgradeButton!.setFillStyle(0x00aa00, 0.8);
        });

        this.downgradeButton.on("pointerdown", () => {
            farm.downgrade();
            this.show(farm); // Refresh popup
        });

        this.downgradeButton.on("pointerover", () => {
            this.downgradeButton!.setFillStyle(0xdd0000, 0.9);
        });

        this.downgradeButton.on("pointerout", () => {
            this.downgradeButton!.setFillStyle(0xaa0000, 0.8);
        });

        // Click outside to close
        this.popupBg.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
            if (
                pointer.x < popupX - popupWidth / 2 ||
                pointer.x > popupX + popupWidth / 2 ||
                pointer.y < popupY - popupHeight / 2 ||
                pointer.y > popupY + popupHeight / 2
            ) {
                this.hide();
            }
        });
    }

    hide() {
        if (this.popupBg) this.popupBg.destroy();
        if (this.upgradeButton) this.upgradeButton.destroy();
        if (this.downgradeButton) this.downgradeButton.destroy();
        if (this.upgradeText) this.upgradeText.destroy();
        if (this.downgradeText) this.downgradeText.destroy();
        if (this.titleText) this.titleText.destroy();

        this.popupBg = null;
        this.upgradeButton = null;
        this.downgradeButton = null;
        this.upgradeText = null;
        this.downgradeText = null;
        this.titleText = null;
        this.farm = null;
        this.isVisible = false;
    }

    isActive(): boolean {
        return this.isVisible;
    }

    destroy() {
        this.hide();
    }
}

