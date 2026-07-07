"""Data model for a single award-seat search result."""

from __future__ import annotations

from dataclasses import dataclass

CABIN_CODES = {
    "economy": "Y",
    "premium": "W",
    "business": "J",
    "first": "F",
}

CABIN_NAMES_ZH = {
    "economy": "经济舱",
    "premium": "超经舱",
    "business": "商务舱",
    "first": "头等舱",
}


@dataclass
class AwardOption:
    """One date/route/cabin with award space available."""

    date: str
    origin: str
    destination: str
    cabin: str  # economy / premium / business / first
    miles: int | None
    remaining_seats: int | None
    direct: bool
    airlines: str
    source: str

    @property
    def cabin_zh(self) -> str:
        return CABIN_NAMES_ZH.get(self.cabin, self.cabin)

    def sort_key(self) -> tuple:
        return (self.date, self.origin, self.destination, self.miles or 10**9)
