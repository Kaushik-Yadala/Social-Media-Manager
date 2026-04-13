#!/usr/bin/env python3
"""
Import CSV files/folders into MongoDB as InstagramInsight documents.

Examples:
    python scripts/csv_import.py --ig-user-id test_user --folder dass-meta-data/instagram/channelwise
    python scripts/csv_import.py --ig-user-id test_user --csv Reach.csv --csv Views.csv
"""

import argparse
import asyncio
import os
import sys
from pathlib import Path

# Add parent dir to path so we can import app modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import MONGO_URI, init_db
from app.services.csv_ingest import (
    collect_csv_files_from_folder,
    expand_csv_payloads,
    merge_csv_updates,
    upsert_insights,
)


async def run_import(
    ig_user_id: str,
    csv_paths: list[str],
    folder_path: str | None,
    mongo_uri: str,
):
    os.environ["MONGO_URI"] = mongo_uri
    client = await init_db()

    try:
        payloads: list[tuple[str, bytes]] = []

        if folder_path:
            folder = Path(folder_path).resolve()
            if not folder.exists() or not folder.is_dir():
                raise ValueError(f"Folder does not exist: {folder}")
            payloads.extend(collect_csv_files_from_folder(folder))

        for raw_path in csv_paths:
            path = Path(raw_path).resolve()
            if not path.exists() or not path.is_file():
                raise ValueError(f"CSV file not found: {path}")
            payloads.append((path.name, path.read_bytes()))

        if not payloads:
            raise ValueError("Provide at least one --csv path or --folder path.")

        expanded_payloads = expand_csv_payloads(payloads)
        updates_by_date, processed_files, metric_keys = merge_csv_updates(expanded_payloads)
        created_entries, updated_entries = await upsert_insights(ig_user_id, updates_by_date)

        print("✅ Import complete")
        print(f"   user_id: {ig_user_id}")
        print(f"   processed_files: {processed_files}")
        print(f"   touched_dates: {len(updates_by_date)}")
        print(f"   created_entries: {created_entries}")
        print(f"   updated_entries: {updated_entries}")
        print(f"   metric_keys: {', '.join(metric_keys)}")
    finally:
        client.close()


def main():
    parser = argparse.ArgumentParser(
        description="Import CSV data into the Instagram stub server DB."
    )
    parser.add_argument(
        "--ig-user-id",
        required=True,
        help="Instagram user/account ID to assign",
    )
    parser.add_argument(
        "--csv",
        action="append",
        default=[],
        help="Path to a CSV file (can be passed multiple times)",
    )
    parser.add_argument(
        "--folder",
        help="Path to a folder containing CSV files",
    )
    parser.add_argument(
        "--mongo-uri",
        default=MONGO_URI,
        help=f"MongoDB connection URI (default: {MONGO_URI})",
    )

    args = parser.parse_args()

    try:
        asyncio.run(
            run_import(
                ig_user_id=args.ig_user_id,
                csv_paths=args.csv,
                folder_path=args.folder,
                mongo_uri=args.mongo_uri,
            )
        )
    except ValueError as exc:
        print(f"❌ {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
