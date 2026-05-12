# ============================================================
# ExploreArmenia — Поиск мест из маршрута в базе данных
# ============================================================
# Как работает:
# 1. Получаем текст: "День 3 — Хор Вирап – Нораванк – Арени"
# 2. Gemini парсит это в список: ["Хор Вирап", "Нораванк", "Арени"]
# 3. Для каждого ищем в MySQL (по name_ru, name_en, aliases)
# 4. Возвращаем структурированный список дней с данными мест
# ============================================================

import os
import json
import re
import google.generativeai as genai
from mysql.connector import Error

# Инициализируем Gemini с ключом из переменной окружения
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
gemini_model = genai.GenerativeModel("gemini-1.5-flash")  # быстрая и бесплатная модель


async def match_places_from_route(route_text: str, db_conn, lang: str = "ru") -> list:
    """
    Главная функция: текст маршрута → список дней с данными мест из БД.
    
    Возвращает структуру вида:
    [
        {
            "day_number": 1,
            "day_label": "День 1 (07.05, четверг)",
            "raw_text": "прилет – трансфер в Ереван - заселение",
            "places": [
                {
                    "query": "Ереван",
                    "status": "OK",
                    "id": 1,
                    "name": "Ереван",
                    "desc": "...",
                    "promo": "...",
                    "photo_main": "https://...",
                    "photo_secondary": "https://..."
                }
            ]
        },
        ...
    ]
    """
    
    # Шаг 1: Парсим маршрут на отдельные дни
    days = parse_days_from_text(route_text)
    
    # Шаг 2: Для каждого дня извлекаем места через Gemini
    result = []
    
    for day in days:
        places_names = await extract_places_with_gemini(day["raw_text"])
        
        # Шаг 3: Ищем каждое место в БД
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
    """
    Разбивает текст маршрута на отдельные дни.
    
    Входные данные:
    "День 1 (07.05, четверг) — прилет – трансфер
     День 2 (08.05, пятница) — Матенадаран – Гарни"
    
    Результат:
    [
        {"day_number": 1, "day_label": "День 1 (07.05, четверг)", "raw_text": "прилет – трансфер"},
        {"day_number": 2, "day_label": "День 2 (08.05, пятница)", "raw_text": "Матенадаран – Гарни"}
    ]
    """
    days = []
    
    # Паттерн: "День N (дата, день недели) — текст"
    # Поддерживает: "День 1", "ДЕНЬ 1", разные разделители (—, -, –)
    pattern = r'(День\s+(\d+)\s*(?:\([^)]+\))?)\s*[—–-]\s*(.+?)(?=День\s+\d+|$)'
    
    matches = re.findall(pattern, route_text, re.IGNORECASE | re.DOTALL)
    
    for match in matches:
        day_label = match[0].strip()
        day_number = int(match[1])
        raw_text = match[2].strip().replace('\n', ' ')
        
        days.append({
            "day_number": day_number,
            "day_label": day_label,
            "raw_text": raw_text
        })
    
    # Если regex не сработал (необычный формат) — возвращаем весь текст как один день
    if not days:
        days.append({
            "day_number": 1,
            "day_label": "День 1",
            "raw_text": route_text.strip()
        })
    
    return days


async def extract_places_with_gemini(day_text: str) -> list:
    """
    Отправляет текст одного дня в Gemini.
    Gemini возвращает список конкретных мест/активностей.
    
    Пример входа:  "Хор Вирап – дегустация крафтовых сыров – Нораванк – пещера Арени"
    Пример выхода: ["Хор Вирап", "дегустация крафтовых сыров", "Нораванк", "пещера Арени"]
    """
    
    prompt = f"""Ты — система обработки туристических маршрутов.

Твоя задача: извлечь ВСЕ конкретные места, достопримечательности и активности из текста.

ПРАВИЛА:
- Включай: монастыри, храмы, музеи, природные объекты, винодельни, мастер-классы, рестораны, города
- НЕ включай: "завтрак в отеле", "прилет", "вылет", "трансфер", "заселение", "свободный день", "возвращение"
- Возвращай ТОЛЬКО JSON массив строк, без объяснений
- Сохраняй оригинальные названия из текста

Текст дня: {day_text}

Ответ ТОЛЬКО в формате JSON: ["место1", "место2", ...]
Если мест нет — верни: []"""
    
    try:
        response = gemini_model.generate_content(prompt)
        text = response.text.strip()
        
        # Убираем markdown-обёртку если Gemini добавил ```json ... ```
        text = re.sub(r'```json\s*', '', text)
        text = re.sub(r'```\s*', '', text)
        text = text.strip()
        
        places = json.loads(text)
        
        # Убеждаемся что получили список строк
        if isinstance(places, list):
            return [str(p) for p in places if p]
        return []
    
    except (json.JSONDecodeError, Exception) as e:
        print(f"Ошибка Gemini при парсинге '{day_text[:50]}...': {e}")
        # Фолбэк: разбиваем текст по разделителям вручную
        parts = re.split(r'\s*[–—-]\s*', day_text)
        return [p.strip() for p in parts if len(p.strip()) > 3]


def find_place_in_db(place_name: str, db_conn, lang: str = "ru") -> dict:
    """
    Ищет место в MySQL по названию.
    
    Порядок поиска:
    1. Точное совпадение с name_ru или name_en
    2. Частичное совпадение (LIKE %название%)
    3. Поиск по aliases
    
    Если ничего не найдено — возвращает PLACE_NOT_FOUND
    """
    
    cursor = db_conn.cursor(dictionary=True)
    
    try:
        # Выбираем нужные поля в зависимости от языка
        if lang == "en":
            name_field = "name_en"
            desc_field = "desc_en"
            promo_field = "promo_en"
        else:  # ru по умолчанию
            name_field = "name_ru"
            desc_field = "desc_ru"
            promo_field = "promo_ru"
        
        # Запрос: ищем в основной таблице И в таблице алиасов
        query = f"""
            SELECT 
                p.id,
                p.{name_field} as name,
                p.name_ru,
                p.{desc_field} as description,
                p.{promo_field} as promo_text,
                p.photo_main,
                p.photo_secondary,
                p.category,
                p.region
            FROM places p
            LEFT JOIN place_aliases pa ON pa.place_id = p.id
            WHERE p.is_active = TRUE
              AND (
                p.name_ru LIKE %s
                OR p.name_en LIKE %s
                OR pa.alias_name LIKE %s
              )
            LIMIT 1
        """
        
        search_term = f"%{place_name}%"
        cursor.execute(query, [search_term, search_term, search_term])
        result = cursor.fetchone()
        
        if result:
            return {
                "query": place_name,
                "status": "OK",
                **result  # разворачиваем все поля из БД
            }
        else:
            # Место не найдено в базе
            print(f"⚠️  PLACE_NOT_FOUND: '{place_name}'")
            return {
                "query": place_name,
                "status": "PLACE_NOT_FOUND",
                "name": place_name,
                "description": "",
                "promo_text": "",
                "photo_main": "",
                "photo_secondary": "",
                "category": "unknown",
                "region": ""
            }
    
    finally:
        cursor.close()
