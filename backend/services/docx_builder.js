// ============================================================
// ExploreArmenia — DOCX Builder v5 (FINAL)
// ============================================================
// АРХИТЕКТУРА:
//   Header/Footer — VML фигуры (прямоугольники, круг), НЕ таблицы.
//   Фигуры позиционируются абсолютно от края страницы.
//   Нет белых зазоров, нет лишних отступов.
//
// HEADER (3 фигуры + лого + текст):
//   Фигура 1: #deebf7,  21.06 × 3.48 cm, top=0, left=0   (фон)
//   Фигура 2: #36c6f5,  17.21 × 3.48 cm, top=0, left=3.85 (синяя полоса)
//   Фигура 3: #ffffff,  3.35  × 3.35 cm, top=0.065, left=0.25 (круг лого)
//   Лого:     PNG оригинал 3.35×3.35 cm поверх круга
//   Текст:    26pt белый Cambria bold по центру синей полосы
//
// FOOTER (1 фигура + текст):
//   Фигура: #deebf7, 21.06 × 2.49 cm
//   Слоган: 18pt #c10000 bold
//   Контакты: 10pt #800000
//
// РАЗДЕЛИТЕЛЬ ДНЯ:
//   VML rect: #36c6f5, 11.53 × 0.15 cm (фигура в правой колонке)
// ============================================================

'use strict';

const {
  Document, Packer, Paragraph, TextRun,
  Table, TableRow, TableCell,
  ImageRun, Header, Footer,
  AlignmentType, BorderStyle, WidthType,
  ShadingType, LevelFormat, VerticalAlign,
  HeightRule, ImportedXmlComponent
} = require('docx');

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ═══════════════════════════════════════════════════════════
// КОНСТАНТЫ
// ═══════════════════════════════════════════════════════════
const FONT = 'Cambria';

// Цвета (без #)
const C_LIGHTBLUE = 'deebf7';
const C_CYAN = '36c6f5';
const C_WHITE = 'FFFFFF';
const C_SLOGAN = 'c10000';
const C_CONTACTS = '800000';
const C_BLACK = '000000';

// Страница A4 в DXA (1 дюйм = 1440 DXA)
const PAGE_W = 11906;
const PAGE_H = 16838;
const MARGIN = 851;   // ~1.5 cm

// Контентная ширина
const CONTENT_W = PAGE_W - MARGIN * 2;  // 10204 DXA

// Колонки дней: 35% фото | 65% текст
const COL_PHOTO = Math.round(CONTENT_W * 0.35);  // 3571 DXA
const COL_GAP = 200;
const COL_TEXT = CONTENT_W - COL_PHOTO - COL_GAP; // 6433 DXA

// Логотип (в pt, не ресайзим: 3.35 cm = ~95 pt)
const LOGO_PT = 95;

// ═══════════════════════════════════════════════════════════
// СЛОВАРИ
// ═══════════════════════════════════════════════════════════
const DICT = {
  ru: {
    day: 'День', title: 'ПРОГРАММА ТУРА ПО АРМЕНИИ',
    slogan: 'Армения - страна, в которую можно влюбиться!',
    contacts: '(+374 91) 01 56 60 (Viber, WhatsApp),  info@explorearmenia.am,  www.explorearmenia.am',
    start: 'Дата начала тура:', end: 'Дата окончания тура:',
    fIn: 'Рейсы прилета:', fOut: 'Рейсы вылета:',
    guests: 'Количество участников:', hotel: 'Отель:', contact: 'Контактное лицо:'
  },
  en: {
    day: 'Day', title: 'ARMENIA TOUR PROGRAM',
    slogan: 'Armenia - a country to fall in love with!',
    contacts: '(+374 91) 01 56 60 (Viber, WhatsApp),  info@explorearmenia.am,  www.explorearmenia.am',
    start: 'Tour start date:', end: 'Tour end date:',
    fIn: 'Arrival flight:', fOut: 'Departure flight:',
    guests: 'Number of participants:', hotel: 'Hotel:', contact: 'Contact person:'
  },
  de: {
    day: 'Tag', title: 'ARMENIEN TOURPROGRAMM',
    slogan: 'Armenien - ein Land, in das man sich verlieben kann!',
    contacts: '(+374 91) 01 56 60 (Viber, WhatsApp),  info@explorearmenia.am,  www.explorearmenia.am',
    start: 'Beginn der Tour:', end: 'Ende der Tour:',
    fIn: 'Anflug:', fOut: 'Abflug:',
    guests: 'Teilnehmerzahl:', hotel: 'Hotel:', contact: 'Kontaktperson:'
  },
  hy: {
    day: 'Օր', title: 'ՀԱՅԱUТАНԻ ТУRԻ ԾPAGRAM',
    slogan: 'Հայաuтан - mի երкir, orp kаrелi ek sirayel!',
    contacts: '(+374 91) 01 56 60 (Viber, WhatsApp),  info@explorearmenia.am,  www.explorearmenia.am',
    start: 'Tur meknarкutyan amsativ:', end: 'Turi avаrtin аmsatіv:',
    fIn: 'Ժаmanum рейs:', fOut: 'Маекnum рейs:',
    guests: 'Mrtsаkіtsner:', hotel: 'Хndrаnос:', contact: 'Кontaktnayin аndzn:'
  }
};

