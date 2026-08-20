/**
 * 由刚体位姿绘制火柴人。渲染层只读物理状态，绝不写。
 * ctx 已被 renderer 设置为世界坐标系（米制、y 向上），线宽用米。
 */
import { Vec2 } from 'planck';
import type { Ragdoll } from '../physics/ragdoll';
import { tuning } from '../game/tuning';

const LIMB_WIDTH = 0.07;
const LEG_UPPER = 0.28;
const LEG_LOWER = 0.3;

export interface StickmanStyle {
  color: string;
  headColor?: string;
}

/** 两段式腿 IK：给定髋/脚/两段长度，求膝盖位置（向 bendDir 弯） */
function solveKnee(hip: Vec2, foot: Vec2, l1: number, l2: number, bendDir: number): Vec2 {
  const dx = foot.x - hip.x;
  const dy = foot.y - hip.y;
  let d = Math.hypot(dx, dy);
  const maxD = l1 + l2 - 0.01;
  if (d > maxD) d = maxD;
  if (d < 0.01) d = 0.01;
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const ux = dx / d;
  const uy = dy / d;
  // 垂直方向取 bendDir 侧
  return new Vec2(hip.x + a * ux - h * uy * bendDir, hip.y + a * uy + h * ux * bendDir);
}

function stroke(ctx: CanvasRenderingContext2D, points: Vec2[], width: number, color: string): void {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const first = points[0];
  if (!first) return;
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p) ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
}

export function drawStickman(
  ctx: CanvasRenderingContext2D,
  r: Ragdoll,
  style: StickmanStyle,
): void {
  const t = tuning;
  const torsoTop = r.torso.getWorldPoint(new Vec2(0, t.torsoHalfHeight));
  const torsoBottom = r.torso.getWorldPoint(new Vec2(0, -t.torsoHalfHeight));
  const shoulder = r.torso.getWorldPoint(new Vec2(0, t.torsoHalfHeight * 0.6));
  const hand = r.arm.getWorldPoint(new Vec2(0.22, 0));
  const headPos = r.head.getPosition();
  const wheelPos = r.wheel.getPosition();

  // —— 腿（程序化摆动动画，非物理）——
  const swing = Math.sin(r.walkPhase);
  const speed = Math.abs(r.wheel.getLinearVelocity().x);
  const amp = Math.min(0.22, speed * 0.045);
  const hip = torsoBottom;
  for (const side of [1, -1] as const) {
    const footX = wheelPos.x + swing * amp * side;
    const footLift = side * swing > 0 ? Math.min(0.1, speed * 0.02) : 0;
    const foot = new Vec2(footX, wheelPos.y - t.wheelRadius * 0.85 + footLift);
    const knee = solveKnee(hip, foot, LEG_UPPER, LEG_LOWER, r.facing);
    stroke(ctx, [hip, knee, foot], LIMB_WIDTH, style.color);
  }

  // —— 躯干 ——
  stroke(ctx, [torsoTop, torsoBottom], LIMB_WIDTH * 1.15, style.color);

  // —— 手臂 ——
  stroke(ctx, [shoulder, hand], LIMB_WIDTH, style.color);

  // —— 头 ——
  ctx.beginPath();
  ctx.fillStyle = style.headColor ?? style.color;
  ctx.arc(headPos.x, headPos.y, t.headRadius, 0, Math.PI * 2);
  ctx.fill();

  // —— 长矛 ——
  const tail = r.spear.getWorldPoint(new Vec2(-t.spearLength / 2, 0));
  const tip = r.spear.getWorldPoint(new Vec2(t.spearLength / 2, 0));
  stroke(ctx, [tail, tip], 0.045, '#c9a86a');
  // 矛头
  const angle = Math.atan2(tip.y - tail.y, tip.x - tail.x);
  ctx.beginPath();
  ctx.fillStyle = '#d8dee9';
  ctx.moveTo(tip.x + Math.cos(angle) * 0.12, tip.y + Math.sin(angle) * 0.12);
  ctx.lineTo(tip.x + Math.cos(angle + 2.5) * 0.07, tip.y + Math.sin(angle + 2.5) * 0.07);
  ctx.lineTo(tip.x + Math.cos(angle - 2.5) * 0.07, tip.y + Math.sin(angle - 2.5) * 0.07);
  ctx.closePath();
  ctx.fill();
}

/** 调试：画矛尖速度矢量（手感调参时开启） */
export function drawSpearDebug(ctx: CanvasRenderingContext2D, r: Ragdoll): void {
  const tip = r.getSpearTip();
  const v = r.getSpearTipVelocity();
  const speed = Math.hypot(v.x, v.y);
  ctx.beginPath();
  ctx.strokeStyle = speed > 8 ? '#ff5555' : '#55ff88';
  ctx.lineWidth = 0.03;
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(tip.x + v.x * 0.12, tip.y + v.y * 0.12);
  ctx.stroke();
}
