# AIStickman

一款完全由 AI 开发的 2D 物理火柴人对战游戏，玩法参考 [Supreme Duelist Stickman](https://apps.apple.com/us/app/supreme-duelist/id1477336151)。

- **技术栈**：TypeScript + Planck.js (Box2D) + Canvas 2D + Vite
- **平台**：浏览器（桌面 + 移动端触屏），可通过 GitHub Pages 直接试玩
- **首版目标（MVP）**：1v1 人机对战 + 同屏双人对战，3 种武器，3 张地图

## 文档

| 文档 | 内容 |
| --- | --- |
| [docs/01-game-analysis.md](docs/01-game-analysis.md) | 参考游戏玩法拆解 |
| [docs/02-implementation-plan.md](docs/02-implementation-plan.md) | 架构设计与实现方案（本项目的开发"宪法"） |
| [docs/03-roadmap.md](docs/03-roadmap.md) | 里程碑与任务拆分 |

## 快速开始（脚手架搭建后生效）

```bash
pnpm install
pnpm dev      # 本地开发 http://localhost:5173
pnpm test     # 物理/逻辑单元测试 (vitest)
pnpm build    # 产出静态站点 dist/
```

## 许可

代码 MIT。美术与音效资源使用自制或 CC0 素材，不使用原作任何资产。本项目为玩法致敬，非原作复刻，不使用原作名称、美术与商标。