// ═══════════════════════════════════════════════════════════
// VML ФИГУРЫ
// ═══════════════════════════════════════════════════════════
// Позиционирование: mso-position-horizontal-relative:page
// означает абсолютную привязку к листу, а не к полям.

/**
 * VML прямоугольник — абсолютная позиция от края страницы.
 * @param {number} wCm   ширина в cm
 * @param {number} hCm   высота в cm
 * @param {string} color hex без #
 * @param {number} topCm отступ от верха страницы в cm
 * @param {number} leftCm отступ от левого края страницы в cm
 * @param {number} zIndex z-индекс (отрицательный = за текстом)
 */
function vmlRect(wCm, hCm, color, topCm, leftCm, zIndex) {
  const style = [
    'position:absolute',
    `left:${leftCm}cm`,
    `top:${topCm}cm`,
    `width:${wCm}cm`,
    `height:${hCm}cm`,
    `z-index:${zIndex}`,
    'mso-position-horizontal-relative:page',
    'mso-position-vertical-relative:page',
  ].join(';');

  return new ImportedXmlComponent(
    '<w:p' +
    ' xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"' +
    ' xmlns:v="urn:schemas-microsoft-com:vml"' +
    ' xmlns:o="urn:schemas-microsoft-com:office:office">' +
    '<w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>' +
    '<w:r><w:rPr/><w:pict>' +
    `<v:rect style="${style}" fillcolor="#${color}" stroked="f">` +
    '<v:fill type="solid"/>' +
    '</v:rect>' +
    '</w:pict></w:r></w:p>'
  );
}

/**
 * VML овал/круг — абсолютная позиция от края страницы.
 * @param {number} dCm   диаметр (ширина = высота) в cm
 * @param {string} color hex без #
 * @param {number} topCm
 * @param {number} leftCm
 * @param {number} zIndex
 */
function vmlCircle(dCm, color, topCm, leftCm, zIndex) {
  const style = [
    'position:absolute',
    `left:${leftCm}cm`,
    `top:${topCm}cm`,
    `width:${dCm}cm`,
    `height:${dCm}cm`,
    `z-index:${zIndex}`,
    'mso-position-horizontal-relative:page',
    'mso-position-vertical-relative:page',
  ].join(';');

  return new ImportedXmlComponent(
    '<w:p' +
    ' xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"' +
    ' xmlns:v="urn:schemas-microsoft-com:vml"' +
    ' xmlns:o="urn:schemas-microsoft-com:office:office">' +
    '<w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>' +
    '<w:r><w:rPr/><w:pict>' +
    `<v:oval style="${style}" fillcolor="#${color}" stroked="f">` +
    '<v:fill type="solid"/>' +
    '</v:oval>' +
    '</w:pict></w:r></w:p>'
  );
}

