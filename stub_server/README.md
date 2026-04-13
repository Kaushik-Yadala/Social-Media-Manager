# Instagram Insights Stub Server

Standalone mock server for Instagram insights data backed by MongoDB.

The server is now **CSV-driven**:
- upload CSV files (or a ZIP of CSVs), or
- import all CSVs from a server folder path (for example `dass-meta-data/instagram/channelwise`)

Imported rows **upsert** by `(ig_user_id, date)`:
- creates a new entry if missing
- updates existing entry metrics when the date already exists

---

## Quick Start

```bash
cd stub_server
pip install -r requirements.txt
uvicorn main:app --port 8001 --reload
```

Server: `http://localhost:8001`  
Docs: `http://localhost:8001/docs`

---

## Configuration (`.env`)

| Variable | Default | Description |
|---|---|---|
| `MONGO_URI` | `mongodb://localhost:27017` | MongoDB connection string |
| `STUB_DB_NAME` | `stub_instagram` | Database name |

---

## Endpoints

### 1. Get Insights (Meta-style response)

```http
GET /stub/insta/get_data/{ig_user_id}/insights
```

Query params:
- `metric` (required): comma-separated metric keys
- `period`: `day`, `week`, `days_28`, `month`, `lifetime`, `total_over_range`
- `since` / `until`: ISO-8601 or Unix timestamp

Example:

```bash
curl "http://localhost:8001/stub/insta/get_data/test_user/insights?metric=views,reach&period=day&since=2025-04-01&until=2025-04-10"
```

---

### 2. Import Uploaded CSVs / ZIP

```http
POST /stub/insta/import_data/{ig_user_id}/csvs
Content-Type: multipart/form-data
```

Form field:
- `files`: one or more `.csv` files, or one `.zip` containing CSVs

Example:

```bash
curl -X POST "http://localhost:8001/stub/insta/import_data/test_user/csvs" \
  -F "files=@dass-meta-data/instagram/channelwise/Views.csv" \
  -F "files=@dass-meta-data/instagram/channelwise/Reach.csv"
```

---

### 3. Import CSV Folder Upload (ZIP)

```http
POST /stub/insta/import_data/{ig_user_id}/folder
Content-Type: multipart/form-data
```

Form field:
- `folder_archive`: one ZIP archive containing CSV files from the folder (`.zip` filename extension recommended)

Example:

```bash
curl -X POST "http://localhost:8001/stub/insta/import_data/test_user/folder" \
  -F "folder_archive=@channelwise.zip"
```

---

## CSV Format Support

The importer supports:
- UTF-8 / UTF-16 encoded CSV files
- optional `sep=,` first line
- optional title row (used when the value column is `Primary`)
- a required `Date` column
- ZIP uploads with nested folders (macOS metadata files like `__MACOSX` / `._*` are ignored)

For channelwise data (e.g. `Views.csv`, `Reach.csv`, etc.), metric keys are inferred from the metric title/file and normalized (snake_case), then written under each document's `metrics` object.

---

## CLI Import Utility

```bash
python scripts/csv_import.py --ig-user-id test_user --folder dass-meta-data/instagram/channelwise
```

You can also pass individual files:

```bash
python scripts/csv_import.py --ig-user-id test_user --csv path/to/Views.csv --csv path/to/Reach.csv
```

---

## Health

```http
GET /health  -> { "status": "ok" }
GET /        -> { "message": "Instagram Insights Stub Server is running." }
```

---

## Project Structure

```text
stub_server/
├── main.py
├── requirements.txt
├── .env
├── app/
│   ├── database.py
│   ├── models/
│   │   └── instagram.py
│   ├── routers/
│   │   └── insights.py
│   └── services/
│       └── csv_ingest.py
└── scripts/
    └── csv_import.py
```
