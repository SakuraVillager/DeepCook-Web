# 轻量云端互动

网页：`https://deepcook.jijiz.cn`。API：`https://deepcook-backend.jijiz.cn/deepcook-api/v1`。

## 数据边界

- SQLite 保存评分、评论、作业文字及图片关联；作业照片保存在服务器 `/var/lib/deepcook-community/media`，不放进数据库 BLOB 或菜谱 JSON。
- 内置菜谱封面、步骤图等静态资源继续由原网站提供，不上传或迁移。
- 收藏、历史、资料、偏好及个人菜谱保持本地。旧私有互动不会自动公开，界面保留「仅本机」标识。
- 之前已经公开文字、照片仍在作者本机的作业：原浏览器联网读取时补传附图，确认成功后释放旧本地副本。失败保留原件并提示刷新重试；其他设备无法补传从未收到的本地文件。
- App 示例与营养示例明确标识，由前端合成，不写入服务器数据库。

## 身份与权限

前端在本站 localStorage 保存 256 位随机访客令牌，通过 HTTPS Authorization 发送。服务端只保存摘要，评分修改、图片上传和删除均校验归属，不相信客户端提供的作者字段。图片和文字发布后均可公开查看。

目前没有登录账号，清除站点数据或更换浏览器会取得新身份，不能继续管理旧记录，但已公开图文仍保留并可阅读。跨设备统一身份需另行接入账号。CORS 允许来源不是身份校验；生产只允许 `https://deepcook.jijiz.cn`，不依赖跨站 Cookie。

## 发布与图片存储

1. 草稿保留稳定帖子 ID。浏览器将图片压缩为 1200×900、4:3 JPEG，单张最多 1 MiB。
2. 附图通过独立二进制 PUT 上传，不做 Base64 传输。服务器校验 JPEG、尺寸和大小，重新编码移除元数据及尾随内容，按内容摘要使用固定 `.jpg` 文件名。
3. 上传阶段图片不可公开访问。提交文字时在数据库事务内一并公开作业与图片关联；缺少附图则拒绝发布带图作业。失败保留输入、照片和 ID，响应丢失后可幂等重试。
4. 取消草稿尝试清理未发布上传。未完成上传最多保留 24 小时，每位访客最多 8 张待发布图片；每日备份及后续写入清理过期内容。
5. 删除作业先校验归属并移除记录与关联，再清理不被引用的文件。同图多条作业共享时保留文件，图片 URL 只对仍有公开关联的文件有效。

图片使用公开缓存、不可变内容地址与 ETag，并通过文件包装器或分块返回，避免整批图片进入内存。默认活动图片预算 5 GiB，磁盘预留至少 2 GiB；容量不足明确报错，不发布缺图记录。SQLite 重启和普通发布不会丢弃已关联文件。

## 服务与反向代理

- Python 3.12、Gunicorn 1 worker / 4 threads、Pillow 校验图片；独立 `deepcook` 用户，内存上限 160 MiB、CPU 上限 1 个逻辑核。
- 仅监听 `127.0.0.1:8391`。SQLite 使用 WAL、FULL 同步、单连接与进程内锁，索引支持汇总和每类 5 条的游标分页。
- 浏览器先展示身份缓存，再刷新服务器。JSON 使用私有 ETag，图片使用公开内容缓存；API 不进入静态 Service Worker 缓存。
- 访客及 IP 限流。文字最多 2000 UTF-16 代码单元、JSON 请求最多 12 KiB、图片请求最多 1 MiB。日志不记录 Authorization 或正文。

DNS A 记录 `deepcook-backend.jijiz.cn` 指向服务器公网 IP。站点管理员自行在面板配置 HTTPS 和代理，模板为 [server/nginx-community.conf](../server/nginx-community.conf)。代理 `/deepcook-api/` 到 `http://127.0.0.1:8391`，保留完整路径；`proxy_pass` 不加尾斜杠。`/internal/` 返回 404，其余路径也可返回 404。

此前 `strbot.jijiz.cn` 下由本项目添加的代理已撤除，AstrBot 原有代理不变。部署脚本只更新应用及 systemd，不再修改或重载任何站点代理。

```bash
python3 server/deploy.py --host root@YOUR_SERVER --identity /path/to/key.pem \
  --api-host deepcook-backend.jijiz.cn --origin https://deepcook.jijiz.cn --service-only
```

SSH 使用临时 0600 密钥副本，退出后清理。应用位于 `/opt/deepcook-community`，数据及图片位于 `/var/lib/deepcook-community`。来源与内部备份密钥位于 `/etc/deepcook-community.env`，不回传前端。旧源码保留在 `previous-*`，部署不清空数据。

## 备份与恢复

`deepcook-backup.timer` 每日 04:20 调用带密钥的本机接口。在同一应用锁内执行 SQLite online backup、完整性检查及图片硬链接，保证数据库快照与图片一致。保留最近 7 份完整快照于 `/var/lib/deepcook-community/backups`。硬链接复用不可变文件数据块，删除在线作业不会破坏备份。

内部接口不经公网代理，且要求独立密钥、回环来源及无代理客户端 IP。旧版独立数据库备份保留。当前是同机备份，不是异地灾备。

恢复时先停止服务，保留原数据库、WAL 和图片，将选定完整快照的 `community.sqlite3` 与 `media/` 一起恢复并保持 `deepcook` 权限，再启动验证。不能只恢复数据库。

```bash
systemctl status deepcook-community
systemctl status deepcook-backup.timer
curl https://deepcook-backend.jijiz.cn/deepcook-api/v1/health
```

## 测试

在 Python 虚拟环境安装 `server/requirements.txt` 后执行：

```bash
python3 -m unittest discover -s tests -p test_community_server.py -v
npm test
npm run build:test
npm run test:e2e -- tests/browser/community.spec.ts
npm run build:test -- --cloud
npm run test:e2e -- --config playwright.cloud.config.ts
npm run build
```

云端浏览器测试使用本机临时 API，验证跨访客图文共享、上传失败不发布、响应丢失后幂等重试、旧附图补传、缓存和分页，不写入生产数据库。单元测试还覆盖文件清理、配额、权限、图片校验及图文联合备份恢复。