/**
 * VML плавающее изображение — абсолютная позиция от края страницы.
 * @param {Buffer} imgData  буфер PNG
 * @param {number} wCm      ширина в cm
 * @param {number} hCm      высота в cm
 * @param {number} topCm
 * @param {number} leftCm
 * @param {number} zIndex
 * @param {string} imgId    уникальный id (строка)
 */
function vmlImage(imgData, wCm, hCm, topCm, leftCm, zIndex, imgId) {
  const b64 = imgData.toString('base64');
  const style = [
    'position:absolute',
    `left:${leftCm}cm`,
    `top:${topCm}cm`,
    `width:${wCm}cm`,
    `height:${hCm}cm`,
    `z-index:${zIndex}`,
    'mso-position-horizontal-relative:page',
    'mso-position-vertical-relative:page',
  ].join(';');

  return new ImportedXmlComponent(
    '<w:p' +
    ' xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"' +
    ' xmlns:v="urn:schemas-microsoft-com:vml"' +
    ' xmlns:o="urn:schemas-microsoft-com:office:office">' +
    '<w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>' +
    '<w:r><w:rPr/><w:pict>' +
    `<v:shape id="${imgId}" type="#_x0000_t75" style="${style}" stroked="f">` +
    '<v:imagedata src="data:image/png;base64,' + b64 + '" o:title="logo"/>' +
    '</v:shape>' +
    '</w:pict></w:r></w:p>'
  );
}

// ═══════════════════════════════════════════════════════════
// HELPER: невидимые границы
// ═══════════════════════════════════════════════════════════
const NB = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF', space: 0 };
const NO_BORDERS_CELL = { top: NB, bottom: NB, left: NB, right: NB };
const NO_BORDERS_TABLE = { top: NB, bottom: NB, left: NB, right: NB, insideH: NB, insideV: NB };

// ═══════════════════════════════════════════════════════════
// «N ДНЕЙ / M НОЧЕЙ»
// ═══════════════════════════════════════════════════════════
function daysNightsStr(days, lang) {
  const n = days.length, m = Math.max(n - 1, 0);
  if (lang === 'ru') return `(${n} ДНЕЙ / ${m} НОЧЕЙ)`;
  if (lang === 'en') return `(${n} DAYS / ${m} NIGHTS)`;
  if (lang === 'de') return `(${n} TAGE / ${m} NÄCHTE)`;
  return `(${n} / ${m})`;
}

// ═══════════════════════════════════════════════════════════
// HEADER — фигуры + текст поверх
// ═══════════════════════════════════════════════════════════
// Структура (слои снизу вверх):
//   z=-4  Фон #deebf7:  21.06 × 3.48 cm  top=0  left=0
//   z=-3  Синяя полоса: 17.21 × 3.48 cm  top=0  left=3.85
//   z=-2  Белый круг:    3.35 ×  3.35 cm  top=0.065  left=0.25
//   z=-1  Лого PNG:      3.35 ×  3.35 cm  top=0.065  left=0.25
//   Текст (inline): 26pt белый, вертикально центрирован в 3.48 cm
//
// Общая высота хедера = 3.48 cm → в секции header margin = 0,
// отступ контента сверху = 3.48 cm ≈ 1973 DXA
//
function createHeader(t, logoPath, daysNights) {
  const children = [];

  // ── Фигуры (рисуются через VML) ─────────────────────────────────

  // 1. Фон header: #deebf7, вся ширина A4, высота 3.48 cm
  children.push(vmlRect(21.06, 3.48, C_LIGHTBLUE, 0, 0, -4));

  // 2. Синяя полоса: от x=3.85 до правого края, высота 3.48 cm
  //    ширина = 21.06 - 3.85 = 17.21 cm
  children.push(vmlRect(17.21, 3.48, C_CYAN, 0, 3.85, -3));

  // 3. Белый круг под лого: 3.35×3.35 cm
  //    центрирован по вертикали: top = (3.48 - 3.35) / 2 = 0.065 cm
  //    отступ слева: 0.25 cm
  children.push(vmlCircle(3.35, C_WHITE, 0.065, 0.25, -2));

  // 4. Лого поверх круга (тот же размер и позиция)
  const logoExists = fs.existsSync(logoPath);
  if (logoExists) {
    const logoData = fs.readFileSync(logoPath);
    children.push(vmlImage(logoData, 3.35, 3.35, 0.065, 0.25, -1, 'logo_hdr'));
  }

  // ── Текст поверх фигур ───────────────────────────────────────────
  // Пустой абзац-распорка, чтобы текст попал примерно на 30% высоты хедера
  // header margin=0, поэтому первый параграф начинается от самого верха.
  // Синяя полоса 3.48 cm → текст нужно сдвинуть на ~0.8 cm вниз
  children.push(new Paragraph({
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text: '', size: 2 })]
  }));

  // Строка 1: название программы, 26pt, белый, жирный
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 180, after: 40 },
    // Отступ слева = ширина лого ячейки (3.85 cm ≈ 2183 DXA) + немного
    indent: { left: 2200 },
    children: [
      new TextRun({
        text: t.title,
        bold: true,
        size: 52,      // 26pt = 52 half-points
        font: FONT,
        color: C_WHITE,
      })
    ]
  }));

  // Строка 2: (N ДНЕЙ / M НОЧЕЙ), 22pt, белый, жирный
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0 },
    indent: { left: 2200 },
    children: [
      new TextRun({
        text: daysNights,
        bold: true,
        size: 44,      // 22pt
        font: FONT,
        color: C_WHITE,
      })
    ]
  }));

  return new Header({ children });
}

