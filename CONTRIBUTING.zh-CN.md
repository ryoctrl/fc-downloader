# 贡献指南

[日本語](CONTRIBUTING.md) | [English](CONTRIBUTING.en.md) | 简体中文

感谢你有兴趣参与 fc-downloader 的开发。欢迎提交错误报告、功能建议和拉取请求（PR）。也欢迎使用英语提交 Issue 或 PR，以下流程同样适用。

本指南是[贡献指南](CONTRIBUTING.md)的简体中文版本。开发环境说明采用当前 CI 使用的 Node.js 24，并补充中文翻译维护说明。

参与项目时，请遵守[行为准则（Code of Conduct）](https://github.com/ryoctrl/.github/blob/master/CODE_OF_CONDUCT.md)。

---

## 开始之前

本应用用于**对自己已支持的内容进行个人备份和浏览**。相关说明见 [README 中的免责声明](README.zh-CN.md#免责声明) 和 [安全与使用规范](docs/spec/security-and-legal.md)。

项目不接受违背这一宗旨的改动，例如未经授权获取付费内容、绕过访问限制，或以再次分发、共享为目的的功能。

本仓库公开可见，请**不要在 Issue、PR 或提交中包含**以下内容：

- Cookie、会话、令牌、密码等认证信息。
- 从真实账号取得的创作者姓名、帖子 ID、内容哈希、带签名的 URL 等数据。
- 已下载的非公开内容，包括图片、文件，以及截图中出现的此类内容。

测试与测试数据必须使用**虚构值**，例如虚构的创作者 ID、虚构哈希和占位令牌。CI 会运行凭据扫描（gitleaks / ggshield），检测到问题时会阻止合并。

## 提交 Issue

- 报告错误或提出功能建议，请使用 [Issue 模板](https://github.com/ryoctrl/fc-downloader/issues/new/choose)。
- 如果希望在开始较大改动前讨论方案，可以先创建 Issue。
- 安全漏洞请勿公开提交 Issue，应按照 [SECURITY.md](SECURITY.md) 的方式私下报告。

## 开发环境

需要 Node.js 24 和 npm，与当前 CI 使用的主版本一致。应用本身不使用需要自行编译的原生模块，通常无须额外安装 Python 或 MSVC 等构建工具。

```bash
npm ci             # 按锁文件安装依赖
npm run dev        # 启动应用，支持热更新
npm run typecheck  # 检查主进程与界面的 TypeScript 类型
npm run lint       # 运行 ESLint
npm test           # 运行 Vitest 测试
npm run build      # 类型检查并执行 electron-vite 构建
```

设计与目录结构说明见 [CLAUDE.md](CLAUDE.md) 和 [docs/](docs/)。以下文档尤其有助于理解项目：

- [整体架构](docs/spec/architecture.md)：模块划分与运行流程。
- [站点适配抽象](docs/spec/service-abstraction.md)：如何添加支持的站点。
- [IPC 约定](docs/spec/ipc-contract.md)：如何添加进程间通信通道。
- [存储与去重](docs/spec/storage-and-dedup.md)：保存目录布局与重复内容判断。

## 代码约定

- **添加站点**：在 `src/main/services/<id>/` 中实现 `Service`，在 `registry.ts` 注册，并将 `<id>` 添加到 `src/shared/types.ts` 的 `ServiceId` 中。
- **添加 IPC 通道**：先在 `src/shared/ipc.ts` 的 `IpcApi` 中定义，再添加 `src/main/ipc/handlers.ts` 中的处理函数和 `src/preload/index.ts` 中的允许列表。请勿手写 `any` 类型。
- `src/shared/*` 同时供主进程与界面使用，请勿引入 Node、Electron 或 DOM 相关依赖。
- 依赖各站点非公开 API、但尚未经过实际站点验证的代码，应在注释中标记 `VERIFY:`。
- 不要向界面进程开放 Node 权限。保持 `contextIsolation: true` 和 `nodeIntegration: false`，通过 `window.api` 完成通信。
- 调查脚本放在 `scripts/_*.cjs`，该前缀已被 Git 忽略，请勿提交。
- 使用 Prettier（`npm run format`）和 `.editorconfig` 中的格式规范。

## 中文翻译维护

- 简体中文字典位于 [`src/renderer/src/design/locales/zh-CN.ts`](src/renderer/src/design/locales/zh-CN.ts)。
- 语言选择与系统语言匹配逻辑位于 [`src/renderer/src/design/language.ts`](src/renderer/src/design/language.ts)。
- 新增界面文案时，同步维护日语、英语和简体中文字典，保持键名一致。
- 保留 `{name}`、`{n}`、`{postId}` 等占位符及文件夹命名变量，避免改变其拼写或含义。
- [`i18n.test.ts`](src/renderer/src/design/i18n.test.ts) 会检查字典键名、占位符与语言匹配。修改较长的提示文案后，也请检查界面是否换行或溢出。
- README 或贡献流程发生变化时，请同步更新中文文档及对应的原文链接。
- 站点内嵌网页、创作者正文和原始服务端诊断消息不属于应用界面翻译的范围。

## 提交拉取请求

1. 从 `main` 创建工作分支，每个 PR 应只包含一个目的的改动。
2. 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/)，例如 `fix(cien): ...`、`feat(viewer): ...` 或 `docs: ...`。
3. 提交 PR 前，确认以下检查通过；CI 也会运行相同检查：

   ```bash
   npm run typecheck
   npm run lint
   npm test
   npm run build
   ```

4. 涉及运行行为的改动，应在条件允许时通过实际应用验证，并在 PR 中说明结果。
5. 按照 [PR 模板](.github/PULL_REQUEST_TEMPLATE.md) 填写改动内容、原因和相关 Issue。

## 许可证

提交贡献即表示你同意将相关代码按照与本仓库相同的 [MIT License](LICENSE) 公开。
