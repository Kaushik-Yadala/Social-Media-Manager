#!/usr/bin/env python3
"""
Import a CSV file into MongoDB as InstagramInsight documents.

The CSV must have a header row with columns matching the model fields:
  date, views, profile_links_taps, total_interactions, reach, accounts_engaged, additional_follows

Usage:
    python scripts/csv_import.py --csv data.csv --ig-user-id test_user_1
    python scripts/csv_import.py --csv data.csv --ig-user-id test_user_1 --mongo-uri mongodb://localhost:27017
"""

import argparse
import asyncio
import csv
import sys
import os
from datetime import datetime, timezone
from pathlib import Path

# Add parent dir to path so we can import app modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import init_db, MONGO_URI
from app.models.instagram import InstagramInsight


EXPECTED_COLUMNS = {
    "date",
    "views",
    "profile_links_taps",
    "total_interactions",
    "reach",
    "accounts_engaged",
    "additional_follows",
}


def parse_date(value: str) -> datetime:
    """Parse a date string into a timezone-aware UTC datetime."""
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%m/%d/%Y", "%d/%m/%Y"):
        try:
            dt = datetime.strptime(value.strip(), fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    raise ValueError(f"Cannot parse date: '{value}'")


async def import_csv(csv_path: str, ig_user_id: str, mongo_uri: str):
    """Read the CSV and insert each row as an InstagramInsight document."""
    os.environ["MONGO_URI"] = mongo_uri
    client = await init_db()

    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)

        # Validate columns
        if reader.fieldnames is None:
            print("❌ CSV has no header row.")
            return

        csv_columns = {c.strip().lower() for c in reader.fieldnames}
        missing = EXPECTED_COLUMNS - csv_columns
        if missing:
            print(f"⚠️  Missing columns: {missing}")
            print(f"   Found columns: {csv_columns}")
            print("   Will use 0 for missing metric fields.")

        count = 0
        for row in reader:
            # Normalise keys
            row = {k.strip().lower(): v.strip() for k, v in row.items()}

            try:
                date = parse_date(row["date"])
            except (ValueError, KeyError) as e:
                print(f"⚠️  Skipping row: {e}")
                continue

            entry = InstagramInsight(
                ig_user_id=ig_user_id,
                date=date,
                views=int(row.get("views", 0) or 0),
                profile_links_taps=int(row.get("profile_links_taps", 0) or 0),
                total_interactions=int(row.get("total_interactions", 0) or 0),
                reach=int(row.get("reach", 0) or 0),
                accounts_engaged=int(row.get("accounts_engaged", 0) or 0),
                additional_follows=int(row.get("additional_follows", 0) or 0),
            )
            await entry.insert()
            count += 1

    print(f"✅ Imported {count} rows for ig_user_id='{ig_user_id}' into MongoDB.")
    client.close()


def main():
    parser = argparse.ArgumentParser(description="Import CSV data into the Instagram stub server DB.")
    parser.add_argument("--csv", required=True, help="Path to the CSV file")
    parser.add_argument("--ig-user-id", required=True, help="Instagram user/account ID to assign")
    parser.add_argument(
        "--mongo-uri",
        default=MONGO_URI,
        help=f"MongoDB connection URI (default: {MONGO_URI})",
    )
    args = parser.parse_args()

    if not Path(args.csv).exists():
        print(f"❌ File not found: {args.csv}")
        sys.exit(1)

    asyncio.run(import_csv(args.csv, args.ig_user_id, args.mongo_uri))


if __name__ == "__main__":
    main()
