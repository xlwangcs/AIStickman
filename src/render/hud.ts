/**
 * HUD：血条、比分、阶段提示。只读 Game 状态，屏幕坐标绘制。
 */
import type { Game } from '../game/game';
import { tuning } from '../game/tuning';

const P_COLORS = ['#e33e3e', '#3e6fe3'];

export function drawHud(
  ctx: CanvasRenderingContext2D,
  game: Game,
  w: number,
  h: number,
  dpr: number,
): void {
  const barW = Math.min(w * 0.35, 420 * dpr);
  const barH = 16 * dpr;
  const margin = 16 * dpr;

  for (const i of [0, 1] as const) {
    const player = game.players[i];
    const x = i === 0 ? margin : w - margin - barW;
    const y = margin;
    // 底
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x, y, barW, barH);
    // 血量（P1 从左往右，P2 从右往左收缩）
    const ratio = Math.max(0, player.hp / tuning.maxHp);
    const fillW = barW * ratio;
    ctx.fillStyle = P_COLORS[i] ?? '#fff';
    ctx.fillRect(i === 0 ? x : x + barW - fillW, y, fillW, barH);
    // 比分圆点
    const score = game.scores[i];
    const dotR = 5 * dpr;
    for (let s = 0; s < tuning.scoreToWin; s++) {
      const dx = i === 0 ? x + dotR + s * dotR * 2.8 : x + barW - dotR - s * dotR * 2.8;
      const dy = y + barH + dotR + 6 * dpr;
      ctx.beginPath();
      ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
      ctx.fillStyle = s < score ? (P_COLORS[i] ?? '#fff') : 'rgba(255,255,255,0.2)';
      ctx.fill();
    }
  }

  // —— 阶段提示 ——
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const big = `bold ${Math.round(64 * dpr)}px system-ui, sans-serif`;
  const mid = `bold ${Math.round(36 * dpr)}px system-ui, sans-serif`;
  const phase = game.phase;
  if (phase.kind === 'countdown') {
    const n = Math.ceil(phase.secondsLeft);
    ctx.font = big;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(n > 0 ? String(n) : 'GO!', w / 2, h * 0.3);
  } else if (phase.kind === 'roundEnd') {
    ctx.font = mid;
    if (phase.winner >= 0) {
      ctx.fillStyle = P_COLORS[phase.winner] ?? '#fff';
      ctx.fillText(`P${phase.winner + 1} 得分!`, w / 2, h * 0.3);
    } else {
      ctx.fillStyle = '#fff';
      ctx.fillText('同归于尽!', w / 2, h * 0.3);
    }
  } else if (phase.kind === 'matchEnd') {
    ctx.font = big;
    ctx.fillStyle = P_COLORS[phase.winner] ?? '#fff';
    ctx.fillText(`P${phase.winner + 1} 获胜!`, w / 2, h * 0.3);
    ctx.font = `${Math.round(18 * dpr)}px monospace`;
    ctx.fillStyle = '#cdd3e0';
    ctx.fillText('按 R 重新开始', w / 2, h * 0.3 + 60 * dpr);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}
