#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 shows.seed.json 生成 data.json，并尽力抓取日文资讯源补充 news。

设计原则：
- 核心是「读 seed -> 合并 -> 写 data.json」，这一步不依赖网络，永远成功，
  保证前端 data.json 始终有效（即使爬虫/网络出问题也不会白屏）。
- 「抓取上新资讯」是尽力而为：抓不到、解析失败都静默降级，只用 seed 里
  手工维护的 news，不抛出异常。

局限（已知）：日本没有干净的「日腐剧上新」聚合 feed，可抓的源是
TVガイドWeb 全站新闻，混杂大量非 BL 内容，关键词过滤后可能仍是噪声。
因此抓取结果按「命中在追剧名」严格过滤，抓不到就保持手工 news。
"""
import json
import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEED_PATH = os.path.join(BASE, "shows.seed.json")
OUT_PATH = os.path.join(BASE, "data.json")

CN_TZ = timezone(timedelta(hours=8))
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " \
     "(KHTML, like Gecko) Chrome/120 Safari/537.36 (追剧日程表更新)"

# 尽力抓取的日文资讯源（RSS feed）
FEEDS = [
    ("TVガイドWeb ドラマガイド", "https://www.tvguide.or.jp/dramaguide/feed/"),
]

# 严格过滤：只有标题命中这些关键词（我们追的剧名/主演）才当资讯收录，
# 避免把全站新闻噪声混进「上新资讯」。
KEYWORDS = [
    "青と碧", "芹沢", "二度目", "殺す旅", "あなたを殺す旅",
    "ふったら", "どしゃぶり", "修学旅行",
]


def fetch_text(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


def scrape_feed(url):
    """抓一个 RSS feed，返回 [(title, link, date), ...]，失败返回 []。"""
    items = []
    xml_text = fetch_text(url)
    root = ET.fromstring(xml_text)
    for item in root.iter("item"):
        title = item.findtext("title") or ""
        link = item.findtext("link") or ""
        pub = item.findtext("pubDate") or ""
        title = title.strip()
        if not title:
            continue
        date = ""
        if pub:
            m = re.search(r"(\d{1,2} \w{3} \d{4})", pub)
            if m:
                try:
                    date = datetime.strptime(m.group(1), "%d %b %Y").date().isoformat()
                except ValueError:
                    date = ""
        items.append((title, link, date))
    return items


def build_news(seed_news):
    """seed 的手工 news + 抓取到的、命中关键词的条目（去重）。"""
    news = list(seed_news)
    seen = {n.get("title") for n in news}
    for _name, url in FEEDS:
        try:
            for title, link, date in scrape_feed(url):
                if title in seen:
                    continue
                if not any(k in title for k in KEYWORDS):
                    continue
                seen.add(title)
                news.append({
                    "date": date,
                    "type": "new_episode",
                    "title": title,
                    "detail": "",
                    "source": link,
                })
        except Exception:
            # 尽力而为：某个源失败不影响整体
            continue
    return news


def main():
    with open(SEED_PATH, encoding="utf-8") as f:
        seed = json.load(f)

    data = {
        "updated_at": datetime.now(CN_TZ).strftime("%Y-%m-%dT%H:%M:%S+08:00"),
        "shows": seed.get("shows", []),
        "news": build_news(seed.get("news", [])),
    }

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"wrote {OUT_PATH}: {len(data['shows'])} shows, {len(data['news'])} news")


if __name__ == "__main__":
    sys.exit(main())
