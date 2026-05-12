# ============================================================
# ExploreArmenia — Главный файл FastAPI сервера
# ============================================================
# Запускается командой: uvicorn main:app --host 0.0.0.0 --port $PORT
# На Render это делается автоматически через Procfile
# ============================================================

import os
import uuid
import tempfile
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
import mysql.connector
from mysql.connector import Error

# Импортируем наши сервисы (файлы из папки services/)
from services.place_matcher import match_places_from_route
from services.ai_generator import generate_day_texts
from services.docx_builder import build_docx
from services.pdf_builder import convert_to_pdf

# ============================================================
# Инициализация приложения
# ============================================================

app = FastAPI(
    title="ExploreArmenia API",
    description="Генератор программ туров по Армении",
    version="1.0.0"
)

# CORS — разрешаем запросы с твоего домена на Бегете
# Без этого браузер заблокирует запросы с Бегета к Render
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://tours.explorearmenia.am",   # твой поддомен на Бегете
        "http://localhost:3000",              # локальная разработка
        "http://127.0.0.1:5500",             # Live Server в VS Code
        "*"                                  # временно разрешаем всё (уберём позже)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# Подключение к MySQL
# ============================================================

def get_db_connection():
    """
    Создаёт подключение к MySQL на Бегете.
    Credentials берутся из переменных окружения (не из кода!).
    """
    try:
        connection = mysql.connector.connect(
            host=os.environ.get("DB_HOST"),
            port=int(os.environ.get("DB_PORT", 3306)),
            database=os.environ.get("DB_NAME"),
            user=os.environ.get("DB_USER"),
            password=os.environ.get("DB_PASSWORD"),
            charset='utf8mb4',
            # Автоматически переподключаться если соединение упало
            autocommit=True
        )
        return connection
    except Error as e:
        print(f"Ошибка подключения к MySQL: {e}")
        raise HTTPException(status_code=500, detail=f"Database connection failed: {str(e)}")


# ============================================================
# Модели данных (Pydantic)
# ============================================================
# Pydantic — это валидация данных. Если фронт отправит
# неправильные данные, FastAPI автоматически вернёт ошибку.

class TourMeta(BaseModel):
    """Данные тура (первая страница документа)"""
    start: str                    # "07.05.2026"
    end: str                      # "11.05.2026"
    flight_in: str                # "SU 1860, прилет в 12:55"
    flight_out: str               # "SU 1861, вылет в 19:45"
    guests: str                   # "4 человека"
    hotel: str                    # "Holiday INN Express"
    contact: str                  # "Светлана Ходакова, +79655914681"

class GenerateRequest(BaseModel):
    """Запрос на генерацию документа"""
    prompt: str                   # маршрут по дням (сырой текст)
    lang: str = "ru"              # язык вывода: ru, en, hy
    meta: TourMeta                # данные тура

class PlaceCreate(BaseModel):
    """Данные для создания/редактирования места в БД"""
    name_ru: str
    name_en: Optional[str] = ""
    name_hy: Optional[str] = ""
    slug: str
    category: str = "monastery"
    region: Optional[str] = ""
    desc_ru: Optional[str] = ""
    desc_en: Optional[str] = ""
    promo_ru: Optional[str] = ""
    promo_en: Optional[str] = ""
    photo_main: Optional[str] = ""
    photo_secondary: Optional[str] = ""
    aliases: Optional[List[str]] = []  # альтернативные названия


# ============================================================
# ЭНДПОИНТЫ
# ============================================================

@app.get("/health")
def health_check():
    """
    Проверка что сервер работает.
    Открой в браузере: https://твой-адрес.onrender.com/health
    Должен вернуть: {"status": "ok"}
    """
    return {"status": "ok", "service": "ExploreArmenia API"}


@app.get("/health/db")
def health_db():
    """
    Проверка подключения к MySQL.
    Открой: https://твой-адрес.onrender.com/health/db
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM places")
    count = cursor.fetchone()[0]
    cursor.close()
    conn.close()
    return {"status": "ok", "places_count": count}


@app.post("/generate")
async def generate_tour(request: GenerateRequest):
    """
    Главный эндпоинт — генерация тура.
    
    Что происходит внутри:
    1. Парсим маршрут по дням
    2. Для каждого дня ищем места в БД через Gemini
    3. Gemini генерирует красивые тексты на нужном языке
    4. Собираем DOCX по шаблону
    5. Конвертируем в PDF
    6. Возвращаем ссылки на скачивание
    """
    conn = get_db_connection()
    
    try:
        # Шаг 1: Ищем места из промта в базе данных
        matched_days = await match_places_from_route(
            route_text=request.prompt,
            db_conn=conn,
            lang=request.lang
        )
        
        # Шаг 2: Генерируем тексты через Gemini
        enriched_days = await generate_day_texts(
            days=matched_days,
            lang=request.lang
        )
        
        # Шаг 3: Собираем DOCX
        # Уникальное имя файла чтобы не перезаписывать чужие документы
        file_id = str(uuid.uuid4())[:8]
        output_dir = tempfile.mkdtemp()
        docx_path = os.path.join(output_dir, f"tour_{file_id}.docx")
        
        build_docx(
            days=enriched_days,
            meta=request.meta.dict(),
            lang=request.lang,
            output_path=docx_path
        )
        
        # Шаг 4: Конвертируем в PDF
        pdf_path = os.path.join(output_dir, f"tour_{file_id}.pdf")
        convert_to_pdf(docx_path, pdf_path)
        
        # Шаг 5: Сохраняем лог в БД
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO tour_logs (client_name, route_raw, docx_link)
            VALUES (%s, %s, %s)
        """, (request.meta.contact, request.prompt, file_id))
        conn.commit()
        cursor.close()
        
        # Шаг 6: Возвращаем ссылки
        base_url = os.environ.get("RENDER_URL", "http://localhost:8000")
        return {
            "status": "ok",
            "file_id": file_id,
            "docx_url": f"{base_url}/download/{file_id}/docx",
            "pdf_url": f"{base_url}/download/{file_id}/pdf",
            "days_processed": len(enriched_days),
            "places_found": sum(len(d.get("places", [])) for d in enriched_days),
            "places_not_found": [
                p["query"] for d in enriched_days 
                for p in d.get("places", []) 
                if p.get("status") == "PLACE_NOT_FOUND"
            ]
        }
    
    finally:
        conn.close()


