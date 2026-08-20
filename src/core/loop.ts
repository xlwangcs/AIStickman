/**
 * 固定时间步主循环（accumulator 模式）。
 * 物理永远以 FIXED_DT 步进，渲染每帧一次并携带插值系数 alpha。
 * 保证不同刷新率设备上手感一致，也让无头测试与真实运行行为一致。
 */
export const FIXED_DT = 1 / 60;

/** 单帧真实耗时上限（秒）。超过则丢弃多余时间，防止后台切回时的"死亡螺旋"。 */
const MAX_FRAME_TIME = 0.25;

export interface LoopCallbacks {
  /** 固定步长更新，dt 恒等于 FIXED_DT */
  update(dt: number): void;
  /** 每显示帧调用一次。alpha ∈ [0,1) 为距下一物理步的插值比例 */
  render(alpha: number, fps: number): void;
}

export class GameLoop {
  private running = false;
  private lastTime = 0;
  private accumulator = 0;
  private fps = 0;
  private fpsCounter = 0;
  private fpsTimer = 0;

  constructor(private readonly callbacks: LoopCallbacks) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    let frameTime = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (frameTime > MAX_FRAME_TIME) frameTime = MAX_FRAME_TIME;

    this.fpsTimer += frameTime;
    this.fpsCounter++;
    if (this.fpsTimer >= 0.5) {
      this.fps = Math.round(this.fpsCounter / this.fpsTimer);
      this.fpsCounter = 0;
      this.fpsTimer = 0;
    }

    this.accumulator += frameTime;
    while (this.accumulator >= FIXED_DT) {
      this.callbacks.update(FIXED_DT);
      this.accumulator -= FIXED_DT;
    }

    this.callbacks.render(this.accumulator / FIXED_DT, this.fps);
    requestAnimationFrame(this.frame);
  };
}
