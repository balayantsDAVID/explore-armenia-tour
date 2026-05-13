# ============================================================
# ExploreArmenia — Конвертация DOCX в PDF
# ============================================================
# Использует LibreOffice (устанавливается на Render бесплатно)
# Команда: libreoffice --headless --convert-to pdf файл.docx
# ============================================================

import os
import subprocess


def convert_to_pdf(docx_path: str, pdf_path: str):
    """
    Конвертирует DOCX в PDF через LibreOffice.
    
    LibreOffice устанавливается в Render через apt-get в build команде.
    Это бесплатно и даёт отличное качество конвертации.
    
    Args:
        docx_path: путь к исходному .docx файлу
        pdf_path: путь куда сохранить .pdf файл
    """
    
    output_dir = os.path.dirname(pdf_path)
    
    # LibreOffice конвертирует и сохраняет рядом с исходным файлом
    # с тем же именем но расширением .pdf
    result = subprocess.run(
        [
            "libreoffice",
            "--headless",                    # без графического интерфейса
            "--convert-to", "pdf",           # конвертируем в PDF
            "--outdir", output_dir,          # папка для результата
            docx_path                        # исходный файл
        ],
        capture_output=True,
        text=True,
        timeout=60
    )
    
    if result.returncode != 0:
        # LibreOffice не установлен или ошибка — пробуем fallback
        print(f"LibreOffice error: {result.stderr}")
        _fallback_pdf(docx_path, pdf_path)
        return
    
    # LibreOffice сохраняет файл с тем же именем но .pdf
    # Перемещаем если нужно в нужное место
    auto_pdf = docx_path.replace('.docx', '.pdf')
    if auto_pdf != pdf_path and os.path.exists(auto_pdf):
        os.rename(auto_pdf, pdf_path)
    
    if not os.path.exists(pdf_path):
        raise RuntimeError(f"PDF не создан по пути: {pdf_path}")
    
    print(f"✅ PDF готов: {pdf_path}")


def _fallback_pdf(docx_path: str, pdf_path: str):
    """
    Запасной вариант если LibreOffice недоступен.
    Создаёт простой PDF через reportlab (только текст, без форматирования).
    Используется только как крайний случай.
    """
    try:
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import A4
        import json
        
        c = canvas.Canvas(pdf_path, pagesize=A4)
        c.setFont("Helvetica-Bold", 16)
        c.drawString(50, 800, "ExploreArmenia — Программа тура")
        c.setFont("Helvetica", 10)
        c.drawString(50, 780, "PDF создан в упрощённом режиме.")
        c.drawString(50, 760, f"Для полного PDF скачайте DOCX: {os.path.basename(docx_path)}")
        c.save()
        print(f"⚠️  PDF создан в fallback режиме (без форматирования)")
    
    except Exception as e:
        raise RuntimeError(f"Не удалось создать PDF: {e}")