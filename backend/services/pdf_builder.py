import os, subprocess, json


def convert_to_pdf(docx_path: str, pdf_path: str, tour_data: dict = None):
    """
    Конвертирует DOCX в PDF.
    tour_data передаётся напрямую из main.py — не ищем файл на диске.
    """
    # Пробуем LibreOffice (на Render недоступен, но на случай если появится)
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
            print(f"✅ PDF via LibreOffice: {pdf_path}")
            return pdf_path
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass  # LibreOffice недоступен — идём к reportlab

    # Основной путь — reportlab
    _make_pdf_reportlab(docx_path, pdf_path, tour_data)
    return pdf_path


def _make_pdf_reportlab(docx_path: str, pdf_path: str, tour_data: dict = None):
    """
    Создаёт PDF через reportlab.
    Данные тура берутся из tour_data (передаётся напрямую).
    """
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    # Если данные не переданы напрямую — пробуем найти JSON файл
    if tour_data is None:
        input_json = docx_path.replace('.docx', '_input.json')
        print(f"🔍 tour_data не передан, ищем JSON: {input_json}")
        print(f"🔍 JSON exists: {os.path.exists(input_json)}")
        if os.path.exists(input_json):
            with open(input_json, 'r', encoding='utf-8') as f:
                tour_data = json.load(f)
            print(f"✅ JSON загружен: {len(tour_data.get('days', []))} дней")
        else:
            print("❌ JSON не найден и tour_data не передан — PDF будет пустым")

    # Регистрируем шрифт с кириллицей
    font_regular = 'Helvetica'
    font_bold = 'Helvetica-Bold'
    for path in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    ]:
        if os.path.exists(path):
            pdfmetrics.registerFont(TTFont('DejaVu', path))
            font_regular = 'DejaVu'
            break
    for path in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    ]:
        if os.path.exists(path):
            pdfmetrics.registerFont(TTFont('DejaVuBold', path))
            font_bold = 'DejaVuBold'
            break

    w, h = A4
    c = canvas.Canvas(pdf_path, pagesize=A4)

    def draw_header():
        c.setFillColorRGB(0, 0.667, 0.8)
        c.rect(0, h - 55, w, 55, fill=1, stroke=0)
        c.setFillColorRGB(1, 1, 1)
        c.setFont(font_bold, 15)
        c.drawCentredString(w / 2, h - 36, "ПРОГРАММА ТУРА ПО АРМЕНИИ")

    def draw_footer():
        c.setFillColorRGB(0.8, 0, 0)
        c.setFont(font_bold, 10)
        c.drawCentredString(w / 2, 28, "Армения - страна, в которую можно влюбиться!")
        c.setFillColorRGB(0.4, 0.4, 0.4)
        c.setFont(font_regular, 8)
        c.drawCentredString(w / 2, 16,
            "(+374 91) 01 56 60  |  info@explorearmenia.am  |  www.explorearmenia.am")

    def wrap_text(text, max_chars=90):
        words = text.split()
        lines, line = [], ""
        for word in words:
            if len(line + " " + word) <= max_chars:
                line = (line + " " + word).strip()
            else:
                if line:
                    lines.append(line)
                line = word
        if line:
            lines.append(line)
        return lines

    # === СТРАНИЦА 1: ДАННЫЕ ТУРА ===
    draw_header()
    draw_footer()
    y = h - 80

    if tour_data and tour_data.get('meta'):
        meta = tour_data['meta']
        for label, key in [
            ("Дата начала тура:",      'start'),
            ("Дата окончания тура:",   'end'),
            ("Рейс прилета:",          'flight_in'),
            ("Рейс вылета:",           'flight_out'),
            ("Количество участников:", 'guests'),
            ("Отель:",                 'hotel'),
            ("Контактное лицо:",       'contact'),
        ]:
            c.setFillColorRGB(0, 0, 0)
            c.setFont(font_bold, 11)
            c.drawString(2 * cm, y, label)
            c.setFont(font_regular, 11)
            c.drawString(8 * cm, y, str(meta.get(key, '')))
            y -= 22
    else:
        c.setFillColorRGB(0.5, 0.5, 0.5)
        c.setFont(font_regular, 11)
        c.drawCentredString(w / 2, h / 2, "Данные тура недоступны")

    # === СТРАНИЦЫ ДНЕЙ ===
    if tour_data and tour_data.get('days'):
        for day in tour_data['days']:
            c.showPage()
            draw_header()
            draw_footer()
            y = h - 72

            # Заголовок дня
            c.setFillColorRGB(0, 0.667, 0.8)
            c.setFont(font_bold, 13)
            c.drawCentredString(w / 2, y, day.get('day_label', ''))
            y -= 18

            # Подзаголовок — список найденных мест
            found = [
                p.get('name') or p.get('query', '')
                for p in day.get('places', [])
                if p.get('status') == 'OK'
            ]
            if found:
                c.setFillColorRGB(0, 0, 0)
                c.setFont(font_bold, 10)
                for line in wrap_text(" – ".join(found), 80):
                    c.drawCentredString(w / 2, y, line)
                    y -= 14
            y -= 6

            # Описания мест
            for place in day.get('places', []):
                if y < 50:
                    c.showPage()
                    draw_header()
                    draw_footer()
                    y = h - 72

                name = place.get('name') or place.get('query', '')
                text = (place.get('final_text') or
                        place.get('promo_text') or
                        place.get('description', ''))

                # Название места
                c.setFillColorRGB(0, 0.4, 0.6)
                c.setFont(font_bold, 10)
                c.drawString(1.5 * cm, y, f"• {name}")
                y -= 14

                # Текст описания
                if text and text.strip():
                    c.setFillColorRGB(0.15, 0.15, 0.15)
                    c.setFont(font_regular, 9)
                    for line in wrap_text(text, 95):
                        if y < 50:
                            c.showPage()
                            draw_header()
                            draw_footer()
                            y = h - 72
                        c.drawString(2 * cm, y, line)
                        y -= 12
                y -= 8

    c.save()
    print(f"✅ PDF готов: {pdf_path}")
