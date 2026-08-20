/**
 * 无头对局回归测试：两个固定种子的随机机器人互殴。
 * 断言的是"性质"：能分出胜负、无 NaN、角色不飞出世界、比分合法。
 */
import { describe, it, expect } from 'vitest';
import { Game } from '../src/game/game';
import { Rng } from '../src/core/rng';
import type { PlayerIntent } from '../src/core/input';
import { FIXED_DT } from '../src/physics/world';

/** 随机意图机器人：每 ~0.25s 换一次输入，偏向朝对手方向移动 */
class RandomBot {
  private intent: PlayerIntent = { move: { x: 0, y: 0 }, jump: false };
  private framesLeft = 0;

  constructor(
    private readonly rng: Rng,
    private readonly index: 0 | 1,
  ) {}

  sample(game: Game): PlayerIntent {
    if (this.framesLeft-- <= 0) {
      this.framesLeft = this.rng.int(8, 20);
      const self = game.players[this.index].ragdoll.torso.getPosition();
      const other = game.players[this.index === 0 ? 1 : 0].ragdoll.torso.getPosition();
      const toward = Math.sign(other.x - self.x) || 1;
      // 70% 朝对手冲，30% 随机
      const x = this.rng.next() < 0.7 ? toward : this.rng.range(-1, 1);
      this.intent = {
        move: { x, y: this.rng.range(-1, 1) },
        jump: this.rng.next() < 0.15,
      };
    }
    return this.intent;
  }
}

function assertFinite(game: Game): void {
  for (const p of game.players) {
    const pos = p.ragdoll.torso.getPosition();
    expect(Number.isFinite(pos.x)).toBe(true);
    expect(Number.isFinite(pos.y)).toBe(true);
    expect(Math.abs(pos.x)).toBeLessThan(game.ground.halfWidth + 2);
    expect(pos.y).toBeGreaterThan(game.ground.y - 2);
    expect(pos.y).toBeLessThan(30);
  }
}

describe('无头对局回归', () => {
  it('两个随机机器人打满一场（先到 2 分），流程完整、物理不发散', { timeout: 60000 }, () => {
    const game = new Game({ scoreToWin: 2 });
    const bots = [new RandomBot(new Rng(1234), 0), new RandomBot(new Rng(5678), 1)] as const;

    const maxFrames = 60 * 240; // 最多模拟 4 分钟
    let frames = 0;
    let sawFighting = false;
    let sawRoundEnd = false;

    while (game.phase.kind !== 'matchEnd' && frames < maxFrames) {
      game.update(FIXED_DT, [bots[0].sample(game), bots[1].sample(game)]);
      if (game.phase.kind === 'fighting') sawFighting = true;
      if (game.phase.kind === 'roundEnd') sawRoundEnd = true;
      if (frames % 120 === 0) assertFinite(game);
      frames++;
    }

    expect(sawFighting).toBe(true);
    expect(sawRoundEnd).toBe(true);
    expect(game.phase.kind).toBe('matchEnd');
    const [s0, s1] = game.scores;
    expect(Math.max(s0, s1)).toBeGreaterThanOrEqual(2);
    expect(s0 + s1).toBeGreaterThanOrEqual(2);
    assertFinite(game);
  });

  it('近身甩矛能造成伤害（命中管线连通）', { timeout: 20000 }, () => {
    // 缩小场地让双方必然接触
    const game = new Game({ ground: { y: 0, halfWidth: 4 }, scoreToWin: 5 });
    // 跳过倒计时
    while (game.phase.kind === 'countdown') {
      game.update(FIXED_DT, [
        { move: { x: 0, y: 0 }, jump: false },
        { move: { x: 0, y: 0 }, jump: false },
      ]);
    }
    // P1 逼近到射程内后停步甩矛；P2 站桩
    let frames = 0;
    const maxFrames = 60 * 30;
    while (game.players[1].hp >= 100 && frames < maxFrames && game.phase.kind === 'fighting') {
      const dist =
        game.players[1].ragdoll.torso.getPosition().x -
        game.players[0].ragdoll.torso.getPosition().x;
      const swing = Math.floor(frames / 8) % 2 === 0 ? 1 : -1;
      const intent1 =
        Math.abs(dist) > 1.7
          ? { move: { x: Math.sign(dist), y: 0 }, jump: false }
          : { move: { x: Math.sign(dist) * 0.2, y: swing }, jump: false };
      game.update(FIXED_DT, [intent1, { move: { x: 0, y: 0 }, jump: false }]);
      frames++;
    }
    expect(game.players[1].hp).toBeLessThan(100);
  });
});
