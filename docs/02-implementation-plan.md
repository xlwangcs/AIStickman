# 02 · 实现方案（架构设计）

> 本文档是项目的开发"宪法"：所有代码由 AI 编写，任何实现与本文冲突时，要么改代码，要么先改本文再改代码。

## 1. 技术选型与理由

| 层 | 选择 | 理由 |
| --- | --- | --- |
| 语言 | TypeScript (strict) | 类型即文档，AI 迭代时编译器兜住大部分低级错误 |
| 物理 | [Planck.js](https://piqnt.com/planck.js)（Box2D 的 JS 移植） | ragdoll 需要稳定的 RevoluteJoint + 马达 + 角度限制，Box2D 系是唯一可靠选项；Matter.js 关节过软，不适合本作 |
| 渲染 | Canvas 2D（自写渲染器） | 火柴人 = 线段 + 圆，Canvas 2D 足够且零依赖；不引入 Phaser/Pixi，减少 AI 需要理解的黑盒 |
| 构建 | Vite + pnpm | 秒级 HMR，`build` 直出静态站点，GitHub Pages 可托管 |
| 测试 | Vitest | 物理与游戏逻辑不依赖 DOM，可在 node 中跑无头模拟测试 |
| CI/CD | GitHub Actions | push → typecheck + test + build → 部署 GitHub Pages |

**明确不用的东西**：游戏引擎（Phaser/Unity/Godot）、ECS 框架、状态管理库、任何服务器。

## 2. 目录结构

```
AIStickman/
├── docs/                    # 设计文档（本目录）
├── public/                  # 静态资源（音效、图标）
├── src/
│   ├── main.ts              # 入口：装配 Game 并启动主循环
│   ├── core/                # 与游戏无关的基础设施
│   │   ├── loop.ts          # 固定时间步主循环（fixed timestep + 渲染插值）
│   │   ├── input.ts         # 统一输入层：触屏摇杆/键盘 → PlayerIntent
│   │   ├── events.ts        # 轻量事件总线（命中、死亡、得分）
│   │   └── rng.ts           # 可播种随机数（回放/测试用）
│   ├── physics/             # 物理世界封装（只有这层 import planck）
│   │   ├── world.ts         # 世界创建、固定步进、碰撞过滤位定义
│   │   ├── ragdoll.ts       # 火柴人刚体+关节装配（核心文件）
│   │   ├── balance.ts       # 站立控制器（扶正力矩、失衡窗口）
│   │   └── contacts.ts      # 碰撞监听 → 命中事件（速度、部位）
│   ├── game/                # 游戏规则
│   │   ├── game.ts          # 对局状态机：菜单→选择→回合→结算
│   │   ├── round.ts         # 单回合：出生、计分、重置
│   │   ├── damage.ts        # 伤害公式（纯函数，重点单测对象）
│   │   ├── player.ts        # 玩家：血量、武器、输入意图应用
│   │   └── ai/
│   │       ├── controller.ts # AI 状态机（输出与人类相同的 PlayerIntent）
│   │       └── profiles.ts   # 难度参数表
│   ├── weapons/
│   │   ├── weapon.ts        # 武器接口 + 注册表
│   │   ├── spear.ts / sword.ts / bow.ts
│   │   └── projectile.ts    # 箭等抛射体
│   ├── maps/
│   │   ├── map.ts           # 地图接口：静态体、出生点、危险区、更新钩子
│   │   └── arena.ts / lava.ts / platforms.ts
│   ├── render/
│   │   ├── renderer.ts      # 相机（双人取中点自动缩放）+ 绘制调度
│   │   ├── stickman-draw.ts # 由刚体位姿绘制火柴人（线帽圆头风格）
│   │   ├── effects.ts       # 粒子：血点、火花、击杀慢动作
│   │   └── hud.ts           # 血条、比分、虚拟摇杆绘制
│   └── audio/sfx.ts         # WebAudio 程序化音效（无版权素材）
├── tests/                   # vitest：damage、balance、无头对局模拟
└── .github/workflows/ci.yml
```

依赖方向强约束：`core ← physics ← game → render/audio`，render 只读游戏状态，绝不写。`weapons`/`maps` 是数据+装配代码，通过注册表接入，新增一把武器 = 新增一个文件 + 注册一行。

## 3. 关键设计决策

### 3.1 主循环：固定时间步

物理必须以固定 `dt = 1/60s` 步进（累加器模式），渲染用插值。这保证不同刷新率设备手感一致，也让无头测试（直接连续调 `step()`）与真实运行行为一致。

### 3.2 输入抽象：PlayerIntent

所有控制源（触屏摇杆、键盘、AI）统一输出：

```ts
interface PlayerIntent {
  move: { x: number; y: number };  // 摇杆向量，长度 ≤ 1
  jump: boolean;
}
```

游戏逻辑只消费 Intent，不知道来源。因此 AI 与人类玩家走完全相同的代码路径，同屏双人只是两个输入源，未来做回放/联机也只需序列化 Intent 流。

### 3.3 火柴人刚体装配（ragdoll.ts）

```
        head (circle)
          │ neck: RevoluteJoint(limit ±25°)
        torso (box/capsule)
    ┌─────┴─────┐
  armUpper    armUpper     shoulder: RevoluteJoint(无限位, 带马达) ← 武器控制核心
    │            │
  armLower(持武器刚体, WeldJoint)
    │
  legs → 不做真实腿：torso 底部挂一个圆形"轮足"(wheel fixture)
         移动 = 对轮足施加速度，视觉上的腿是程序化动画（渲染层画出来的）
```

要点：

- **轮足方案**：真实双腿步行是 active-ragdoll 最大的坑，原作观感也是"滑步"。用一个低摩擦→高摩擦可切换的圆 fixture 当脚，移动直接设速度，跳跃施加冲量。腿只在渲染层根据水平速度画摆动动画。
- **站立控制（balance.ts）**：每步对 torso 施加 `torque = -k1·angle - k2·angularVelocity`（PD 控制器）把身体拉回直立。被击中后进入 `stunMs` 失衡窗口，PD 增益归零 → 自然翻滚。
- **武器手臂**：shoulder 关节马达以 `motorSpeed = clamp(k·angleError)` 追踪摇杆方向。摇杆快速反向 → 角度误差大 → 马达全速 → 武器高速甩动。**攻击力完全来自这里，没有攻击键。**
- **碰撞过滤**：同一角色的肢体互不碰撞（负 groupIndex）；武器与对方所有肢体碰撞；双方躯干之间碰撞（可以推挤）。

### 3.4 伤害模型（damage.ts，纯函数）

```
damage = baseDamage(weapon)
       × clamp01((relSpeed - minSpeed) / (refSpeed - minSpeed))   // 相对速度归一
       × partMultiplier(hitPart)                                   // 头 1.5 / 躯干 1.0 / 手脚 0.6
命中冷却：同一武器对同一目标 200ms 内不重复判伤（防止贴脸连跳帧多次判定）
击退冲量方向 = 武器速度方向，大小 ∝ damage
```

所有系数集中在 `tuning.ts` 一个常量文件里，方便手感调参（这是本项目最需要人工反馈迭代的部分）。

### 3.5 命中检测（contacts.ts）

用 Box2D 的 begin-contact + 传感器不够（会漏掉高速穿透），方案：

- 武器 fixture 设为 `bullet body`（连续碰撞检测 CCD），Box2D 原生支持防穿透
- 在 `PostSolve` 里读接触点相对速度，派发 `HitEvent{ attacker, target, part, relSpeed, point }`
- 游戏层消费事件算伤害，物理层不知道"血量"概念

### 3.6 对局状态机（game.ts）

```
Boot → MainMenu → Setup(模式/武器/地图选择) → RoundIntro(3,2,1)
     → Fighting → RoundEnd(慢动作+得分) → {Fighting | MatchEnd} → MainMenu
```

状态机用简单的 discriminated union + switch 实现，不引库。

### 3.7 相机与渲染

- 相机对准两名玩家中点，缩放 = clamp(f(两人距离))，平滑插值跟随
- 火柴人绘制：读取各刚体 position/angle，用粗圆头线条连接关节点；颜色区分玩家；死亡后继续按物理位姿绘制（布娃娃瘫倒动画免费获得）
- 击杀触发 0.5s 的 `timeScale = 0.3` 慢动作 + 屏幕轻震

### 3.8 音效

WebAudio 合成（噪声爆发=打击、扫频=挥舞、方波琶音=胜利），零素材文件、零版权风险。后续可替换为 CC0 采样。

## 4. 测试策略（AI 开发的安全网）

| 层 | 方式 |
| --- | --- |
| damage.ts / tuning | 纯函数单测：边界速度、部位系数、冷却 |
| balance.ts | 无头物理测试：创建 ragdoll，step 300 帧，断言 torso 角度 < 阈值（站得住）；施加冲量后 N 帧内恢复直立 |
| 对局回归 | 无头模拟：两个 AI 用固定种子打 50 回合，断言总能分出胜负、无 NaN、无角色飞出世界边界 |
| 渲染/输入 | 不做自动化，靠浏览器手测清单（docs/03 附） |

物理不可能"精确断言"，测试目标是**性质**（站得住、打得死、不发散），不是数值快照。

## 5. 移动端适配

- `viewport fit=cover` + 全屏 canvas，横屏提示
- 触控：左半屏任意落点生成浮动摇杆，右半屏点按=跳跃（双人模式改为固定区域）
- 性能预算：物理 body < 40 个，Canvas 绘制调用 < 200/帧，目标 60fps 中端手机

## 6. 风险与对策

| 风险 | 等级 | 对策 |
| --- | --- | --- |
| 甩武器手感不对（灵魂机制） | 高 | 里程碑 M1 只做这一件事的可玩原型，手感不过关不进入 M2 |
| ragdoll 物理抖动/爆炸 | 中 | 固定步长、限制最大速度、关节加 limit、bullet CCD |
| 同屏双人触控冲突 | 中 | 多点触控按半屏归属，早期真机验证 |
| 范围蔓延（联机、皮肤…） | 中 | 严格按 roadmap，MVP 之外的想法只进 docs/ideas.md |
