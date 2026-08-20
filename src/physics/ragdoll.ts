/**
 * 火柴人刚体装配与驱动（本项目最核心的文件）。
 *
 * 结构（自下而上）：
 *   wheel（圆形"轮足"，马达驱动移动）
 *     └─ RevoluteJoint(马达) ─ torso（躯干，PD 扶正）
 *          ├─ RevoluteJoint(±25° 限位) ─ head
 *          └─ RevoluteJoint(无限位+马达) ─ arm ─ WeldJoint ─ spear
 *
 * 没有攻击键：手臂马达追踪摇杆方向，摇杆快速反向 → 角度误差大 →
 * 马达全速 → 武器高速甩动。伤害（M2）将来自武器相对速度。
 */
import { Vec2, Circle, Box, RevoluteJoint, WeldJoint, type Body, type World } from 'planck';
import type { PlayerIntent } from '../core/input';
import { tuning } from '../game/tuning';
import { playerGroup } from './world';
import { BalanceController, wrapAngle } from './balance';

export interface RagdollOptions {
  playerIndex: number;
  /** 出生点（轮足触地点） */
  x: number;
  y: number;
  /** 初始面朝方向：1 右 / -1 左 */
  facing?: 1 | -1;
}

export class Ragdoll {
  readonly playerIndex: number;
  readonly wheel: Body;
  readonly torso: Body;
  readonly head: Body;
  readonly arm: Body;
  readonly spear: Body;
  readonly balance = new BalanceController();

  private readonly wheelJoint: RevoluteJoint;
  private readonly shoulderJoint: RevoluteJoint;

  /** 面朝方向（无输入时手臂休息姿态用） */
  facing: 1 | -1 = 1;
  /** 最后一次非零瞄准角度 */
  private aimAngle: number;
  private jumpCooldownMs = 0;
  private prevJump = false;
  /** 累计移动相位，渲染层画摆腿动画用 */
  walkPhase = 0;

  constructor(
    readonly world: World,
    opts: RagdollOptions,
  ) {
    this.playerIndex = opts.playerIndex;
    this.facing = opts.facing ?? 1;
    this.aimAngle = this.facing > 0 ? 0 : Math.PI;

    const t = tuning;
    const group = playerGroup(opts.playerIndex);
    const { x, y } = opts;

    // —— 尺寸布局（y 向上）——
    const wheelY = y + t.wheelRadius;
    const torsoY = wheelY + t.wheelRadius * 0.4 + t.torsoHalfHeight;
    const neckY = torsoY + t.torsoHalfHeight;
    const headY = neckY + t.headRadius * 0.9;
    const shoulderY = torsoY + t.torsoHalfHeight * 0.6;
    const armHalfLen = 0.22;

    // —— 轮足 ——
    this.wheel = world.createBody({ type: 'dynamic', position: new Vec2(x, wheelY) });
    this.wheel.createFixture({
      shape: new Circle(t.wheelRadius),
      density: t.bodyDensity * 2,
      friction: t.wheelFriction,
      filterGroupIndex: group,
    });

    // —— 躯干 ——
    this.torso = world.createBody({ type: 'dynamic', position: new Vec2(x, torsoY) });
    this.torso.createFixture({
      shape: new Box(t.torsoHalfWidth, t.torsoHalfHeight),
      density: t.bodyDensity,
      friction: 0.3,
      filterGroupIndex: group,
    });

    // —— 头 ——
    this.head = world.createBody({ type: 'dynamic', position: new Vec2(x, headY) });
    this.head.createFixture({
      shape: new Circle(t.headRadius),
      density: t.bodyDensity * 0.8,
      friction: 0.3,
      filterGroupIndex: group,
    });

    // —— 手臂（初始水平指向面朝方向）——
    const armCenterX = x + this.facing * armHalfLen;
    this.arm = world.createBody({
      type: 'dynamic',
      position: new Vec2(armCenterX, shoulderY),
      angle: this.facing > 0 ? 0 : Math.PI,
    });
    this.arm.createFixture({
      shape: new Box(armHalfLen, 0.035),
      density: t.bodyDensity * 0.7,
      friction: 0.3,
      filterGroupIndex: group,
    });

    // —— 长矛（焊在手上；bullet 开启 CCD 防高速穿透）——
    const handX = x + this.facing * armHalfLen * 2;
    const gripOffset = (0.5 - t.spearGrip) * t.spearLength;
    const spearCenterX = handX + this.facing * gripOffset;
    this.spear = world.createBody({
      type: 'dynamic',
      position: new Vec2(spearCenterX, shoulderY),
      angle: this.facing > 0 ? 0 : Math.PI,
      bullet: true,
    });
    this.spear.createFixture({
      shape: new Box(t.spearLength / 2, 0.025),
      density: t.spearDensity,
      friction: 0.2,
      filterGroupIndex: group,
    });

    // —— 关节 ——
    this.wheelJoint = world.createJoint(
      new RevoluteJoint(
        { enableMotor: true, maxMotorTorque: t.wheelTorque, motorSpeed: 0 },
        this.torso,
        this.wheel,
        this.wheel.getPosition(),
      ),
    )!;

    world.createJoint(
      new RevoluteJoint(
        { enableLimit: true, lowerAngle: -0.45, upperAngle: 0.45 },
        this.torso,
        this.head,
        new Vec2(x, neckY),
      ),
    );

    this.shoulderJoint = world.createJoint(
      new RevoluteJoint(
        { enableMotor: true, maxMotorTorque: t.armTorque, motorSpeed: 0 },
        this.torso,
        this.arm,
        new Vec2(x, shoulderY),
      ),
    )!;

    world.createJoint(new WeldJoint({}, this.arm, this.spear, new Vec2(handX, shoulderY)));
  }

