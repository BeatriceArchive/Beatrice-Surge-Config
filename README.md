# Beatrice Surge Config

[![Validate Surge Config](https://github.com/BeatriceArchive/Beatrice-Surge-Config/actions/workflows/validate.yml/badge.svg)](https://github.com/BeatriceArchive/Beatrice-Surge-Config/actions/workflows/validate.yml)

Beatrice 的公开 Surge iOS 配置壳。仓库只保存已经审计的 Surge 原生配置结构，**不保存真实代理节点、订阅地址、密码、Token 或其他私密凭据**。

## 架构

```text
Beatrice-Surge.conf
        ↓
Beatrice Sub 获取并转换私人节点
        ↓
只生成 Surge [Proxy] 节点行
        ↓
注入 / 替换 [Proxy]
        ↓
[General] / [Proxy Group] / [Rule] 保持公开模板语义
```

公开仓库中的 `Beatrice-Surge.conf` 故意没有 `[Proxy]`。它不是节点订阅仓库，而是 Beatrice Sub 的 Surge 原生模板与策略壳。

## 当前配置模型

### General

固定 Surge iOS 网络基线，包括：

- System DNS 与远端代理解析语义
- VIF `compatibility-mode = 3`
- IPv6 关闭
- Wi‑Fi / 热点代理共享关闭
- 全网络 VIF 接管范围
- UDP 与日志行为

### Proxy Group

对用户暴露 5 个核心策略：

| 策略 | 用途 |
| --- | --- |
| `🚀 手动切换` | 通用代理入口 |
| `🤖 AI服务` | AI 服务 |
| `🌍 国外流媒体` | 国际流媒体 |
| `🍎 苹果服务` | Apple 服务 |
| `🌐 兜底策略` | 最终策略 |

另有香港、日本、新加坡、美国、台湾 5 个隐藏地区 helper。地区 helper 使用 `fallback + REJECT`，在没有匹配节点时保持 fail-closed，避免空组意外直连。

### Rule

规则采用 Surge 原生自上而下、首次命中生效的顺序模型。当前结构包括：

- LAN / System
- AI / Apple Intelligence
- Apple
- 国际流媒体
- Bilibili
- 中国大陆域名 / IP
- 唯一最终 `FINAL,🌐 兜底策略,dns-failed`

## 安全边界

这个仓库必须始终保持公开安全：

- 不提交真实 `[Proxy]` 节点
- 不提交机场订阅 URL
- 不提交 `password` / `username` / private key / Token
- 不在公开模板写入私人 `#!MANAGED-CONFIG` 地址
- 不加入 MITM、Rewrite 或 Script 资产

私人节点只在 Beatrice Sub 的运行时生成结果中出现。

## 自动校验

仓库提供零依赖静态检查：

```bash
node scripts/validate-config.mjs
```

GitHub Actions 会在 push 和 pull request 时自动执行同一套门禁。校验覆盖：

- 公开模板只有 `[General]` / `[Proxy Group]` / `[Rule]`
- `[Proxy]` 不得进入公开仓库
- General 冻结基线
- 5 个核心策略 + 5 个隐藏地区 helper
- 地区 regex 正向 / 反向边界样例
- AI / 国外流媒体 / 手动链路不得出现隐式 DIRECT
- 规则策略引用有效
- 无重复规则、无 `MATCH`
- 只有一个 FINAL 且必须位于规则末尾
- 外部 RULE-SET 必须使用 HTTPS
- 无常见代理凭据或节点声明

如果未来因为 Surge 官方语义变化或真实需求需要修改已冻结行为，应在同一个 commit 中同步更新配置、校验器和说明，避免“配置已经变了但仓库契约仍停留在旧版本”。

## 相关项目

- [Beatrice-Surge-Modules](https://github.com/BeatriceArchive/Beatrice-Surge-Modules) — 独立 Surge 模块与脚本
- Beatrice Sub — 私人节点、订阅与运行时模板注入层

## 配置文件

- [`Beatrice-Surge.conf`](./Beatrice-Surge.conf)
- [Raw](https://raw.githubusercontent.com/BeatriceArchive/Beatrice-Surge-Config/main/Beatrice-Surge.conf)
