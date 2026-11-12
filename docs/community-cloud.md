# 轻量云端互动

网页：`https://deepcook.jijiz.cn`。API：`https://deepcook-backend.jijiz.cn/deepcook-api/v1`。

## 数据边界

- SQLite 保存评分、评论、作业文字及图片关联；作业照片保存在服务器 `/var/lib/deepcook-community/media`，不放进数据库 BLOB 或菜谱 JSON。
- 内置菜谱封面、步骤图等静态资源继续由原网站提供，不上传或迁移。
- 登录后，收藏、最近浏览、昵称、头像、喜欢/忌口、显示和阅读偏好、个人菜谱及其图片随账号同步。游客保持本地；旧私有互动不会自动公开。账号缓存与草稿按账号隔离。
- 之前已经公开文字、照片仍在作者本机的作业：原浏览器联网读取时补传附图，确认成功后释放旧本地副本。失败保留原件并提示刷新重试；其他设备无法补传从未收到的本地文件。
- 原先前端合成的 15 道菜互动已一次性转入云端：45 条评分、15 条评论、15 条作业及附图。正文、作者与原时间保留，按普通云端记录展示；前端不再生成或叠加这些内容。营养示例继续明确标识，不写入互动数据库。

## 身份与权限

登录、注册页面分别为 `/app/#/login`、`/app/#/register`，不使用弹窗，也不显示网站底部栏；常用电脑、平板和手机尺寸采用一屏布局，极短视口保留原生滚动。在线版顶栏根据会话显示账号入口或头像/昵称；注册与登录可携带校验后的站内返回路径，成功后返回来源页面。

账号采用用户名和密码注册、登录；目前不收集邮箱，未启用邮箱验证或邮件找回。用户名为 3–24 位 ASCII 字母、数字或下划线，按小写唯一；昵称最多 12 个字。密码 15–128 个字符，使用随机盐及 600,000 轮 PBKDF2-HMAC-SHA256，只在受限并发的密码计算区校验，不保存明文。方案参考 [OWASP 密码存储建议](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)。

生产使用 `__Host-deepcook_session`：HTTPS、HttpOnly、SameSite=Lax、Path=/、无 Domain，7 天绝对有效期。会话随机 256 位，数据库只保存摘要，可退出撤销，最多保留 10 个会话。本机测试显式使用非 Secure 的不同 Cookie 名，生产始终强制 Secure。前端 localStorage 仅保存可公开的账号提示和原有随机访客身份，不保存账号密码或会话令牌。

公开互动支持游客。注册/登录时可选择凭当前访客令牌将已发布的评分、评论、作业和待发布附图归到账号；账号已有评分优先，不重复计数。游客令牌在迁移后不再拥有这些公开记录。未选择合并时不修改游客记录。资料合并按 ID 去重，已有同 ID 云端菜谱优先，本机原件保留。

带 Cookie 的所有写请求要求精确来源白名单；CORS 回应具体来源及 Allow-Credentials，拒绝通配来源。`X-DeepCook-Account` 将已知账号与实际会话比对，过期后不会静默以游客身份写入。正式网页与 API 同为 HTTPS `jijiz.cn` 站点；EdgeOne 临时域名属于跨站来源，其登录 Cookie 可能被浏览器第三方 Cookie 策略阻止，登录应在正式域名验证。第三方来源不会获得个人数据。

## 私人厨房同步

- `GET /auth/session`、`POST /auth/register`、`POST /auth/login`、`POST /auth/logout` 管理账号。认证与个人数据响应均为 private/no-store。
- `GET /account/data` 返回个人资料与修订号；`PUT /account/data` 接收修订号、随机操作 ID 和完整资料。过期版本返回 409，前端读取最新版本并重放当前变更。操作 ID 防止响应丢失后重试重复执行；同时修改同一道个人菜谱时保留草稿并提示核对。
- 账号资料 JSON 上限 900 KiB（适配现有 1 MiB 代理限制），最多 200 道个人菜谱、5000 条收藏和 50 条最近浏览。服务端逐字段校验结构、取值及图片归属，忽略客户端身份声明。
- `PUT /account/media` 接收头像、个人封面及步骤图：JPEG、最长边 1200、最多 1 MiB，重新编码去除元数据。SQLite 保存关联，文件在 `/var/lib/deepcook-community/account-media`，每账号最多 200 MiB、2000 个引用。私有图片与公开作业图片分目录。
- `GET /account/media/<摘要>.jpg` 必须登录且属于当前账号；不公开、不进入 Service Worker 缓存。账号互相不可读取。移除资料中的图片会清理关联和不再引用的文件，未完成上传保留最多一天。
- 浏览器以账号 ID 隔离资料缓存、交流缓存与编辑草稿。退出后回到游客数据；离线只展示此账号已有的缓存，保存需要联网。账户提示不作为服务端授权依据。

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
- 访客及 IP 限流。文字最多 2000 UTF-16 代码单元、互动 JSON 请求最多 12 KiB、账号资料最多 900 KiB、图片请求最多 1 MiB。日志不记录 Authorization 或正文。

