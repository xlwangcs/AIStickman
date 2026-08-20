/**
 * 统一输入抽象。所有控制源（键盘 / 触屏摇杆 / AI）都输出 PlayerIntent，
 * 游戏逻辑只消费 Intent，不关心来源。
 */
export interface PlayerIntent {
  /** 摇杆向量，长度 ≤ 1。同时决定移动方向与手臂/武器指向 */
  move: { x: number; y: number };
  /** 跳跃键是否按下（边沿检测由消费方处理） */
  jump: boolean;
}

export function neutralIntent(): PlayerIntent {
  return { move: { x: 0, y: 0 }, jump: false };
}

export interface IntentSource {
  /** 每个物理步调用一次，返回当前意图 */
  sample(): PlayerIntent;
}

export interface KeyBindings {
  up: string;
  down: string;
  left: string;
  right: string;
  jump: string;
}

export const P1_KEYS: KeyBindings = {
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'KeyF',
};

export const P2_KEYS: KeyBindings = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  jump: 'ControlRight',
};

/** 键盘 → PlayerIntent。四方向键合成"数字摇杆"向量并归一化。 */
export class KeyboardInput implements IntentSource {
  private readonly pressed = new Set<string>();

  constructor(
    private readonly bindings: KeyBindings,
    target: Window = window,
  ) {
    target.addEventListener('keydown', (e) => {
      this.pressed.add(e.code);
      if (this.isBound(e.code)) e.preventDefault();
    });
    target.addEventListener('keyup', (e) => this.pressed.delete(e.code));
    target.addEventListener('blur', () => this.pressed.clear());
  }

  private isBound(code: string): boolean {
    const b = this.bindings;
    return code === b.up || code === b.down || code === b.left || code === b.right || code === b.jump;
  }

  sample(): PlayerIntent {
    const b = this.bindings;
    let x = (this.pressed.has(b.right) ? 1 : 0) - (this.pressed.has(b.left) ? 1 : 0);
    let y = (this.pressed.has(b.up) ? 1 : 0) - (this.pressed.has(b.down) ? 1 : 0);
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { move: { x, y }, jump: this.pressed.has(b.jump) };
  }
}
