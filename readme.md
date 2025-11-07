# checkin-reminder · 囤囤鼠的签到备忘录

> “今天豆子领了吗？积分签了吗？现金券兑了吗？”  
> 别再满屏书签与提醒事项了。
> **checkin-reminder** 把你的每日签到/领取/兑换入口整齐收好，点击跳转签到、自动标记状态，专为囤囤鼠打造。

## ✨ 特性

- **一屏管理**：把所有「签到/领取/兑换」条目聚合，分组 + 标签随手筛。  
- **点了就记**：点击“签到”按钮即自动记为“今日已签”；若有“兑换”链接，系统会在你**签 + 兑**都点过后再算完成（防止只点了一半）。  
- **权限管理**：管理员口令验证后方可查看/新增/编辑/删除条目。  
- **明/暗主题**：右上角一键切换。  
- **持久化与清理**：后端用 Cloudflare D1 保存签到记录，并按周期自动清理旧记录。  

## 🧱 架构

- **前端**：一体化 HTML（内置 TailwindCDN），零依赖构建，直接随 Worker 发。  
- **后端**：Cloudflare Worker 提供页面与 JSON API。  
- **数据**：Cloudflare D1（SQLite），表结构见 `schema.sql`。  
- **定时任务**：Worker 的 `scheduled` 事件按设定清理过期签到记录。  

## 📂 目录
```
schema.sql # D1 数据库表结构
wrangler.toml # Cloudflare 部署配置
src/
└─ worker.js # Worker 源码（页面 + API）
 ```

 
## 🚀 快速开始

**前置**：已安装 [Wrangler](https://developers.cloudflare.com/workers/wrangler/) 并登录 Cloudflare 账号，或使用 npm wrangler，基本同理。

1) **创建 D1 并导入表结构**
```bash
# 创建 D1 数据库，名称可以修改，和 wrangler.toml 保持一致
wrangler d1 create checkin-reminder  
# 把返回的数据库名称写进 wrangler.toml 的 d1_databases 绑定
wrangler d1 execute <你的D1名称> --file=./schema.sql
```

2) **配置环境变量和密钥**
- 管理口令：建议非明文创建
```bash
wrangler secret put ADMIN_TOKEN
```
- 时区与清理天数：修改 `wrangler.toml` 里的 `[vars]` 段

3) **部署 Worker**
```bash
wrangler deploy
```

