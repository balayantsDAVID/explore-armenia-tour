import os
from google import genai

client = genai.Client(
    api_key=os.environ.get("GEMINI_API_KEY"),
    http_options={'api_version': 'v1'}
)
MODEL_ID = "gemini-1.5-flash"

async def generate_day_texts(days: list, lang: str = "ru") -> list:
    for day in days:
        for place in day["places"]:
            if place["status"] == "PLACE_NOT_FOUND":
                place["final_text"] = await generate_fallback_text(place["query"], lang)
            elif not place.get("promo_text", "").strip():
                place["final_text"] = await enrich_description(
                    place.get("name", place["query"]), 
                    place.get("description", ""), 
                    lang
                )
            else:
                place["final_text"] = place["promo_text"]
    return days

async def enrich_description(name: str, raw_desc: str, lang: str = "ru") -> str:
    prompt = f"Перепиши описание места {name} в красивый туристический текст на языке {lang}. База: {raw_desc}"
    try:
        response = client.models.generate_content(model=MODEL_ID, contents=prompt)
        return response.text.strip()
    except:
        return raw_desc

async def generate_fallback_text(place_name: str, lang: str = "ru") -> str:
    prompt = f"Напиши 1-2 предложения о достопримечательности {place_name} на языке {lang}."
    try:
        response = client.models.generate_content(model=MODEL_ID, contents=prompt)
        return f"[AI] {response.text.strip()}"
    except:
        return f"Прекрасное место {place_name} в вашем маршруте."