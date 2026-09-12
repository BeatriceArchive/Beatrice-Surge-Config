# Beatrice Surge Config

[![Validate Surge Config](https://github.com/BeatriceArchive/Beatrice-Surge-Config/actions/workflows/validate.yml/badge.svg)](https://github.com/BeatriceArchive/Beatrice-Surge-Config/actions/workflows/validate.yml)
[![Audit External Rule Drift](https://github.com/BeatriceArchive/Beatrice-Surge-Config/actions/workflows/external-drift.yml/badge.svg)](https://github.com/BeatriceArchive/Beatrice-Surge-Config/actions/workflows/external-drift.yml)

Beatrice 的公开 Surge iOS 配置壳。仓库保存经过验证的 `[General]`、`[Proxy Group]` 和 `[Rule]`，不保存真实代理节点、订阅地址或凭据。

## 架构与边界

`Beatrice-Surge.conf` 故意不包含 `[Proxy]`。运行时由私人订阅层只注入代理节点；公开模板继续决定网络基线、策略组和路由规则。

公开仓库禁止出现：

- 真实代理节点和 `[Proxy]`
- 机场订阅、私人 managed profile URL
- password、username、private key、Token 等凭据
- MITM、Rewrite 或 Script 资产

配置中的活动 URL 采用小型 allowlist：当前只接受明确的规则源、图标源和代理测试端点。注释也会被完整扫描，只允许无凭据、无查询参数的已知公共文档/源码 host，避免旧订阅 URL 藏在禁用文本中；README 中的普通文档链接不参与此门禁。

## 配置模型

### General

- System DNS；代理目标默认保持远端解析语义
- Surge iOS VIF-only：`compatibility-mode = 3`
- IPv6 关闭
- Wi-Fi / 热点共享关闭
- 按既定范围接管全网络
- 不支持 UDP 的策略直接拒绝，避免静默直连
- ICMP forwarding 关闭
- `http://www.gstatic.com/generate_204` 作为显式代理可用性测试端点；`test-timeout = 5`

### Proxy Group

策略分三层：

1. 业务 / 全局层：`🚀 手动选择`、`🤖 AI`、`🌍 流媒体`、`🍎 Apple`。手动入口导入全部真实节点；AI、流媒体和 Apple 通过六个地区与手动入口复用节点，不重复展开 raw proxies。Apple 首选项固定为 `DIRECT`，需要时可手动切换六区或全局手动节点；该选择覆盖主要 Apple 用户服务和主要 Apple CDN/static assets，不宣称覆盖所有 Apple 或共享 CDN 流量。
2. 地区人工层：香港、日本、新加坡、美国、台湾、韩国。每组默认使用自动 helper，也能持久固定真实地区节点。
3. 地区自动层：隐藏的 `fallback` helper。每个 helper 都把 `REJECT` 作为首个显式成员，再按地区 regex 导入运行时节点。

当前用户可见策略组共 10 个：四个业务/全局组和六个地区组。六个 `⚡ 地区自动` helper 均使用 `hidden=true`。

当某地区没有节点时，helper 仍有 `REJECT`，不会成为空组并触发 `SUBSTITUTE → DIRECT`。AI 和流媒体不提供 `DIRECT` 成员；英国、德国、加拿大等长尾地区节点仍可从 `🚀 手动选择` 访问。

### Rule

规则遵循 Surge 自上而下、首次命中生效的模型：

- LAN
- AI 与 Apple Intelligence 特例
- SYSTEM、Apple 中国服务与可切换的 Apple 通用服务
- 国际流媒体
- 跟随 `🚀 手动选择` 的 Bilibili corpus
- 中国大陆域名
- 带 `no-resolve` 的 IP 规则和 GEOIP
- 唯一且最后的 `FINAL,🚀 手动选择,dns-failed`

明确的窄规则优先处理已知冲突：`api.github.com` 不随上游 AI 聚合规则进入 AI；Apple Intelligence 进入 `🤖 AI`，SYSTEM 与 Apple 中国服务保持 DIRECT，`apple_services.conf` 与 SKK `domainset/apple_cdn.conf` 进入默认 DIRECT 的 `🍎 Apple`。真机确认但 upstream 尚未覆盖的 `afs.ampaeservices.com` 使用精确本地规则，不扩大为整个 suffix；Bilibili 在国内聚合规则之前命中并跟随全局手动选择。

## 确定性验证

Required CI 只读取当前仓库和当前 commit，不 checkout 其他仓库，也不实时下载外部 RULE-SET：

```bash
node scripts/validate-config.mjs
```

硬性门禁包括：

- section、General key、policy group 和 group parameter 不得重复
- 单/双引号、引号内逗号、受支持转义、quote-aware 行内注释和空组件的语法检查
- General 网络行为契约
- policy 引用、`include-other-group` 递归依赖、未定义成员、循环和 FINAL 位置
- Surge `AND` / `OR` / `NOT` 的窄而完整结构验证；公开产品边界继续显式拒绝 `SCRIPT`
- 十个必需可见组、六组地区人工选择及 helper 的 zero-node fail-closed 安全性
- service group 不得直接铺开 raw proxies；AI/流媒体不得加入 `DIRECT`，Apple 必须以 `DIRECT` 为首成员
- IP-bound rules 的 `no-resolve`
- 活动 URL allowlist、全配置（含注释）公共 URL 门禁、具体节点与常见凭据泄漏检测
- 精度优先的地区 regex（美国支持 `USA` 且排除 `South America`、`USAID`、`USDT` 等），以及零节点、单区、部分六区、完整六区、纯长尾、混合、重名和 126 节点场景
- 29 个高价值 hostname 的 first-match 路由矩阵，覆盖 Apple Intelligence、SYSTEM、Apple 中国、Apple 通用服务与 Apple CDN 的优先级
- 44 个负向 fixture；只有 validator 正常以预期 validation failure 退出才算成功拒绝
- 合法演进 fixture：新增合法业务组、`include-other-group`、logical rule、公共文档注释和图标变化不会被文本快照误杀

规则数量、注释、图标和完整 `[Rule]` 文本不做 SHA256 冻结。合法演进只需继续满足语义契约和冲突测试。

## 外部漂移审计

`Audit External Rule Drift` 每周运行一次，也支持手动触发：

```bash
node scripts/audit-external-rules.mjs
```

它检查当前 8 个外部规则资源（7 个 `RULE-SET`、1 个 `DOMAIN-SET`）的可达性、非空、格式、合理规模、IP-only 规则族和少量关键契约，并用实时下载的完整上游内容模拟当前 profile 的 first-match 路由。28 个关键 hostname 用来发现 AI、Apple 服务/CDN、流媒体、Bilibili、国内与 FINAL 之间的真实捕获冲突。每次打印内容 fingerprint 便于追踪；单纯 fingerprint 变化不会失败，只有无法获取、格式/规模异常、关键契约丢失或最终路由语义改变才失败。

外部网络检查刻意不进入 required CI，因此同一仓库 commit 的主要验证不会随上游 mutable 内容或临时网络故障随机变化。

## 维护流程

修改配置时同步更新对应语义断言：

1. 运行 `node scripts/validate-config.mjs`。
2. 若修改外部 RULE-SET 依赖，再运行 `node scripts/audit-external-rules.mjs`。
3. 检查完整 diff 与 `git diff --check`。
4. 确认远端 `main` 未前移后再 fast-forward push；不 force push。

不要求每次规则变化更新整份 corpus hash，也不因普通上游 fingerprint 漂移修改仓库。

## 配置文件

- [`Beatrice-Surge.conf`](./Beatrice-Surge.conf)
- [Raw](https://raw.githubusercontent.com/BeatriceArchive/Beatrice-Surge-Config/main/Beatrice-Surge.conf)
