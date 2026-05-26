"""
ExploreArmenia — PDF Builder (Full Rewrite v2)
===============================================
Дизайн строго по скриншотам:
  - Шапка (Header): голубой фон #36c6f5, логотип в белом круге слева,
    белый жирный заголовок программы справа, 22pt.
  - Метаданные тура: под шапкой, без разрыва страниц.
  - Каждый день: заголовок «День N (дд.мм, день)» + синяя линия-разделитель,
    маршрут по центру жирно, левая колонка ~35% фото, правая ~65% буллиты 12pt.
  - Футер: красный слоган 11pt + серые контакты 9pt с номером страницы.
  - Шрифт: Cambria (с fallback на DejaVuSerif).
"""

import os, json, re, requests
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image as RLImage, KeepTogether
)
from reportlab.platypus.flowables import HRFlowable
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.pdfgen import canvas as rl_canvas

# ============================================================
# ЦВЕТА (точно из скриншотов, HEX)
# ============================================================
C_HEADER_BG  = colors.HexColor('#36c6f5')   # голубой фон шапки
C_DARK_RED   = colors.HexColor('#800000')   # тёмно-красный слоган + акценты
C_LIGHT_BLUE = colors.HexColor('#deebf7')   # светлый фон (не используем как фон, только как accent)
C_WHITE      = colors.white
C_DARK_BLUE  = colors.HexColor('#003366')   # заголовки дней
C_GRAY       = colors.HexColor('#555555')   # серый текст футера
C_BLACK      = colors.black
C_HEADER_LINE= colors.HexColor('#36c6f5')   # линия под заголовком дня

# ============================================================
# МУЛЬТИЯЗЫЧНЫЙ СЛОВАРЬ
# ============================================================
DICT = {
    "ru": {
        "day":      "День",
        "title":    "ПРОГРАММА ТУРА ПО АРМЕНИИ",
        "slogan":   "Армения - страна, в которую можно влюбиться!",
        "start":    "Дата начала тура:",
        "end":      "Дата окончания тура:",
        "fIn":      "Рейсы прилета:",
        "fOut":     "Рейсы вылета:",
        "guests":   "Количество участников:",
        "hotel":    "Отель:",
        "contact":  "Контактное лицо:",
        "inc":      "Стоимость тура включает:",
        "exc":      "Стоимость тура не включает:",
    },
    "en": {
        "day":      "Day",
        "title":    "ARMENIA TOUR PROGRAM",
        "slogan":   "Armenia - a country to fall in love with!",
        "start":    "Tour start date:",
        "end":      "Tour end date:",
        "fIn":      "Arrival flight:",
        "fOut":     "Departure flight:",
        "guests":   "Number of participants:",
        "hotel":    "Hotel:",
        "contact":  "Contact person:",
        "inc":      "Tour price includes:",
        "exc":      "Tour price excludes:",
    },
    "de": {
        "day":      "Tag",
        "title":    "ARMENIEN TOURPROGRAMM",
        "slogan":   "Armenien - ein Land, in das man sich verlieben kann!",
        "start":    "Beginn der Tour:",
        "end":      "Ende der Tour:",
        "fIn":      "Anflug:",
        "fOut":     "Abflug:",
        "guests":   "Teilnehmerzahl:",
        "hotel":    "Hotel:",
        "contact":  "Kontaktperson:",
        "inc":      "Der Tourpreis beinhaltet:",
        "exc":      "Der Tourpreis beinhaltet nicht:",
    },
    "hy": {
        "day":      "Օր",
        "title":    "ՀԱՅԱUТАНԻ TUРԻ ԾPAGRAM",
        "slogan":   "Հայաuтան - mի երকir, orp kаrелi ek sirayel!",
        "start":    "Tuри meknarкutyan амsаtіv:",
        "end":      "Туrи аvаrtіn аmsatіv:",
        "fIn":      "Ժaмanum рейs:",
        "fOut":     "Маекnum рейs:",
        "guests":   "Mrtsаkіtsner:",
        "hotel":    "Хndrаnос:",
        "contact":  "Карасmаmdman andzn:",
        "inc":      "Туri аrzek nerkayatsnum е:",
        "exc":      "Туri аrzek chnerkayatsnum е:",
    },
}

