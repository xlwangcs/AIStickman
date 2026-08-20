/**
 * 碰撞监听 → 命中事件。
 * 在 post-solve 里读取"武器 fixture × 对方身体部位"的接触，计算接触点相对速度，
 * 派发 HitEvent 队列。物理层不知道血量概念，伤害计算在 game/damage.ts。
 *
 * 注意：post-solve 期间禁止创建/销毁刚体，所以这里只入队，游戏层每步 drain()。
 */
import { WorldManifold, type Contact, type World, type Body } from 'planck';
import type { BodyPart, BodyTag } from './ragdoll';

export interface HitEvent {
  attacker: number;
  target: number;
  /** 被命中的部位 */
  part: BodyPart;
  /** 接触点相对速度（武器相对目标） */
  relSpeed: number;
  /** 接触点（世界坐标） */
  point: { x: number; y: number };
  /** 击退方向（单位向量，武器速度方向） */
  dir: { x: number; y: number };
}

export class ContactListener {
  private queue: HitEvent[] = [];

  constructor(world: World) {
    world.on('post-solve', (contact) => this.onPostSolve(contact));
  }

  /** 取走本步累计的命中事件 */
  drain(): HitEvent[] {
    if (this.queue.length === 0) return [];
    const q = this.queue;
    this.queue = [];
    return q;
  }

  clear(): void {
    this.queue = [];
  }

  private onPostSolve(contact: Contact): void {
    const bodyA = contact.getFixtureA().getBody();
    const bodyB = contact.getFixtureB().getBody();
    const tagA = bodyA.getUserData() as BodyTag | null;
    const tagB = bodyB.getUserData() as BodyTag | null;
    if (!tagA || !tagB) return;
    if (tagA.player === tagB.player) return;

    // 武器 × 对方身体（武器对武器 = 格挡，不判伤）
    if (tagA.part === 'weapon' && tagB.part !== 'weapon') {
      this.emit(bodyA, tagA, bodyB, tagB, contact);
    } else if (tagB.part === 'weapon' && tagA.part !== 'weapon') {
      this.emit(bodyB, tagB, bodyA, tagA, contact);
    }
  }

  private emit(
    weaponBody: Body,
    weaponTag: BodyTag,
    targetBody: Body,
    targetTag: BodyTag,
    contact: Contact,
  ): void {
    const manifold = new WorldManifold();
    contact.getWorldManifold(manifold);
    const point = manifold.points[0];
    if (!point) return;

    const vw = weaponBody.getLinearVelocityFromWorldPoint(point);
    const vt = targetBody.getLinearVelocityFromWorldPoint(point);
    const rx = vw.x - vt.x;
    const ry = vw.y - vt.y;
    const relSpeed = Math.hypot(rx, ry);
    if (relSpeed < 0.01) return;

    this.queue.push({
      attacker: weaponTag.player,
      target: targetTag.player,
      part: targetTag.part,
      relSpeed,
      point: { x: point.x, y: point.y },
      dir: { x: rx / relSpeed, y: ry / relSpeed },
    });
  }
}
