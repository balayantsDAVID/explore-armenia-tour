// ============================================================
// ExploreArmenia — DOCX Builder v3
// ============================================================
// Дизайн точно по скриншотам:
//   HEADER:  фон #deebf7 (светло-голубой), логотип слева в белом
//            круге, текст заголовка 26pt жирный белый, фон полосы #36c6f5
//   DAYS:    заголовок «День N» 18pt тёмно-красный, выравнивание RIGHT,
//            синяя линия-разделитель только под правой колонкой,
//            маршрут 18pt жирный тёмно-красный, RIGHT
//            левая колонка ~35% — только фото,
//            правая колонка ~65% — буллиты 12pt Cambria
//   FOOTER:  слоган 18pt красный, контакты 10pt серый
// ============================================================

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, BorderStyle, WidthType,
  ShadingType, PageNumber, LevelFormat, VerticalAlign
} = require('docx');

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ─────────────────────────────────────────────
// КОНСТАНТЫ ДИЗАЙНА
// ─────────────────────────────────────────────
const FONT = 'Cambria';

const C_CYAN = '36c6f5';  // голубой — фон полосы в шапке
const C_LIGHTBLUE = 'deebf7';  // светло-голубой — фон самого хедера (вся строка)
const C_DARKRED = '800000';  // тёмно-красный — слоган, заголовки дней
const C_DARKBLUE = '003366';  // тёмно-синий — линия-разделитель дней
const C_WHITE = 'FFFFFF';
const C_GRAY = '555555';
const C_BLACK = '000000';

// A4 в DXA (1 inch = 1440 DXA)
const PAGE_W = 11906;   // ~210 мм
const PAGE_H = 16838;   // ~297 мм
const MARGIN = 851;     // ~1.5 cm = поля

// Ширина контента (без полей с двух сторон)
const CONTENT_W = PAGE_W - MARGIN * 2;   // ≈ 10204 DXA

// Колонки: 35% фото / 65% текст
const COL_PHOTO = Math.round(CONTENT_W * 0.35);   // ≈ 3571
const COL_TEXT = CONTENT_W - COL_PHOTO - 200;    // gap 200 DXA ≈ 3433... recalc:
//   COL_PHOTO + GAP + COL_TEXT = CONTENT_W
//   COL_TEXT = CONTENT_W - COL_PHOTO - 200
const GAP = 200;
// recalc COL_TEXT
const COL_TEXT_W = CONTENT_W - COL_PHOTO - GAP;   // ≈ 6433

// ─────────────────────────────────────────────
// МУЛЬТИЯЗЫЧНЫЙ СЛОВАРЬ
// ─────────────────────────────────────────────
const DICT = {
  ru: {
    day: 'День', title: 'ПРОГРАММА ТУРА ПО АРМЕНИИ',
    slogan: 'Армения - страна, в которую можно влюбиться!',
    contacts: '(+374 91) 01 56 60 (Viber, WhatsApp)  |  info@explorearmenia.am  |  www.explorearmenia.am',
    start: 'Дата начала тура:', end: 'Дата окончания тура:',
    fIn: 'Рейсы прилета:', fOut: 'Рейсы вылета:',
    guests: 'Количество участников:', hotel: 'Отель:', contact: 'Контактное лицо:'
  },
  en: {
    day: 'Day', title: 'ARMENIA TOUR PROGRAM',
    slogan: 'Armenia - a country to fall in love with!',
    contacts: '(+374 91) 01 56 60 (Viber, WhatsApp)  |  info@explorearmenia.am  |  www.explorearmenia.am',
    start: 'Tour start date:', end: 'Tour end date:',
    fIn: 'Arrival flight:', fOut: 'Departure flight:',
    guests: 'Number of participants:', hotel: 'Hotel:', contact: 'Contact person:'
  },
  de: {
    day: 'Tag', title: 'ARMENIEN TOURPROGRAMM',
    slogan: 'Armenien - ein Land, in das man sich verlieben kann!',
    contacts: '(+374 91) 01 56 60 (Viber, WhatsApp)  |  info@explorearmenia.am  |  www.explorearmenia.am',
    start: 'Beginn der Tour:', end: 'Ende der Tour:',
    fIn: 'Anflug:', fOut: 'Abflug:',
    guests: 'Teilnehmerzahl:', hotel: 'Hotel:', contact: 'Kontaktperson:'
  },
  hy: {
    day: 'Օր', title: 'ՀԱՅԱՍՏԱՆԻ TUРԻԾPAGRAM',
    slogan: 'Հայաuтан - mի երкир, orp каrелi ек sirayel!',
    contacts: '(+374 91) 01 56 60 (Viber, WhatsApp)  |  info@explorearmenia.am  |  www.explorearmenia.am',
    start: 'Tuри meknarкutyan аmsatіv:', end: 'Turi аvаrtіn аmsatіv:',
    fIn: 'Ժаmanum рейs:', fOut: 'Маекnum рейs:',
    guests: 'Mrtsаkіtsner:', hotel: 'Хndrаnос:', contact: 'Каrasmamdman аndzn:'
  }
};

