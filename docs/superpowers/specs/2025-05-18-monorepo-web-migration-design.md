# Monorepo Restructure & Web Version Design

## Goal

将 app-icon-maker 改造为 pnpm monorepo，抽离可复用组件/工具到共享包，并用 Astro + React + CF Workers 在 `web/` 下创建 web 版本。

## Architecture Overview

```
app-icon-maker/
├── pnpm-workspace.yaml     # packages: ['packages/*', 'web']
├── package.json            # Root (Tauri desktop app entry)
├── packages/
│   ├── utils/              # @app-icon-maker/utils — 纯 TS，零 UI 依赖
│   └── ui/                 # @app-icon-maker/ui — 共享 React 组件
├── src/ + src-tauri/       # Tauri 桌面端（引用 packages/*）
└── web/                    # Astro + React + CF Workers（引用 packages/*）
```

## packages/utils（纯 TypeScript 共享逻辑）

### 内容

| Source | Package path | Exports |
|--------|-------------|---------|
| `src/lib/icon-types.ts` | `packages/utils/src/icon-types.ts` | `IconState` |
| `src/lib/squircle.ts` | `packages/utils/src/squircle.ts` | `SQUIRCLE_PATH_01`, `squircleStrokeWidthVbForVisibleBorder`, etc. |
| `src/lib/utils.ts` | `packages/utils/src/utils.ts` | `cn()` |
| `src/lib/icon-pipeline.ts` | `packages/utils/src/icon-pipeline.ts` | `useIconPipeline`, `Transport` interface, `PipelineStatus`, etc. |

### icon-pipeline 传输层解耦

原 `icon-pipeline.ts` 硬编码 `@tauri-apps/api/core` 的 `invoke`。改为依赖注入模式：

```typescript
// packages/utils/src/icon-pipeline.ts
export interface GenerateParams {
  prompt: string;
  model: string;
  provider: string;
  referenceImage?: string;
}

export interface GenerateResult {
  images: string[];  // base64 strings
  error?: string;
}

export interface Transport {
  generateIcon(params: GenerateParams): Promise<GenerateResult>;
}

export function useIconPipeline(transport: Transport): IconPipeline {
  // 内部逻辑使用 transport.generateIcon() 而非 tauriInvoke()
}
```

每个消费者注入自己的 transport：
- **Tauri**: `transport.generateIcon()` → `invoke("generate_icon", params)`
- **Web**: `transport.generateIcon()` → `fetch("/api/generate", { method: "POST", body: JSON.stringify(params) })`

### Build

- 用 `tsup` 输出 ESM + CJS + `.d.ts`
- 零外部运行时依赖（仅 `clsx`, `tailwind-merge` 仍为 deps）

## packages/ui（共享 React 组件）

### 组件清单

| 组件 | 备注 |
|------|------|
| `macos-icon` | Icon display with idle/generating/generated/refine states |
| `prompt-input` | Text input with file attachment + primary action button |
| `variant-picker` | Select between 3 generated variants |
| `icon-face` | Single icon preview face |
| `icon-stack` | Stacked icon animation for generating state |
| `single-refine-icon` | Refine mode single icon display |
| `blueprint-face` | Blueprint placeholder icon |
| `squircle-clip-defs` | SVG clip-path definitions |
| `error-modal` | Error display modal |
| `save-success-modal` | Save success feedback modal |
| `title-bar-status` | Compact progress bar |
| `theme-provider` | Theme context provider |
| `ui/select` | Select dropdown component |
| `app-content` | **不提取** — app 特有编排逻辑，Tauri 和 Web 各自实现 |

### 不提取的组件

- `openai-api-key-modals.tsx` — 依赖 Tauri IPC（API key 管理命令），Web 版需要不同的 key 管理 UI
- `app-content.tsx` — 应用编排逻辑，Tauri 和 Web 各自实现

### 样式策略

组件使用 Tailwind CSS 4 class names。直接 export TSX 源码，由消费端（Tauri Vite / Astro）编译 Tailwind。

每个组件导出时附带样式说明，确保消费端的 Tailwind config 包含所需 utilities。

### Build

- 用 `tsup` 输出 ESM + `.d.ts`
- React / ReactDOM 为 peerDependencies
- Tailwind classes 不预编译（由消费端处理）

## web/ — Astro + React + CF Workers

### 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Astro 6 |
| UI | React 19（Astro islands） |
| 样式 | Tailwind CSS 4（与桌面端一致） |
| 部署 | `@astrojs/cloudflare` adapter |
| API 代理 | Astro backend endpoints（`src/pages/api/*.ts`） |

### API 架构

Web 版用 Astro API 路由代替 Tauri IPC：

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/generate` | POST | 代理 AI 图片生成请求（OpenAI/Gemini/OpenRouter/fal） |
| `/api/download` | POST | 图片格式转换下载（PNG/JPEG） |

### 数据流

```
[React Frontend]
  → localStorage (API keys)
  → fetch("/api/generate", { apiKey, prompt, model, provider, referenceImage })
  → [Astro API Endpoint / CF Worker]
    → fetch(AI Provider API)
    → return base64 images
  → [React Frontend] display + allow download
```

Key 管理：**用户 API key 存 localStorage**，每次请求发送到 Astro backend 由 Worker 转发到 AI 供应商。Worker 不做 key 持久化。

### 与桌面端差异

| 能力 | 桌面端 (Tauri) | Web 版 |
|------|---------------|--------|
| 图片生成 | Rust invoke → HTTP | Astro API → HTTP |
| API key 管理 | Tauri store（加密文件） | localStorage |
| 文件导出 | `.icns` / `.png` / `.jpeg` | `.png` / `.jpeg`（无 .icns） |
| 系统交互 | Finder 打开、原生对话框 | 浏览器下载 |
| 窗口管理 | 固定 550×520 窗口 | 自适应浏览器 |

### 部署

- `@astrojs/cloudflare` adapter
- Worker 负责 API 代理转发
- 静态资源由 Cloudflare Pages 托管

## 迁移步骤

### Phase 1: 建立 monorepo 基础设施
1. 配置 `pnpm-workspace.yaml`（`packages: ['packages/*', 'web']`）
2. 创建 `packages/utils/` 脚手架（package.json, tsconfig, tsup config）
3. 创建 `packages/ui/` 脚手架（package.json, tsconfig, tsup config, peerDeps）

### Phase 2: 迁移 packages/utils
1. 复制 icon-types.ts、squircle.ts、utils.ts、icon-pipeline.ts
2. 重构 icon-pipeline：提取 Transport 接口，移除 Tauri 硬编码
3. 验证构建通过

### Phase 3: 迁移 packages/ui
1. 逐文件复制组件，将 `@/lib/` 导入替换为 `@app-icon-maker/utils`
2. 复制 `ui/select.tsx` 和 `theme-provider.tsx`
3. 验证构建通过

### Phase 4: 重构桌面端导入
1. 更新 `src/` 下所有文件：`@/lib/` → `@app-icon-maker/utils`，`@/components/` → `@app-icon-maker/ui`
2. 桌面端创建 TauriTransport 实现
3. `pnpm build` 验证通过

### Phase 5: 开发 Web 版本
1. 配置 `web/`：添加 `@astrojs/react`、`@astrojs/cloudflare`、Tailwind
2. 创建 Astro API 路由（generate, download）
3. 引入并使用共享组件构建 web AppContent
4. 实现 WebTransport（fetch-based）
5. 验证 dev + build 正常

### Phase 6: 清理与文档
1. 清理旧的重复文件
2. 更新根目录 README
3. 更新 CLAUDE.md
