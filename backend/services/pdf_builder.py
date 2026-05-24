import os, json, re, requests
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors

DICT = {
    "ru": {"day": "День", "title": "ПРОГРАММА ТУРА ПО АРМЕНИИ", "slogan": "Армения - страна, в которую можно влюбиться!", "start": "Дата начала тура:", "end": "Дата окончания тура:", "fIn": "Рейс прилета:", "fOut": "Рейс вылета:", "guests": "Количество участников:", "hotel": "Отель:", "contact": "Контактное лицо:"},
    "en": {"day": "Day", "title": "ARMENIA TOUR PROGRAM", "slogan": "Armenia - a country to fall in love with!", "start": "Tour start date:", "end": "Tour end date:", "fIn": "Arrival flight:", "fOut": "Departure flight:", "guests": "Number of participants:", "hotel": "Hotel:", "contact": "Contact person:"},
}

def convert_to_pdf(docx_path: str, pdf_path: str, tour_data: dict = None):
    _make_pdf_reportlab(docx_path, pdf_path, tour_data)
    return pdf_path

def _make_pdf_reportlab(docx_path: str, pdf_path: str, tour_data: dict = None):
    if tour_data is None:
        input_json = docx_path.replace('.docx', '_input.json')
        if os.path.exists(input_json):
            with open(input_json, 'r', encoding='utf-8') as f: tour_data = json.load(f)

    lang = tour_data.get('lang', 'ru') if tour_data else 'ru'
    t = DICT.get(lang, DICT['ru'])

    # 1. РЕГИСТРАЦИЯ ШРИФТОВ (Попытка загрузить Cambria, иначе фолбэк)
    font_regular, font_bold = 'Helvetica', 'Helvetica-Bold'
    try:
        # Убедитесь, что файлы Cambria.ttf и Cambria-Bold.ttf лежат в папке services
        base_dir = os.path.dirname(__file__)
        pdfmetrics.registerFont(TTFont('Cambria', os.path.join(base_dir, 'Cambria.ttf')))
        pdfmetrics.registerFont(TTFont('Cambria-Bold', os.path.join(base_dir, 'Cambria-Bold.ttf')))
        font_regular = 'Cambria'
        font_bold = 'Cambria-Bold'
    except Exception as e:
        print(f"Cambria font not found, falling back to DejaVu: {e}")
        for path in ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans.ttf"]:
            if os.path.exists(path): pdfmetrics.registerFont(TTFont('DejaVu', path)); font_regular = 'DejaVu'; break
        for path in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"]:
            if os.path.exists(path): pdfmetrics.registerFont(TTFont('DejaVuBold', path)); font_bold = 'DejaVuBold'; break

    # 2. СТИЛИ ТЕКСТА (Размеры 12 и 18)
    styles = getSampleStyleSheet()
    style_main = ParagraphStyle('Main', fontName=font_regular, fontSize=12, leading=16, alignment=4) # 4 = Выравнивание по ширине (Justify)
    style_bold = ParagraphStyle('MainBold', fontName=font_bold, fontSize=12, leading=16)
    style_title = ParagraphStyle('Title', fontName=font_bold, fontSize=18, leading=22, alignment=1, textColor=colors.HexColor('#003366'))
    style_day = ParagraphStyle('DayTitle', fontName=font_bold, fontSize=14, leading=18, textColor=colors.HexColor('#003366'))
    
    doc = SimpleDocTemplate(pdf_path, pagesize=A4, rightMargin=1.5*cm, leftMargin=1.5*cm, topMargin=3*cm, bottomMargin=3*cm)
    story = []

    # ЛОГОТИП И ШАПКА
    logo_path = os.path.join(os.path.dirname(__file__), 'logo.png')
    if os.path.exists(logo_path):
        story.append(RLImage(logo_path, width=6*cm, height=2*cm))
    story.append(Paragraph(t["title"], style_title))
    story.append(Spacer(1, 0.5*cm))

    # БЛОК МЕТАДАННЫХ (без разрывов страницы, единым блоком)
    if tour_data and tour_data.get('meta'):
        meta = tour_data['meta']
        for label, key in [(t["start"], 'start'), (t["end"], 'end'), (t["fIn"], 'flight_in'), (t["fOut"], 'flight_out'), (t["guests"], 'guests'), (t["hotel"], 'hotel'), (t["contact"], 'contact')]:
            val = meta.get(key, '')
            if val: # Добавляем только если поле не пустое
                story.append(Paragraph(f"<b>{label}</b> {val}", style_main))
        story.append(Spacer(1, 1*cm))

    # ДНИ ТУРА (ДИНАМИЧЕСКИЕ СТРОКИ ДЛЯ ИСКЛЮЧЕНИЯ ВЫХОДА ЗА ГРАНИЦЫ)
    if tour_data and tour_data.get('days'):
        for i, day in enumerate(tour_data['days']):
            day_title = f"{t['day']} {day.get('day_number', i+1)} ({day.get('date_str', '')})"
            clean_raw = re.sub(r'^(День|Day|Tag|Օր)\s*\d+\s*[-—–]+\s*', '', day.get('raw_text', ''), flags=re.IGNORECASE)
            
            # Подготавливаем все фото дня (максимум 3, чтобы не растягивать)
            photos = [p['photo_main'] for p in day.get('places', []) if p.get('photo_main')]
            left_images = []
            for photo_url in photos[:3]:
                try:
                    res = requests.get(photo_url, timeout=5)
                    if res.status_code == 200:
                        # Ваши точные пропорции
                        img = RLImage(BytesIO(res.content), width=5.5*cm, height=4*cm)
                        left_images.append(img)
                except: pass

            # Массив строк таблицы для конкретного дня
            table_data = []

            # Строка 1: Вводная часть дня (Заголовок слева, Краткое описание справа)
            row_1_left = [Paragraph(day_title, style_day)]
            if left_images:
                row_1_left.extend([Spacer(1, 0.3*cm), left_images.pop(0)])
            
            row_1_right = [Paragraph(day_title, style_day), Spacer(1, 0.2*cm), Paragraph(f"<b>{clean_raw}</b>", style_bold), Spacer(1, 0.3*cm)]
            table_data.append([row_1_left, row_1_right])

            # Строка 2...N: КАЖДАЯ ЛОКАЦИЯ В ОТДЕЛЬНОЙ СТРОКЕ ТАБЛИЦЫ
            # Это позволяет ReportLab переносить локации на следующую страницу, если они не влезают!
            for place in day.get('places', []):
                text = place.get('final_text', '')
                if text:
                    # Колонка с фото (если еще остались фото)
                    cell_left = []
                    if left_images:
                        cell_left = [left_images.pop(0), Spacer(1, 0.3*cm)]
                    
                    # Колонка с текстом
                    words = text.split(' ')
                    first_word = words.pop(0) if words else ''
                    rest_text = ' '.join(words)
                    
                    cell_right = [Paragraph(f"• <b>{first_word}</b> {rest_text}", style_main), Spacer(1, 0.2*cm)]
                    table_data.append([cell_left, cell_right])
            
            # Если фото остались, а локации закончились (добавляем их вниз)
            for img in left_images:
                table_data.append([[img, Spacer(1, 0.3*cm)], []])

            # Собираем день в единую таблицу и добавляем в story
            t_style = TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'), 
                ('LEFTPADDING', (0,0), (-1,-1), 0), 
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 2)
            ])
            story.append(Table(table_data, colWidths=[6*cm, 12*cm], style=t_style))
            story.append(Spacer(1, 0.7*cm))

    # КОЛОНТИТУЛЫ (на каждой странице)
    def add_footer(canvas, doc):
        canvas.saveState()
        canvas.setFont(font_bold, 11)
        canvas.setFillColorRGB(0.8, 0, 0) # Красный слоган
        canvas.drawCentredString(A4[0]/2, 1.8*cm, t["slogan"])
        canvas.setFont(font_regular, 9)
        canvas.setFillColorRGB(0.4, 0.4, 0.4) # Серый текст подвала
        canvas.drawCentredString(A4[0]/2, 1*cm, f"(+374 91) 01 56 60 (Viber, WhatsApp) | info@explorearmenia.am | www.explorearmenia.am | стр. {doc.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)