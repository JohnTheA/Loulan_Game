"""Thin client for the seats.aero Partner API.

seats.aero continuously caches award availability for Aeroplan (and many
other programs). Docs: https://developers.seats.aero/
An API key (Pro subscription) is required, passed via the
``Partner-Authorization`` header.
"""

from __future__ import annotations

import time

import requests

from .models import CABIN_CODES, AwardOption

API_BASE = "https://seats.aero/partnerapi"
PAGE_SIZE = 500
MAX_PAGES = 20


class SeatsAeroError(RuntimeError):
    pass


class SeatsAeroClient:
    def __init__(self, api_key: str, session: requests.Session | None = None):
        if not api_key:
            raise SeatsAeroError(
                "缺少 seats.aero API key。请设置环境变量 SEATS_AERO_API_KEY，"
                "key 可在 https://seats.aero/apikey 获取（需要 Pro 订阅）。"
            )
        self.session = session or requests.Session()
        self.session.headers.update(
            {
                "Partner-Authorization": api_key,
                "Accept": "application/json",
            }
        )

    def _get(self, path: str, params: dict) -> dict:
        resp = self.session.get(f"{API_BASE}{path}", params=params, timeout=30)
        if resp.status_code == 401:
            raise SeatsAeroError("seats.aero 返回 401：API key 无效或已过期。")
        if resp.status_code == 429:
            raise SeatsAeroError("seats.aero 返回 429：请求过于频繁，请稍后再试。")
        if not resp.ok:
            raise SeatsAeroError(
                f"seats.aero 请求失败（HTTP {resp.status_code}）：{resp.text[:300]}"
            )
        return resp.json()

    def search(
        self,
        origins: list[str],
        destinations: list[str],
        start_date: str,
        end_date: str,
        source: str = "aeroplan",
    ) -> list[dict]:
        """Return raw availability records for the given city pairs and dates."""
        params = {
            "origin_airport": ",".join(a.upper() for a in origins),
            "destination_airport": ",".join(a.upper() for a in destinations),
            "start_date": start_date,
            "end_date": end_date,
            "source": source,
            "take": PAGE_SIZE,
        }
        records: list[dict] = []
        for _ in range(MAX_PAGES):
            payload = self._get("/search", params)
            records.extend(payload.get("data", []))
            if not payload.get("hasMore"):
                break
            cursor = payload.get("cursor")
            if cursor is None:
                break
            params["cursor"] = cursor
            time.sleep(0.3)  # stay well under the API rate limit
        return records


def _to_int(value) -> int | None:
    try:
        return int(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return None


def parse_options(records: list[dict], cabins: list[str]) -> list[AwardOption]:
    """Flatten raw seats.aero records into one AwardOption per available cabin."""
    options: list[AwardOption] = []
    for rec in records:
        route = rec.get("Route", {})
        for cabin in cabins:
            code = CABIN_CODES[cabin]
            if not rec.get(f"{code}Available"):
                continue
            miles = _to_int(rec.get(f"{code}MileageCostRaw"))
            if miles is None:
                miles = _to_int(rec.get(f"{code}MileageCost"))
            options.append(
                AwardOption(
                    date=str(rec.get("Date", ""))[:10],
                    origin=route.get("OriginAirport", ""),
                    destination=route.get("DestinationAirport", ""),
                    cabin=cabin,
                    miles=miles,
                    remaining_seats=_to_int(rec.get(f"{code}RemainingSeats")),
                    direct=bool(rec.get(f"{code}Direct")),
                    airlines=rec.get(f"{code}Airlines") or "",
                    source=route.get("Source", rec.get("Source", "")),
                )
            )
    options.sort(key=AwardOption.sort_key)
    return options
