"""Command-line interface: `search` for one-off queries, `watch` for a config-driven sweep."""

from __future__ import annotations

import argparse
import os
import sys

import yaml

from .models import CABIN_CODES, AwardOption
from .output import render_markdown, render_table
from .seats_aero import SeatsAeroClient, SeatsAeroError, parse_options

API_KEY_ENV = "SEATS_AERO_API_KEY"


def _filter(
    options: list[AwardOption],
    max_miles: int | None,
    direct_only: bool,
) -> list[AwardOption]:
    result = options
    if max_miles:
        result = [o for o in result if o.miles is not None and o.miles <= max_miles]
    if direct_only:
        result = [o for o in result if o.direct]
    return result


def _client() -> SeatsAeroClient:
    return SeatsAeroClient(os.environ.get(API_KEY_ENV, ""))


def cmd_search(args: argparse.Namespace) -> int:
    client = _client()
    cabins = args.cabin or ["business"]
    records = client.search(
        origins=args.origin,
        destinations=args.dest,
        start_date=args.start,
        end_date=args.end,
        source=args.source,
    )
    options = _filter(parse_options(records, cabins), args.max_miles, args.direct_only)
    if args.markdown:
        title = f"{'/'.join(args.origin)} → {'/'.join(args.dest)}（{args.start} ~ {args.end}）"
        print(render_markdown(options, title))
    else:
        print(render_table(options))
        print(f"\n共 {len(options)} 条结果。")
    return 0


def cmd_watch(args: argparse.Namespace) -> int:
    with open(args.config, encoding="utf-8") as f:
        config = yaml.safe_load(f)

    client = _client()
    any_found = False
    outputs: list[str] = []
    for route in config.get("routes", []):
        origins = [str(a) for a in route["from"]]
        dests = [str(a) for a in route["to"]]
        cabins = [c for c in route.get("cabins", ["business"]) if c in CABIN_CODES]
        records = client.search(
            origins=origins,
            destinations=dests,
            start_date=str(route["start"]),
            end_date=str(route["end"]),
            source=route.get("source", "aeroplan"),
        )
        options = _filter(
            parse_options(records, cabins),
            route.get("max_miles"),
            bool(route.get("direct_only")),
        )
        any_found = any_found or bool(options)
        title = (
            f"{'/'.join(origins)} → {'/'.join(dests)}"
            f"（{route['start']} ~ {route['end']}，{'/'.join(cabins)}）"
        )
        if args.markdown:
            outputs.append(render_markdown(options, title))
        else:
            outputs.append(f"== {title} ==\n{render_table(options)}")

    print("\n\n".join(outputs))
    if args.fail_when_empty and not any_found:
        return 2
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="aeroplan-finder",
        description="查询加拿大航空 Aeroplan 里程票（数据来自 seats.aero）",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_search = sub.add_parser("search", help="按航线和日期区间查询一次")
    p_search.add_argument("--from", dest="origin", nargs="+", required=True,
                          metavar="IATA", help="出发机场（可多个），如 YVR YYZ")
    p_search.add_argument("--to", dest="dest", nargs="+", required=True,
                          metavar="IATA", help="到达机场（可多个），如 PEK PVG")
    p_search.add_argument("--start", required=True, help="开始日期 YYYY-MM-DD")
    p_search.add_argument("--end", required=True, help="结束日期 YYYY-MM-DD")
    p_search.add_argument("--cabin", nargs="+", choices=sorted(CABIN_CODES),
                          help="舱位（默认 business）")
    p_search.add_argument("--max-miles", type=int, help="里程上限，如 90000")
    p_search.add_argument("--direct-only", action="store_true", help="只看直飞")
    p_search.add_argument("--source", default="aeroplan",
                          help="里程计划（默认 aeroplan，也可用 united、lifemiles 等）")
    p_search.add_argument("--markdown", action="store_true", help="输出 markdown 表格")
    p_search.set_defaults(func=cmd_search)

    p_watch = sub.add_parser("watch", help="按 routes.yaml 配置批量检查所有关注航线")
    p_watch.add_argument("--config", default="routes.yaml", help="配置文件路径")
    p_watch.add_argument("--markdown", action="store_true", help="输出 markdown 表格")
    p_watch.add_argument("--fail-when-empty", action="store_true",
                         help="全部航线均无票时返回退出码 2（便于 CI 判断）")
    p_watch.set_defaults(func=cmd_watch)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except SeatsAeroError as e:
        print(f"错误：{e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
