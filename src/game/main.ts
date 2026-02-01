import { Boot } from "./scenes/Boot";
import { GameOver } from "./scenes/GameOver";
import { Game as MainGame } from "./scenes/Game";
import { MainMenu } from "./scenes/MainMenu";
import { Game } from "phaser";
import { Preloader } from "./scenes/Preloader";
import { RoomInit } from "./scenes/RoomInit";
import { MainGameScene } from "./scenes/MainGameScene";
import { TestConnection } from "./scenes/TestConnection";
import { DevScene } from "./scenes/DevScene";
import { YouWin } from "./scenes/YouWin";

// Check environment
const isDev = import.meta.env.VITE_ENV === "dev";

const config: Phaser.Types.Core.GameConfig = {
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1280,
        height: 720,
        fullscreenTarget: "parent",
        expandParent: false,
    },
    parent: "game-container",
    backgroundColor: "#028af8",
    scene: isDev
        ? [DevScene] // Dev mode: only DevScene
        : [
              Boot,
              Preloader,
              MainMenu,
              MainGame,
              GameOver,
              RoomInit,
              MainGameScene,
              TestConnection,
              YouWin,
          ],
    physics: {
        default: "arcade",
        arcade: {
            debug: isDev, // Enable physics debug in dev mode
        },
    },
};

const StartGame = (parent: string) => {
    if (isDev) {
        console.log("🔧 Starting in DEV mode - No network required");
    }
    return new Game({ ...config, parent });
};

export default StartGame;
