# ============================================================
# ExploreArmenia — Генерация туристических текстов через Gemini
# ============================================================
# Берёт данные из БД (сухое описание) и превращает их в
# красивый туристический текст для программы тура.
# ============================================================

import os
import json
import re
import google.generativeai as genai

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
gemini_model = genai.GenerativeModel("gemini-1.5-flash")

async def generate_day_texts(days: list, lang: str = "ru") -> list:
    """
    Для каждого дня генерирует красивое описание через Gemini.
    
    Если место найдено в БД — берём promo_text из БД (не придумываем).
    Если место НЕ найдено — Gemini пишет краткое описание на основе названия.
    Если promo_text пустой — Gemini дополняет на основе desc.
    """
    
    enriched_days = []
    
    for day in days:
        enriched_places = []
        
        for place in day["places"]:
            
            if place["status"] == "PLACE_NOT_FOUND":
                # Место не в базе — просим Gemini написать минимальное описание
                text = await generate_fallback_text(place["query"], lang)
                place["final_text"] = text
                place["warning"] = f"⚠️ '{place['query']}' не найден в базе. Добавьте его через Admin панель."
            
            elif not place.get("promo_text", "").strip():
                # Место есть в БД, но promo_text пустой — генерируем из description
                text = await enrich_description(
                    name=place.get("name", place["query"]),
                    raw_desc=place.get("description", ""),
                    lang=lang
                )
                place["final_text"] = text
            
            else:
                # Всё хорошо — берём готовый promo_text из БД
                place["final_text"] = place["promo_text"]
            
            enriched_places.append(place)
        
        enriched_days.append({
            **day,
            "places": enriched_places
        })
    
    return enriched_days


async def enrich_description(name: str, raw_desc: str, lang: str = "ru") -> str:
    """
    Превращает сухое описание из БД в красивый туристический текст.
    Используется когда promo_text не заполнен, но desc_ru есть.
    """
    
    lang_instruction = {
        "ru": "на русском языке",
        "en": "in English",
        "hy": "հայերեն"
    }.get(lang, "на русском языке")
    
    prompt = f"""Ты — копирайтер туристической компании ExploreArmenia.

Перепиши описание достопримечательности в красивый туристический стиль {lang_instruction}.

Требования:
- 2-3 предложения максимум
- Эмоциональный, вдохновляющий тон
- Подчёркивай уникальность места
- НЕ выдумывай исторические факты, используй только данные из описания
- Без вводных фраз типа "Это место..." или "Добро пожаловать..."

Название: {name}
Исходное описание: {raw_desc}

Результат (только текст, без кавычек):"""
    
    try:
        response = gemini_model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        print(f"Ошибка генерации текста для '{name}': {e}")
        return raw_desc  # возвращаем оригинальное описание как запасной вариант


async def generate_fallback_text(place_name: str, lang: str = "ru") -> str:
    """
    Генерирует минимальное описание для мест которых НЕТ в базе.
    Важно: помечаем что данные сгенерированы AI, а не из БД.
    """
    
    lang_instruction = {
        "ru": "на русском языке",
        "en": "in English", 
        "hy": "հայերեն"
    }.get(lang, "на русском языке")
    
    prompt = f"""Напиши 1-2 предложения об армянской достопримечательности "{place_name}" {lang_instruction}.
Стиль: туристический, вдохновляющий.
Только текст, без вводных фраз."""
    
    try:
        response = gemini_model.generate_content(prompt)
        return f"[AI] {response.text.strip()}"
    except Exception as e:
        return f"{place_name} — интересная остановка в вашем маршруте по Армении."
