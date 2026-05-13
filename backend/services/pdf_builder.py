import os
import subprocess

def convert_to_pdf(docx_path: str, pdf_path: str):
    """
    Конвертация DOCX в PDF.
    На Render free tier LibreOffice недоступен — используем reportlab fallback.
    """
    # Сначала пробуем LibreOffice (если вдруг есть)
    try:
        result = subprocess.run(
            ["libreoffice", "--headless", "--convert-to", "pdf",
             "--outdir", os.path.dirname(pdf_path), docx_path],
            capture_output=True, text=True, timeout=30
        )
        auto_pdf = docx_path.replace('.docx', '.pdf')
        if os.path.exists(auto_pdf):
            if auto_pdf != pdf_path:
                os.rename(auto_pdf, pdf_path)
            print(f"✅ PDF via LibreOffice")
            return pdf_path
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass  # LibreOffice недоступен — идём к fallback

    # Fallback: reportlab
    _make_pdf_reportlab(docx_path, pdf_path)
    return pdf_path


def _make_pdf_reportlab(docx_path: str, pdf_path: str):
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    import json, os

    # Пробуем загрузить данные тура из JSON рядом с docx
    input_json = docx_path.replace('.docx', '_input.json')
    tour_data = None
    if os.path.exists(input_json):
        with open(input_json, 'r', encoding='utf-8') as f:
            tour_data = json.load(f)

    w, h = A4
    c = canvas.Canvas(pdf_path, pagesize=A4)

    def new_page():
        # Хедер
        c.setFillColorRGB(0, 0.667, 0.8)
        c.rect(0, h - 55, w, 55, fill=1, stroke=0)
        c.setFillColorRGB(1, 1, 1)
        c.setFont("Helvetica-Bold", 16)
        c.drawCentredString(w / 2, h - 35, "PROGRAMA TURA PO ARMENII")
        # Футер
        c.setFillColorRGB(0.8, 0, 0)
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(w / 2, 25, "Armenia - strana, v kotoruyu mozhno vlyubitsya!")
        c.setFillColorRGB(0.4, 0.4, 0.4)
        c.setFont("Helvetica", 8)
        c.drawCentredString(w / 2, 14, "info@explorearmenia.am | www.explorearmenia.am")

    # Страница 1: данные тура
    new_page()
    y = h - 80
    c.setFillColorRGB(0, 0, 0)

    if tour_data and tour_data.get('meta'):
        meta = tour_data['meta']
        fields = [
            ("Дата начала тура:", meta.get('start', '')),
            ("Дата окончания тура:", meta.get('end', '')),
            ("Рейс прилета:", meta.get('flight_in', '')),
            ("Рейс вылета:", meta.get('flight_out', '')),
            ("Количество участников:", meta.get('guests', '')),
            ("Отель:", meta.get('hotel', '')),
            ("Контактное лицо:", meta.get('contact', '')),
        ]
        for label, value in fields:
            c.setFont("Helvetica-Bold", 11)
            c.drawString(2 * cm, y, label)
            c.setFont("Helvetica", 11)
            c.drawString(8 * cm, y, str(value))
            y -= 20

    # Страницы дней
    if tour_data and tour_data.get('days'):
        for day in tour_data['days']:
            c.showPage()
            new_page()
            y = h - 75

            # Заголовок дня
            c.setFillColorRGB(0, 0.667, 0.8)
            c.setFont("Helvetica-Bold", 13)
            c.drawCentredString(w / 2, y, day.get('day_label', ''))
            y -= 20

            # Места
            for place in day.get('places', []):
                if y < 60:
                    c.showPage()
                    new_page()
                    y = h - 75

                name = place.get('name') or place.get('query', '')
                text = place.get('final_text') or place.get('promo_text') or place.get('description', '')

                c.setFillColorRGB(0, 0, 0)
                c.setFont("Helvetica-Bold", 10)
                c.drawString(2 * cm, y, f"• {name}")
                y -= 14

                if text:
                    # Разбиваем длинный текст на строки
                    words = text.split()
                    line = ""
                    for word in words:
                        if len(line + word) > 85:
                            c.setFont("Helvetica", 9)
                            c.setFillColorRGB(0.2, 0.2, 0.2)
                            c.drawString(2.5 * cm, y, line.strip())
                            y -= 12
                            line = word + " "
                            if y < 60:
                                c.showPage()
                                new_page()
                                y = h - 75
                        else:
                            line += word + " "
                    if line.strip():
                        c.setFont("Helvetica", 9)
                        c.drawString(2.5 * cm, y, line.strip())
                        y -= 12
                y -= 6

    c.save()
    print(f"✅ PDF via reportlab fallback: {pdf_path}")