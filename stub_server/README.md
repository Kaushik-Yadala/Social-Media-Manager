# Instagram/Facebook Insights Stub Server

Standalone mock server for Instagram and Facebook insights data backed by MongoDB.

The server is now **CSV-driven**:
- upload CSV files (or a ZIP of CSVs)

Imported rows **upsert** by `(platform, account_id, date)`:
- creates a new entry if missing
- updates existing entry metrics when the date already exists

Each stored MongoDB document includes:
- `platform`: `"instagram"` or `"facebook"`
- account key: `ig_user_id` (Instagram) or `fb_user_id` (Facebook)
- `date`
- `metrics`

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

### 1. Instagram: Get Insights (Meta-style response)

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

### 4. Facebook: Get Insights (Meta-style response)

```http
GET /facebook/get_data/{fb_user_id}/insights
```

Query params:
- `metric` (required): comma-separated metric keys
- `period`: `day`, `week`, `days_28`, `month`, `lifetime`, `total_over_range`
- `since` / `until`: ISO-8601 or Unix timestamp

Example:

```bash
curl "http://localhost:8001/facebook/get_data/test_page/insights?metric=views,viewers,content_interactions&period=day&since=2025-04-01&until=2025-04-10"
```

---

### 5. Facebook: Import Uploaded CSVs / ZIP

```http
POST /facebook/import_data/{fb_user_id}/csvs
Content-Type: multipart/form-data
```

Form field:
- `files`: one or more `.csv` files, or one `.zip` containing CSVs

Example:

```bash
curl -X POST "http://localhost:8001/facebook/import_data/test_page/csvs" \
  -F "files=@dass-meta-data/facebook/channelwise/Views.csv" \
  -F "files=@dass-meta-data/facebook/channelwise/Viewers.csv"
```

---

### 6. Facebook: Import CSV Folder Upload (ZIP)

```http
POST /facebook/import_data/{fb_user_id}/folder
Content-Type: multipart/form-data
```

Form field:
- `folder_archive`: one ZIP archive containing CSV files from the folder (`.zip` filename extension recommended)

Example:

```bash
curl -X POST "http://localhost:8001/facebook/import_data/test_page/folder" \
  -F "folder_archive=@facebook-channelwise.zip"
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

## MongoDB document structure and CSV mapping

### Instagram document (`instagram_insights_data`)

```json
{
  "platform": "instagram",
  "ig_user_id": "test_user",
  "date": "2026-04-10T00:00:00Z",
  "metrics": {
    "views": 123,
    "reach": 98,
    "content_interactions": 17,
    "instagram_link_clicks": 4,
    "instagram_profile_visits": 12,
    "instagram_follows": 2
  }
}
```

### Facebook document (`facebook_insights_data`)

```json
{
  "platform": "facebook",
  "fb_user_id": "test_page",
  "date": "2026-04-10T00:00:00Z",
  "metrics": {
    "views": 123,
    "viewers": 41,
    "content_interactions": 9,
    "facebook_link_clicks": 3,
    "facebook_visits": 15,
    "facebook_follows": 1
  }
}
```

### How uploaded CSV rows map into MongoDB

- `Date` column -> document `date` (normalized to midnight UTC).
- Metric value column (`Primary` / `Value` / `Values`) -> `metrics.<derived_metric_key>`.
- `ig_user_id` / `fb_user_id` comes from the path parameter in the import endpoint.
- `platform` is set automatically based on endpoint family (`/stub/insta/...` vs `/facebook/...`).

### CSV file -> metric key mapping used by importer

| Platform | CSV file | Stored metric key (`metrics.<key>`) |
|---|---|---|
| Instagram | `Views.csv` | `views` |
| Instagram | `Reach.csv` | `reach` |
| Instagram | `Interactions.csv` | `content_interactions` |
| Instagram | `LinkClicks.csv` | `instagram_link_clicks` |
| Instagram | `Visits.csv` | `instagram_profile_visits` |
| Instagram | `Follows.csv` | `instagram_follows` |
| Facebook | `Views.csv` | `views` |
| Facebook | `Viewers.csv` | `viewers` |
| Facebook | `Interactions.csv` | `content_interactions` |
| Facebook | `LinkClicks.csv` | `facebook_link_clicks` |
| Facebook | `Visits.csv` | `facebook_visits` |
| Facebook | `Follows.csv` | `facebook_follows` |

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
GET /        -> { "message": "Instagram/Facebook Insights Stub Server is running." }
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
│   │   ├── instagram.py
│   │   └── facebook.py
│   ├── routers/
│   │   └── insights.py
│   └── services/
│       └── csv_ingest.py
└── scripts/
    └── csv_import.py
```
