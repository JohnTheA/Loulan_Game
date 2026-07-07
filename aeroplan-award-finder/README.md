# Aeroplan Award Finder — 加拿大航空里程票查询工具

用命令行批量查询 **加拿大航空 Aeroplan** 里程票（奖励机票）的放票情况，支持：

- 多出发地、多目的地、日期区间一次性查询
- 按舱位（经济/超经/商务/头等）、里程上限、是否直飞过滤
- `routes.yaml` 关注航线清单，一条命令扫完所有航线
- GitHub Actions 每日定时自动检查，结果写入运行摘要

## 数据来源

数据来自 [seats.aero](https://seats.aero) 的 Partner API。它持续抓取并缓存 Aeroplan（以及 United、Lifemiles 等十几个里程计划）的奖励票放票数据，是目前查星空联盟里程票最稳定的方式——加航官网没有公开 API，直接爬取很容易被风控拦截。

使用前需要：

1. 注册 seats.aero 并订阅 Pro（约 $9.99 USD/月）
2. 在 <https://seats.aero/apikey> 生成 API key
3. 设置环境变量：`export SEATS_AERO_API_KEY=你的key`

> 如果只是偶尔手动查，也可以直接用 seats.aero 网页版免费搜索；这个工具的价值在于批量、自动化和定时监控。

## 安装

```bash
pip install -r requirements.txt
```

需要 Python 3.10+。

## 用法

### 单次查询

```bash
# 温哥华/多伦多 → 北京/上海，9 月商务舱，9 万里程以内
python -m aeroplan_finder search \
  --from YVR YYZ --to PEK PVG \
  --start 2026-09-01 --end 2026-09-30 \
  --cabin business --max-miles 90000
```

输出示例：

```
日期        航线       舱位    里程    余票  直飞    承运航司
2026-09-12  YVR → PVG  商务舱  87,500  2     ✈ 直飞  AC
2026-09-18  YYZ → PEK  商务舱  85,000  ≥1    中转    AC, NH
```

常用参数：`--cabin economy premium business first`、`--direct-only`、`--markdown`（输出 markdown 表格）、`--source united`（换其他里程计划）。

### 批量监控关注航线

```bash
cp routes.example.yaml routes.yaml   # 编辑成自己关注的航线
python -m aeroplan_finder watch --config routes.yaml
```

### GitHub Actions 每日自动检查

仓库中已带 `.github/workflows/daily-check.yml`，每天 UTC 13:00 自动跑一遍 `watch`，结果写入 Actions 运行摘要。启用方法：

1. 在仓库 **Settings → Secrets and variables → Actions** 添加 secret `SEATS_AERO_API_KEY`
2. 把 `routes.example.yaml` 改名提交为 `routes.yaml`（或保持示例配置）
3. 也可以在 Actions 页面手动触发（workflow_dispatch）

## 里程参考（Aeroplan 北美 ↔ 东亚，单程）

| 舱位 | 常见区间 |
|---|---|
| 经济舱 | 35k – 55k |
| 超经舱 | 45k – 70k |
| 商务舱 | 75k – 90k（AC 自家动态定价可能更高） |

星盟伙伴（如 ANA、EVA）按固定表价，通常比 AC 自家动态价划算。

## ⚠️ 迁移到独立仓库

这个项目目前作为 `Loulan_Game` 仓库的子目录存在（本次会话的 GitHub 权限无法直接新建仓库）。**GitHub Actions 定时任务只有在它成为独立仓库后才会生效。** 迁移方法——先在 GitHub 网页上新建一个空仓库（如 `aeroplan-award-finder`，不要勾选初始化 README），然后：

```bash
git clone -b claude/canada-airlines-miles-finder-plt1xv \
  https://github.com/JohnTheA/Loulan_Game.git loulan-tmp
cd loulan-tmp
git subtree split -P aeroplan-award-finder -b finder-main
git push https://github.com/JohnTheA/aeroplan-award-finder.git finder-main:main
cd .. && rm -rf loulan-tmp
```

迁移后记得在新仓库配置 `SEATS_AERO_API_KEY` secret。
