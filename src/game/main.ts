import { Boot } from "./scenes/Boot";
import { GameOver } from "./scenes/GameOver";
import { Game as MainGame } from "./scenes/Game";
import { MainMenu } from "./scenes/MainMenu";
import { Game } from "phaser";
import { Preloader } from "./scenes/Preloader";
import { CreateRoom } from "./scenes/CreateRoom";
import { RoomInit } from "./scenes/RoomInit";
import { JoinRoom } from "./scenes/JoinRoom";
import { MainGameScene } from "./scenes/MainGameScene";

const config: Phaser.Types.Core.GameConfig = {
    scale: {
        mode: Phaser.Scale.EXPAND,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1280,
        height: 720,
        min: {
            width: 640,
            height: 360,
        },
        max: {
            width: 1920,
            height: 1080,
        },
        fullscreenTarget: "parent",
        expandParent: true,
    },
    parent: "game-container",
    backgroundColor: "#028af8",
    scene: [
        Boot,
        Preloader,
        MainMenu,
        MainGame,
        GameOver,
        CreateRoom,
        JoinRoom,
        RoomInit,
        MainGameScene,
    ],
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
};

export default StartGame;
