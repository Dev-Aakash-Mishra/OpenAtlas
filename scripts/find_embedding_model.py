from google import genai
import os
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

print("Searching for embedding models...")
try:
    for model in client.models.list():
        if 'embedContent' in model.supported_actions:
            print(f"Model: {model.name}")
except Exception as e:
    print(f"Error: {e}")
