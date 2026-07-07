"""Render search results as a terminal table or GitHub-flavored markdown."""

from __future__ import annotations

from .models import AwardOption

HEADERS = ["日期", "航线", "舱位", "里程", "余票", "直飞", "承运航司"]


def _rows(options: list[AwardOption]) -> list[list[str]]:
    rows = []
    for o in options:
        rows.append(
            [
                o.date,
                f"{o.origin} → {o.destination}",
                o.cabin_zh,
                f"{o.miles:,}" if o.miles else "?",
                str(o.remaining_seats) if o.remaining_seats else "≥1",
                "✈ 直飞" if o.direct else "中转",
                o.airlines,
            ]
        )
    return rows


def render_table(options: list[AwardOption]) -> str:
    if not options:
        return "（没有找到符合条件的里程票）"
    rows = [HEADERS] + _rows(options)
    # 中文字符按 2 列宽估算，保证对齐
    def width(s: str) -> int:
        return sum(2 if ord(c) > 0x2E7F else 1 for c in s)

    col_w = [max(width(r[i]) for r in rows) for i in range(len(HEADERS))]
    lines = []
    for idx, row in enumerate(rows):
        cells = [c + " " * (col_w[i] - width(c)) for i, c in enumerate(row)]
        lines.append("  ".join(cells).rstrip())
        if idx == 0:
            lines.append("  ".join("-" * w for w in col_w))
    return "\n".join(lines)


def render_markdown(options: list[AwardOption], title: str = "") -> str:
    lines = []
    if title:
        lines.append(f"### {title}")
        lines.append("")
    if not options:
        lines.append("_没有找到符合条件的里程票。_")
        return "\n".join(lines)
    lines.append("| " + " | ".join(HEADERS) + " |")
    lines.append("|" + "---|" * len(HEADERS))
    for row in _rows(options):
        lines.append("| " + " | ".join(row) + " |")
    return "\n".join(lines)
