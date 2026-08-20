/**
 * 渲染器：相机（跟随所有玩家中点，按间距缩放）+ 场景绘制调度。
 * 只读游戏/物理状态。屏幕坐标 y 向下，世界坐标 y 向上，用负 scale 翻转。
 */
import type { Ragdoll } from '../physics/ragdoll';
import { drawStickman, drawSpearDebug, type StickmanStyle } from './stickman-draw';

const PLAYER_STYLES: StickmanStyle[] = [
  { color: '#e33e3e' },
  { color: '#3e6fe3' },
  { color: '#3ec46a' },
  { color: '#e3b13e' },
];

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private camX = 0;
  private camY = 2;
  private ppm = 60; // pixels per meter
  debugVectors = true;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(this.canvas.clientWidth * dpr);
    this.canvas.height = Math.floor(this.canvas.clientHeight * dpr);
  }

  render(ragdolls: readonly Ragdoll[], groundY: number, groundHalfWidth: number, fps: number): void {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;

    // —— 相机：所有玩家包围盒中心 + 距离自适应缩放，平滑插值 ——
    if (ragdolls.length > 0) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const r of ragdolls) {
        const p = r.torso.getPosition();
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
      const targetX = (minX + maxX) / 2;
      const targetY = (minY + maxY) / 2 + 0.8;
      const spanX = maxX - minX + 7;
      const spanY = maxY - minY + 5;
      const targetPpm = Math.max(28, Math.min(90, Math.min(w / spanX, h / spanY)));
      const s = 0.06;
      this.camX += (targetX - this.camX) * s;
      this.camY += (targetY - this.camY) * s;
      this.ppm += (targetPpm - this.ppm) * s;
    }

    // —— 背景 ——
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1a1c22';
    ctx.fillRect(0, 0, w, h);

    // —— 世界坐标系 ——
    ctx.setTransform(this.ppm, 0, 0, -this.ppm, w / 2 - this.camX * this.ppm, h / 2 + this.camY * this.ppm);

    // 网格（轻微，提供速度感）
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 0.02;
    for (let gx = -Math.ceil(groundHalfWidth); gx <= groundHalfWidth; gx += 2) {
      ctx.beginPath();
      ctx.moveTo(gx, groundY);
      ctx.lineTo(gx, groundY + 10);
      ctx.stroke();
    }

    // 地面与挡墙
    ctx.strokeStyle = '#8a93a6';
    ctx.lineWidth = 0.08;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-groundHalfWidth, groundY);
    ctx.lineTo(groundHalfWidth, groundY);
    ctx.moveTo(-groundHalfWidth, groundY);
    ctx.lineTo(-groundHalfWidth, groundY + 8);
    ctx.moveTo(groundHalfWidth, groundY);
    ctx.lineTo(groundHalfWidth, groundY + 8);
    ctx.stroke();

    // —— 火柴人 ——
    ragdolls.forEach((r, i) => {
      drawStickman(ctx, r, PLAYER_STYLES[i % PLAYER_STYLES.length] ?? { color: '#fff' });
      if (this.debugVectors) drawSpearDebug(ctx, r);
    });

    // —— HUD ——
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#cdd3e0';
    ctx.font = `${Math.round(12 * (window.devicePixelRatio || 1))}px monospace`;
    ctx.fillText(`FPS ${fps}`, 12, 20);
    ctx.fillText('P1: WASD 移动/瞄准, F 跳 | P2: 方向键, 右Ctrl 跳 | 甩摇杆挥矛!', 12, 40);
  }
}
