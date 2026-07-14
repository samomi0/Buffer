# Buffer

模块化工具平台 —— 集成密库管理、开发手记等多种工具。

## 模块体系

Buffer 将功能划分为 **标准模块** 与 **定制模块** 两个层次，便于维护与二次开发。

### 标准模块 (Built-in)

随平台发行的内置功能，代码位于 `src/modules/`。可复用平台核心 API（`core/stores`、`core/lib`、Tauri commands）。

| 模块 | ID | 说明 | 目录 |
|------|----|------|------|
| 密库 | `SecureVault` | 加密存储服务器与密码等隐私信息 | `src/modules/vault/` |
| 开发手记 | `DevLog` | 记录开发任务细节与笔记 | `src/modules/devlog/` |

### 定制模块 (Custom)

面向特定业务的定制功能。二次开发者可在 `src/custom/` 下创建 React 组件模块，或在 `public/custom-tools/` 下放置静态 HTML 页面，然后在 `src/App.tsx` 的 `CUSTOM_MODULES` 中注册即可。

## 技术栈

- **前端**: React 19 + TypeScript + Vite 6
- **状态管理**: Zustand 5
- **富文本编辑**: Tiptap 3
- **桌面壳**: Tauri 2 (Rust)
- **构建工具**: Vite

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（Web 模式）
npm run dev

# 启动 Tauri 桌面应用
npm run tauri dev

# 生产构建
npm run tauri build
```

## 项目结构

```
Buffer/
├── docs/                          # 项目文档
│   └── design.md                  # 开发手记设计文档
├── public/
│   ├── fonts/                     # 字体文件（静态资源）
│   └── custom-tools/              # 🛠 定制静态工具（git 忽略）
├── src/
│   ├── main.tsx                   # 入口
│   ├── App.tsx                    # 应用壳 + 模块注册
│   ├── core/                      # ⚙️ 核心框架
│   │   ├── stores/                #   状态管理（Zustand）
│   │   ├── lib/                   #   工具库（workbenchSettings、holidaySync）
│   │   ├── styles/                #   全局样式
│   │   └── components/            #   平台组件
│   │       ├── dashboard/         #     仪表盘
│   │       ├── launcher/          #     搜索启动器
│   │       ├── settings/          #     设置页
│   │       ├── setup/             #     初始设置
│   │       └── tools/             #     iframe 工具容器 ToolFrame
│   ├── modules/                   # 📦 标准模块
│   │   ├── vault/                 #     密库
│   │   └── devlog/                #     开发手记
│   └── custom/                    # 🛠 定制模块（二次开发，git 忽略）
├── src-tauri/                     # Tauri 桌面壳（Rust）
│   ├── src/                       #   Rust 源码
│   ├── icons/                     #   应用图标
│   └── capabilities/              #   权限配置
└── data/                          # 运行时数据（不纳入版本控制）
```

## 许可

MIT License
