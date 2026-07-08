# PoE2 Marketwright

[English Documentation](./README.md)

PoE2 Marketwright 是一个面向《流放之路 2》官方市集页面的浏览器扩展项目。当前已实现的核心能力，是在 `https://www.pathofexile.com/trade2` 页面中根据当前选择的类别或物品名称，过滤右侧不相关的词缀建议。后续还会继续合并更多和 trade2 相关的增强功能。

## 当前功能

- 在页面内注入一个可开关的增强面板。
- 自动识别当前类别或物品名称。
- 按爬取到的 PoE2DB 数据过滤不属于当前类别的词缀建议。
- 支持识别失败时手动指定类别。

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
scripts/.venv/bin/python scripts/poe2_scraper.py scrape --scope all --split-dir build/all-affixes-split --out build/all-affixes-all.json --pretty
scripts/.venv/bin/python scripts/build_extension_data.py --split-dir build/all-affixes-split --out data/affix-filter-data.json
```

## 数据来源

- `https://poe2db.tw/us/Modifiers`
- 各类别页，例如 `https://poe2db.tw/us/Amulets#ModifiersCalc`
- 官方 `trade2` 相关命名与词条兼容性来自：
  - `https://www.pathofexile.com/api/trade2/data/items`
  - `https://www.pathofexile.com/api/trade2/data/stats`
