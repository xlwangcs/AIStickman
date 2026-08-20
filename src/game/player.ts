/**
 * 玩家：血量、存活状态、所属 ragdoll。输入意图由 Game 转发。
 */
import { Vec2, type World } from 'planck';
import { Ragdoll } from '../physics/ragdoll';
import { tuning } from './tuning';

export class Player {
  hp = tuning.maxHp;
  alive = true;
  ragdoll: Ragdoll;

  constructor(
    readonly index: number,
    world: World,
    spawnX: number,
    facing: 1 | -1,
  ) {
    this.ragdoll = new Ragdoll(world, { playerIndex: index, x: spawnX, y: 0, facing });
  }

  /** 受击：扣血 + 击退 + 硬直；血量归零则死亡（布娃娃） */
  takeHit(damage: number, impulse: Vec2, point: Vec2): void {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - damage);
    this.ragdoll.applyHit(impulse, point);
    if (this.hp <= 0) this.die();
  }

  die(): void {
    if (!this.alive) return;
    this.alive = false;
    this.ragdoll.kill();
  }

  /** 回合重置：销毁旧躯体，在出生点重建 */
  respawn(world: World, spawnX: number, facing: 1 | -1): void {
    this.ragdoll.destroy();
    this.ragdoll = new Ragdoll(world, { playerIndex: this.index, x: spawnX, y: 0, facing });
    this.hp = tuning.maxHp;
    this.alive = true;
  }
}
