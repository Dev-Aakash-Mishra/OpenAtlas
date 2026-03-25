from google import genai
import os
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

text = "Hello world"
model = "models/gemini-embedding-2-preview"

print(f"Testing embedding with {model}...")
try:
    response = client.models.embed_content(
        model=model,
        contents=text,
        config={
            "output_dimensionality": 768
        }
    )
    vec = response.embeddings[0].values
    print(f"Dimension: {len(vec)}")
except Exception as e:
    print(f"Error: {e}")
