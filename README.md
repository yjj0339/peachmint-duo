# PEACHMINT · 桃薄荷双人馆

独立实现的双人对战小游戏馆：三款服务端裁判的游戏（五子连珠、猜拳抢三、翻转黑白），手机与电脑浏览器即开即玩。

本项目由单一会话从零编写，不依赖、不复制本机任何其他项目的代码或素材。

- 前端：原生 ESM + CSS，无构建步骤，`client/` 即静态站点。
- 后端：Node.js + Socket.IO，房间、序号去重、3 秒同步开局、断线 60 秒判负、令牌重连、隐藏信息按座位下发；已结束对局写入 `runtime/data/matches.sqlite`（node:sqlite）。
- 端口：默认 4412（`PORT` 环境变量可改）。

## 运行

```powershell
& 'D:\codexAI\.toolchains\powershell\pwsh.exe' -NoProfile -File 'D:\codexAI\peachmint-duo\scripts\start.ps1'
```

或直接用 D 盘 Node：`D:\codexAI\.toolchains\emsdk\node\24.19.0_64bit\node.exe server\index.js`

停止：`scripts\stop.ps1`（只停止状态文件记录的本项目进程）。

## 测试

`npm test`（D 盘 Node）：规则引擎与房间协议共 8 组断言全绿；`runtime/temp/match-check.mjs` 为真实双 Socket 客户端对局脚本（满员拒绝、结算、私密字段、再来一局幂等）。

## 公网

GitHub Pages 托管 `client/` 静态前端；对战服务在本机，通过临时 Cloudflare Tunnel 暴露 4412。 Pages 页面用 `?server=<地址>` 指定对战服务；本机直连 `http://127.0.0.1:4412`。

远程对战要求本机开机联网且服务与隧道在运行；临时隧道地址每次启动可能变化。
