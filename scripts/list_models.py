from google import genai
import os
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

print("Listing available models...")
try:
    for model in client.models.list():
        print(model)
except Exception as e:
    print(f"Error listing models: {e}")
