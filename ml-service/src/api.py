import polars as pl
import pandas as pd
import numpy as np
import joblib
import shap
import os
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from dotenv import load_dotenv
from google import genai
from google.genai import types

from src.features import engineer_features
from src.data_loader import load_and_clean_data
from src.trend_ingestor import get_rising_trends
from src.vector_store import retrieve_similar_posts

# load environment variables
load_dotenv()

# configure Gemini API
gemini_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=gemini_key)

app = FastAPI(title="Engagement Prediction & Generation API")

# global variables for RAM state
MODEL = None
MODEL_COLUMNS = None
EXPLAINER = None
HISTORICAL_DF = None

class PostRequest(BaseModel):
    description: str
    duration_sec: int
    publish_time: str
    post_type: str

class GenerateRequest(BaseModel):
    topic: str
    post_type: str

class GenerateInsightRequest(BaseModel):
    # Optional: If empty, the system will auto-hunt for trends
    seed_keywords: list[str] = ["khadi", "block print", "sustainable packaging", "handmade"]

# on startup
@app.on_event("startup")
def load_artifacts():
    global MODEL, MODEL_COLUMNS, EXPLAINER, HISTORICAL_DF
    base_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(base_dir, "../models/rf_engagement_model.joblib")
    cols_path = os.path.join(base_dir, "../models/model_columns.joblib")
    
    if not os.path.exists(model_path):
        raise RuntimeError("Model not found. Please run src/model.py first.")
        
    MODEL = joblib.load(model_path)
    MODEL_COLUMNS = joblib.load(cols_path)
    EXPLAINER = shap.TreeExplainer(MODEL)
    
    HISTORICAL_DF = load_and_clean_data()
    
    if not os.getenv("GEMINI_API_KEY"):
        print("WARNING: GEMINI_API_KEY not found in .env")
    
    print("Model, Explainer, and Historical Data loaded into RAM.")

# the predictor
@app.post("/predict")
def predict_engagement(post: PostRequest):
    df = pl.DataFrame({
        "Description": [post.description],
        "Duration (sec)": [post.duration_sec],
        "Publish time": [post.publish_time],
        "Post type": [post.post_type],
        "Post ID": [0], "Date": [""], "Like_Rate": [0.0] 
    })

    try:
        X_polars, _ = engineer_features(df)
        X_pandas = X_polars.to_pandas()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Feature extraction failed: {str(e)}")

    for col in MODEL_COLUMNS:
        if col not in X_pandas.columns:
            X_pandas[col] = 0
            
    X_final = X_pandas[MODEL_COLUMNS]
    prediction = MODEL.predict(X_final)[0]
    shap_values = EXPLAINER.shap_values(X_final)
    
    shap_dict = {
        col: float(val) 
        for col, val in zip(MODEL_COLUMNS, shap_values[0]) 
        if abs(val) > 0.0001
    }
    shap_dict = dict(sorted(shap_dict.items(), key=lambda item: abs(item[1]), reverse=True))

    baseline = EXPLAINER.expected_value
    if isinstance(baseline, np.ndarray):
        baseline = baseline[0]

    return {
        "predicted_like_rate": round(float(prediction), 4),
        "baseline_rate": round(float(baseline), 4),
        "shap_explanations": shap_dict
    }
    
@app.post("/generate_insight")
def generate_trend_insight(req: GenerateInsightRequest):
    if not os.getenv("GEMINI_API_KEY"):
         raise HTTPException(status_code=500, detail="Gemini API Key missing.")

    # 1. Fetch rising trends from Google Trends
    print("Scanning ecosystem for trends...")
    trends = get_rising_trends(req.seed_keywords, threshold=15.0)
    
    if not trends:
        return {"message": "No significant trends detected today based on your seed keywords."}
        
    # take the hottest trend
    top_trend = trends[0]["trend"]
    momentum = trends[0]["momentum"]
    
    # retrieve similar historical posts from our Vector DB
    print(f"Retrieving internal context for: {top_trend}")
    similar_posts = retrieve_similar_posts(top_trend, top_k=3)
    
    if not similar_posts:
        context_text = "We have no historical posts related to this trend."
    else:
        context_text = "\n\n".join([
            f"- Caption: {post['description']}\n  Format: {post['metadata']['Post_type']}\n  Like Rate: {post['metadata']['Like_Rate']:.4f}" 
            for post in similar_posts
        ])

    # construct the RAG Prompt for Gemini
    prompt = f"""
    You are an expert social media strategist for an artisanal lifestyle brand.
    
    MARKET ALERT: Google Search volume for '{top_trend}' has spiked by {momentum}% in the last 7 days.
    
    OUR HISTORICAL PERFORMANCE ON THIS TOPIC:
    {context_text}

    ------------------------
    TASK:
    Based on the market trend and our historical data, generate:
    1. A short, actionable strategic recommendation (Should we post about this? What format works best?)
    2. A ready-to-post, highly engaging caption capitalizing on this trend.
    
    Format your response clearly.
    """

    try:
        response = client.models.generate_content(
            model='gemma-3-4b-it',
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=500
            )
        )
        
        return {
            "detected_trend": top_trend,
            "momentum": momentum,
            "strategy_and_caption": response.text,
            "historical_posts_referenced": len(similar_posts)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini Generation failed: {str(e)}")