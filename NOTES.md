# 学海大陆 · 项目说明

像素风「异世界冒险」主题的目标管理网页应用。纯 HTML/CSS/JS，无构建工具、无框架、无依赖，双击 `index.html` 即可运行，所有数据存 `localStorage`。

- 调色板：背景 `#1a1a2e` / 强调红 `#e94560` / 金币 `#ffd700` / 经验蓝 `#00d9ff` / 战力红 `#ff6b6b` / 迷雾灰 `#2c3e50` / 辉光橙 `#f39c12`
- 字体：中文 Zpix（jsdelivr CDN），拉丁/数字 Press Start 2P（Google Fonts）
- 视觉规范：按钮/面板 3px 黑边 + `box-shadow` 硬阴影；页面切换统一黑场过场（`steps()` 跳变）；动画只用 `transform`/`opacity`

---

## 一、目录结构与各文件职责

```
├── index.html            所有页面 + 弹窗 + 脚本引入
├── NOTES.md              本说明文件
├── css/
│   └── style.css         全部样式（调色板变量、像素组件、各页面、动画、响应式）
├── js/
│   ├── storage.js        存档层：localStorage 读写、默认存档、迁移(normalize)、
│   │                     util 工具(genId/localDateKey/daysUntil)、存档码(exportCode/parseCode)
│   ├── game.js           数值核心：职业列表、奖励三档、金币双上限(grantGold/goldToday)、
│   │                     升级公式(expNeeded/addExp)、结算(applyReward/applyFlatReward)
│   ├── audio.js          8-bit 音效：Web Audio 实时合成 + 静音开关
│   ├── map.js            迷雾地图数据模型：大陆/节点树、战力/进度/征服度、点亮(lightLeaf)、
│   │                     终极(createContinent 含 reason/battleDay/ultimate)
│   ├── ui.js             通用 UI：黑场过场、屏幕切换、飘字/提示/鼠标飘字、
│   │                     状态栏(含今日目标/终极横幅)、大厅入口绑定
│   ├── ada.js            阿黛事件系统：事件驱动对话 + 表情切换 + 队列/优先级/冷却
│   ├── quests.js         委托板：打卡型/记录型双模式、执念、每日重置、赏金计数
│   ├── settle.js         勇者传记(编年史)：战报统计、委托明细带执念、发愿对照、编年史
│   ├── meditation.js     静思庭：今日发愿、随时反思、历史、每日发愿提示
│   ├── map-ui.js         迷雾地图 UI：大陆列表/地图页/面包屑/点亮动画/决战日/终极弹窗
│   ├── qiankun.js        乾坤袋：存档码导出/导入弹窗
│   └── main.js           入口：初始化、绑定各模块、调试 API(XH.state/addExp/reset)
├── img/                  美术素材（见第七节）
└── .asset-tools/
    ├── crop-icons.js     图标裁切脚本（Node + pngjs，裁 icons.png 为 4 张）
    ├── verify-icons.js   裁切验证脚本（尺寸/边缘截断/ASCII 观感）
    └── optimize-images.js 图片瘦身脚本（阿黛 2048→512、背景 2560→1920，输出 img/opt/）
```

脚本加载顺序（依赖关系）：`storage → game → audio → map → ui → quests → settle → meditation → map-ui → qiankun → main`。全局命名空间 `XH`，各模块挂 `XH.xxx`。

---

## 二、已完成功能清单（按页面）

**标题页**：闪烁星空 + 标题 + 开始冒险 + 底部存档承诺文案。

**契约仪式**：4 步向导（名号 1~12 字 → 5 职业选一 → 冒险誓言 → 血手印长按 2 秒），黑场过场，完成后缔结存档进大厅。

**公会大厅**：
- 状态栏：名号/职业/等级/EXP 条/金币/总战力/今日目标 X/Y/重置/乾坤袋/静音。
- 终极远征横幅（有终极大陆时常驻显示：大陆名 + 征服度% + 倒计时）。
- 像素场景四入口：迷雾地图 / 委托板 / 编年史（进页面为"勇者传记"）/ 静思庭。
- 阿黛事件系统：18 个游戏事件触发她说话 + 切换表情（见下方触发点清单）。

**迷雾地图**：大陆列表（名字/征服理由/总战力/进度/决战日倒计时/补绑/钦定，终极置顶金边徽记）；开辟大陆（名字+征服理由+决战日可选）；大陆内面包屑导航、区域/试炼节点、增设/删除；点亮叶子（动画+奖励+战力传导+区域肃清+大陆征服，终极触发"远征终章"）；每日征服赏金 X/50。

**委托板**：打卡型（下限+单位，点击完成）/ 记录型（记录数量+备注，累计）双模式；分「每日打卡」「自由记录」两区带数量；执念字段 + 类型徽章（印章/羽毛笔）；每日委托赏金 X/30。

**勇者传记（大厅入口名"编年史"）**：今日战报（发愿对照目标、委托明细带执念）；冒险日志；编年史（按日倒序）。

