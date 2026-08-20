/**
 * 入口：装配 M1 灵魂原型。
 * 两个键盘控制的火柴人（P1 WASD+F / P2 方向键+右Ctrl），同一场地互甩长矛。
 * 目标：验证"甩摇杆挥武器"的手感。伤害判定在 M2 接入。
 */
import { Vec2 } from 'planck';
import { GameLoop } from './core/loop';
import { KeyboardInput, P1_KEYS, P2_KEYS } from './core/input';
import { createWorld, createGround, stepWorld } from './physics/world';
import { Ragdoll } from './physics/ragdoll';
import { Renderer } from './render/renderer';
import { buildTuningPanel } from './render/panel';

const GROUND = { y: 0, halfWidth: 12 };

const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new Renderer(canvas);

const world = createWorld();
createGround(world, GROUND);

const p1 = new Ragdoll(world, { playerIndex: 0, x: -3, y: 0, facing: 1 });
const p2 = new Ragdoll(world, { playerIndex: 1, x: 3, y: 0, facing: -1 });
const ragdolls = [p1, p2];

const input1 = new KeyboardInput(P1_KEYS);
const input2 = new KeyboardInput(P2_KEYS);

// 调参面板（gravity 改变时需要同步到已创建的世界）
const panel = document.getElementById('panel');
if (panel) {
  buildTuningPanel(panel, (key, value) => {
    if (key === 'gravityY') world.setGravity(new Vec2(0, value));
  });
}

// 调试：按 H 键给 P2 一记冲量，测试失衡与恢复
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyH') {
    p2.applyHit(new Vec2(4, 3), p2.torso.getWorldPoint(new Vec2(0, 0.2)));
  }
});

const loop = new GameLoop({
  update(dt) {
    p1.update(input1.sample(), dt);
    p2.update(input2.sample(), dt);
    stepWorld(world);
  },
  render(_alpha, fps) {
    renderer.render(ragdolls, GROUND.y, GROUND.halfWidth, fps);
  },
});

loop.start();
