import { Scene } from "phaser";

export class Preloader extends Scene {
    constructor() {
        super("Preloader");
    }

    init() {
        //  We loaded this image in our Boot Scene, so we can display it here
        this.add.image(
            this.scale.width * 0.5,
            this.scale.height * 0.477,
            "background",
        );

        //  A simple progress bar. This is the outline of the bar.
        this.add
            .rectangle(
                this.scale.width * 0.5,
                this.scale.height * 0.477,
                468,
                32,
            )
            .setStrokeStyle(1, 0xffffff);

        //  This is the progress bar itself. It will increase in size from the left based on the % of progress.
        const bar = this.add.rectangle(
            this.scale.width * 0.5 - 230,
            this.scale.height * 0.477,
            4,
            28,
            0xffffff,
        );

        //  Use the 'progress' event emitted by the LoaderPlugin to update the loading bar
        this.load.on("progress", (progress: number) => {
            //  Update the progress bar (our bar is 464px wide, so 100% = 464px)
            bar.width = 4 + 460 * progress;
        });
    }

    preload() {
        //  Load the assets for the game - Replace with your own assets
        this.load.setPath("assets");

        this.load.image("logo", "logo.png");
        this.load.image("star", "star.png");

        // Load tilemap and tile images
        this.load.tilemapTiledJSON("map", "map.tmj");
        this.load.image("mvp2-farm", "MVP2/farm.png");
        this.load.image("mvp2-grass", "MVP2/grass.png");
    }

    create() {
        //  When all the assets have loaded, it's often worth creating global objects here that the rest of the game can use.
        //  For example, you can define global animations here, so we can use them in other scenes.

        // Create a simple character sprite (placeholder)
        // This creates a 32x32 red rectangle as the character
        const graphics = this.make.graphics({ x: 0, y: 0, add: false });
        graphics.fillStyle(0xff0000, 1);
        graphics.fillRect(0, 0, 32, 32);
        graphics.generateTexture("character", 32, 32);
        graphics.destroy();

        //  Move to the MainMenu. You could also swap this for a Scene Transition, such as a camera fade.
        this.scene.start("MainMenu");
    }
}