# ============================================================
# РАЗМЕРЫ СТРАНИЦЫ
# ============================================================
A4_W, A4_H = A4
MARGIN_L = 1.5 * cm
MARGIN_R = 1.5 * cm
MARGIN_T = 0.4 * cm   # маленький верхний — хедер рисуем через canvas
MARGIN_B = 2.8 * cm   # место для футера
CONTENT_W = A4_W - MARGIN_L - MARGIN_R

# Высота шапки (нарисованной через canvas)
HEADER_H = 3.2 * cm

# Колонки дней: левая (фото) ~35%, правая (текст) ~65%
COL_PHOTO_W = CONTENT_W * 0.35
COL_TEXT_W  = CONTENT_W * 0.65 - 0.3 * cm   # небольшой gap

# ============================================================
# РЕГИСТРАЦИЯ ШРИФТОВ
# ============================================================
_FONT_REG  = 'Helvetica'
_FONT_BOLD = 'Helvetica-Bold'

def _register_fonts(base_dir: str):
    global _FONT_REG, _FONT_BOLD

    cambria_paths = [
        os.path.join(base_dir, 'Cambria.ttf'),
        '/usr/share/fonts/truetype/msttcorefonts/cambria.ttf',
        '/Library/Fonts/Cambria.ttc',
        'C:/Windows/Fonts/cambria.ttf',
    ]
    cambria_bold_paths = [
        os.path.join(base_dir, 'Cambria-Bold.ttf'),
        os.path.join(base_dir, 'CambriaBold.ttf'),
        '/usr/share/fonts/truetype/msttcorefonts/cambriab.ttf',
        '/Library/Fonts/Cambria Bold.ttf',
        'C:/Windows/Fonts/cambriab.ttf',
    ]
    dejavu_paths = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf',
        '/usr/share/fonts/dejavu/DejaVuSerif.ttf',
    ]
    dejavu_bold_paths = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf',
        '/usr/share/fonts/dejavu/DejaVuSerif-Bold.ttf',
    ]

    # Попытка Cambria regular
    for p in cambria_paths:
        if os.path.exists(p):
            try:
                pdfmetrics.registerFont(TTFont('Cambria', p))
                _FONT_REG = 'Cambria'
                break
            except Exception as e:
                print(f"Cambria reg warn: {e}")
    
    if _FONT_REG == 'Helvetica':
        for p in dejavu_paths:
            if os.path.exists(p):
                try:
                    pdfmetrics.registerFont(TTFont('Cambria', p))
                    _FONT_REG = 'Cambria'
                    break
                except: pass

    # Попытка Cambria bold
    for p in cambria_bold_paths:
        if os.path.exists(p):
            try:
                pdfmetrics.registerFont(TTFont('Cambria-Bold', p))
                _FONT_BOLD = 'Cambria-Bold'
                break
            except Exception as e:
                print(f"Cambria-Bold reg warn: {e}")

    if _FONT_BOLD == 'Helvetica-Bold':
        for p in dejavu_bold_paths:
            if os.path.exists(p):
                try:
                    pdfmetrics.registerFont(TTFont('Cambria-Bold', p))
                    _FONT_BOLD = 'Cambria-Bold'
                    break
                except: pass


# ============================================================
# ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: загрузка фото
# ============================================================
def _fetch_image(url: str, width: float, height: float) -> RLImage | None:
    """Скачивает изображение по URL и возвращает RLImage нужного размера."""
    if not url or not url.strip():
        return None
    try:
        resp = requests.get(url.strip(), timeout=6)
        if resp.status_code == 200:
            img = RLImage(BytesIO(resp.content), width=width, height=height)
            return img
    except Exception as e:
        print(f"Image fetch error ({url[:60]}): {e}")
    return None


