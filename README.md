# CedarLicenseTool 许可证分发工具

Wails v2 桌面应用，用于生成带有 RSA 数字签名的许可证文件，与 [license-manager-enterprise](https://github.com/cedar/license-manager-enterprise) 完全兼容。

## 技术栈

| 组件 | 技术 |
|------|------|
| 桌面框架 | Wails v2 |
| 后端加密 | Go 标准库 `crypto`（RSA-PSS-SHA256） |
| 前端框架 | React + TypeScript |
| UI | Tailwind CSS + Lucide Icons |

## 项目结构

```
cedar-license-tool/
├── main.go                  # Go 应用入口
├── go.mod / go.sum          # Go 依赖
├── wails.json               # Wails 项目配置
├── .vscode/settings.json    # VSCode/Cursor Go 配置
├── README.md
│
├── frontend/                # 前端源码
│   ├── src/
│   │   ├── App.tsx         # React 主组件
│   │   ├── main.tsx        # React 入口
│   │   ├── index.css        # 样式（Tailwind）
│   │   └── wailsjs/         # Wails 生成的桥接代码
│   ├── dist/               # 构建产物（由 wails build 生成）
│   ├── package.json
│   └── ...
│
├── build/                  # Wails 构建配置
│   ├── bin/                 # 编译输出目录
│   │   └── CedarLicenseTool.exe
│   └── windows/
│
├── docs/
│   └── 2026.4.7-CedarLicenseTool工具需求.md
│
├── keys/                   # 密钥目录（运行时自动创建）
└── output/licenses/        # 许可证输出目录（运行时自动创建）
```

## 构建

在项目根目录执行：

```bash
# 正式打包
wails build

# 开发调试（带热重载）
wails dev
```

### IDE 中直接 go build

Wails 应用不能用裸的 `go build` 编译，需加标签：

```bash
go build -tags desktop -o CedarLicenseTool.exe .
```

本项目已在 `.vscode/settings.json` 中为 Go/gopls 配置了 `-tags desktop,dev`，在 Cursor/VS Code 中可正常分析代码。

## 功能

- RSA 2048 位密钥对生成（PKCS1 私钥 / PKIX 公钥）
- RSA-PSS-SHA256 数字签名
- 客户名称 + 机器指纹授权
- 灵活授权时长（1 个月 ~ 3 年 + 自定义）
- 有期限 / 无期限切换
- 许可证 Base64 导出、复制、下载
- 导出存档（公钥 + 许可证）

## 加密兼容性

与 license-manager-enterprise 后端完全兼容：

- 签名算法：RSA-PSS + SHA-256
- 私钥格式：PKCS1（`-----BEGIN RSA PRIVATE KEY-----`）
- 公钥格式：PKIX（`-----BEGIN PUBLIC KEY-----`）
- 许可证结构：`{data, signature, algorithm}`
