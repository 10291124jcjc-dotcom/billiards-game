# 双人台球游戏

## 启动方式

### 方式 1：双击启动，推荐

双击 `start-game.bat`。

它会：

- 启动本地服务器
- 自动打开默认浏览器
- 进入 `http://127.0.0.1:8080/`

### 方式 2：本地服务器启动

如果你更想用 PowerShell，也可以运行 `start.ps1`，它会：

- 启动本地网页服务器
- 自动打开浏览器
- 访问 `http://localhost:8080/`

### 方式 3：直接打开

直接用浏览器打开 `index.html`。

## 操作说明

- 鼠标在白球附近按下并拖动来瞄准
- 松开鼠标击球
- 进球继续出杆
- 空杆换人
- 白球落袋判失误并重置

## 文件

- `index.html`：页面入口
- `styles.css`：界面样式
- `game.js`：台球逻辑和碰撞
- `server.js`：本地静态服务器
- `start-game.bat`：双击启动入口

## 发布到 GitHub Pages

这个项目是静态网站，最适合直接发布到 GitHub Pages。

### 推荐仓库名

如果你想把网站发布成主站地址，仓库名用：

`你的GitHub用户名.github.io`

如果你只是想发成一个普通项目页，也可以使用任意仓库名。

### 发布步骤

1. 在 GitHub 新建一个公开仓库
2. 把当前文件上传到仓库
3. 打开仓库的 `Settings`
4. 打开 `Pages`
5. 在 `Build and deployment` 里把 `Source` 设为 `Deploy from a branch`
6. 选择 `main` 分支和根目录 `/`
7. 保存后等待几分钟

### 发布地址

- 用户主页仓库：`https://你的用户名.github.io/`
- 普通仓库：`https://你的用户名.github.io/仓库名/`
