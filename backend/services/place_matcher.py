import os, json, re
from google import genai

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
MODEL_ID = "gemini-3.1-flash-lite"

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

        # Убираем дубликаты
        seen_ids = set()
        unique_places = []
        for p in places_data:
            pid = p.get('id')
            if pid and pid not in seen_ids:
                seen_ids.add(pid)
                unique_places.append(p)
            elif not pid:
                unique_places.append(p)

        result.append({
            "day_number": day["day_number"],
            "raw_text": day["raw_text"],
            "places": unique_places
        })
    return result

def parse_days_from_text(route_text: str) -> list:
    days = []
    # Ловим любой формат "День 1" и берем текст до следующего дня
    pattern = r'(День\s+(\d+).*?)\s*[—–-]\s*(.+?)(?=День\s+\d+|$)'
    matches = re.findall(pattern, route_text, re.IGNORECASE | re.DOTALL)
    
    for match in matches:
        days.append({
            "day_number": int(match[1]),
            "raw_text": match[2].strip().replace('\n', ' ')
        })
    if not days:
        days.append({"day_number": 1, "raw_text": route_text.strip()})
    return days

async def extract_places_with_gemini(day_text: str) -> list:
    prompt = f"Извлеки ТОЛЬКО названия достопримечательностей из текста: {day_text}. Верни JSON массив строк. Без markdown."
    try:
        response = client.models.generate_content(model=MODEL_ID, contents=prompt)
        text = re.sub(r'```json\s*|```\s*', '', response.text.strip()).strip()
        return json.loads(text)
    except Exception as e:
        parts = re.split(r'\s*[–—-]\s*', day_text)
        return [p.strip() for p in parts if len(p.strip()) > 3]

def find_place_in_db(place_name: str, db_conn, lang: str = "ru") -> dict:
    cursor = db_conn.cursor()
    try:
        # Умный выбор языка из БД
        name_field = f"name_{lang}" if lang in ["ru", "en", "de", "hy"] else "name_ru"
        desc_field = f"desc_{lang}" if lang in ["ru", "en", "de", "hy"] else "desc_ru"
        
        query = f"""
            SELECT p.id, p.{name_field} as name, p.{desc_field} as description, p.photo_main
            FROM places p
            LEFT JOIN place_aliases pa ON pa.place_id = p.id
            WHERE p.slug = %s OR p.name_ru LIKE %s OR p.name_en LIKE %s OR p.name_de LIKE %s OR p.name_hy LIKE %s OR pa.alias_name LIKE %s
            LIMIT 1
        """
        like_val = f"%{place_name}%"
        cursor.execute(query, (place_name, like_val, like_val, like_val, like_val, like_val))
        result = cursor.fetchone()
        if result:
            return {"query": place_name, "status": "OK", **result}
        return {"query": place_name, "status": "PLACE_NOT_FOUND", "description": ""}
    finally:
        cursor.close()