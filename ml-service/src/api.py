import polars as pl
import pandas as pd
import numpy as np
import joblib
import shap
import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from google import genai
from google.genai import types

from src.features import engineer_features
from src.data_loader import load_and_clean_data

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

# the generator (powered by gemini)
@app.post("/generate")
def generate_post(req: GenerateRequest):
    if HISTORICAL_DF is None:
        raise HTTPException(status_code=500, detail="Historical data not loaded.")
    if not os.getenv("GEMINI_API_KEY"):
         raise HTTPException(status_code=500, detail="Gemini API Key missing.")

    # retrieve the top 3 best performing posts of this specific type
    top_posts = (
        HISTORICAL_DF
        .filter(pl.col("Post type") == req.post_type)
        .sort("Like_Rate", descending=True)
        .head(3)
        .select("Description")
        .to_series()
        .to_list()
    )

    if not top_posts:
        examples_text = "No historical examples found for this post type. Use standard professional formatting."
    else:
        examples_text = "\n\n".join([f"Example {i+1}:\n{text}" for i, text in enumerate(top_posts)])

    # the system Instructions
    # system_instruction = f"""
    # You are an expert social media strategist. Your task is to write a highly engaging caption for a new '{req.post_type}'.
    
    # Below are the top 3 best-performing historical captions for this account. 
    # Analyze their tone, length, and hashtag usage, and mimic this exact style.
    
    # HISTORICAL BEST PERFORMERS:
    # {examples_text}
    # """

    # user_prompt = f"Write a new caption about the following topic/trend: {req.topic}"

    prompt = f"""
    You are an expert social media strategist. Your task is to write a highly engaging caption for a new '{req.post_type}'.
    
    Below are the top 3 best-performing historical captions for this account. 
    Analyze their tone, length, and hashtag usage, and mimic this exact style.
    
    HISTORICAL BEST PERFORMERS:
    {examples_text}

    ------------------------
    TASK: Write a new caption about the following topic/trend: {req.topic}
    
    CRITICAL INSTRUCTIONS: 
    - Output ONLY the exact text of the social media caption.
    - Do NOT include any introductory text like "Here is the caption".
    - Do NOT include any outro, rationale, or explanation of your thought process.
    - Return just the raw, ready-to-post text.
    """

    # call the Gemini model using the new google-genai
    try:
        response = client.models.generate_content(
            model='gemma-3-4b-it',
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=300
            )
        )
        
        return {
            "topic": req.topic,
            "post_type": req.post_type,
            "generated_caption": response.text,
            "context_used": len(top_posts)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini Generation failed: {str(e)}")