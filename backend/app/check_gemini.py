from google import genai
from app.config import settings

client = genai.Client(
    api_key = settings.GEMINI_API_KEY
)

response = client.models.generate_content(
    model = settings.GEMINI_MODEL,
    contents = "Reply with: Gemini connection successful."
)

print(response.text)