// ═══════════════════════════════════════════════════════════
// FOOTER — фигура + текст поверх
// ═══════════════════════════════════════════════════════════
// Фон #deebf7: 21.06 × 2.49 cm, top=0, left=0
// Текст центрирован внутри.
//
function createFooter(t) {
  const children = [];

  // Фон: #deebf7, вся ширина, высота 2.49 cm
  children.push(vmlRect(21.06, 2.49, C_LIGHTBLUE, 0, 0, -1));

  // Слоган: 18pt, #c10000, жирный
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 60 },
    children: [
      new TextRun({
        text: t.slogan,
        bold: true,
        size: 36,    // 18pt
        font: FONT,
        color: C_SLOGAN,
      })
    ]
  }));

  // Контакты: 10pt, #800000, без номера страницы
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0 },
    children: [
      new TextRun({
        text: t.contacts,
        size: 20,    // 10pt
        font: FONT,
        color: C_CONTACTS,
      })
    ]
  }));

  return new Footer({ children });
}

// ═══════════════════════════════════════════════════════════
// МЕТАДАННЫЕ ТУРА
// ═══════════════════════════════════════════════════════════
function buildMetaBlock(meta, t) {
  const fields = [
    [t.start, meta.start],
    [t.end, meta.end],
    [t.fIn, meta.flight_in],
    [t.fOut, meta.flight_out],
    [t.guests, meta.guests],
    [t.hotel, meta.hotel],
    [t.contact, meta.contact],
  ];

  return fields
    .filter(([, val]) => val && String(val).trim())
    .map(([label, val]) => {
      const isHotel = label === t.hotel;
      return new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 0, after: 80 },
        children: [
          new TextRun({ text: label + ' ', bold: true, size: 24, font: FONT, color: C_BLACK }),
          new TextRun({
            text: String(val),
            bold: isHotel,
            size: 24,
            font: FONT,
            color: isHotel ? C_CONTACTS : C_BLACK
          }),
        ]
      });
    });
}

