/**
 * 站立控制器：对躯干施加 PD 扶正力矩，把身体拉回直立。
 * 受击后进入失衡窗口（stun），增益归零 → 自然翻滚，这是"被打踉跄"手感的来源。
 */
import type { Body } from 'planck';
import { tuning } from '../game/tuning';

/** 把角度折叠到 [-π, π] */
export function wrapAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

export class BalanceController {
  /** 剩余失衡时间（毫秒），> 0 时马达全部失效 */
  private stunLeftMs = 0;

  get stunned(): boolean {
    return this.stunLeftMs > 0;
  }

  stun(ms: number = tuning.stunMs): void {
    this.stunLeftMs = Math.max(this.stunLeftMs, ms);
  }

  /** 每个物理步调用 */
  update(torso: Body, dt: number): void {
    if (this.stunLeftMs > 0) {
      this.stunLeftMs -= dt * 1000;
      return;
    }
    const angle = wrapAngle(torso.getAngle());
    const angularVel = torso.getAngularVelocity();
    const torque = -tuning.balanceKp * angle - tuning.balanceKd * angularVel;
    torso.applyTorque(torque, true);
  }
}
