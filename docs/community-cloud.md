# 轻量云端互动

正式网站：`https://deepcook.jijiz.cn`。API：`https://strbot.jijiz.cn/deepcook-api/v1`，复用现有有效 HTTPS 虚拟主机的独立路径。

## 数据边界

- SQLite 只存内置菜谱的评分、评论与作业文字。API 不接收图片、Base64、作者名或客户端提供的所有者 ID。
- 菜谱与配图继续由原静态网站提供。用户作业照片继续保存在当前浏览器；其他访客只能看到公开的作业文字。
- 收藏、历史、资料、偏好及个人菜谱保持本地。旧互动不自动发布，界面标为「仅本机」；原有评分可在重新评价时由用户主动发布。
- 内置 App 示例由前端合成并明确标识，不写入线上数据库。营养表仍为 App 示例，不是实测值。

## 身份与权限

前端生成 256 位随机访客令牌，只保存在本站的 localStorage，并通过 HTTPS 的 Authorization 请求头发送。服务端仅存 SHA-256 摘要，所有更新与删除都按摘要校验归属，不相信客户端传入的作者或所有者。其他浏览器可以阅读公开内容，不能修改这个浏览器的评分或删除其帖子。

这不是登录账号：清除站点数据或更换浏览器后会取得新身份，不能继续管理旧记录。一个人使用不同浏览器可以分别评分；需要跨设备统一身份时须另行接入账号。CORS 允许来源不是身份校验。当前生产仅允许 `https://deepcook.jijiz.cn`，无跨站 Cookie；开发与集成测试使用独立的本机 API。

## 服务与性能

- Python 3.12 + 固定版本 Gunicorn，1 个 worker、4 个线程；内存上限 160 MiB、CPU 上限 1 个逻辑核，独立非登录用户 `deepcook`。
- 仅监听 `127.0.0.1:8391`，不开放新公网端口。现有 OpenResty 的 `/deepcook-api/` 路径代理请求，其余 AstrBot 配置不变。
- SQLite 使用 WAL、FULL 同步、单连接及进程内锁；微型事务串行提交，不依赖有竞争的多写连接。评分使用 `(recipe,owner)` 主键；评分汇总与帖子游标查询均有索引。
- 首次请求只返回十档评分计数、个人评分、总数、每类最近 5 条文字及下一页游标；不会返回所有评分或一次下载所有评论。每类后续按 5 条继续加载。
- GET 支持私有 ETag 条件读取。浏览器先展示当前身份对应的缓存，再读取服务器；离线显示缓存及错误状态，不将未成功发布的数据伪装为线上记录。API 不进入静态 Service Worker 缓存。
- 写入要求有效访客令牌与允许的来源，限制每分钟/每小时的访客及 IP 操作量。只接受允许列表中的菜谱 ID、1–10 整数评分及最多 2000 UTF-16 代码单元的非空正文，最大请求体 12 KiB。
- 日志不记录 Authorization 或请求正文。数据库不保存原始访客令牌。

## 发布与本地图片

作业先保存本地草稿 ID 与本地附图，再提交文字。客户端提供随机 UUID 作为幂等 ID；相同内容的同一请求可安全重试，冲突内容返回 409。只有文字提交成功后才清理草稿，网络中断时保留输入。两个存储系统没有分布式事务；网络结果不确定时保留本地照片副本，以免丢失已发布作业对应的照片。清除浏览器数据会删除这些本地副本。

其他访客收到的帖子没有图片地址。作者再次读取自己的帖子时，前端按帖子 ID 匹配本地照片。删除共享帖子先校验服务端所有权，再清理作者的本地照片；重复删除安全。删除个人菜谱只清理其本地数据。

## 部署与备份

源码位于 `server/`。部署脚本只上传小型 API 源码、菜谱 ID 列表及 systemd 单元，不上传或迁移静态资源、APK 和照片。适用于已配置好 HTTPS 虚拟主机的 1Panel/OpenResty 服务器：

```bash
python3 server/deploy.py --host root@YOUR_SERVER --identity /path/to/key.pem \
  --api-host EXISTING_HTTPS_HOST --origin https://YOUR_WEB_HOST
```

SSH 使用临时 0600 密钥副本，退出后清理。应用与独立 venv 位于 `/opt/deepcook-community`，数据位于 `/var/lib/deepcook-community/community.sqlite3`，来源配置位于 `/etc/deepcook-community.env`。已有应用源码保留在 `previous-*` 目录以便回退；部署不会清空数据库。OpenResty 配置先通过 `nginx -t` 再平滑重载；配置检查失败会恢复原代理文件。

`deepcook-backup.timer` 每日 04:20 调用 SQLite online backup API，验证结果后保留最近 7 份在 `/var/lib/deepcook-community/backups`。这些备份仍在同一服务器，只覆盖误操作/文件损坏恢复，不是异地灾备。恢复时先停止 API，保留现有数据库和 WAL 后再从验证过的备份恢复。

```bash
systemctl status deepcook-community
systemctl status deepcook-backup.timer
curl https://strbot.jijiz.cn/deepcook-api/v1/health
```

生产构建使用 `.env.production` 中的公开 API URL，不含私钥或上游 AI key。未来 AI 服务不能直接继承匿名交流接口的权限方案，需另行设置访问与费用限制。

## 测试

```bash
python3 -m unittest discover -s tests -p test_community_server.py -v
npm test
npm run build:test
npm run test:e2e -- tests/browser/community.spec.ts
npm run build:test -- --cloud
npm run test:e2e -- --config playwright.cloud.config.ts
npm run build
```

云端浏览器测试自动启动本机临时 SQLite API，分别验证两个访客的权限、共享文字、本地图片、断网重试、缓存和分页。测试不向生产数据库写入内容。服务器上线后额外执行 HTTPS/CORS/归属验证，测试记录立即清理。
