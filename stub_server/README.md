# Instagram Insights Stub Server

A **fully independent**, black-box mock of the Meta Graph API for Instagram Media Insights. Returns responses in Meta's exact JSON format, stores time-series data in MongoDB, and auto-generates daily metrics via a built-in cron job.

---

## Quick Start

```bash
cd stub_server

# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure .env (edit MONGO_URI if needed)
cat .env

# 3. Start the server
uvicorn main:app --port 8001 --reload
```

The server runs at `http://localhost:8001`. The interactive API docs are at `http://localhost:8001/docs`.

---

## Configuration (`.env`)

| Variable | Default | Description |
|---|---|---|
| `MONGO_URI` | `mongodb://localhost:27017` | MongoDB connection string |
| `STUB_DB_NAME` | `stub_instagram` | Database name |
| `CRON_HOUR` | `0` | Hour (24h) for daily cron job |
| `CRON_MINUTE` | `0` | Minute for daily cron job |
| `CRON_TIMEZONE` | `UTC` | Timezone for the cron schedule |
| `CRON_IG_USER_IDS` | `default_user` | Comma-separated user IDs to auto-generate data for |

---

## API Endpoints

### 1. Get Insights

```
GET /stub/insta/get_data/{ig_user_id}/insights
```

Mimics Meta's `GET /<INSTAGRAM_MEDIA_ID>/insights` endpoint.

**Query Parameters:**

| Param | Required | Description |
|---|---|---|
| `metric` | ✅ | Comma-separated metrics: `views`, `profile_links_taps`, `total_interactions`, `reach`, `accounts_engaged`, `additional_follows` |
| `period` | No (default: `day`) | `day`, `week`, `days_28`, `month`, `lifetime`, `total_over_range` |
| `since` | No | Start date — ISO-8601 (`2025-04-01`) or Unix timestamp |
| `until` | No | End date — ISO-8601 or Unix timestamp |

**Example Request:**
```bash
curl "http://localhost:8001/stub/insta/get_data/test_user_1/insights?metric=views,reach&period=day&since=2025-04-01&until=2025-04-10"
```

**Example Response (Meta format):**
```json
{
  "data": [
    {
      "name": "views",
      "period": "day",
      "values": [
        { "value": 523, "end_time": "2025-04-01T00:00:00+0000" },
        { "value": 612, "end_time": "2025-04-02T00:00:00+0000" }
      ],
      "title": "Views",
      "description": "Total number of times the content was viewed.",
      "id": "test_user_1/insights/views/day"
    },
    {
      "name": "reach",
      "period": "day",
      "values": [
        { "value": 401, "end_time": "2025-04-01T00:00:00+0000" },
        { "value": 389, "end_time": "2025-04-02T00:00:00+0000" }
      ],
      "title": "Reach",
      "description": "Number of unique Instagram accounts that have seen the content at least once...",
      "id": "test_user_1/insights/reach/day"
    }
  ]
}
```

**Period behavior:**
- `day` — one value per day with `end_time`
- `week` / `days_28` / `month` — aggregated buckets
- `lifetime` / `total_over_range` — single summed value

**Empty data:** If no data exists for the query, returns `{ "data": [] }` (matches Meta behavior).

---

### 2. Create Entry (Generate Data)

```
GET /stub/insta/create_entry/{ig_user_id}?date=<ISO_DATE>
```

Generates a new daily insights entry using **Gaussian sampling** from historical data and inserts it into MongoDB.

**Query Parameters:**

| Param | Required | Description |
|---|---|---|
| `date` | ✅ | ISO date for the new entry (e.g., `2025-04-09`) |

**Example Request:**
```bash
curl "http://localhost:8001/stub/insta/create_entry/test_user_1?date=2025-04-09"
```

**Example Response:**
```json
{
  "data": [
    { "name": "views", "period": "day", "values": [{ "value": 487, "end_time": "2025-04-09T00:00:00+0000" }], "title": "Views", "description": "...", "id": "test_user_1/insights/views/day" },
    { "name": "profile_links_taps", "period": "day", "values": [{ "value": 22, "end_time": "2025-04-09T00:00:00+0000" }], "title": "Profile links taps", "description": "...", "id": "test_user_1/insights/profile_links_taps/day" }
  ]
}
```

**Duplicate protection:** Returns `409 Conflict` if an entry already exists for that user + date.

**How generation works:** Looks at the last 14 entries, computes mean & standard deviation for each metric, and samples from `N(mean, std)`, clamped to ≥ 0. If no history exists, uses sensible defaults.

---

### 3. Health Check

```
GET /health       → { "status": "ok" }
GET /             → { "message": "Instagram Insights Stub Server is running." }
```

---

## Cron Job (Auto-Generation)

A built-in APScheduler cron job runs daily at the configured time and auto-generates today's entry for each `ig_user_id` listed in `CRON_IG_USER_IDS`.

- Starts automatically when the server boots
- Logs each generation to the console
- Skips silently if the entry already exists (catches errors)

**To configure:** Edit the `CRON_*` variables in `.env`:

```env
CRON_HOUR=0
CRON_MINUTE=0
CRON_TIMEZONE=Asia/Kolkata
CRON_IG_USER_IDS=user_123,user_456
```

---

## CSV Import

Bulk-load historical data from a CSV file:

```bash
python scripts/csv_import.py --csv data.csv --ig-user-id test_user_1
```

**Expected CSV columns:**
```
date,views,profile_links_taps,total_interactions,reach,accounts_engaged,additional_follows
2025-04-01,500,20,150,400,100,15
2025-04-02,520,18,165,420,110,12
```

Missing columns default to `0`. Supports date formats: `YYYY-MM-DD`, `MM/DD/YYYY`, `DD/MM/YYYY`.

---

## Project Structure

```
stub_server/
├── main.py                    # FastAPI app + cron startup
├── requirements.txt           # Dependencies
├── .env                       # Configuration
├── app/
│   ├── database.py            # MongoDB/Beanie connection
│   ├── models/
│   │   └── instagram.py       # InstagramInsight document model
│   ├── routers/
│   │   └── insights.py        # API endpoints
│   ├── services/
│   │   └── generator.py       # Gaussian data generator
│   └── tasks/
│       └── cron.py            # APScheduler daily job
└── scripts/
    └── csv_import.py          # CSV → MongoDB importer
```

---

## Available Metrics

| Metric | Description |
|---|---|
| `views` | Total content views |
| `profile_links_taps` | Bio link taps |
| `total_interactions` | Likes + saves + comments + shares |
| `reach` | Unique accounts that saw content |
| `accounts_engaged` | Unique accounts that interacted |
| `additional_follows` | New followers gained |
