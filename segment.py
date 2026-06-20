"""Customer segmentation via RFM scoring.

Usage:
    python segment.py customers.csv [--out segments.csv]

CSV must include columns for total spend and last order date.
Optional: id, name, email, orders.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import random
import sys
from dataclasses import dataclass, asdict
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Iterable

SEGMENT_META = {
    "Champions": "Bought recently, often, spend the most. Reward them.",
    "Loyal": "Consistently spend. Upsell higher value products.",
    "Potential Loyalist": "Recent customers, average frequency. Offer membership.",
    "New Customers": "Bought very recently but not often. Onboard them.",
    "Promising": "Recent shoppers, low spend. Build awareness.",
    "Needs Attention": "Above average recency & frequency. Limited offers.",
    "At Risk": "Spent big & often, but long ago. Win them back.",
    "Hibernating": "Last purchase long ago, low spend. Recreate value.",
    "Lost": "Lowest scores. Reach-out campaigns.",
}

HEADER_MAP = {
    "id": ["id", "customer_id", "customerid", "user_id"],
    "name": ["name", "customer", "customer_name", "full_name"],
    "email": ["email", "mail"],
    "spend": ["total_spend", "spend", "total", "amount", "revenue", "monetary", "ltv"],
    "orders": ["orders", "frequency", "order_count", "num_orders", "purchases"],
    "date": ["last_order_date", "last_order", "last_purchase", "last_date", "date"],
}


@dataclass
class Customer:
    id: str
    name: str
    email: str
    total_spend: float
    orders: int
    last_order_date: str
    recency_days: int
    r_score: int = 0
    f_score: int = 0
    m_score: int = 0
    segment: str = ""


def find_key(fieldnames: list[str], candidates: list[str]) -> str | None:
    norm = {f.strip().lower().replace(" ", "_"): f for f in fieldnames}
    for c in candidates:
        if c in norm:
            return norm[c]
    for c in candidates:
        for key, orig in norm.items():
            if c in key:
                return orig
    return None


def parse_float(v) -> float:
    if v is None:
        return float("nan")
    s = str(v).strip().replace(",", "")
    s = "".join(ch for ch in s if ch.isdigit() or ch in ".-")
    try:
        return float(s)
    except ValueError:
        return float("nan")


def parse_date(v) -> date | None:
    if v is None:
        return None
    s = str(v).strip()
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(s).date()
    except ValueError:
        return None


def quintile(sorted_values: list[float], v: float, invert: bool = False) -> int:
    n = len(sorted_values)
    # First index where sorted >= v
    lo, hi = 0, n
    while lo < hi:
        mid = (lo + hi) // 2
        if sorted_values[mid] < v:
            lo = mid + 1
        else:
            hi = mid
    pct = lo / n if n else 0
    score = max(1, min(5, math.ceil(pct * 5) or 1))
    return 6 - score if invert else score


def classify(r: int, f: int, m: int) -> str:
    fm = (f + m) / 2
    if r >= 4 and fm >= 4: return "Champions"
    if r >= 3 and fm >= 4: return "Loyal"
    if r >= 4 and fm >= 3: return "Potential Loyalist"
    if r >= 4 and fm <= 2: return "New Customers"
    if r >= 3 and fm <= 2: return "Promising"
    if r >= 2 and fm >= 3: return "Needs Attention"
    if r <= 2 and fm >= 4: return "At Risk"
    if r <= 2 and fm >= 2: return "Hibernating"
    return "Lost"


def load_customers(path: Path) -> list[Customer]:
    with path.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        if not reader.fieldnames:
            raise SystemExit("Empty CSV.")
        fields = reader.fieldnames
        id_k = find_key(fields, HEADER_MAP["id"])
        name_k = find_key(fields, HEADER_MAP["name"])
        email_k = find_key(fields, HEADER_MAP["email"])
        spend_k = find_key(fields, HEADER_MAP["spend"])
        orders_k = find_key(fields, HEADER_MAP["orders"])
        date_k = find_key(fields, HEADER_MAP["date"])
        if not spend_k or not date_k:
            raise SystemExit("CSV must include a spend column and a last order date column.")

        today = date.today()
        out: list[Customer] = []
        for i, row in enumerate(reader, start=1):
            spend = parse_float(row.get(spend_k))
            d = parse_date(row.get(date_k))
            if math.isnan(spend) or d is None:
                continue
            orders = 1
            if orders_k:
                try:
                    orders = max(1, int(float(row.get(orders_k) or 1)))
                except ValueError:
                    orders = 1
            out.append(Customer(
                id=str(row.get(id_k) or f"C-{i}") if id_k else f"C-{i}",
                name=str(row.get(name_k) or "") if name_k else "",
                email=str(row.get(email_k) or "") if email_k else "",
                total_spend=round(spend, 2),
                orders=orders,
                last_order_date=d.isoformat(),
                recency_days=max(0, (today - d).days),
            ))
        return out


def score(customers: list[Customer]) -> list[Customer]:
    if not customers:
        return customers
    r_sorted = sorted(c.recency_days for c in customers)
    f_sorted = sorted(c.orders for c in customers)
    m_sorted = sorted(c.total_spend for c in customers)
    for c in customers:
        c.r_score = quintile(r_sorted, c.recency_days, invert=True)
        c.f_score = quintile(f_sorted, c.orders)
        c.m_score = quintile(m_sorted, c.total_spend)
        c.segment = classify(c.r_score, c.f_score, c.m_score)
    return customers


def summarize(customers: list[Customer]) -> dict:
    by_segment: dict[str, dict] = {}
    for c in customers:
        s = by_segment.setdefault(c.segment, {"count": 0, "revenue": 0.0})
        s["count"] += 1
        s["revenue"] += c.total_spend
    total_rev = sum(c.total_spend for c in customers)
    return {
        "customers": len(customers),
        "revenue": round(total_rev, 2),
        "orders": sum(c.orders for c in customers),
        "segments": {
            name: {
                "count": v["count"],
                "revenue": round(v["revenue"], 2),
                "share": round((v["revenue"] / total_rev * 100) if total_rev else 0, 2),
                "description": SEGMENT_META.get(name, ""),
            }
            for name, v in sorted(by_segment.items(), key=lambda kv: -kv[1]["revenue"])
        },
    }


def write_csv(customers: Iterable[Customer], path: Path) -> None:
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(asdict(next(iter(customers))).keys()))
        w.writeheader()
        for c in customers:
            w.writerow(asdict(c))


def generate_demo(n: int = 240, path: Path | None = None) -> Path:
    first = ["Ava", "Liam", "Noah", "Mia", "Zoe", "Kai", "Ivy", "Owen", "Maya", "Leo", "Nora", "Eli", "Aria", "Ezra", "Luna", "Theo", "Sage", "Rio", "June", "Asa"]
    last = ["Chen", "Patel", "Garcia", "Kim", "Singh", "Rossi", "Diallo", "Nguyen", "Silva", "Khan", "Cohen", "Park", "Lopez", "Mueller", "Tanaka"]
    today = date.today()
    rng = random.Random(42)
    path = path or Path("demo_customers.csv")
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["customer_id", "name", "email", "orders", "total_spend", "last_order_date"])
        for i in range(n):
            b = rng.random()
            if b < 0.15:
                rec, orders, aov = rng.randint(0, 30), rng.randint(8, 32), 90 + rng.random() * 220
            elif b < 0.35:
                rec, orders, aov = rng.randint(20, 100), rng.randint(4, 14), 50 + rng.random() * 120
            elif b < 0.55:
                rec, orders, aov = rng.randint(0, 60), rng.randint(1, 3), 20 + rng.random() * 80
            elif b < 0.78:
                rec, orders, aov = rng.randint(120, 320), rng.randint(5, 22), 80 + rng.random() * 200
            else:
                rec, orders, aov = rng.randint(200, 700), rng.randint(1, 4), 15 + rng.random() * 60
            fn, ln = rng.choice(first), rng.choice(last)
            d = today - timedelta(days=rec)
            w.writerow([f"C-{1000+i}", f"{fn} {ln}", f"{fn.lower()}.{ln.lower()}@example.com",
                        orders, round(orders * aov, 2), d.isoformat()])
    return path


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="RFM customer segmentation.")
    p.add_argument("csv", nargs="?", help="Input CSV path. Omit to generate demo data.")
    p.add_argument("--out", default="segments.csv", help="Output CSV path.")
    p.add_argument("--json", default=None, help="Optional summary JSON output path.")
    p.add_argument("--demo", action="store_true", help="Generate demo_customers.csv and segment it.")
    args = p.parse_args(argv)

    if args.demo or not args.csv:
        demo = generate_demo()
        print(f"Wrote demo data -> {demo}")
        args.csv = str(demo)

    customers = load_customers(Path(args.csv))
    if not customers:
        print("No valid rows.")
        return 1
    score(customers)
    write_csv(customers, Path(args.out))
    summary = summarize(customers)

    if args.json:
        Path(args.json).write_text(json.dumps(summary, indent=2))
    print(f"\nScored {summary['customers']} customers · ${summary['revenue']:,.0f} revenue · {summary['orders']} orders\n")
    print(f"{'Segment':<22}{'Count':>8}{'Revenue':>14}{'Share':>9}")
    print("-" * 53)
    for name, v in summary["segments"].items():
        print(f"{name:<22}{v['count']:>8}{'$'+format(v['revenue'], ',.0f'):>14}{str(v['share'])+'%':>9}")
    print(f"\nSegmented file -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