  /** 轮足是否接触地面（法线朝上的有效接触） */
  isGrounded(): boolean {
    for (let ce = this.wheel.getContactList(); ce; ce = ce.next) {
      const contact = ce.contact;
      if (!contact.isTouching()) continue;
      const manifold = contact.getWorldManifold(null);
      if (!manifold) continue;
      // 法线方向依赖 fixture 顺序，取 y 分量绝对值近似"站在东西上"
      if (Math.abs(manifold.normal.y) > 0.5) return true;
    }
    return false;
  }

  /** 每个物理步调用一次 */
  update(intent: PlayerIntent, dt: number): void {
    const t = tuning;
    this.jumpCooldownMs = Math.max(0, this.jumpCooldownMs - dt * 1000);

    const stunned = this.balance.stunned;
    this.balance.update(this.torso, dt);

    const move = intent.move;
    const moveLen = Math.hypot(move.x, move.y);
    const grounded = this.isGrounded();

    // —— 移动：轮足马达 ——
    if (!stunned) {
      const targetVx = move.x * t.moveSpeed;
      // 轮子向前滚 = 顺时针 = 负角速度（y 向上坐标系）
      this.wheelJoint.setMotorSpeed(-targetVx / t.wheelRadius);
      this.wheelJoint.setMaxMotorTorque(t.wheelTorque);
      if (!grounded && Math.abs(move.x) > 0.1) {
        this.torso.applyForceToCenter(new Vec2(move.x * t.airControl, 0), true);
      }
    } else {
      this.wheelJoint.setMotorSpeed(0);
      this.wheelJoint.setMaxMotorTorque(0);
    }

    // —— 跳跃（边沿触发）——
    const jumpPressed = intent.jump && !this.prevJump;
    this.prevJump = intent.jump;
    if (jumpPressed && grounded && !stunned && this.jumpCooldownMs <= 0) {
      const mass =
        this.wheel.getMass() +
        this.torso.getMass() +
        this.head.getMass() +
        this.arm.getMass() +
        this.spear.getMass();
      const impulse = new Vec2(0, t.jumpImpulse * mass);
      this.torso.applyLinearImpulse(impulse, this.torso.getWorldCenter(), true);
      this.jumpCooldownMs = t.jumpCooldownMs;
    }

    // —— 手臂追踪瞄准方向 ——
    if (moveLen > 0.15) {
      this.aimAngle = Math.atan2(move.y, move.x);
      if (Math.abs(move.x) > 0.2) this.facing = move.x > 0 ? 1 : -1;
    } else {
      // 无输入 → 手臂回到休息角度
      this.aimAngle = this.facing > 0 ? t.armRestAngle : Math.PI - t.armRestAngle;
    }

    // 跌倒状态（躯干大幅倾斜）手臂卸力：否则武器会像撑脚架一样刚性撑住身体，
    // 让 PD 扶正力矩永远无法把人拉起来。
    const fallen = Math.abs(wrapAngle(this.torso.getAngle())) > 0.5;
    if (!stunned) {
      const err = wrapAngle(this.aimAngle - this.arm.getAngle());
      const speed = Math.max(-t.armMaxSpeed, Math.min(t.armMaxSpeed, t.armTrackGain * err));
      this.shoulderJoint.setMotorSpeed(speed);
      this.shoulderJoint.setMaxMotorTorque(fallen ? t.armTorque * 0.1 : t.armTorque);
    } else {
      this.shoulderJoint.setMotorSpeed(0);
      this.shoulderJoint.setMaxMotorTorque(0);
    }

    // —— 渲染用摆腿相位 ——
    if (grounded) {
      this.walkPhase += this.wheel.getLinearVelocity().x * dt * 3.2;
    }

    this.clampVelocities();
  }

  /** 稳定性护栏：限制所有刚体的最大线速度/角速度，防止马达+关节组合发散 */
  private clampVelocities(): void {
    const t = tuning;
    for (const body of [this.wheel, this.torso, this.head, this.arm, this.spear]) {
      const v = body.getLinearVelocity();
      const speed = Math.hypot(v.x, v.y);
      if (speed > t.maxLinearSpeed) {
        const k = t.maxLinearSpeed / speed;
        body.setLinearVelocity(new Vec2(v.x * k, v.y * k));
      }
      const w = body.getAngularVelocity();
      if (Math.abs(w) > t.maxAngularSpeed) {
        body.setAngularVelocity(Math.sign(w) * t.maxAngularSpeed);
      }
    }
  }

  /** 矛尖世界坐标（调试可视化 & M2 伤害判定用） */
  getSpearTip(): Vec2 {
    const t = tuning;
    return this.spear.getWorldPoint(new Vec2(t.spearLength / 2, 0));
  }

  /** 矛尖世界速度 */
  getSpearTipVelocity(): Vec2 {
    return this.spear.getLinearVelocityFromWorldPoint(this.getSpearTip());
  }

  /** 受击/测试用：施加冲量并进入失衡窗口 */
  applyHit(impulse: Vec2, point: Vec2): void {
    this.balance.stun();
    this.torso.applyLinearImpulse(impulse, point, true);
  }
}
