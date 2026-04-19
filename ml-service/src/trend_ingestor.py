import pandas as pd
from pytrends.request import TrendReq
import time

def get_rising_trends(keywords: list, threshold: float = 20.0) -> list:
    """
    Checks Google Trends for a list of keywords and returns those with 
    a 7-day positive momentum crossing the threshold percentage.
    """
    # initialize pytrends (using standard parameters to avoid blocks)
    pytrend = TrendReq(hl='en-US', tz=330, timeout=(10,25))
    
    rising_trends = []
    
    # process in chunks of 5 (Google Trends API limit per request)
    for i in range(0, len(keywords), 5):
        chunk = keywords[i:i+5]
        
        try:
            # build payload for the last 30 days in India (adjust 'IN' as needed)
            pytrend.build_payload(chunk, cat=0, timeframe='today 1-m', geo='IN')
            df = pytrend.interest_over_time()
            
            if not df.empty and 'isPartial' in df.columns:
                df = df.drop(columns=['isPartial'])
                
            for term in chunk:
                if term in df.columns:
                    # get the average of the first 3 weeks vs the last 7 days
                    historical_avg = df[term].iloc[:-7].mean()
                    recent_avg = df[term].iloc[-7:].mean()
                    
                    if historical_avg == 0: continue # Prevent division by zero
                    
                    # Calculate momentum (percentage increase)
                    momentum = ((recent_avg - historical_avg) / historical_avg) * 100
                    
                    if momentum >= threshold:
                        rising_trends.append({
                            "trend": term,
                            "momentum": round(momentum, 2)
                        })
            
            # sleep to prevent rate-limiting
            time.sleep(2)
            
        except Exception as e:
            print(f"Warning: Failed to fetch chunk {chunk}. Error: {e}")
            
    # sort by highest momentum
    rising_trends = sorted(rising_trends, key=lambda x: x["momentum"], reverse=True)
    return rising_trends

# Quick test
if __name__ == "__main__":
    seed_terms = ["khadi", "diwali hampers", "block print", "sustainable packaging"]
    trends = get_rising_trends(seed_terms, threshold=10.0)
    print("Rising Trends:", trends)