// ─────────────────────────────────────────────
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ─────────────────────────────────────────────

/** Пустая граница (невидимая) */
function noBorder() {
  return { style: BorderStyle.NONE, size: 0, color: C_WHITE, space: 0 };
}

/** Все границы ячейки невидимы */
function cellNoBorders() {
  return {
    top: noBorder(),
    bottom: noBorder(),
    left: noBorder(),
    right: noBorder(),
  };
}

/** Скачать изображение по URL в файл */
async function downloadImage(url, destPath) {
  if (!url || !url.trim()) return null;
  return new Promise((resolve) => {
    const proto = url.startsWith('https') ? https : http;
    const req = proto.get(url.trim(), (res) => {
      if (res.statusCode !== 200) { resolve(null); return; }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => resolve(destPath));
      file.on('error', () => resolve(null));
    });
    req.setTimeout(6000, () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

/** Вычислить «N ДНЕЙ / M НОЧЕЙ» из массива дней */
function daysNightsStr(days, lang) {
  const n = days.length;
  const m = Math.max(n - 1, 0);
  if (lang === 'ru') return `(${n} ДНЕЙ / ${m} НОЧЕЙ)`;
  if (lang === 'en') return `(${n} DAYS / ${m} NIGHTS)`;
  if (lang === 'de') return `(${n} TAGE / ${m} NÄCHTE)`;
  return `(${n} / ${m})`;
}

// ─────────────────────────────────────────────
// HEADER  (колонтитул верхний)
// ─────────────────────────────────────────────
// Дизайн (по скриншотам):
//   Вся строка хедера имеет светло-голубой фон (#deebf7).
//   Внутри — таблица 2 колонки без рамок:
//     левая: логотип в белом круге (эмулируем просто картинкой)
//     правая: голубая (#36c6f5) заливка, 2 строки белого текста 26pt + sub
//
function createHeader(t, logoPath, daysNights) {
  const logoExists = fs.existsSync(logoPath);

  // ── Левая ячейка: логотип ──
  const logoChildren = [];
  if (logoExists) {
    logoChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [
          new ImageRun({
            type: 'png',
            data: fs.readFileSync(logoPath),
            transformation: { width: 72, height: 72 },   // ~1.9cm
          })
        ]
      })
    );
  } else {
    logoChildren.push(new Paragraph({ children: [new TextRun('')] }));
  }

  const leftCell = new TableCell({
    width: { size: 1200, type: WidthType.DXA },
    borders: cellNoBorders(),
    shading: { fill: C_LIGHTBLUE, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 80 },
    verticalAlign: VerticalAlign.CENTER,
    children: logoChildren,
  });

  // ── Правая ячейка: голубая полоса с заголовком ──
  const rightCellW = CONTENT_W - 1200;

  const titleLine1 = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 20 },
    children: [
      new TextRun({
        text: t.title,
        bold: true,
        size: 52,            // 26pt (half-points)
        font: FONT,
        color: C_WHITE,
      })
    ]
  });

  const titleLine2 = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 60 },
    children: [
      new TextRun({
        text: daysNights,
        bold: true,
        size: 44,            // 22pt
        font: FONT,
        color: C_WHITE,
      })
    ]
  });

  const rightCell = new TableCell({
    width: { size: rightCellW, type: WidthType.DXA },
    borders: cellNoBorders(),
    shading: { fill: C_CYAN, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 200, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: [titleLine1, titleLine2],
  });

  // Таблица-шапка
  const headerTable = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [1200, rightCellW],
    borders: {
      top: noBorder(), bottom: noBorder(),
      left: noBorder(), right: noBorder(),
      insideH: noBorder(), insideV: noBorder(),
    },
    rows: [
      new TableRow({ children: [leftCell, rightCell] })
    ]
  });

  return new Header({
    children: [
      // Фон всей строки хедера — светло-голубой (через параграф с затенением)
      new Paragraph({
        spacing: { before: 0, after: 0 },
        shading: { fill: C_LIGHTBLUE, type: ShadingType.CLEAR },
        children: []
      }),
      headerTable,
    ]
  });
}

