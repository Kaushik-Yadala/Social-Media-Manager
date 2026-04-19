import os
from pymongo import MongoClient
import chromadb
from dotenv import load_dotenv
from vector_store import embed_text

load_dotenv()

# connect to MongoDB Atlas
MONGO_URI = os.getenv("MONGO_URI")
mongo_client = MongoClient(MONGO_URI)
db = mongo_client["social_media_db"]
posts_collection = db["posts"]

# connect to ChromaDB
chroma_client = chromadb.PersistentClient(path="./chroma_db")
chroma_collection = chroma_client.get_or_create_collection(name="social_posts")

def sync_new_posts():
    print("Starting MongoDB -> ChromaDB Sync...")
    
    # get all existing Post IDs currently in ChromaDB
    existing_data = chroma_collection.get(include=["metadatas"])
    existing_ids = set(existing_data["ids"]) if existing_data["ids"] else set()
    
    # fetch posts from MongoDB that are NOT in our existing ChromaDB IDs
    # (Assuming your Mongo documents have an '_id' or 'post_id' field)
    new_posts = list(posts_collection.find({"post_id": {"$nin": list(existing_ids)}}))
    
    if not new_posts:
        print("Everything is up to date. No new posts to sync.")
        return

    print(f"Found {len(new_posts)} new posts. Embedding and storing...")
    
    ids = []
    documents = []
    embeddings = []
    metadatas = []
    
    for post in new_posts:
        post_id = str(post["post_id"])
        text = str(post.get("description", ""))
        
        if not text.strip(): 
            continue
            
        ids.append(post_id)
        documents.append(text)
        embeddings.append(embed_text(text)) # Call to Gemini to vectorize
        metadatas.append({
            "Post_type": post.get("post_type", "unknown"),
            "Like_Rate": float(post.get("like_rate", 0.0))
        })

    # upsert the new batch into ChromaDB
    if ids:
        chroma_collection.upsert(
            ids=ids,
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas
        )
        print(f"Successfully synced {len(ids)} new posts to Vector DB.")

if __name__ == "__main__":
    sync_new_posts()