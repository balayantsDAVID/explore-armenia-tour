import os
import json
import re
import google.generativeai as genai

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
gemini_model = genai.GenerativeModel("gemini-1.5-flash")


async def match_places_from_route(route_text: str, db_conn, lang: str = "ru") -> list:
    days = parse_days_from_text(route_text)
    result = []
    for day in days:
        places_names = await extract_places_with_gemini(day["raw_text"])
        places_data = []
        for place_name in places_names:
            db_place = find_place_in_db(place_name, db_conn, lang)
            places_data.append(db_place)
        result.append({
            "day_number": day["day_number"],
            "day_label": day["day_label"],
            "raw_text": day["raw_text"],
            "places": places_data
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
    prompt = f"""Извлеки ВСЕ конкретные места, достопримечательности и активности из текста.
НЕ включай: прилет, вылет, трансфер, заселение, свободный день, возвращение, завтрак.
Верни ТОЛЬКО JSON массив строк без объяснений.

Текст: {day_text}

Ответ ТОЛЬКО в формате: ["место1", "место2"]
Если мест нет — верни: []"""
    try:
        response = gemini_model.generate_content(prompt)
        text = re.sub(r'```json\s*|```\s*', '', response.text.strip()).strip()
        places = json.loads(text)
        return [str(p) for p in places if p] if isinstance(places, list) else []
    except Exception as e:
        print(f"Gemini parse error: {e}")
        return [p.strip() for p in re.split(r'\s*[–—-]\s*', day_text) if len(p.strip()) > 3]


def find_place_in_db(place_name: str, db_conn, lang: str = "ru") -> dict:
    # PyMySQL — DictCursor уже установлен в соединении
    cursor = db_conn.cursor()
    try:
        name_field = "name_en" if lang == "en" else "name_ru"
        desc_field = "desc_en" if lang == "en" else "desc_ru"
        promo_field = "promo_en" if lang == "en" else "promo_ru"

        query = f"""
            SELECT p.id, p.{name_field} as name, p.name_ru,
                   p.{desc_field} as description,
                   p.{promo_field} as promo_text,
                   p.photo_main, p.photo_secondary,
                   p.category, p.region
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
        else:
            print(f"⚠️ PLACE_NOT_FOUND: '{place_name}'")
            return {
                "query": place_name, "status": "PLACE_NOT_FOUND",
                "name": place_name, "description": "", "promo_text": "",
                "photo_main": "", "photo_secondary": "",
                "category": "unknown", "region": ""
            }
    finally:
        cursor.close()