# App Icon Maker

使用 AI 生成 **macOS 应用图标** (.icns 格式) 的桌面应用。描述你想要的图标，可选附加参考图片，从多个变体中挑选，完善设计，然后保存包含所有标准尺寸的 `.icns` 文件和 `.iconset` 文件夹。

基于 [Tauri 2](https://v2.tauri.app/) + React + Tailwind CSS v4 构建，使用 [OpenAI gpt-image-1 API](https://openai.com/api/) 进行图像生成。

## 功能

- **Prompt 驱动生成** — 你的描述自动包裹在 macOS 图标风格约束中（居中构图、无文字、适合 squircle 形状等）。
- **每次 3 个变体** — 一次生成返回三个不同方案，方便对比。
- **可选的参考图片** — 可附加 PNG 作为参考（草稿、Logo 或之前的渲染结果）。
- **完善工作流** — 选定一个变体后进入 refine 模式，该图标成为后续生成的参考，迭代调整直至满意。
- **真实预览** — UI 使用 squircle（Lamé 超椭圆）裁剪蒙版预览图标效果。
- **导出 .icns** — 保存的 `.icns` 使用全幅图像，macOS 自身应用圆角遮罩（避免预裁剪导致的灰色底板和缩小图标问题）。
- **未保存提醒** — 退出时如有未保存的图标会弹出确认对话框。
- **API Key 持久化** — OpenAI API key 通过 `tauri-plugin-store` 持久化到磁盘，重启不丢失。

## 截图

<!-- TODO: add screenshot or demo GIF -->

> 原版 MoBrowser 架构演示视频：https://github.com/user-attachments/assets/1c87f99d-993f-408b-bd32-a1eb6552eada

## 系统要求

- **macOS 14** (Apple Silicon / Intel) 或更高版本（`.icns` 生成依赖系统自带的 `sips` + `iconutil`）
- **Node.js** 20+（推荐 22 LTS）
- **Rust** 工具链（用于编译 Tauri 后端，安装方式见 [rustup.rs](https://rustup.rs/)）

## 快速开始

```bash
# 安装前端依赖
pnpm install

# 开发模式
pnpm tauri dev

# 生产构建
pnpm tauri build
```

## 使用方式

1. **描述你的图标** — 在输入框中输入简短描述（如 "blue clipboard with folded corner"）。
2. **（可选）附加参考图片** — 点击图片按钮上传 PNG。
3. 按 **Generate**（或 Enter 键），等待三个预览图生成。
4. **选择一个变体** — 点击进入 refine 模式，或重新生成。
5. **在 refine 模式**下调整描述，确认的图标作为下一批的参考。
6. 满意后点击 **Save**，选择 `.icns` 保存路径。应用会在目标文件夹创建 `YourName.icns` 和 `YourName.iconset`。
7. 保存成功后可通过 **Show in Finder** 快速定位文件。

## 项目结构

```
app-icon-maker/
├── src/                          # 前端 (React + TypeScript)
│   ├── main.tsx                  # 入口
│   ├── App.tsx                   # 根组件
│   ├── index.css                 # Tailwind v4 + 主题变量 + 动画
│   ├── components/               # React 组件 (14 个)
│   │   ├── app-content.tsx       # 主状态调度 (IconState 状态机)
│   │   ├── macos-icon.tsx        # macOS 图标容器
│   │   ├── icon-face.tsx         # 图标面 (图片/占位/蓝图 三种状态)
│   │   ├── icon-stack.tsx        # 空闲/生成中 三图标堆叠
│   │   ├── variant-picker.tsx    # 生成后 三变体选择
│   │   ├── single-refine-icon.tsx # refine 模式 单图标
│   │   ├── blueprint-face.tsx    # 蓝图网格 + 扫描动画 SVG
│   │   ├── prompt-input.tsx      # 输入框 + 附件 + 按钮
│   │   ├── title-bar-status.tsx  # macOS 标题栏进度
│   │   ├── squircle-clip-defs.tsx # SVG clipPath (objectBoundingBox)
│   │   ├── error-modal.tsx       # 错误弹窗 + API key 检测
│   │   ├── save-success-modal.tsx # 保存成功 + Finder 显示
│   │   ├── openai-api-key-modals.tsx # API key 设置 (启动/管理)
│   │   └── theme-provider.tsx    # 暗色主题管理
│   └── lib/                      # 工具库
│       ├── icon-pipeline.ts      # Squircle Canvas mask + Tauri IPC
│       ├── icon-types.ts         # IconState 类型
│       ├── squircle.ts           # Lamé 超椭圆几何
│       └── utils.ts              # cn() class merge
├── src-tauri/                    # Tauri 后端 (Rust)
│   ├── Cargo.toml                # Rust 依赖
│   ├── tauri.conf.json           # Tauri 配置
│   ├── capabilities/default.json # 权限声明
│   └── src/
│       ├── main.rs               # 入口
│       └── lib.rs                # 8 个 tauri::command + store + 窗口事件
├── postcss.config.js             # Tailwind v4 PostCSS
├── vite.config.ts                # Vite + @ 别名
└── tsconfig.json                 # TypeScript 配置
```

## 后端命令

| Tauri 命令                  | 功能                                               |
| --------------------------- | -------------------------------------------------- |
| `generate_icon`             | 调用 OpenAI gpt-image-1 生成图标 (文生图 / 图生图) |
| `save_icon`                 | 保存为 .icns (sips + iconutil)                     |
| `show_path_in_finder`       | 在 Finder 中显示文件                               |
| `open_external_url`         | 打开外部 URL                                       |
| `set_openai_api_key`        | 保存 OpenAI API key (内存 + 磁盘持久化)            |
| `get_openai_api_key_status` | 检查 key 是否存在                                  |
| `get_stored_openai_api_key` | 获取已存储的 key                                   |
| `set_unsaved_icon_state`    | 设置未保存状态 (控制关闭确认)                      |

## 已知限制

- `.icns` 生成仅支持 **macOS**（依赖 `sips` 和 `iconutil` 系统命令）。
- 仅支持 **OpenAI gpt-image-1** 模型。
- 窗口固定尺寸 **550×520**，不可缩放。

## TODO

- [ ] **自定义 macOS 菜单栏** — 添加完整的应用菜单（About、文件、编辑、视图、窗口、帮助），替代 Tauri 原生窗口装饰的默认菜单。
- [ ] **About 对话框** — 显示应用版本信息、OpenAI/MōBrowser 技术说明、GitHub 仓库链接。

## 下载

关注 [Releases 页面](https://github.com/TeamDev-IP/MoBrowser-App-Icon-Maker/releases)（原 MoBrowser 版）获取签名和公证的 DMG 安装包。Tauri 版构建包将在后续发布。

## 技术栈

- **框架**: [Tauri 2](https://v2.tauri.app/)
- **前端**: React 19 + TypeScript + Vite 7
- **样式**: Tailwind CSS v4 + CSS 自定义属性 (light/dark 双主题)
- **后端**: Rust (reqwest, base64, serde, tokio)
- **插件**: `tauri-plugin-opener`, `tauri-plugin-dialog`, `tauri-plugin-shell`, `tauri-plugin-store`
- **图像**: OpenAI gpt-image-1 via REST API
- **图标生成**: macOS `sips` + `iconutil` (系统内置)