# ============================================================
# СТИЛИ ПАРАГРАФОВ
# ============================================================
def _make_styles() -> dict:
    s = {}

    # Метаданные тура: обычный текст 12pt
    s['meta'] = ParagraphStyle(
        'meta', fontName=_FONT_REG, fontSize=12, leading=16,
        alignment=TA_LEFT, textColor=C_BLACK,
        spaceAfter=2
    )
    s['meta_bold'] = ParagraphStyle(
        'meta_bold', fontName=_FONT_BOLD, fontSize=12, leading=16,
        alignment=TA_LEFT, textColor=C_BLACK,
        spaceAfter=2
    )

    # Заголовок дня: «День 2 (30.05, суббота)» — 16pt, тёмно-красный, центр
    s['day_title'] = ParagraphStyle(
        'day_title', fontName=_FONT_BOLD, fontSize=16, leading=20,
        alignment=TA_CENTER, textColor=C_DARK_RED,
        spaceBefore=4, spaceAfter=4
    )

    # Подзаголовок маршрута дня (жирно, по центру, 13pt, тёмно-красный)
    s['day_route'] = ParagraphStyle(
        'day_route', fontName=_FONT_BOLD, fontSize=13, leading=17,
        alignment=TA_CENTER, textColor=C_DARK_RED,
        spaceBefore=2, spaceAfter=6
    )

    # Буллит-текст описания локации: 12pt, justify
    s['bullet'] = ParagraphStyle(
        'bullet', fontName=_FONT_REG, fontSize=12, leading=16,
        alignment=TA_JUSTIFY, textColor=C_BLACK,
        spaceAfter=6, leftIndent=12, firstLineIndent=0,
        bulletIndent=0
    )

    # Первое слово буллита выделено жирным (обрабатываем через HTML в Paragraph)
    s['bullet_html'] = ParagraphStyle(
        'bullet_html', fontName=_FONT_REG, fontSize=12, leading=16,
        alignment=TA_JUSTIFY, textColor=C_BLACK,
        spaceAfter=6, leftIndent=0
    )

    return s


# ============================================================
# КЛАСС: рисование Header и Footer через canvas
# ============================================================
class _HeaderFooterCanvas(rl_canvas.Canvas):
    """
    Переопределяем Canvas для отрисовки шапки и подвала на каждой странице.
    Используется через SimpleDocTemplate(canvasmaker=_HeaderFooterCanvas).
    Передаём данные через атрибуты класса (статически до build).
    """
    logo_path: str = ''
    title_text: str = ''
    slogan_text: str = ''
    font_reg: str = 'Helvetica'
    font_bold: str = 'Helvetica-Bold'
    days_nights: str = ''   # «(7 ДНЕЙ/ 6 НОЧЕЙ)»

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_header_footer(num_pages)
            super().showPage()
        super().save()

    def _draw_header_footer(self, total_pages):
        self.saveState()
        w, h = A4

        # ── HEADER: голубой прямоугольник на всю ширину ──────────────
        hdr_h = HEADER_H
        hdr_y = h - hdr_h - MARGIN_T

        # Фон шапки
        self.setFillColor(C_HEADER_BG)
        self.rect(0, hdr_y, w, hdr_h, fill=1, stroke=0)

        # Логотип: белый круг + картинка
        logo_cx = MARGIN_L + 1.3 * cm   # центр круга
        logo_cy = hdr_y + hdr_h / 2
        circle_r = 1.25 * cm

        self.setFillColor(C_WHITE)
        self.circle(logo_cx, logo_cy, circle_r, fill=1, stroke=0)

        if os.path.exists(self.__class__.logo_path):
            logo_size = circle_r * 1.55  # немного меньше круга
            self.drawImage(
                self.__class__.logo_path,
                logo_cx - logo_size / 2,
                logo_cy - logo_size / 2,
                width=logo_size, height=logo_size,
                preserveAspectRatio=True, mask='auto'
            )

        # Текст заголовка справа от логотипа
        text_x = MARGIN_L + circle_r * 2 + 0.5 * cm
        text_w = w - text_x - MARGIN_R
        text_cx = text_x + text_w / 2

        # Строка 1: основной заголовок
        self.setFillColor(C_WHITE)
        self.setFont(self.__class__.font_bold, 20)
        line1 = self.__class__.title_text
        line2 = self.__class__.days_nights

        if line2:
            # два ряда текста в шапке
            self.drawCentredString(text_cx, hdr_y + hdr_h * 0.62, line1)
            self.setFont(self.__class__.font_bold, 17)
            self.drawCentredString(text_cx, hdr_y + hdr_h * 0.25, line2)
        else:
            self.drawCentredString(text_cx, hdr_y + hdr_h / 2 - 7, line1)

        # ── FOOTER ────────────────────────────────────────────────────
        # Слоган: тёмно-красный, жирный, 11pt, по центру
        self.setFillColor(C_DARK_RED)
        self.setFont(self.__class__.font_bold, 11)
        self.drawCentredString(w / 2, 1.75 * cm, self.__class__.slogan_text)

        # Контакты + номер страницы: серый, 9pt
        self.setFillColor(C_GRAY)
        self.setFont(self.__class__.font_reg, 9)
        page_num = getattr(self, '_pageNumber', 1)
        contacts = (
            f"(+374 91) 01 56 60 (Viber, WhatsApp)  |  "
            f"info@explorearmenia.am  |  www.explorearmenia.am  |  стр. {page_num}"
        )
        self.drawCentredString(w / 2, 1.1 * cm, contacts)

        # Тонкая линия над футером
        self.setStrokeColor(colors.HexColor('#cccccc'))
        self.setLineWidth(0.5)
        self.line(MARGIN_L, 2.1 * cm, w - MARGIN_R, 2.1 * cm)

        self.restoreState()