// ─────────────────────────────────────────────
// FOOTER  (колонтитул нижний)
// ─────────────────────────────────────────────
// Слоган: 18pt тёмно-красный жирный, по центру
// Контакты: 10pt серый, по центру, с номером страницы
//
function createFooter(t) {
  const slogan = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 40 },
    children: [
      new TextRun({
        text: t.slogan,
        bold: true,
        size: 36,    // 18pt
        font: FONT,
        color: C_DARKRED,
      })
    ]
  });

  const contacts = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 60 },
    children: [
      new TextRun({
        text: t.contacts + '  |  стр. ',
        size: 20,    // 10pt
        font: FONT,
        color: C_GRAY,
      }),
      new TextRun({
        children: [PageNumber.CURRENT],
        size: 20,
        font: FONT,
        color: C_GRAY,
      })
    ]
  });

  return new Footer({ children: [slogan, contacts] });
}

// ─────────────────────────────────────────────
// БЛОК МЕТАДАННЫХ ТУРА
// ─────────────────────────────────────────────
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

  const paras = [];
  for (const [label, val] of fields) {
    if (!val || !String(val).trim()) continue;

    const runs = [
      new TextRun({ text: label + ' ', bold: true, size: 24, font: FONT, color: C_BLACK })
    ];

    // Отель — красным жирным
    if (label === t.hotel) {
      runs.push(new TextRun({ text: String(val), bold: true, size: 24, font: FONT, color: C_DARKRED }));
    } else {
      runs.push(new TextRun({ text: String(val), size: 24, font: FONT, color: C_BLACK }));
    }

    paras.push(new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 0, after: 80 },
      children: runs
    }));
  }

  return paras;
}

// ─────────────────────────────────────────────
// БЛОК ОДНОГО ДНЯ
// ─────────────────────────────────────────────
async function buildDayBlock(day, dayIndex, t, tempDir) {
  const dayNum = day.day_number || (dayIndex + 1);
  const dateStr = day.date_str || '';
  const rawText = day.raw_text || '';
  const places = day.places || [];

  // Очищаем маршрут от «День N —»
  const cleanRoute = rawText
    .replace(/^(День|Day|Tag|Օr)\s*\d+\s*[-—–]+\s*/i, '')
    .trim();

  // ── Заголовок дня (на всю ширину) ──
  // «День N (дд.мм, день)» — 18pt, тёмно-красный, RIGHT
  const dayTitlePara = new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { before: 200, after: 60 },
    // Синяя линия снизу — только под правой колонкой, делаем здесь как border
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 12, color: C_CYAN, space: 4 }
    },
    children: [
      new TextRun({
        text: `${t.day} ${dayNum} (${dateStr})`,
        bold: true,
        size: 36,    // 18pt
        font: FONT,
        color: C_DARKRED,
      })
    ]
  });

  // Маршрут дня — 18pt жирный, тёмно-красный, RIGHT
  const routePara = new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { before: 60, after: 120 },
    children: [
      new TextRun({
        text: cleanRoute,
        bold: true,
        size: 36,    // 18pt
        font: FONT,
        color: C_DARKRED,
      })
    ]
  });

  // ── Левая колонка: фотографии ──
  const photoParas = [];
  let photoCount = 0;

  for (const place of places) {
    if (photoCount >= 4) break;
    const url = place.photo_main || '';
    if (!url.trim()) continue;

    const fname = `photo_d${dayIndex}_${photoCount}_${Date.now()}.jpg`;
    const fpath = path.join(tempDir, fname);
    const downloaded = await downloadImage(url, fpath);

    if (downloaded && fs.existsSync(fpath)) {
      const data = fs.readFileSync(fpath);
      // Ширина фото = ширина колонки в EMU (1 DXA = 914.4 EMU / 1440)
      // COL_PHOTO DXA → пикселей: COL_PHOTO/1440 * 96 * (EMU/px = 9144)
      // Проще: задаём в pt: COL_PHOTO / 20 = pt ≈ cm*28.35
      const imgWidthPt = Math.round(COL_PHOTO / 20);        // pt
      const imgHeightPt = Math.round(imgWidthPt * 0.71);     // ~3:2 пропорция

      photoParas.push(
        new Paragraph({
          spacing: { before: 0, after: 120 },
          alignment: AlignmentType.LEFT,
          children: [
            new ImageRun({
              type: 'jpg',
              data,
              transformation: {
                width: imgWidthPt,
                height: imgHeightPt,
              }
            })
          ]
        })
      );
      photoCount++;
    }
  }

  if (photoParas.length === 0) {
    photoParas.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
  }

  // ── Правая колонка: заголовок + маршрут + буллиты ──
  const textParas = [dayTitlePara, routePara];

  for (const place of places) {
    const text = (place.final_text || '').trim();
    if (!text) continue;

    // Разбиваем на первое слово (жирное — название) и остаток
    const spaceIdx = text.indexOf(' ');
    const firstWord = spaceIdx > -1 ? text.slice(0, spaceIdx) : text;
    const restText = spaceIdx > -1 ? text.slice(spaceIdx + 1) : '';

    textParas.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { before: 0, after: 100 },
        numbering: { reference: 'bullets', level: 0 },
        children: [
          new TextRun({ text: firstWord + ' ', bold: true, size: 24, font: FONT, color: C_BLACK }),
          ...(restText ? [new TextRun({ text: restText, size: 24, font: FONT, color: C_BLACK })] : []),
        ]
      })
    );
  }

  if (textParas.length <= 2) {
    textParas.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
  }

  // ── Двухколоночная таблица ──
  const leftCell = new TableCell({
    width: { size: COL_PHOTO, type: WidthType.DXA },
    borders: cellNoBorders(),
    margins: { top: 0, bottom: 0, left: 0, right: GAP },
    verticalAlign: VerticalAlign.TOP,
    children: photoParas,
  });

  const rightCell = new TableCell({
    width: { size: COL_TEXT_W, type: WidthType.DXA },
    borders: cellNoBorders(),
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    verticalAlign: VerticalAlign.TOP,
    children: textParas,
  });

  const dayTable = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [COL_PHOTO, COL_TEXT_W],
    borders: {
      top: noBorder(), bottom: noBorder(),
      left: noBorder(), right: noBorder(),
      insideH: noBorder(), insideV: noBorder(),
    },
    rows: [new TableRow({ children: [leftCell, rightCell] })]
  });

  return dayTable;
}