**静思庭**：今日发愿（发愿+目标战力）；随时反思（首思有奖励）；历史（发愿→反思→战报配对）。

**乾坤袋**：存档码导出（UTF-8/Base64、一键复制）；导入（校验、二次确认、刷新恢复）。

**全局**：8-bit 音效 12 种 + 静音开关；localStorage 存档（跨天重置、旧存档自动迁移）；性能优化（进度条 scaleX、动画只用 transform/opacity、图片 opt 瘦身、内页背景预加载）。

**移动端横屏适配**（`css/style.css` 末尾）：判定用 `pointer: coarse`（主输入为触屏）+ `orientation`——桌面 `pointer: fine` 不命中，拖窄窗口零影响。
- 竖屏遮罩：`(pointer: coarse) and (orientation: portrait)` 显示全屏旋转遮罩（CSS 画的手机旋转动画 + "请旋转手机，横屏开始冒险"）。
- 横屏紧凑化：`(pointer: coarse) and (orientation: landscape) and (max-height: 430px)` 触发——状态栏单行矮条、大厅四入口一排缩小（scene 360→120px）、终极横幅变矮、阿黛头像 120→56px、各内页收紧标题/间距/内边距。viewport 已为 `width=device-width, initial-scale=1`。

### 阿黛事件系统 · 18 触发点

台词集中在 `ada.js` 的 `EVENTS` 配置，接口 `XH.ada.trigger('事件id', params)`；同一时间只播一条，高优先级插队、低优先级排队，表情在台词开始时切换。

| # | 事件 id | 表情 | 触发时机 | 频率 |
|---|---|---|---|---|
| 1 | first_visit | smile | 新访客首次进大厅（无大陆） | 每日一次 |
| 2 | daily_greet | smile | 每日首次进大厅（时段问候） | 每日一次 |
| 3 | light_normal | smile | 点亮 ≤60 战力试炼 | 30s 冷却 |
| 4 | light_high | laugh | 点亮 61+ 战力试炼 | 无 |
| 5 | region_clear | laugh | 区域肃清 | 无 |
| 6 | continent_clear | laugh | 大陆征服（非终极） | 无 |
| 7 | level_up | laugh | 升级 LEVEL UP | 无 |
| 8 | designate_ultimate | serious | 钦定终极大陆 | 无 |
| 9 | battle_day | serious | 决战日 ≤7 天 | 每日一次 |
| 10 | expedition_finale | laugh | 远征终章（终极征服） | 无（最高优先级） |
| 11 | quest_done | smile | 完成打卡委托 | 30s 冷却 |
| 12 | vow_made | smile | 今日发愿 | 无 |
| 13 | reset_farewell | serious | 重置存档 | 无（最高优先级） |
| 14 | all_quests_done | wink | 今日委托全清 | 每日一次 |
| 15 | bounty_capped | wink | 赏金上限后仍继续点亮 | 每日一次 |
| 16 | streak | smile/laugh | 连续 3/7/30 天上线 | 每日一次 |
| 17 | export_code | smile | 乾坤袋导出存档码 | 无 |
| 18 | reflection_done | smile | 写完一条反思 | 每日一次 |

---

## 三、当前数值设定

**奖励三档**（按节点战力区间，`game.js` 的 `REWARD_TIERS`）：

| 节点战力 | EXP | 金币 |
|---|---|---|
| ≤ 20 | +10 | +5 |
| 21 ~ 60 | +20 | +10 |
| ≥ 61 | +30 | +15 |

**金币双每日上限**（`GOLD_CAPS`，独立计算、跨天自动重置）：

| 来源 | 每日上限 |
|---|---|
| 委托板（quest） | 30 |
| 迷雾地图/大陆点亮（node） | 50 |

- 达到上限后：委托/节点照常完成，EXP 和战力照常获得，仅金币不再增加；飘字变为「+XEXP · 赏金已领完」。
- 静思庭的奖励（发愿 +15 金 +10 EXP、首思 +5 金 +10 EXP）走 `applyFlatReward`，**不计入以上任何上限**。

**升级曲线**：升到下一级所需 EXP = `floor(100 × 1.5^(level-1))`。第 1 级需 100，第 2 级需 150，第 3 级需 225……升级时全屏飘字「LEVEL UP!」。

**战力**：总战力由「已点亮叶子战力之和」派生（`map.totalPower`），点亮叶子加战力、删除节点自动减少，不另行累加。委托不计入战力。

**征服度**：`已点亮叶子战力 / 大陆总战力 × 100%`（`map.conquestPercent`）。

---

## 四、存档数据结构

localStorage key：`xuehai_save_v1`。顶层结构：

