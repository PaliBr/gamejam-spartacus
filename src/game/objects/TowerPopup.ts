import Phaser from "phaser";
import { Tower } from "./Tower";
import { TrapTower } from "./TrapTower";

export class TowerPopup {
    private scene: Phaser.Scene;
    private tower: Tower | TrapTower | null = null;
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

    show(tower: Tower | TrapTower) {
        if (this.isVisible) {
            this.hide();
        }

        this.tower = tower;
        this.isVisible = true;

        // Center popup on the tower
        const popupX = tower.x + (tower instanceof Tower ? 20 : 0); // Tower origin is 0,0, TrapTower is 0.5,0.5
        const popupY = tower.y + (tower instanceof Tower ? 40 : 0);
        const popupWidth = 160;
        const popupHeight = 120;

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

        // Title showing tower type and current level
        const towerType = tower instanceof Tower ? "Tower" : "Trap Tower";
        const upgradeCost = tower.level * 6;
        const levelInfo =
            tower instanceof Tower
                ? `Speed: ${(500 / tower.level).toFixed(0)}ms`
                : `Capacity: ${3 + (tower.level - 1)}`;

        this.titleText = this.scene.add.text(
            popupX,
            popupY - 35,
            `${towerType}\nLevel ${tower.level}\n${levelInfo}\nUpgrade: ${upgradeCost}g`,
            {
                fontSize: "12px",
                color: "#ffffff",
                align: "center",
                stroke: "#000000",
                strokeThickness: 2,
            },
        );
        this.titleText.setOrigin(0.5);
        this.titleText.setResolution(2);
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
                stroke: "#000000",
                strokeThickness: 2,
            },
        );
        upgradeText.setOrigin(0.5);
        upgradeText.setResolution(2);
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
                stroke: "#000000",
                strokeThickness: 2,
            },
        );
        downgradeText.setOrigin(0.5);
        downgradeText.setResolution(2);
        downgradeText.setDepth(202);
        this.downgradeText = downgradeText;

        // Button interactions
        this.upgradeButton.on(
            "pointerdown",
            (
                _pointer: Phaser.Input.Pointer,
                _localX: number,
                _localY: number,
                event: Phaser.Types.Input.EventData,
            ) => {
                event.stopPropagation();
                const success = tower.upgrade();
                if (success) {
                    this.show(tower); // Refresh popup only if upgrade succeeded
                }
            },
        );

        this.upgradeButton.on("pointerover", () => {
            this.upgradeButton!.setFillStyle(0x00dd00, 0.9);
        });

        this.upgradeButton.on("pointerout", () => {
            this.upgradeButton!.setFillStyle(0x00aa00, 0.8);
        });

        this.downgradeButton.on(
            "pointerdown",
            (
                _pointer: Phaser.Input.Pointer,
                _localX: number,
                _localY: number,
                event: Phaser.Types.Input.EventData,
            ) => {
                event.stopPropagation();
                const success = tower.downgrade();
                if (success) {
                    this.show(tower); // Refresh popup
                }
            },
        );

        this.downgradeButton.on("pointerover", () => {
            this.downgradeButton!.setFillStyle(0xdd0000, 0.9);
        });

        this.downgradeButton.on("pointerout", () => {
            this.downgradeButton!.setFillStyle(0xaa0000, 0.8);
        });

        // Click outside to close
        this.popupBg.on(
            "pointerdown",
            (
                pointer: Phaser.Input.Pointer,
                _localX: number,
                _localY: number,
                event: Phaser.Types.Input.EventData,
            ) => {
                event.stopPropagation();
                if (
                    pointer.x < popupX - popupWidth / 2 ||
                    pointer.x > popupX + popupWidth / 2 ||
                    pointer.y < popupY - popupHeight / 2 ||
                    pointer.y > popupY + popupHeight / 2
                ) {
                    this.hide();
                }
            },
        );
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
        this.tower = null;
        this.isVisible = false;
    }

    isActive(): boolean {
        return this.isVisible;
    }

    destroy() {
        this.hide();
    }
}

