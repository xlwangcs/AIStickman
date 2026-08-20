/**
 * 对局状态机与回合规则（M2 核心）。
 *
 *   countdown(3,2,1) → fighting → roundEnd(慢动作+计分) → {countdown | matchEnd}
 *
 * Game 不做任何渲染；渲染层只读它的公开状态。
 */
import { Vec2, type World } from 'planck';
import { createWorld, createGround, stepWorld, type GroundSpec } from '../physics/world';
import { ContactListener } from '../physics/contacts';
import type { PlayerIntent } from '../core/input';
import { neutralIntent } from '../core/input';
import { computeDamage, knockbackMagnitude } from './damage';
import { Player } from './player';
import { tuning } from './tuning';

export type Phase =
  | { kind: 'countdown'; secondsLeft: number }
  | { kind: 'fighting' }
  | { kind: 'roundEnd'; winner: number; secondsLeft: number }
  | { kind: 'matchEnd'; winner: number };

export interface GameOptions {
  ground?: GroundSpec;
  scoreToWin?: number;
}

const SPAWN_OFFSET = 3;

export class Game {
  readonly world: World;
  readonly players: [Player, Player];
  readonly scores: [number, number] = [0, 0];
  readonly ground: GroundSpec;
  phase: Phase;
  /** 慢动作剩余毫秒（击杀特写） */
  private slowmoLeftMs = 0;
  /** 屏幕震动强度（渲染层每帧读取并衰减） */
  shake = 0;
  /** 最近一次命中点（特效/音效钩子，M5 使用） */
  lastHit: { x: number; y: number; damage: number } | null = null;

  private readonly contacts: ContactListener;
  private readonly scoreToWin: number;
  /** 命中冷却 key = "attacker->target"，值 = 剩余毫秒 */
  private readonly hitCooldowns = new Map<string, number>();

  constructor(opts: GameOptions = {}) {
    this.ground = opts.ground ?? { y: 0, halfWidth: 12 };
    this.scoreToWin = opts.scoreToWin ?? tuning.scoreToWin;
    this.world = createWorld();
    createGround(this.world, this.ground);
    this.contacts = new ContactListener(this.world);
    this.players = [
      new Player(0, this.world, -SPAWN_OFFSET, 1),
      new Player(1, this.world, SPAWN_OFFSET, -1),
    ];
    this.phase = { kind: 'countdown', secondsLeft: tuning.countdownSec };
  }

  /** 当前时间缩放（慢动作） */
  get timeScale(): number {
    return this.slowmoLeftMs > 0 ? tuning.slowmoScale : 1;
  }

  update(dt: number, intents: [PlayerIntent, PlayerIntent]): void {
    const scale = this.timeScale;
    const stepDt = dt * scale;
    this.slowmoLeftMs = Math.max(0, this.slowmoLeftMs - dt * 1000);
    this.shake = Math.max(0, this.shake - dt * 10);

    // 冷却计时
    for (const [key, left] of this.hitCooldowns) {
      const next = left - stepDt * 1000;
      if (next <= 0) this.hitCooldowns.delete(key);
      else this.hitCooldowns.set(key, next);
    }

    switch (this.phase.kind) {
      case 'countdown': {
        // 倒计时期间锁操作，角色保持站立
        this.stepPhysics(stepDt, [neutralIntent(), neutralIntent()]);
        this.phase.secondsLeft -= dt;
        if (this.phase.secondsLeft <= 0) this.phase = { kind: 'fighting' };
        break;
      }
      case 'fighting': {
        this.stepPhysics(stepDt, intents);
        this.processHits();
        this.checkDeaths();
        break;
      }
      case 'roundEnd': {
        // 布娃娃继续飞，胜者仍可操作
        this.stepPhysics(stepDt, intents);
        this.phase.secondsLeft -= dt;
        if (this.phase.secondsLeft <= 0) this.nextRoundOrEnd(this.phase.winner);
        break;
      }
      case 'matchEnd': {
        this.stepPhysics(stepDt, intents);
        break;
      }
    }
  }

  private stepPhysics(stepDt: number, intents: [PlayerIntent, PlayerIntent]): void {
    this.players[0].ragdoll.update(intents[0], stepDt);
    this.players[1].ragdoll.update(intents[1], stepDt);
    stepWorld(this.world, stepDt);
  }

  private processHits(): void {
    for (const hit of this.contacts.drain()) {
      if (this.phase.kind !== 'fighting') break;
      const attacker = this.players[hit.attacker];
      const target = this.players[hit.target];
      if (!attacker || !target || !attacker.alive || !target.alive) continue;

      const key = `${hit.attacker}->${hit.target}`;
      if (this.hitCooldowns.has(key)) continue;

      const damage = computeDamage({
        baseDamage: tuning.spearBaseDamage,
        relSpeed: hit.relSpeed,
        part: hit.part,
      });
      if (damage <= 0) continue;

      this.hitCooldowns.set(key, tuning.hitCooldownMs);
      const mag = knockbackMagnitude(damage);
      const impulse = new Vec2(hit.dir.x * mag, hit.dir.y * mag);
      const point = new Vec2(hit.point.x, hit.point.y);
      target.takeHit(damage, impulse, point);
      this.lastHit = { x: hit.point.x, y: hit.point.y, damage };
      this.shake = Math.min(1, this.shake + damage / 60);
    }
    // 非战斗阶段产生的事件直接丢弃
    this.contacts.clear();
  }

  private checkDeaths(): void {
    const dead0 = !this.players[0].alive;
    const dead1 = !this.players[1].alive;
    if (!dead0 && !dead1) return;
    // 同帧双杀判平：双方各得一分（极罕见）
    const winner = dead0 && dead1 ? -1 : dead0 ? 1 : 0;
    if (winner >= 0) this.scores[winner as 0 | 1]++;
    else {
      this.scores[0]++;
      this.scores[1]++;
    }
    this.slowmoLeftMs = tuning.slowmoMs;
    this.shake = 1;
    this.phase = { kind: 'roundEnd', winner, secondsLeft: tuning.roundEndSec };
  }

  private nextRoundOrEnd(lastWinner: number): void {
    const s0 = this.scores[0];
    const s1 = this.scores[1];
    if (s0 >= this.scoreToWin || s1 >= this.scoreToWin) {
      const winner = s0 === s1 ? lastWinner : s0 > s1 ? 0 : 1;
      this.phase = { kind: 'matchEnd', winner };
      return;
    }
    this.players[0].respawn(this.world, -SPAWN_OFFSET, 1);
    this.players[1].respawn(this.world, SPAWN_OFFSET, -1);
    this.hitCooldowns.clear();
    this.contacts.clear();
    this.phase = { kind: 'countdown', secondsLeft: tuning.countdownSec };
  }
}
