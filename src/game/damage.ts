/**
 * 伤害公式（纯函数，无状态、无物理依赖，重点单测对象）。
 *
 * damage = base × 速度归一(clamp01) × 部位系数
 * 击退冲量 = damage × knockbackPerDamage，方向 = 武器速度方向
 */
import type { BodyPart } from '../physics/ragdoll';
import { tuning, type Tuning } from './tuning';

export function partMultiplier(part: BodyPart, t: Tuning = tuning): number {
  switch (part) {
    case 'head':
      return t.partMultHead;
    case 'torso':
      return t.partMultTorso;
    case 'arm':
    case 'wheel':
      return t.partMultLimb;
    case 'weapon':
      return 0;
  }
}

export interface DamageInput {
  baseDamage: number;
  relSpeed: number;
  part: BodyPart;
}

/** 返回本次命中的伤害值；低于速度阈值返回 0 */
export function computeDamage(input: DamageInput, t: Tuning = tuning): number {
  if (input.relSpeed < t.hitMinSpeed) return 0;
  const span = Math.max(0.001, t.hitRefSpeed - t.hitMinSpeed);
  const scale = Math.min(1, (input.relSpeed - t.hitMinSpeed) / span);
  return input.baseDamage * scale * partMultiplier(input.part, t);
}

/** 击退冲量大小 */
export function knockbackMagnitude(damage: number, t: Tuning = tuning): number {
  return damage * t.knockbackPerDamage;
}
