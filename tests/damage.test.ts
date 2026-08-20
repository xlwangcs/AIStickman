import { describe, it, expect } from 'vitest';
import { computeDamage, knockbackMagnitude, partMultiplier } from '../src/game/damage';
import { tuning } from '../src/game/tuning';

describe('computeDamage', () => {
  const base = { baseDamage: 30, part: 'torso' as const };

  it('低于速度阈值不造成伤害', () => {
    expect(computeDamage({ ...base, relSpeed: tuning.hitMinSpeed - 0.1 })).toBe(0);
    expect(computeDamage({ ...base, relSpeed: 0 })).toBe(0);
  });

  it('速度达到参考值时伤害拉满', () => {
    expect(computeDamage({ ...base, relSpeed: tuning.hitRefSpeed })).toBeCloseTo(30);
    // 超过参考速度不再增加
    expect(computeDamage({ ...base, relSpeed: tuning.hitRefSpeed * 2 })).toBeCloseTo(30);
  });

  it('速度在阈值与参考值之间线性插值', () => {
    const mid = (tuning.hitMinSpeed + tuning.hitRefSpeed) / 2;
    expect(computeDamage({ ...base, relSpeed: mid })).toBeCloseTo(15);
  });

  it('部位系数：头 > 躯干 > 四肢，武器为 0', () => {
    expect(partMultiplier('head')).toBeGreaterThan(partMultiplier('torso'));
    expect(partMultiplier('torso')).toBeGreaterThan(partMultiplier('arm'));
    expect(partMultiplier('weapon')).toBe(0);
    const speed = tuning.hitRefSpeed;
    expect(computeDamage({ baseDamage: 30, relSpeed: speed, part: 'head' })).toBeCloseTo(
      30 * tuning.partMultHead,
    );
  });

  it('击退与伤害成正比', () => {
    expect(knockbackMagnitude(10)).toBeCloseTo(10 * tuning.knockbackPerDamage);
    expect(knockbackMagnitude(0)).toBe(0);
  });
});
