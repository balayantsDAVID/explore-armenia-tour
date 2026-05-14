import os
import json
import re
from google import genai
# from google.genai import types

# Инициализация нового клиента
client = genai.Client(
    api_key=os.environ.get("GEMINI_API_KEY"),
    http_options={'api_version': 'v1'}
)
MODEL_ID = "gemini-1.5-flash"

async def match_places_from_route(route_text: str, db_conn, lang: str = "ru") -> list:
    days = parse_days_from_text(route_text)
    result = []
    
    for day in days:
        places_names = await extract_places_with_gemini(day["raw_text"])
        
        EXCLUDE_WORDS = {'прилет', 'вылет', 'перелет', 'заселение', 'выселение',
                         'трансфер', 'возвращение', 'свободный день', 'завтрак'}
        
        filtered_names = [p for p in places_names 
                         if p.lower().strip() not in EXCLUDE_WORDS
                         and not any(ex in p.lower() for ex in ['трансфер', 'прилет', 'вылет'])]

        places_data = []
        for place_name in filtered_names:
            db_place = find_place_in_db(place_name, db_conn, lang)
            places_data.append(db_place)

        # Убираем дубликаты по ID
        seen_ids = set()
        unique_places = []
        for p in places_data:
            pid = p.get('id')
            if pid and pid not in seen_ids:
                seen_ids.add(pid)
                unique_places.append(p)
            elif not pid: # Если место не в базе, оставляем для AI генерации
                unique_places.append(p)

        result.append({
            "day_number": day["day_number"],
            "day_label": day["day_label"],
            "raw_text": day["raw_text"],
            "places": unique_places
        })
    return result

def parse_days_from_text(route_text: str) -> list:
    days = []
    pattern = r'(День\s+(\d+)\s*(?:\([^)]+\))?)\s*[—–-]\s*(.+?)(?=День\s+\d+|$)'
    matches = re.findall(pattern, route_text, re.IGNORECASE | re.DOTALL)
    for match in matches:
        days.append({
            "day_number": int(match[1]),
            "day_label": match[0].strip(),
            "raw_text": match[2].strip().replace('\n', ' ')
        })
    if not days:
        days.append({"day_number": 1, "day_label": "День 1", "raw_text": route_text.strip()})
    return days

async def extract_places_with_gemini(day_text: str) -> list:
    prompt = f"Извлеки ТОЛЬКО названия достопримечательностей из текста: {day_text}. Верни только JSON массив строк."
    
    try:
        # Новый синтаксис вызова
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type='application/json',
            )
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Gemini Error: {e}")
        # Наш надежный запасной вариант (regex)
        return [p.strip() for p in re.split(r'\s*[–—-]\s*', day_text) if len(p.strip()) > 3]

def find_place_in_db(place_name: str, db_conn, lang: str = "ru") -> dict:
    cursor = db_conn.cursor()
    try:
        name_field = "name_en" if lang == "en" else "name_ru"
        desc_field = "desc_en" if lang == "en" else "desc_ru"
        promo_field = "promo_en" if lang == "en" else "promo_ru"
        
        query = f"""
            SELECT p.id, p.{name_field} as name, p.name_ru,
            p.{desc_field} as description, p.{promo_field} as promo_text,
            p.photo_main, p.category, p.region
            FROM places p
            LEFT JOIN place_aliases pa ON pa.place_id = p.id
            WHERE p.is_active = TRUE 
            AND (p.name_ru LIKE %s OR p.name_en LIKE %s OR pa.alias_name LIKE %s)
            LIMIT 1
        """
        cursor.execute(query, [f"%{place_name}%"] * 3)
        result = cursor.fetchone()
        if result:
            return {"query": place_name, "status": "OK", **result}
        return {"query": place_name, "status": "PLACE_NOT_FOUND", "description": "", "promo_text": ""}
    finally:
        cursor.close()