// ═══════════════════════════════════════════════════════════
// СКАЧАТЬ ИЗОБРАЖЕНИЕ
// ═══════════════════════════════════════════════════════════
async function downloadImage(url, destPath) {
  if (!url || !url.trim()) return null;
  return new Promise((resolve) => {
    const proto = url.trim().startsWith('https') ? https : http;
    const req = proto.get(url.trim(), (res) => {
      if (res.statusCode !== 200) { resolve(null); return; }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => resolve(destPath));
      file.on('error', () => resolve(null));
    });
    req.setTimeout(7000, () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

// ═══════════════════════════════════════════════════════════
// БЛОК ОДНОГО ДНЯ
// ═══════════════════════════════════════════════════════════
// Правая колонка:
//   - Заголовок «День N (дд.мм, день)»: 18pt, #800000, RIGHT
//   - Разделитель: VML rect #36c6f5, 11.53 × 0.15 cm (inline)
//   - Маршрут: 18pt жирный, #800000, RIGHT
//   - Буллиты: 12pt Cambria, justified
// Левая колонка: фотографии из БД
//
async function buildDayBlock(day, dayIdx, t, tempDir) {
  const dayNum = day.day_number || (dayIdx + 1);
  const dateStr = day.date_str || '';
  const rawText = day.raw_text || '';
  const places = day.places || [];

  // Убираем «День N —» из начала
  const cleanRoute = rawText
    .replace(/^(День|Day|Tag|Օr)\s*\d+\s*[-—–]+\s*/i, '')
    .trim();

  // ─── ПРАВАЯ КОЛОНКА ─────────────────────────────────────────────
  const textParas = [];

  // 1. Заголовок дня: «День N (дата)» — 18pt, #800000, RIGHT
  textParas.push(new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { before: 160, after: 60 },
    children: [
      new TextRun({
        text: `${t.day} ${dayNum} (${dateStr})`,
        bold: true,
        size: 36,
        font: FONT,
        color: C_CONTACTS,
      })
    ]
  }));

  // 2. Синяя линия-разделитель — VML rect внутри ячейки
  //    Ширина: 11.53 cm, Высота: 0.15 cm, цвет: #36c6f5
  //    Позиционируется относительно колонки, прижата вправо.
  //    Используем relative позиционирование (без page-relative),
  //    тогда фигура следует за текстом.
  textParas.push(new ImportedXmlComponent(
    '<w:p' +
    ' xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"' +
    ' xmlns:v="urn:schemas-microsoft-com:vml">' +
    '<w:pPr>' +
    '  <w:jc w:val="right"/>' +
    '  <w:spacing w:before="0" w:after="60"/>' +
    '</w:pPr>' +
    '<w:r><w:rPr/><w:pict>' +
    '<v:rect style="width:11.53cm;height:0.15cm;z-index:1" fillcolor="#36c6f5" stroked="f">' +
    '<v:fill type="solid"/>' +
    '</v:rect>' +
    '</w:pict></w:r></w:p>'
  ));

  // 3. Маршрут: 18pt жирный, #800000, RIGHT
  textParas.push(new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { before: 60, after: 140 },
    children: [
      new TextRun({
        text: cleanRoute,
        bold: true,
        size: 36,
        font: FONT,
        color: C_CONTACTS,
      })
    ]
  }));

  // 4. Буллиты: первое слово жирное, остаток обычный, 12pt, justified
  for (const place of places) {
    const text = (place.final_text || '').trim();
    if (!text) continue;

    const spIdx = text.indexOf(' ');
    const firstWord = spIdx > -1 ? text.slice(0, spIdx) : text;
    const rest = spIdx > -1 ? text.slice(spIdx + 1) : '';

    textParas.push(new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { before: 0, after: 100 },
      numbering: { reference: 'bullets', level: 0 },
      children: [
        new TextRun({ text: firstWord + (rest ? ' ' : ''), bold: true, size: 24, font: FONT, color: C_BLACK }),
        ...(rest ? [new TextRun({ text: rest, bold: false, size: 24, font: FONT, color: C_BLACK })] : [])
      ]
    }));
  }

  if (textParas.length <= 3) {
    textParas.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
  }

  // ─── ЛЕВАЯ КОЛОНКА: ФОТО ────────────────────────────────────────
  const photoParas = [];
  let photoCount = 0;

  for (const place of places) {
    if (photoCount >= 4) break;
    const url = (place.photo_main || '').trim();
    if (!url) continue;

    const fname = `photo_d${dayIdx}_p${photoCount}_${Date.now()}.jpg`;
    const fpath = path.join(tempDir, fname);
    const ok = await downloadImage(url, fpath);

    if (ok && fs.existsSync(fpath)) {
      const imgPt = Math.round(COL_PHOTO / 20);      // DXA → pt ≈ /20
      const imgH = Math.round(imgPt * 0.70);

      photoParas.push(new Paragraph({
        spacing: { before: 0, after: 120 },
        alignment: AlignmentType.LEFT,
        children: [
          new ImageRun({
            type: 'jpg',
            data: fs.readFileSync(fpath),
            transformation: { width: imgPt, height: imgH }
          })
        ]
      }));
      photoCount++;
    }
  }

  if (photoParas.length === 0) {
    photoParas.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
  }

  // ─── ДВУХКОЛОНОЧНАЯ ТАБЛИЦА ─────────────────────────────────────
  const leftCell = new TableCell({
    width: { size: COL_PHOTO, type: WidthType.DXA },
    borders: NO_BORDERS_CELL,
    margins: { top: 0, bottom: 0, left: 0, right: COL_GAP },
    verticalAlign: VerticalAlign.TOP,
    children: photoParas,
  });

  const rightCell = new TableCell({
    width: { size: COL_TEXT, type: WidthType.DXA },
    borders: NO_BORDERS_CELL,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    verticalAlign: VerticalAlign.TOP,
    children: textParas,
  });

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [COL_PHOTO, COL_TEXT],
    borders: NO_BORDERS_TABLE,
    rows: [new TableRow({ children: [leftCell, rightCell] })]
  });
}

