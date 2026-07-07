# Social Media Dashboard

- This is a team final project for the **Design and Analysis of Software Systems** course. This was created by working with a client (Club Artizen) to create a system that meets their requirements. This is a project that is currently deployed and used by the client.

## 1. Overview
The **Social Media Dashboard** is a unified analytics platform providing comprehensive insights into various social media channels and website performance. It aggregates data from Google Analytics 4 (GA4), YouTube, LinkedIn, Instagram, and WhatsApp into a single customizable dashboard interface. The platform is enriched with an advanced Machine Learning microservice that brings in capabilities like trend analysis, sentiment analysis, and competitor tracking.

## 2. Folder Structure
```text
project-monorepo-team-35/
├── .github/          # GitHub actions and workflow configurations
├── docs/             # Project documentation (SRS, Design Document, etc.)
├── ml-service/       # Machine Learning microservice (FastAPI, GenAI, ChromaDB)
├── scripts/          # Utility and simulation scripts (e.g., test data generation)
├── src/
│   ├── backend/      # Core FastAPI backend serving the main API and integrating with external platforms
│   └── frontend/     # Next.js frontend application with Tailwind CSS and Recharts
├── main.py           # Root ASGI entrypoint to run the backend API easily
└── README.md         # This repository overview
```

## 3. Tech Stack
**Frontend:**
- Framework: Next.js (React)
- Styling: Tailwind CSS v4, Shadcn UI
- Data Visualization: Recharts
- Layout: React Grid Layout

**Backend:**
- Framework: FastAPI
- Database: MongoDB (Motor Async Client)
- Task Scheduling: APScheduler
- Integrations: Google API Client (GA4), various OAuth and Social API integrations.

**Machine Learning Service:**
- Framework: FastAPI
- ML/AI: Google GenAI, Scikit-Learn, TextBlob, SHAP
- Vector Database: ChromaDB
- Data Processing: Pandas, Polars

## 4. Setup Instructions

### Prerequisites
- Node.js (v18+)
- Python (v3.12 or v3.13+)
- MongoDB instance running

### Backend Setup
```bash
# Navigate to the backend directory
cd src/backend

# Install dependencies
pip install -r requirements.txt

# Create a .env file based on environment variables required (e.g., MongoDB URI, API Keys)

# Run the backend server
# (Alternatively, you can run `uvicorn main:app --reload` from the root of the repo)
uvicorn main:app --reload
```

### Frontend Setup
```bash
# Navigate to the frontend directory
cd src/frontend

# Install dependencies
npm install

# Create a .env file based on .env.example

# Run the development server
npm run dev
```

### ML Service Setup
```bash
# Navigate to the ml-service directory
cd ml-service

# Install dependencies (uses uv or pip)
pip install -e .

# Run the ML service server
uvicorn main:app --reload --port 8001
```

## 5. Functions Implemented
- **Unified Analytics Dashboard:** A customizable grid-based dashboard integrating metrics across all platforms.
- **Platform Integrations:** Direct data fetching from Google Analytics, YouTube, LinkedIn, Instagram, and WhatsApp.
- **Authentication & Security:** Secure JWT-based authentication flow for users.
- **Competitor Analysis:** Tracks and compares client metrics against identified competitors.
- **Trend Forecasting & Analysis:** Automated background jobs to scrape and analyze current trends using external ML models and text analysis tools.
- **Social Insights:** Generates actionable AI-driven insights leveraging Google GenAI and user engagement data.
