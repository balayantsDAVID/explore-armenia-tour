# backend/services/place_matcher.py

async def match_places_from_route(route_text: str, db) -> list:
    """
    Шаг 1: OpenAI извлекает список мест из текста
    Шаг 2: Ищем каждое место в БД (точно + по aliases)
    Шаг 3: Не найденные — помечаем PLACE_NOT_FOUND
    """
    
    # Шаг 1 — извлечь названия через AI
    extraction_prompt = f"""
    Извлеки все конкретные места, достопримечательности и активности 
    из текста маршрута. Верни ТОЛЬКО JSON массив названий на русском.
    Не включай: "прилет", "трансфер", "заселение", "свободный день".
    
    Текст: {route_text}
    
    Ответ ТОЛЬКО в формате: ["место1", "место2", ...]
    """
    
    places_list = await openai_extract(extraction_prompt)
    
    # Шаг 2 — искать в БД
    results = []
    for place_name in places_list:
        found = await db.query("""
            SELECT p.* FROM places p
            LEFT JOIN place_aliases pa ON pa.place_id = p.id
            WHERE p.name_ru LIKE %s 
               OR p.name_en LIKE %s
               OR pa.alias LIKE %s
            LIMIT 1
        """, [f"%{place_name}%"] * 3)
        
        results.append({
            "query": place_name,
            "found": found[0] if found else None,
            "status": "OK" if found else "PLACE_NOT_FOUND"
        })
    
    return results