// ═══════════════════════════════════════════════════════════
// ГЛАВНАЯ ФУНКЦИЯ
// ═══════════════════════════════════════════════════════════
async function buildDocument(inputJsonPath, outputDocxPath) {
  const raw = JSON.parse(fs.readFileSync(inputJsonPath, 'utf8'));
  const lang = raw.lang || 'ru';
  const t = DICT[lang] || DICT.ru;
  const meta = raw.meta || {};
  const days = raw.days || [];
  const tempDir = path.dirname(outputDocxPath);

  // Логотип рядом с этим скриптом
  const logoPath = path.join(__dirname, 'logo.png');

  const daysNights = daysNightsStr(days, lang);

  // ─── Контент документа ────────────────────────────────────────
  const docChildren = [];

  // 1. Метаданные (без разрыва страниц)
  docChildren.push(...buildMetaBlock(meta, t));
  docChildren.push(new Paragraph({ spacing: { before: 240, after: 240 }, children: [] }));

  // 2. Дни тура
  for (let i = 0; i < days.length; i++) {
    const dayTable = await buildDayBlock(days[i], i, t, tempDir);
    docChildren.push(dayTable);
    docChildren.push(new Paragraph({ spacing: { before: 120, after: 120 }, children: [] }));
  }

  // ─── Документ ─────────────────────────────────────────────────
  const doc = new Document({
    numbering: {
      config: [{
        reference: 'bullets',
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: '\u2022',
          alignment: AlignmentType.LEFT,
          style: {
            paragraph: { indent: { left: 360, hanging: 360 }, spacing: { after: 80 } },
            run: { font: FONT, size: 24 }
          }
        }]
      }]
    },
    styles: {
      default: {
        document: { run: { font: FONT, size: 24, color: C_BLACK } }
      }
    },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: {
            // Верхний отступ контента = высота header = 3.48 cm ≈ 1973 DXA
            // + небольшой gap ≈ 200 DXA
            top: 2200,
            // Нижний отступ = высота footer = 2.49 cm ≈ 1412 DXA + gap
            bottom: 1700,
            left: MARGIN,
            right: MARGIN,
            // header/footer = 0: фигуры прибиваются к краям без отступов
            header: 0,
            footer: 0,
          }
        }
      },
      headers: { default: createHeader(t, logoPath, daysNights) },
      footers: { default: createFooter(t) },
      children: docChildren,
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputDocxPath, buffer);
  console.log(`✅ DOCX создан: ${outputDocxPath}`);
}

// ═══════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════
const [, , inputPath, outputPath] = process.argv;

if (inputPath && outputPath) {
  buildDocument(inputPath, outputPath)
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
} else {
  console.error('Использование: node docx_builder.js <input.json> <output.docx>');
  process.exit(1);
}