@app.get("/download/{file_id}/{format}")
def download_file(file_id: str, format: str):
    """
    Отдаёт файл для скачивания.
    Render хранит временные файлы пока сервер не перезапустится.
    """
    import glob
    
    ext = "docx" if format == "docx" else "pdf"
    pattern = f"/tmp/*/tour_{file_id}.{ext}"
    files = glob.glob(pattern)
    
    if not files:
        raise HTTPException(status_code=404, detail="Файл не найден. Сгенерируйте заново.")
    
    media_type = (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        if ext == "docx" else "application/pdf"
    )
    
    return FileResponse(
        path=files[0],
        media_type=media_type,
        filename=f"ExploreArmenia_tour_{file_id}.{ext}"
    )


# ============================================================
# CRUD для мест (Admin панель)
# ============================================================

@app.get("/places")
def get_places(search: Optional[str] = None, category: Optional[str] = None):
    """
    Возвращает список всех мест из БД.
    Параметры: ?search=хор&category=monastery
    """
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)  # dictionary=True → возвращает dict вместо tuple
    
    query = "SELECT * FROM places WHERE is_active = TRUE"
    params = []
    
    if search:
        query += " AND (name_ru LIKE %s OR name_en LIKE %s)"
        params.extend([f"%{search}%", f"%{search}%"])
    
    if category:
        query += " AND category = %s"
        params.append(category)
    
    query += " ORDER BY name_ru ASC"
    
    cursor.execute(query, params)
    places = cursor.fetchall()
    
    cursor.close()
    conn.close()
    
    return {"places": places, "total": len(places)}


@app.post("/places")
def create_place(place: PlaceCreate):
    """
    Добавляет новое место в базу.
    Вызывается из admin.html когда заполняешь форму.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Вставляем основную запись
        cursor.execute("""
            INSERT INTO places 
            (slug, name_ru, name_en, name_hy, category, region,
             desc_ru, desc_en, promo_ru, promo_en, photo_main, photo_secondary)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            place.slug, place.name_ru, place.name_en, place.name_hy,
            place.category, place.region,
            place.desc_ru, place.desc_en,
            place.promo_ru, place.promo_en,
            place.photo_main, place.photo_secondary
        ))
        
        place_id = cursor.lastrowid
        
        # Вставляем алиасы (альтернативные названия для поиска)
        for alias in place.aliases:
            if alias.strip():
                cursor.execute(
                    "INSERT INTO place_aliases (place_id, alias_name) VALUES (%s, %s)",
                    (place_id, alias.strip())
                )
        
        conn.commit()
        return {"status": "created", "id": place_id}
    
    except Error as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    
    finally:
        cursor.close()
        conn.close()


@app.put("/places/{place_id}")
def update_place(place_id: int, place: PlaceCreate):
    """Редактирует существующее место"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            UPDATE places SET
                name_ru=%s, name_en=%s, name_hy=%s, category=%s, region=%s,
                desc_ru=%s, desc_en=%s, promo_ru=%s, promo_en=%s,
                photo_main=%s, photo_secondary=%s
            WHERE id=%s
        """, (
            place.name_ru, place.name_en, place.name_hy,
            place.category, place.region,
            place.desc_ru, place.desc_en,
            place.promo_ru, place.promo_en,
            place.photo_main, place.photo_secondary,
            place_id
        ))
        
        # Обновляем алиасы: удаляем старые, вставляем новые
        cursor.execute("DELETE FROM place_aliases WHERE place_id = %s", (place_id,))
        for alias in place.aliases:
            if alias.strip():
                cursor.execute(
                    "INSERT INTO place_aliases (place_id, alias_name) VALUES (%s, %s)",
                    (place_id, alias.strip())
                )
        
        conn.commit()
        return {"status": "updated"}
    
    finally:
        cursor.close()
        conn.close()


@app.delete("/places/{place_id}")
def delete_place(place_id: int):
    """
    Мягкое удаление — ставим is_active=FALSE.
    Данные не теряются, просто скрываются.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE places SET is_active = FALSE WHERE id = %s", (place_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return {"status": "deleted"}
