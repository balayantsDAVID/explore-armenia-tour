import os
import uuid
import tempfile
import traceback
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List

app = FastAPI(title="ExploreArmenia API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

REQUIRED_ENV = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD", "GEMINI_API_KEY"]

@app.on_event("startup")
async def startup_check():
    try:
        conn = get_db_connection()
        conn.close()
        print("✅ MySQL подключение успешно")
    except Exception as e:
        print(f"❌ MySQL ошибка: {e}")

def get_db_connection():
    import pymysql.cursors
    return pymysql.connect(
        host=os.environ.get("DB_HOST"),
        port=int(os.environ.get("DB_PORT", 3306)),
        database=os.environ.get("DB_NAME"),
        user=os.environ.get("DB_USER"),
        password=os.environ.get("DB_PASSWORD"),
        charset='utf8mb4',
        autocommit=True,
        connect_timeout=10,
        cursorclass=pymysql.cursors.DictCursor
    )

class TourMeta(BaseModel):
    start: str
    end: str
    flight_in: str
    flight_out: str
    guests: str
    hotel: str
    contact: str

class GenerateRequest(BaseModel):
    prompt: str
    lang: str = "ru"
    meta: TourMeta

class PlaceCreate(BaseModel):
    slug: str
    name_ru: str
    name_en: Optional[str] = ""
    name_de: Optional[str] = ""
    name_hy: Optional[str] = ""
    desc_ru: Optional[str] = ""
    desc_en: Optional[str] = ""
    desc_de: Optional[str] = ""
    desc_hy: Optional[str] = ""
    photo_main: Optional[str] = ""
    aliases: Optional[List[str]] = []

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/analytics/generations")
def get_generations_analytics():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT DATE(created_at) as date, COUNT(*) as count 
            FROM tour_logs 
            GROUP BY DATE(created_at) 
            ORDER BY date ASC
        """)
        data = cursor.fetchall()
        return {"analytics": [{"date": str(row['date']), "count": row['count']} for row in data]}
    except Exception as e:
        return {"error": str(e)}
    finally:
        cursor.close()
        conn.close()

@app.post("/generate")
async def generate_tour(request: GenerateRequest):
    try:
        from services.place_matcher import match_places_from_route
        from services.ai_generator import generate_day_texts
        from services.docx_builder import build_docx
        from services.pdf_builder import convert_to_pdf
    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"Import error: {str(e)}")

    conn = get_db_connection()
    try:
        matched_days = await match_places_from_route(request.prompt, conn, request.lang)
        enriched_days = await generate_day_texts(matched_days, request.meta.dict(), request.lang)
        
        file_id = str(uuid.uuid4())[:8]
        output_dir = tempfile.mkdtemp()
        
        docx_path = os.path.join(output_dir, f"tour_{file_id}.docx")
        build_docx(enriched_days, request.meta.dict(), request.lang, docx_path)
        
        import json as json_module
        pdf_data_path = os.path.join(output_dir, f"tour_{file_id}_input.json")
        with open(pdf_data_path, 'w', encoding='utf-8') as f:
            json_module.dump({"days": enriched_days, "meta": request.meta.dict(), "lang": request.lang}, f, ensure_ascii=False)
            
        pdf_path = os.path.join(output_dir, f"tour_{file_id}.pdf")
        convert_to_pdf(docx_path, pdf_path, tour_data={"days": enriched_days, "meta": request.meta.dict(), "lang": request.lang})
        
        try:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO tour_logs (client_name, route_raw, docx_link) VALUES (%s, %s, %s)",
                           (request.meta.contact, request.prompt, file_id))
            cursor.close()
        except: pass
        
        base_url = os.environ.get("RENDER_URL", "https://explore-armenia-tour.onrender.com")
        return {
            "status": "ok", "file_id": file_id,
            "docx_url": f"{base_url}/download/{file_id}/docx",
            "pdf_url": f"{base_url}/download/{file_id}/pdf",
            "days_processed": len(enriched_days),
            "places_found": sum(1 for d in enriched_days for p in d.get("places", []) if p.get("status") == "OK")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=traceback.format_exc())
    finally:
        conn.close()

@app.get("/download/{file_id}/{format}")
def download_file(file_id: str, format: str):
    import glob
    ext = "docx" if format == "docx" else "pdf"
    files = glob.glob(f"/tmp/*/tour_{file_id}.{ext}")
    if not files: raise HTTPException(status_code=404, detail="Файл не найден")
    return FileResponse(path=files[0], filename=f"ExploreArmenia_tour_{file_id}.{ext}")

@app.get("/places")
def get_places(search: Optional[str] = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    # ВОТ ЗДЕСЬ ИСПРАВЛЕН ЗАПРОС ДЛЯ ПСЕВДОНИМОВ: GROUP_CONCAT
    query = """
        SELECT p.id, p.slug, p.name_ru, p.name_en, p.name_de, p.name_hy,
               p.desc_ru, p.desc_en, p.desc_de, p.desc_hy, p.photo_main,
               GROUP_CONCAT(pa.alias_name SEPARATOR ', ') as aliases_str
        FROM places p
        LEFT JOIN place_aliases pa ON p.id = pa.place_id
        WHERE p.is_active = TRUE
    """
    params = []
    if search:
        query += " AND (p.name_ru LIKE %s OR p.name_en LIKE %s OR p.name_de LIKE %s OR p.name_hy LIKE %s)"
        params.extend([f"%{search}%"] * 4)
    query += " GROUP BY p.id ORDER BY p.name_ru ASC"
    
    cursor.execute(query, params)
    places = cursor.fetchall()
    cursor.close()
    conn.close()
    return {"places": places, "total": len(places)}

@app.post("/places")
def create_place(place: PlaceCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO places (slug, name_ru, name_en, name_de, name_hy, desc_ru, desc_en, desc_de, desc_hy, photo_main)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (place.slug, place.name_ru, place.name_en, place.name_de, place.name_hy,
              place.desc_ru, place.desc_en, place.desc_de, place.desc_hy, place.photo_main))
        place_id = cursor.lastrowid
        for alias in place.aliases:
            if alias.strip():
                cursor.execute("INSERT INTO place_aliases (place_id, alias_name) VALUES (%s, %s)", (place_id, alias.strip()))
        return {"status": "created", "id": place_id}
    except Exception as e: raise HTTPException(status_code=400, detail=str(e))
    finally: cursor.close(); conn.close()

@app.put("/places/{place_id}")
def update_place(place_id: int, place: PlaceCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE places SET slug=%s, name_ru=%s, name_en=%s, name_de=%s, name_hy=%s,
                desc_ru=%s, desc_en=%s, desc_de=%s, desc_hy=%s, photo_main=%s WHERE id=%s
        """, (place.slug, place.name_ru, place.name_en, place.name_de, place.name_hy,
              place.desc_ru, place.desc_en, place.desc_de, place.desc_hy, place.photo_main, place_id))
        
        cursor.execute("DELETE FROM place_aliases WHERE place_id = %s", (place_id,))
        for alias in place.aliases:
            if alias.strip():
                cursor.execute("INSERT INTO place_aliases (place_id, alias_name) VALUES (%s, %s)", (place_id, alias.strip()))
        conn.commit()
        return {"status": "updated"}
    except Exception as e: raise HTTPException(status_code=500, detail=traceback.format_exc())
    finally: cursor.close(); conn.close()

@app.delete("/places/{place_id}")
def delete_place(place_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM place_aliases WHERE place_id = %s", (place_id,))
        cursor.execute("DELETE FROM places WHERE id = %s", (place_id,))
        conn.commit()
        return {"status": "deleted"}
    finally: cursor.close(); conn.close()