```js
{
  version: 1,
  adventurer: { name, classId, oath, level, exp, gold, power, createdAt },
  continents: [{ id, name, reason, battleDay, ultimate, status, nodes, createdAt }],
  quests:    [{ id, name, power, status, builtin, type, motive, minAmount, unit, records }],
  questLastReset: 'YYYY-MM-DD',
  bounty:     { quest: {date, gold}, node: {date, gold} },
  meditation: { vows: [], reflections: [], lastPromptDate },
  loginStreak: { count, lastDate },
  chronicle: [{ date, nodesLit, questsDone, power, exp, gold, note, questDetails, savedAt }],
  log:       [{ type, source, power, exp, gold, at }]
}
```

- `node`：`{ id, name, parentId(null=根), type('region'|'trial'), power(仅叶子), status('mist'|'lit') }`
- `quest.type`：`'checkin'`(打卡型) / `'record'`(记录型)；打卡型有 `minAmount`(下限)+`unit`(单位)，记录型有 `records`(数量+备注)。
- `log.source`：`'node'`(大陆点亮，计战力) / `'quest'`(委托) / `'vow'`(发愿) / `'reflect'`(反思)。
- 旧存档缺失字段在 `storage.normalize()` 里自动补齐，不会报错。

---

## 五、美术素材

存放在 `img/`，直接相对路径引用（无构建，`file://` 直接可用）。

> 性能优化版统一放 `img/opt/`（同名），由 `.asset-tools/optimize-images.js` 生成：阿黛 2048×2048 → 512×512、背景 2560×1440 → 1920×1080。**代码全部引用 `img/opt/` 优化版**，`img/` 根目录原图仅作源图备份、不再被引用。

| 文件 | 尺寸 | 用途 | 引用方式（均指向优化版） |
|---|---|---|---|
| `icons.png` | 2560×1440 | 原始 2×2 网格（左上=地图/右上=委托/左下=编年史/右下=静思庭） | 仅源图，不直接引用 |
| `icon-map.png` | 450×512 | 迷雾地图入口图标 | `<img class="station-img">`（未优化，已够小） |
| `icon-board.png` | 572×477 | 委托板入口图标 | 同上 |
| `icon-chronicle.png` | 612×535 | 编年史入口图标 | 同上 |
| `icon-garden.png` | 499×549 | 静思庭入口图标 | 同上 |
| `hall-bg.png` | 2560×1440 | 大厅背景 | `img/opt/hall-bg.png`（`.scene-bg`） |
| `bg-map.png` | 2560×1440 | 迷雾地图整页背景（大陆列表 + 大陆内地图两屏共用，主体均匀，锚 center center） | `img/opt/bg-map.png`（`.page-bg--map`） |
| `bg-board.png` | 2560×1440 | 委托板页整页背景（告示板中上部，锚 center 30%） | `img/opt/bg-board.png`（`.page-bg--board`） |
| `bg-chronicle.png` | 2560×1440 | 编年史页整页背景（蜡烛和书中左，锚 center 40%） | `img/opt/bg-chronicle.png`（`.page-bg--chronicle`） |
| `bg-garden.png` | 2560×1440 | 静思庭页整页背景（亭子中左上方，锚 left 25%） | `img/opt/bg-garden.png`（`.page-bg--garden`） |
| `ada-smile.png` | 2048×2048 | 阿黛·微笑 | `img/opt/ada-{expr}.png`（`ada.js` setExpression） |
| `ada-laugh.png` | 2048×2048 | 阿黛·大笑 | 同上 |
| `ada-serious.png` | 2048×2048 | 阿黛·严肃 | 同上 |
| `ada-wink.png` | 2048×2048 | 阿黛·眨眼 | 同上 |
| `ada-salute.png` | 2048×2048 | 阿黛·敬礼（完成打卡委托） | 同上 |

关键 CSS：
- 入口图标 `.station-img`：`object-fit: contain; image-rendering: pixelated`（桌面 54px / 移动 44px）。
- 背景 `.scene-bg`：`object-fit: cover; object-position: center 30%`。
- 内页背景 `.page-bg`：`object-fit: cover; image-rendering: pixelated`，锚点按各图主体定位（map `center center` / board `center 30%` / chronicle `center 40%` / garden `left 25%`）；`.page-bg-shade` 底部渐变遮罩（透明 → `--bg`，同大厅）；仅当对应 `.screen.active` 时经 `body:has(...)` 显示。
- 阿黛头像框 `.npc-avatar`：120×120px 正方形（3px 黑边 + 4px 硬阴影，垂直居中；窄屏 <768px 缩回 80px）；`.npc-avatar-img`：`object-fit: cover; image-rendering: pixelated`。

---

## 六、还没做的事

- **委托每日轮换/自动生成**：委托目前是「3 个预置 + 用户自建」，没有随机轮换或按日刷新机制。
- **大陆删除**：节点可删（连带后代），整座大陆暂无删除入口。
- **删除节点的奖励回退**：删除已点亮节点不会退还已发放的金币/经验（战力因派生会自动下降）。
- **入口图标与背景物件的像素级对齐**：四入口仍按原有布局，未与 `hall-bg.png` 中对应物件精确对齐。
- **"未来正式版完整继承"**：存档码已带版本号 + 迁移逻辑，但尚无真正的正式版发布/版本升级场景。
