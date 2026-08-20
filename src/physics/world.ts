/**
 * 物理世界封装。整个项目只有 physics/ 目录 import planck。
 * 坐标系：米制，y 轴向上（渲染层负责翻转）。
 */
import { World, Vec2, Edge } from 'planck';
import { tuning } from '../game/tuning';

export const FIXED_DT = 1 / 60;
const VELOCITY_ITERATIONS = 8;
const POSITION_ITERATIONS = 3;

/** 碰撞组：每个玩家一个负 groupIndex（同组永不互撞），0 号玩家 = -1 */
export function playerGroup(playerIndex: number): number {
  return -(playerIndex + 1);
}

export function createWorld(): World {
  return new World(new Vec2(0, tuning.gravityY));
}

/** dt 默认固定步长；慢动作时传入缩放后的更小步长（仍是确定性子步） */
export function stepWorld(world: World, dt: number = FIXED_DT): void {
  world.step(dt, VELOCITY_ITERATIONS, POSITION_ITERATIONS);
}

export interface GroundSpec {
  /** 地面 y 坐标 */
  y: number;
  /** 左右边界 x */
  halfWidth: number;
}

/** M1 原型地面：一条静态边 + 两侧挡墙 */
export function createGround(world: World, spec: GroundSpec = { y: 0, halfWidth: 12 }): void {
  const ground = world.createBody({ type: 'static' });
  const { y, halfWidth: hw } = spec;
  const friction = 0.8;
  ground.createFixture({ shape: new Edge(new Vec2(-hw, y), new Vec2(hw, y)), friction });
  ground.createFixture({ shape: new Edge(new Vec2(-hw, y), new Vec2(-hw, y + 8)), friction });
  ground.createFixture({ shape: new Edge(new Vec2(hw, y), new Vec2(hw, y + 8)), friction });
}
