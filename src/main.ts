/**
 * 入口：M2 完整对局。
 * 键盘双人（P1 WASD+F / P2 方向键+右Ctrl），先到 5 分获胜，R 重开。
 */
import { Vec2 } from 'planck';
import { GameLoop } from './core/loop';
import { KeyboardInput, P1_KEYS, P2_KEYS } from './core/input';
import { Game } from './game/game';
import { Renderer } from './render/renderer';
import { buildTuningPanel } from './render/panel';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new Renderer(canvas);

let game = new Game();

const input1 = new KeyboardInput(P1_KEYS);
const input2 = new KeyboardInput(P2_KEYS);

// 调参面板（gravity 改变时同步到当前世界）
const panel = document.getElementById('panel');
if (panel) {
  buildTuningPanel(panel, (key, value) => {
    if (key === 'gravityY') game.world.setGravity(new Vec2(0, value));
  });
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR' && game.phase.kind === 'matchEnd') {
    game = new Game();
  }
});

const loop = new GameLoop({
  update(dt) {
    game.update(dt, [input1.sample(), input2.sample()]);
  },
  render(_alpha, fps) {
    renderer.renderGame(game, fps);
  },
});

loop.start();
