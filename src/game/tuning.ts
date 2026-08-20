/**
 * 全部手感参数集中在此文件。调参面板直接读写这个对象。
 * 任何魔法数字不允许散落在物理/游戏代码里。
 * 单位：米、秒、弧度（物理世界 y 轴向上）。
 */
export const tuning = {
  // —— 世界 ——
  /** 重力（负值向下）。比真实略强，落地更干脆 */
  gravityY: -24,

  // —— 站立（PD 扶正控制器） ——
  // 注意：增益必须与刚体惯量匹配（质量见 bodyDensity），否则离散积分发散
  /** 角度误差增益。必须在任意倾角都压过重力倾覆力矩（~140 N·m @90°），否则会出现"稳定斜靠"平衡点 */
  balanceKp: 320,
  /** 角速度阻尼增益 */
  balanceKd: 22,
  /** 受击失衡窗口（毫秒）：期间所有马达失效 */
  stunMs: 450,
  /** 躯干倾斜超过此角度视为跌倒（手臂卸力，防武器撑地死锁） */
  fallenAngle: 0.9,

  // —— 移动 ——
  /** 地面移动目标速度 */
  moveSpeed: 6,
  /** 轮足马达最大扭矩 */
  wheelTorque: 100,
  /** 跳跃冲量（作用于全身质量） */
  jumpImpulse: 8.2,
  /** 空中水平操控力 */
  airControl: 10,
  /** 两次跳跃最小间隔（毫秒） */
  jumpCooldownMs: 250,

  // —— 手臂/武器控制 ——
  /** 手臂马达最大角速度 rad/s（决定甩击的最高挥速） */
  armMaxSpeed: 22,
  /** 手臂马达最大扭矩（决定甩重武器的"力量"） */
  armTorque: 120,
  /** 角度误差 → 马达速度的增益（越大越"跟手"） */
  armTrackGain: 14,
  /** 无输入时手臂的休息角度（相对面朝方向，弧度）。注意：过陡会让矛尖戳地"撑杆跳" */
  armRestAngle: -0.35,

  // —— 稳定性护栏 ——
  /** 刚体最大线速度（防物理发散） */
  maxLinearSpeed: 30,
  /** 刚体最大角速度 */
  maxAngularSpeed: 25,

  // —— 战斗 ——
  maxHp: 100,
  /** 低于此相对速度的接触不造成伤害（推挤/轻碰） */
  hitMinSpeed: 4,
  /** 达到此相对速度时伤害拉满 */
  hitRefSpeed: 13,
  /** 同一攻击者对同一目标的判伤冷却（毫秒） */
  hitCooldownMs: 250,
  /** 每点伤害对应的击退冲量（N·s） */
  knockbackPerDamage: 1.6,
  /** 部位伤害系数 */
  partMultHead: 1.5,
  partMultTorso: 1.0,
  partMultLimb: 0.6,
  /** 击杀慢动作时长（毫秒）与时间缩放 */
  slowmoMs: 700,
  slowmoScale: 0.3,
  /** 回合流程（秒） */
  countdownSec: 3,
  roundEndSec: 2.5,
  scoreToWin: 5,

  // —— 长矛 ——
  spearLength: 1.5,
  spearDensity: 25,
  spearBaseDamage: 34,
  /** 握持点距矛尾的比例（0=尾 0.5=中点） */
  spearGrip: 0.3,

  // —— 身体尺寸/质量 ——
  headRadius: 0.14,
  torsoHalfHeight: 0.3,
  torsoHalfWidth: 0.08,
  wheelRadius: 0.18,
  /** 基础密度 kg/m²。全身合计约 25kg，所有扭矩/冲量参数都按此质量标定 */
  bodyDensity: 60,
  wheelFriction: 4,
};

export type Tuning = typeof tuning;
