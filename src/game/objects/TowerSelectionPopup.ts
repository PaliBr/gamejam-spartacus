import Phaser from "phaser";

export class TowerSelectionPopup {
    private scene: Phaser.Scene;
    private container: Phaser.GameObjects.Container | null = null;
    private background: Phaser.GameObjects.Rectangle | null = null;
    private buttons: Phaser.GameObjects.Rectangle[] = [];
    private texts: Phaser.GameObjects.Text[] = [];
    private active: boolean = false;
    private gridX: number = 0;
    private gridY: number = 0;
    private onSelectCallback:
        | ((type: "regular" | "trap", trapType?: number) => void)
        | null = null;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    show(
        x: number,
        y: number,
        onSelect: (type: "regular" | "trap", trapType?: number) => void,
    ) {
        if (this.active) {
            this.hide();
        }

        this.gridX = x;
        this.gridY = y;
        this.onSelectCallback = onSelect;
        this.active = true;

        // Create container for popup
        this.container = this.scene.add.container(x, y);
        this.container.setDepth(2000);

        // Create background
        const bgWidth = 160;
        const bgHeight = 200;
        this.background = this.scene.add.rectangle(
            0,
            0,
            bgWidth,
            bgHeight,
            0x222222,
            0.95,
        );
        this.background.setStrokeStyle(2, 0xffffff);
        this.container.add(this.background);

        // Add title
        const title = this.scene.add.text(
            0,
            -bgHeight / 2 + 16,
            "Select Tower Type",
            {
                fontSize: "14px",
                fontFamily: "Arial",
                color: "#ffffff",
                fontStyle: "bold",
                stroke: "#000000",
                strokeThickness: 3,
            },
        );
        title.setOrigin(0.5, 0.5);
        title.setResolution(2);
        this.container.add(title);

        // Create buttons for regular tower and 4 trap types
        const buttonWidth = 140;
        const buttonHeight = 28;
        const startY = -bgHeight / 2 + 46;
        const spacing = 32;

        // Regular tower button
        this.createButton(
            0,
            startY,
            buttonWidth,
            buttonHeight,
            "Regular Tower (10 Gold)",
            0x6666ff,
            () => {
                if (this.onSelectCallback) {
                    this.onSelectCallback("regular");
                }
                this.hide();
            },
        );

        // Trap buttons (4 types)
        const trapNames = [
            "Red Trap (3 Gold)",
            "Blue Trap (3 Gold)",
            "Yellow Trap (3 Gold)",
            "Green Trap (3 Gold)",
        ];
        const trapColors = [0xff0000, 0x0000ff, 0xffff00, 0x00ff00];

        trapNames.forEach((name, index) => {
            const yPos = startY + spacing * (index + 1);
            this.createButton(
                0,
                yPos,
                buttonWidth,
                buttonHeight,
                name,
                trapColors[index],
                () => {
                    if (this.onSelectCallback) {
                        this.onSelectCallback("trap", index);
                    }
                    this.hide();
                },
            );
        });

        console.log(`🎯 Tower selection popup shown at (${x}, ${y})`);
    }

    private createButton(
        x: number,
        y: number,
        width: number,
        height: number,
        text: string,
        color: number,
        onClick: () => void,
    ) {
        const button = this.scene.add.rectangle(
            x,
            y,
            width,
            height,
            color,
            0.8,
        );
        button.setStrokeStyle(2, 0xffffff);
        button.setDepth(2001); // Ensure button is above container
        button.setInteractive({ cursor: "pointer" });

        const buttonText = this.scene.add.text(x, y, text, {
            fontSize: "10px",
            fontFamily: "Arial",
            color: "#ffffff",
            fontStyle: "bold",
            stroke: "#000000",
            strokeThickness: 2,
        });
        buttonText.setOrigin(0.5, 0.5);
        buttonText.setResolution(2);

        // Hover effects
        button.on("pointerover", () => {
            button.setFillStyle(color, 1);
            button.setScale(1.05);
        });

        button.on("pointerout", () => {
            button.setFillStyle(color, 0.8);
            button.setScale(1);
        });

        button.on(
            "pointerdown",
            (
                _pointer: Phaser.Input.Pointer,
                _localX: number,
                _localY: number,
                event: Phaser.Types.Input.EventData,
            ) => {
                event.stopPropagation();
                onClick();
            },
        );

        this.buttons.push(button);
        this.texts.push(buttonText);

        if (this.container) {
            this.container.add(button);
            this.container.add(buttonText);
        }
    }

    hide() {
        if (this.container) {
            this.container.destroy();
            this.container = null;
        }
        this.buttons = [];
        this.texts = [];
        this.background = null;
        this.active = false;
        this.onSelectCallback = null;
    }

    isActive(): boolean {
        return this.active;
    }

    destroy() {
        this.hide();
    }
}

