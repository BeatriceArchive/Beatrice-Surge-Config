# Beatrice Surge Config

[![Validate Surge Config](https://github.com/BeatriceArchive/Beatrice-Surge-Config/actions/workflows/validate.yml/badge.svg)](https://github.com/BeatriceArchive/Beatrice-Surge-Config/actions/workflows/validate.yml)
[![Audit External Rule Drift](https://github.com/BeatriceArchive/Beatrice-Surge-Config/actions/workflows/external-drift.yml/badge.svg)](https://github.com/BeatriceArchive/Beatrice-Surge-Config/actions/workflows/external-drift.yml)

Beatrice 的公开 Surge iOS Profile 模板。仓库只维护可公开、可验证的网络基线、策略组和路由规则；真实代理节点、订阅地址与凭据始终位于私人订阅层。

> 维护原则：稳定优先、最小改动、真实设备证据优先。成熟配置默认进入维护模式，不为了“多功能”持续增加复杂度。

## 与另外两个仓库的关系

- **Beatrice-Surge-Config**：定义 Surge 的 `[General]`、`[Proxy Group]` 与 `[Rule]`。
- **Beatrice-Sub**：私人订阅工作台；生成 Surge 输出时只向模板注入 `[Proxy]` 与必要的 WireGuard section，不应重写本仓库的 General、策略组或规则。
- **Beatrice-Surge-Modules**：独立的 Surge 模块仓库；提供系统覆盖、基础面板和 Bilibili 自动化，不承担代理节点存储职责。

三者可以协同使用，但安全边界彼此独立。

## 公开边界

`Beatrice-Surge.conf` 故意不保存 `[Proxy]`。

本仓库禁止出现：

- 真实代理节点或私人 `[Proxy]`
- 机场订阅、私人 Managed Profile URL
- password、username、private key、Token 等凭据
- MITM、Rewrite 或 Script 资产

配置中的活动 URL 使用小型 allowlist。Validator 同时扫描注释中的 URL，避免旧订阅或凭据被“注释掉以后继续留在公开仓库”。

## 当前配置模型

### General

当前基线包括：

- `dns-server = system`
- Surge iOS VIF-only：`compatibility-mode = 3`
- IPv6 关闭：`ipv6 = false`、`ipv6-vif = disabled`
- Wi-Fi / 热点代理共享关闭
- `include-all-networks = true`
- `include-local-networks = false`
- `include-apns = false`
- `include-cellular-services = false`
- 不支持 UDP 的策略直接 `reject`，避免静默直连
- `exclude-simple-hostnames = true`
- `proxy-restricted-to-lan = true`
- `icmp-forwarding = false`
- `loglevel = notify`
- `http://www.gstatic.com/generate_204` 作为显式代理可用性测试端点，`test-timeout = 5`

### Bilibili raw-TCP 真机 A/B

当前 `main` 含一个**范围受限的真实设备 A/B 候选**：仅对已观察到的 Bilibili HTTPS 媒体域名设置 `always-raw-tcp-hosts`，用于比较绕过协议嗅探后的视频播放体验。

它不是对根因的永久结论，也不是全局 raw-TCP 开关。只有真实 iPhone 使用收益成立时才值得长期保留；若收益不成立，应按单变量实验原则精确回滚。

### Proxy Group

用户可见策略分两层：

1. 业务 / 全局层：`🚀 手动选择`、`🤖 AI`、`🌍 流媒体`、`🍎 Apple`。
2. 地区人工层：香港、日本、新加坡、美国、台湾、韩国。

每个地区组默认指向一个隐藏 `fallback` helper，同时允许手动固定真实节点。六个 helper 都以 `REJECT` 作为显式安全成员，再按地区 regex 导入运行时节点。

因此：

- 当前用户可见策略组共 **10 个**：4 个业务/全局组 + 6 个地区组。
- 六个 `⚡ 地区自动` helper 均为 `hidden=true`。
- 某地区零节点时保持 fail-closed，不会形成空组后 `SUBSTITUTE → DIRECT`。
- `🤖 AI` 与 `🌍 流媒体` 不提供 `DIRECT` 成员。
- `🍎 Apple` 默认首选 `DIRECT`，但可手动切换地区或全局手动节点。
- 长尾地区节点仍可通过 `🚀 手动选择` 访问。

### Rule

规则按 Surge 自上而下、首次命中生效：

1. LAN
2. AI 与 Apple Intelligence 特例
3. SYSTEM、Apple 中国服务与可切换的 Apple 通用服务 / CDN
4. 国际流媒体
5. Bilibili corpus，跟随 `🚀 手动选择`
6. 中国大陆域名
7. 带 `no-resolve` 的 IP 规则与 GEOIP
8. 唯一且最后的 `FINAL,🚀 手动选择,dns-failed`

窄规则优先处理已知冲突：`api.github.com` 不进入 AI 聚合规则；Apple Intelligence 高于 SYSTEM；Apple 中国服务保持 DIRECT；通用 Apple 服务与主要 CDN 进入默认 DIRECT 的 `🍎 Apple`；Bilibili 在国内聚合规则之前命中。

## 确定性验证

Required CI 只依赖当前仓库与当前 commit，不实时下载外部 RULE-SET：

```bash
node scripts/validate-config.mjs
```

主要门禁覆盖：

- section、General key、policy group 与 group parameter 去重
- 引号、转义、行内注释、空组件等语法边界
- General 网络行为契约
- policy 引用、`include-other-group` 递归依赖、循环与 FINAL 位置
- `AND` / `OR` / `NOT` 的受支持结构
- 10 个可见组与 6 个地区 helper 的零节点安全性
- service group 不直接铺开 raw proxies
- AI / 流媒体不得加入 `DIRECT`；Apple 必须以 `DIRECT` 为首成员
- IP-bound rules 的 `no-resolve`
- 活动 URL allowlist、注释 URL、安全凭据与节点泄漏检测
- 地区 regex 的正向 / 负向场景
- 高价值 hostname 的 first-match 路由矩阵
- 负向 fixture 与合法演进 fixture

Validator 验证的是**语义契约**，不是完整文本 hash；合法注释、图标和规则演进不需要人为更新整份快照。

## 外部规则漂移

外部网络审计与 Required CI 分离：

```bash
node scripts/audit-external-rules.mjs
```

`Audit External Rule Drift` 每周执行，也支持手动触发。它实时读取当前外部规则资源，检查可达性、格式、规模、关键契约与 first-match 路由结果。

普通 fingerprint 变化本身不会失败；只有资源不可用、结构异常、关键契约消失或最终路由语义发生破坏性变化才失败。

## 维护流程

修改 Profile 时：

1. 只改有明确收益的行为。
2. 运行 `node scripts/validate-config.mjs`。
3. 涉及外部规则依赖时再运行 `node scripts/audit-external-rules.mjs`。
4. 检查完整 diff 与 `git diff --check`。
5. push 前确认远端 `main` 未发生意外前移；不 force push。
6. CI 通过后，如变更影响真实网络体验，再以 iPhone / Surge 真机结果作为最终证据。

## 文件与安装

- [`Beatrice-Surge.conf`](./Beatrice-Surge.conf)
- [Raw Profile](https://raw.githubusercontent.com/BeatriceArchive/Beatrice-Surge-Config/main/Beatrice-Surge.conf)