DNS A 记录 `deepcook-backend.jijiz.cn` 指向服务器公网 IP。站点管理员自行在面板配置 HTTPS 和代理，模板为 [server/nginx-community.conf](../server/nginx-community.conf)。代理 `/deepcook-api/` 到 `http://127.0.0.1:8391`，保留完整路径；`proxy_pass` 不加尾斜杠。`/internal/` 返回 404，其余路径也可返回 404。

此前 `strbot.jijiz.cn` 下由本项目添加的代理已撤除，AstrBot 原有代理不变。部署脚本只更新应用及 systemd，不再修改或重载任何站点代理。

```bash
python3 server/deploy.py --host root@YOUR_SERVER --identity /path/to/key.pem \
  --api-host deepcook-backend.jijiz.cn --origin https://deepcook.jijiz.cn --service-only
```

SSH 使用临时 0600 密钥副本，退出后清理。应用位于 `/opt/deepcook-community`，数据及图片位于 `/var/lib/deepcook-community`。来源与内部备份密钥位于 `/etc/deepcook-community.env`，不回传前端。旧源码保留在 `previous-*`，部署不清空数据。

## 初始互动迁移

冻结清单为 `server/legacy-community.json`，仅包含原先首 12 道及精选菜谱的互动。管理员在 API 停止时，以服务用户执行 `server/promote_community.py --assets /path/to/catalog`。脚本先将原附图按现有上传流程保存到云端文件目录，再按菜谱事务提交评分、正文和公开关联。

`community_imports` 按版本和菜谱记录迁移完成状态；重跑不会重复计分、重复发帖或恢复已删除记录。`profiles` 保存迁入作者昵称，身份随机生成，普通访客不能删除他人内容，公开写入接口仍拒绝伪造作者。迁移不会覆盖其他用户的已有互动。迁移结束生成包含数据库与附图的备份；普通部署不会自动再次导入。

## 备份与恢复

`deepcook-backup.timer` 每日 04:20 调用带密钥的本机接口。在同一应用锁内执行 SQLite online backup、完整性检查及公开图片和私有账号图片的硬链接，保证数据库快照与图片一致。保留最近 7 份完整快照于 `/var/lib/deepcook-community/backups`。硬链接复用不可变文件数据块，删除在线作业不会破坏备份。

内部接口不经公网代理，且要求独立密钥、回环来源及无代理客户端 IP。旧版独立数据库备份保留。当前是同机备份，不是异地灾备。

恢复时先停止服务，保留原数据库、WAL 和图片，将选定完整快照的 `community.sqlite3`、`media/` 与 `account-media/` 一起恢复并保持 `deepcook` 权限，再启动验证。不能只恢复数据库。

```bash
systemctl status deepcook-community
systemctl status deepcook-backup.timer
curl https://deepcook-backend.jijiz.cn/deepcook-api/v1/health
```

## 测试

在 Python 虚拟环境安装 `server/requirements.txt` 后执行：

```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
npm test
npm run build:test
npm run test:e2e -- tests/browser/community.spec.ts
npm run build:test -- --cloud
npm run test:e2e -- --config playwright.cloud.config.ts
npm run build
```

云端浏览器测试使用本机临时 API，验证跨访客图文共享、上传失败不发布、响应丢失后幂等重试、旧附图补传、缓存和分页，以及账号注册、登录、退出、跨浏览器的完整个人资料/图片同步、保存重试与并发合并，不写入生产数据库。单元测试还覆盖文件清理、配额、权限、图片校验及图文联合备份恢复。
