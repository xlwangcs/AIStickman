/**
 * 无头物理测试：不断言精确数值，断言"性质"——站得住、被打能恢复、不发散。
 */
import { describe, it, expect } from 'vitest';
import { Vec2 } from 'planck';
import { createWorld, createGround, stepWorld } from '../src/physics/world';
import { Ragdoll } from '../src/physics/ragdoll';
import { wrapAngle } from '../src/physics/balance';
import { neutralIntent } from '../src/core/input';

function makeScene() {
  const world = createWorld();
  createGround(world, { y: 0, halfWidth: 12 });
  const ragdoll = new Ragdoll(world, { playerIndex: 0, x: 0, y: 0, facing: 1 });
  return { world, ragdoll };
}

function simulate(scene: ReturnType<typeof makeScene>, frames: number, intent = neutralIntent()) {
  for (let i = 0; i < frames; i++) {
    scene.ragdoll.update(intent, 1 / 60);
    stepWorld(scene.world);
  }
}

describe('站立稳定性', () => {
  it('静置 5 秒保持直立且不下陷、无 NaN', () => {
    const scene = makeScene();
    simulate(scene, 300);
    const { torso } = scene.ragdoll;
    const angle = Math.abs(wrapAngle(torso.getAngle()));
    const pos = torso.getPosition();
    expect(Number.isFinite(pos.x)).toBe(true);
    expect(Number.isFinite(pos.y)).toBe(true);
    expect(angle).toBeLessThan(0.3); // < ~17°
    expect(pos.y).toBeGreaterThan(0.4); // 躯干仍在地面上方
    expect(Math.abs(pos.x)).toBeLessThan(1); // 没有原地漂移
  });

  it('水平移动 1.2 秒后停止，仍然站立（不会撞墙）', () => {
    const scene = makeScene();
    simulate(scene, 72, { move: { x: 1, y: 0 }, jump: false });
    simulate(scene, 120);
    const { torso } = scene.ragdoll;
    expect(torso.getPosition().x).toBeGreaterThan(1.5); // 确实移动了
    expect(Math.abs(wrapAngle(torso.getAngle()))).toBeLessThan(0.3);
    expect(torso.getPosition().y).toBeGreaterThan(0.4);
  });

  it('受到冲量击打后进入失衡，4 秒内恢复直立', () => {
    const scene = makeScene();
    simulate(scene, 60); // 先稳定
    const { ragdoll } = scene;
    ragdoll.applyHit(new Vec2(60, 50), ragdoll.torso.getWorldPoint(new Vec2(0, 0.25)));
    expect(ragdoll.balance.stunned).toBe(true);
    simulate(scene, 240);
    expect(ragdoll.balance.stunned).toBe(false);
    expect(Math.abs(wrapAngle(ragdoll.torso.getAngle()))).toBeLessThan(0.35);
    expect(ragdoll.torso.getPosition().y).toBeGreaterThan(0.4);
  });

  it('疯狂甩动手臂 5 秒，物理不发散（无 NaN、不飞天）', () => {
    const scene = makeScene();
    for (let i = 0; i < 300; i++) {
      // 每 10 帧反转瞄准方向，模拟玩家疯狂甩摇杆
      const dir = Math.floor(i / 10) % 2 === 0 ? 1 : -1;
      scene.ragdoll.update({ move: { x: dir, y: 0.3 * dir }, jump: false }, 1 / 60);
      stepWorld(scene.world);
    }
    const pos = scene.ragdoll.torso.getPosition();
    expect(Number.isFinite(pos.x)).toBe(true);
    expect(Number.isFinite(pos.y)).toBe(true);
    expect(pos.y).toBeLessThan(5);
    expect(Math.abs(pos.x)).toBeLessThan(12.5);
  });
});

describe('跳跃', () => {
  it('跳跃后离地上升，随后落回地面', () => {
    const scene = makeScene();
    simulate(scene, 60);
    const startY = scene.ragdoll.torso.getPosition().y;
    // 按住跳跃一帧（边沿触发）
    simulate(scene, 1, { move: { x: 0, y: 0 }, jump: true });
    simulate(scene, 20);
    const peakY = scene.ragdoll.torso.getPosition().y;
    expect(peakY).toBeGreaterThan(startY + 0.3);
    simulate(scene, 180);
    const endY = scene.ragdoll.torso.getPosition().y;
    expect(Math.abs(endY - startY)).toBeLessThan(0.3); // 回到地面高度
  });
});

describe('甩矛（灵魂机制的物理前提）', () => {
  it('快速反转瞄准方向时矛尖速度显著高于身体速度', () => {
    const scene = makeScene();
    simulate(scene, 90, { move: { x: 1, y: 0 }, jump: false }); // 手臂指向右
    let maxTipSpeed = 0;
    for (let i = 0; i < 40; i++) {
      scene.ragdoll.update({ move: { x: -1, y: 0.4 }, jump: false }, 1 / 60); // 猛反向
      stepWorld(scene.world);
      const v = scene.ragdoll.getSpearTipVelocity();
      maxTipSpeed = Math.max(maxTipSpeed, Math.hypot(v.x, v.y));
    }
    expect(maxTipSpeed).toBeGreaterThan(8); // 甩击可产生高速矛尖
  });
});
