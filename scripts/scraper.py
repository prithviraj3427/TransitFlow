#!/usr/bin/env python3
"""
TransitFlow — route dataset refresher.

Scrapes CBE city-bus routes from way2cbe.com and writes them to
`data/routes.json` in the exact shape the API consumes:

    [ { "routeNumber": "102A", "name": "A - B", "stops": ["A", "...", "B"] }, … ]

The original data came from a Selenium flow on the same site, so this script
keeps that proven technique (the route list is a JS-driven <select>, and
"Get Details" opens the stop list in a new window).

Usage:
    pip install selenium
    python scripts/scraper.py                 # refresh data/routes.json
    python scripts/scraper.py --out tmp.json  # write somewhere else
    python scripts/scraper.py --limit 5       # only first 5 routes (test run)

Notes:
- Requires Chrome + chromedriver on PATH (or webdriver-manager).
- Be polite: it sleeps between routes; don't run it in a tight loop.
- If the site layout changes, adjust the TRIM lists below.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import Select
except ImportError:  # pragma: no cover
    sys.exit("Missing dependency. Run:  pip install selenium")

BASE_URL = "https://way2cbe.com/citybus-routes/"

# Text that belongs to site chrome, not to stops — trim from the edges.
TOP_NAV = {"CITYBUS ROUTES", "WAY2CBE", "POPULAR ROUTES"}
FOOTER = {"Citybus Search", "Route Search", "Train Timings", "Search"}
HEADER_WORDS = {"s.no", "s.no.", "sl no", "sl no.", "stops", "bus stops", "route no", "route no."}


def make_driver() -> webdriver.Chrome:
    options = webdriver.ChromeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1280,900")
    options.add_argument(
        "user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 TransitFlow/1.0"
    )
    return webdriver.Chrome(service=Service(), options=options)


def route_options(driver: webdriver.Chrome) -> list[str]:
    driver.get(BASE_URL)
    time.sleep(3)
    select = Select(driver.find_element(By.TAG_NAME, "select"))
    return [opt.text.strip() for opt in select.options if opt.text.strip() and opt.text.strip() != "Select a Route"]


def scrape_route(driver: webdriver.Chrome, route_number: str) -> dict:
    """Load one route's stop list and return the shaped record."""
    driver.get(BASE_URL)
    time.sleep(2)

    select = Select(driver.find_element(By.TAG_NAME, "select"))
    select.select_by_visible_text(route_number)

    submit = driver.find_element(
        By.XPATH, "//input[@value='Get Details'] | //button[contains(text(), 'Get Details')]"
    )
    driver.execute_script("arguments[0].click();", submit)
    time.sleep(4)

    if len(driver.window_handles) > 1:
        driver.switch_to.window(driver.window_handles[-1])

    raw: list[str] = []
    try:
        for el in driver.find_elements(By.XPATH, "//td | //th | //li"):
            text = el.text.strip()
            if not text or text.isdigit() or text.lower() in HEADER_WORDS:
                continue
            raw.append(text)
    finally:
        if len(driver.window_handles) > 1:
            driver.close()
            driver.switch_to.window(driver.window_handles[0])

    # de-dupe, preserve order
    seen: set[str] = set()
    stops = [s for s in raw if not (s in seen or seen.add(s))]

    # trim site chrome from the top
    for menu in TOP_NAV:
        if menu in stops:
            stops = stops[stops.index(menu) + 1:]
    # …and from the bottom
    for menu in FOOTER:
        if menu in stops:
            stops = stops[: stops.index(menu)]

    name = f"{stops[0]} - {stops[-1]}" if len(stops) >= 2 else (stops[0] if stops else "Route Details Not Found on Website")
    return {"routeNumber": route_number, "name": name, "stops": stops}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default=None, help="Output JSON path (default: <repo>/data/routes.json)")
    parser.add_argument("--limit", type=int, default=0, help="Only scrape the first N routes (0 = all)")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    out_path = Path(args.out) if args.out else repo_root / "data" / "routes.json"

    driver = make_driver()
    failures: list[str] = []
    try:
        options = route_options(driver)
        if args.limit:
            options = options[: args.limit]
        print(f"Found {len(options)} routes to scrape.")

        routes: list[dict] = []
        for i, route in enumerate(options, start=1):
            print(f"[{i}/{len(options)}] {route} …", end=" ", flush=True)
            try:
                record = scrape_route(driver, route)
                routes.append(record)
                print(f"ok ({len(record['stops'])} stops)")
            except Exception as exc:  # noqa: BLE001 — keep going on one bad route
                failures.append(route)
                print(f"FAILED ({exc})")
            time.sleep(1.5)  # politeness
    finally:
        driver.quit()

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(routes, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nWrote {len(routes)} routes → {out_path}")
    if failures:
        print(f"Failed routes (re-run to retry): {', '.join(failures)}")
    return 0 if routes else 1


if __name__ == "__main__":
    raise SystemExit(main())
