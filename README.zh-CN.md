# PoE2 Marketwright

[English Documentation](./README.md)

PoE2 Marketwright 是一个面向《流放之路 2》官方市集页面的浏览器扩展项目。当前已实现的核心能力，是在 `https://www.pathofexile.com/trade2` 页面中根据当前选择的类别或物品名称，过滤右侧不相关的词缀建议。后续还会继续合并更多和 trade2 相关的增强功能。

## 当前功能

- 在页面内注入一个增强面板，并分别控制词缀过滤、PoB 复制按钮和 C/D 报价换算。
- 扩展界面和收藏内容可单独选择 English、简体中文或繁體中文。
- 市集页面另有独立语言设置，支持 English、简体中文、繁體中文、简中（English）和繁中（English）。已映射的原生市集界面、筛选项和结果字段会随之切换，未映射文本稳定保留英文。
- 物品、类别和词缀选择器可用英文、简体中文或繁体中文输入，并定位到同一个原生市集选项。
- 自动识别当前类别或物品名称。
- 按爬取到的 PoE2DB 数据过滤不属于当前类别的词缀建议。
- 支持识别失败时手动指定类别。
- 在市集结果行中增加用于 PoB Create Custom 的复制按钮。
- 为固定价的崇高石、混沌石、神圣石报价增加 `E`、`C`、`D` 换算按钮；汇率按当前市集赛季从 Poe2Scout 实时获取，面板中的刷新按钮可强制更新报价。

## 安装方式

推荐优先从 [GitHub Releases](https://github.com/WAY29/poe2-marketwright/releases) 下载已经构建好的版本。

1. 进入 [GitHub Releases](https://github.com/WAY29/poe2-marketwright/releases) 下载最新发布的 zip 文件。
2. 将 zip 解压到本地目录。
3. 打开 `chrome://extensions`。
4. 开启右上角的 `Developer mode`。
5. 点击 `Load unpacked`。
6. 选择刚才解压出来的目录。

## 从源码加载

如果你是开发者，或者想直接加载当前仓库代码：

1. 打开 `chrome://extensions`。
2. 开启右上角的 `Developer mode`。
3. 点击 `Load unpacked`。
4. 选择当前仓库根目录。

## 刷新扩展数据

在仓库根目录执行：

```bash
uv run --project scripts python scripts/poe2_scraper.py scrape --scope all --split-dir build/all-affixes-split --out build/all-affixes-all.json --pretty
uv run --project scripts python scripts/build_extension_data.py --split-dir build/all-affixes-split --out data/affix-filter-data.json
```

## 数据来源

- `https://poe2db.tw/us/Modifiers`
- 各类别页，例如 `https://poe2db.tw/us/Amulets#ModifiersCalc`
- 官方国际服、国服和台服 `trade2` 数据在构建期按稳定 ID 对齐，用于生成页面显示：
  - `https://www.pathofexile.com/api/trade2/data/items`
  - `https://www.pathofexile.com/api/trade2/data/stats`
  - `https://www.pathofexile.com/api/trade2/data/static`
  - `https://www.pathofexile.com/api/trade2/data/filters`
  - 对应中文来源：`https://poe.game.qq.com/api/trade2/data/*` 与 `https://pathofexile.tw/api/trade2/data/*`
- PoE2DB 的公开物品分类页（包括 `https://poe2db.tw/us/Stackable_Currency`）按相同 slug 验证通货、宝石、遗物等 Trade 物品名称。
- 官方游戏客户端导出的界面兜底文本：`https://github.com/LocalIdentity/poe2-data/tree/main/data`
- E/C/D 报价换算：`https://api.poe2scout.com/poe2/Leagues/{赛季}/ReferenceCurrencies`

## 汉化覆盖率

当前生成的 Trade 汉化数据包覆盖：

- 物品显示名：简体中文 `2198/2200`（99.91%），繁体中文 `2200/2200`（100%）
- Trade 词缀模板：简体中文 `8057/8141`（98.97%），繁体中文 `8059/8141`（98.99%）

以上统计只覆盖总数固定的物品名与词缀模板。原生 Trade 界面文本由各区域 Trade API 动态提供，没有固定总数。

## 致谢

感谢 [PoE2DB](https://poe2db.tw/us/) 提供词缀过滤所需的词缀与物品类别数据，感谢 [Poe2Scout](https://poe2scout.com/) 提供报价换算所需的参考通货汇率。