// ─────────────────────────────────────────────
// ГЛАВНАЯ ФУНКЦИЯ
// ─────────────────────────────────────────────
async function buildDocument(inputJsonPath, outputDocxPath) {
  const raw = JSON.parse(fs.readFileSync(inputJsonPath, 'utf8'));
  const lang = raw.lang || 'ru';
  const t = DICT[lang] || DICT.ru;
  const meta = raw.meta || {};
  const days = raw.days || [];
  const tempDir = path.dirname(outputDocxPath);

  // Логотип: ищем рядом с этим скриптом
  const logoPath = path.join(__dirname, 'logo.png');

  const daysNights = daysNightsStr(days, lang);

  // ── Собираем контент ──
  const docChildren = [];

  // 1. Метаданные тура
  const metaParas = buildMetaBlock(meta, t);
  docChildren.push(...metaParas);

  // Пустая строка-отступ после метаданных
  docChildren.push(new Paragraph({ spacing: { before: 160, after: 160 }, children: [] }));

  // 2. Дни тура
  for (let i = 0; i < days.length; i++) {
    const dayTable = await buildDayBlock(days[i], i, t, tempDir);
    docChildren.push(dayTable);
    // Небольшой отступ между днями
    docChildren.push(new Paragraph({ spacing: { before: 120, after: 120 }, children: [] }));
  }

  // ── Создаём документ ──
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '\u2022',   // •
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 360, hanging: 360 },
                  spacing: { after: 80 }
                },
                run: { font: FONT, size: 24 }
              }
            }
          ]
        }
      ]
    },
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 24, color: C_BLACK }
        }
      }
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_W, height: PAGE_H },
            margin: {
              top: MARGIN,
              bottom: MARGIN * 2,   // место под футер
              left: MARGIN,
              right: MARGIN,
              header: 200,
              footer: 400,
            }
          }
        },
        headers: { default: createHeader(t, logoPath, daysNights) },
        footers: { default: createFooter(t) },
        children: docChildren,
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputDocxPath, buffer);
  console.log(`✅ DOCX создан: ${outputDocxPath}`);
}

// ─────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────
const [, , inputPath, outputPath] = process.argv;

if (inputPath && outputPath) {
  buildDocument(inputPath, outputPath)
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
} else {
  console.error('Использование: node docx_builder.js <input.json> <output.docx>');
  process.exit(1);
}