# ============================================================
# ОСНОВНАЯ ФУНКЦИЯ
# ============================================================
def convert_to_pdf(docx_path: str, pdf_path: str, tour_data: dict = None):
    """
    Главная точка входа (совместима со старым API).
    docx_path: путь к docx (используем только для поиска _input.json рядом).
    pdf_path:  куда сохранить PDF.
    tour_data: уже готовый словарь данных тура (если передан — json не читаем).
    """
    if tour_data is None:
        input_json = docx_path.replace('.docx', '_input.json')
        if os.path.exists(input_json):
            with open(input_json, 'r', encoding='utf-8') as f:
                tour_data = json.load(f)
        else:
            raise FileNotFoundError(f"tour_data не передан и JSON не найден: {input_json}")

    _make_pdf(pdf_path, tour_data)
    return pdf_path


def _make_pdf(pdf_path: str, tour_data: dict):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    _register_fonts(base_dir)

    lang = tour_data.get('lang', 'ru')
    t = DICT.get(lang, DICT['ru'])
    meta = tour_data.get('meta', {})
    days = tour_data.get('days', [])

    # Вычисляем «7 ДНЕЙ / 6 НОЧЕЙ» из количества дней
    n_days = len(days)
    n_nights = max(n_days - 1, 0)
    if lang == 'ru':
        days_nights_str = f"({n_days} ДНЕЙ / {n_nights} НОЧЕЙ)"
    elif lang == 'en':
        days_nights_str = f"({n_days} DAYS / {n_nights} NIGHTS)"
    elif lang == 'de':
        days_nights_str = f"({n_days} TAGE / {n_nights} NÄCHTE)"
    else:
        days_nights_str = f"({n_days} / {n_nights})"

    # Настраиваем класс canvas
    logo_path = os.path.join(base_dir, 'logo.png')
    _HeaderFooterCanvas.logo_path   = logo_path
    _HeaderFooterCanvas.title_text  = t['title']
    _HeaderFooterCanvas.slogan_text = t['slogan']
    _HeaderFooterCanvas.font_reg    = _FONT_REG
    _HeaderFooterCanvas.font_bold   = _FONT_BOLD
    _HeaderFooterCanvas.days_nights = days_nights_str

    # SimpleDocTemplate с нашим canvas
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=A4,
        leftMargin=MARGIN_L,
        rightMargin=MARGIN_R,
        topMargin=MARGIN_T + HEADER_H + 0.5 * cm,   # освобождаем место под хедер
        bottomMargin=MARGIN_B,
    )

    styles = _make_styles()
    story = []

    # ── 1. БЛОК МЕТАДАННЫХ ───────────────────────────────────────────
    meta_fields = [
        (t['start'],   meta.get('start',      '')),
        (t['end'],     meta.get('end',        '')),
        (t['fIn'],     meta.get('flight_in',  '')),
        (t['fOut'],    meta.get('flight_out', '')),
        (t['guests'],  meta.get('guests',     '')),
        (t['hotel'],   meta.get('hotel',      '')),
        (t['contact'], meta.get('contact',    '')),
    ]

    meta_paras = []
    for label, val in meta_fields:
        if val and str(val).strip():
            # Отель выделяем красным жирным
            if label == t['hotel']:
                para = Paragraph(
                    f'<font name="{_FONT_BOLD}">{label}</font> '
                    f'<font name="{_FONT_BOLD}" color="#800000">{val}</font>',
                    styles['meta']
                )
            else:
                para = Paragraph(
                    f'<font name="{_FONT_BOLD}">{label}</font> {val}',
                    styles['meta']
                )
            meta_paras.append(para)

    story.extend(meta_paras)
    story.append(Spacer(1, 0.6 * cm))

    # ── 2. ДНИ ТУРА ──────────────────────────────────────────────────
    for i, day in enumerate(days):
        day_num   = day.get('day_number', i + 1)
        date_str  = day.get('date_str', '')
        raw_text  = day.get('raw_text', '')
        places    = day.get('places', [])

        # Очищаем raw_text от «День N —»
        clean_route = re.sub(
            r'^(День|Day|Tag|Օr)\s*\d+\s*[-—–]+\s*', '',
            raw_text, flags=re.IGNORECASE
        ).strip()

        # --- Заголовок дня (на всю ширину, над двухколоночным блоком) ---
        day_header_items = [
            Paragraph(f"{t['day']} {day_num} ({date_str})", styles['day_title']),
            HRFlowable(
                width=CONTENT_W, thickness=1.5,
                color=C_HEADER_LINE, spaceAfter=4, spaceBefore=0
            ),
            Paragraph(clean_route, styles['day_route']),
            Spacer(1, 0.2 * cm),
        ]

        # --- Левая колонка: фотографии ---
        photo_items = []
        photo_count = 0
        for place in places:
            url = place.get('photo_main', '')
            if url and photo_count < 4:
                img = _fetch_image(url, COL_PHOTO_W, COL_PHOTO_W * 0.72)
                if img:
                    photo_items.append(img)
                    photo_items.append(Spacer(1, 0.25 * cm))
                    photo_count += 1

        if not photo_items:
            photo_items.append(Spacer(1, 0.3 * cm))

        # --- Правая колонка: буллиты с описаниями ---
        text_items = []
        for place in places:
            final_text = place.get('final_text', '').strip()
            if not final_text:
                continue
            # Первое слово — название места — выделяем жирным
            words = final_text.split(' ', 1)
            first = words[0] if words else ''
            rest  = words[1] if len(words) > 1 else ''

            html = (
                f'• <font name="{_FONT_BOLD}">{first}</font>'
                + (f' {rest}' if rest else '')
            )
            text_items.append(Paragraph(html, styles['bullet_html']))

        if not text_items:
            text_items.append(Spacer(1, 0.2 * cm))

        # --- Двухколоночная таблица ---
        two_col = Table(
            [[photo_items, text_items]],
            colWidths=[COL_PHOTO_W, COL_TEXT_W + 0.3 * cm],
            style=TableStyle([
                ('VALIGN',       (0, 0), (-1, -1), 'TOP'),
                ('LEFTPADDING',  (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                ('TOPPADDING',   (0, 0), (-1, -1), 0),
                ('BOTTOMPADDING',(0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (0, -1),  6),  # gap между колонками
            ])
        )

        # Собираем день в один блок (заголовок + таблица)
        day_block = day_header_items + [two_col, Spacer(1, 0.5 * cm)]
        story.append(KeepTogether(day_header_items[:3]))  # заголовок держим вместе
        story.append(two_col)
        story.append(Spacer(1, 0.5 * cm))

    # ── 3. СБОРКА PDF ────────────────────────────────────────────────
    doc.build(story, canvasmaker=_HeaderFooterCanvas)
    print(f"✅ PDF готов: {pdf_path}")