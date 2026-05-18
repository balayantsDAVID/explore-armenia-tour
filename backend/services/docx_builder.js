// ============================================================
// ExploreArmenia — DOCX Builder v2
// Воспроизводит точный макет оригинального документа
// ============================================================

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
  UnderlineType
} = require('docx');

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ============================================================
// Константы — точно по оригиналу
// ============================================================
const COLORS = {
  blue:      "00AACC",  // голубой хедер
  red:       "CC0000",  // красный слоган
  darkBlue:  "003366",  // тёмно-синий заголовок дня
  cyan:      "009DC4",  // заголовок дня (подзаголовок)
  white:     "FFFFFF",
  black:     "000000",
  gray:      "555555",
  lightGray: "888888",
};

// A4 в DXA
const PAGE_W = 11906;
const PAGE_H = 16838;
const MARGIN  = 851;  // ~1.5cm
const CONTENT_W = PAGE_W - MARGIN * 2; // 10204

// Колонки для блока дня: фото 38%, текст 62%
const COL_PHOTO = Math.round(CONTENT_W * 0.38); // 3877
const COL_TEXT  = CONTENT_W - COL_PHOTO;         // 6327

// ============================================================
// Скачивание изображения
// ============================================================
async function downloadImage(url, destPath) {
  if (!url || !url.trim()) return null;
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 ExploreArmenia/2.0' }
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        downloadImage(res.headers.location, destPath).then(resolve);
        return;
      }
      if (res.statusCode !== 200) { resolve(null); return; }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(destPath); });
      file.on('error', () => resolve(null));
    });
    req.on('error', () => resolve(null));
    req.setTimeout(12000, () => { req.destroy(); resolve(null); });
  });
}

// Определяем тип изображения по расширению
function getImageType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'png';
  if (ext === '.gif') return 'gif';
  return 'jpg';
}

// ============================================================
// ХЕДЕР — голубая плашка с логотипом и заголовком
// ============================================================
function createHeader(logoPath) {
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder };

  // Левая ячейка — логотип или текст EXPLORE
  const logoCell = new TableCell({
    width: { size: 2200, type: WidthType.DXA },
    shading: { fill: COLORS.blue, type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    borders: noBorders,
    margins: { top: 80, bottom: 80, left: 150, right: 80 },
    children: [
      logoPath && fs.existsSync(logoPath)
        ? new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [new ImageRun({
              type: 'png',
              data: fs.readFileSync(logoPath),
              transformation: { width: 95, height: 68 },
              altText: { title: 'Logo', description: 'ExploreArmenia', name: 'logo' }
            })]
          })
        : new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [
              new TextRun({ text: "EXPLORE", color: COLORS.white, bold: true, size: 22, font: "Arial", break: 0 }),
              new TextRun({ text: "armenia.am", color: COLORS.white, size: 16, font: "Arial", break: 1 }),
            ]
          })
    ]
  });

  // Правая ячейка — заголовок
  const titleCell = new TableCell({
    width: { size: CONTENT_W - 2200, type: WidthType.DXA },
    shading: { fill: COLORS.blue, type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    borders: noBorders,
    margins: { top: 80, bottom: 80, left: 200, right: 150 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [new TextRun({
          text: "ПРОГРАММА ТУРА ПО АРМЕНИИ",
          color: COLORS.white,
          bold: true,
          size: 36,
          font: "Arial",
        })]
      })
    ]
  });

  const headerTable = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2200, CONTENT_W - 2200],
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder },
    rows: [new TableRow({ children: [logoCell, titleCell] })]
  });

  return new Header({ children: [headerTable] });
}

// ============================================================
// ФУТЕР — красный слоган + контакты
// ============================================================
function createFooter() {
  return new Footer({
    children: [
      // Разделительная линия
      new Paragraph({
        spacing: { before: 0, after: 60 },
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: COLORS.blue } },
        children: []
      }),
      // Слоган красным жирным
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 40 },
        children: [new TextRun({
          text: "Армения - страна, в которую можно влюбиться!",
          color: COLORS.red,
          bold: true,
          size: 22,
          font: "Arial",
        })]
      }),
      // Контакты серым мелким + номер страницы
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({ text: "(+374 91) 01 56 60 (Viber, WhatsApp)  |  info@explorearmenia.am  |  www.explorearmenia.am  |  стр. ", color: COLORS.lightGray, size: 15, font: "Arial" }),
          new TextRun({ children: [PageNumber.CURRENT], color: COLORS.lightGray, size: 15 })
        ]
      })
    ]
  });
}

// ============================================================
// СТРАНИЦА 1 — данные тура
// ============================================================
function buildTourInfoPage(meta) {
  const items = [];

  // Пустая строка сверху
  items.push(new Paragraph({ spacing: { before: 200, after: 100 }, children: [] }));

  // Даты
  items.push(new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [
      new TextRun({ text: "Дата начала тура: ", bold: true, size: 24, font: "Arial" }),
      new TextRun({ text: meta.start || "—", size: 24, font: "Arial" }),
    ]
  }));
  items.push(new Paragraph({
    spacing: { before: 60, after: 160 },
    children: [
      new TextRun({ text: "Дата окончания тура: ", bold: true, size: 24, font: "Arial" }),
      new TextRun({ text: meta.end || "—", size: 24, font: "Arial" }),
    ]
  }));

  // Рейсы
  items.push(new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [
      new TextRun({ text: "Рейс прилета: ", bold: true, size: 24, font: "Arial" }),
      new TextRun({ text: meta.flight_in || "—", size: 24, font: "Arial" }),
    ]
  }));
  items.push(new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [
      new TextRun({ text: "Рейс вылета: ", bold: true, size: 24, font: "Arial" }),
      new TextRun({ text: meta.flight_out || "—", size: 24, font: "Arial" }),
    ]
  }));
  items.push(new Paragraph({
    spacing: { before: 60, after: 160 },
    children: [
      new TextRun({ text: "Количество участников: ", bold: true, size: 24, font: "Arial" }),
      new TextRun({ text: meta.guests || "—", size: 24, font: "Arial" }),
    ]
  }));

  // Отель
  items.push(new Paragraph({
    spacing: { before: 60, after: 160 },
    children: [
      new TextRun({ text: "Отель: ", bold: true, size: 24, font: "Arial" }),
      new TextRun({ text: meta.hotel || "—", size: 24, font: "Arial", color: COLORS.red }),
    ]
  }));

  // Контакт
  items.push(new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [
      new TextRun({ text: "Контактное лицо: ", bold: true, size: 24, font: "Arial" }),
      new TextRun({ text: meta.contact || "—", size: 24, font: "Arial" }),
    ]
  }));

  return items;
}

// ============================================================
// БЛОК ДНЯ — фото слева, текст справа (точно по оригиналу)
// ============================================================
async function buildDayBlock(day, tempDir) {
  const elements = [];
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder };

  // Собираем фото для дня (максимум 2)
  const photos = [];
  for (const place of day.places || []) {
    if (photos.length >= 2) break;
    for (const photoUrl of [place.photo_main, place.photo_secondary]) {
      if (!photoUrl || !photoUrl.trim() || photos.length >= 2) continue;
      const fname = `photo_${day.day_number}_${photos.length}_${Date.now()}.jpg`;
      const fpath = path.join(tempDir, fname);
      const downloaded = await downloadImage(photoUrl, fpath);
      if (downloaded) photos.push(downloaded);
    }
  }

  // --- ЛЕВАЯ КОЛОНКА: фото ---
  const photoCellChildren = [];
  if (photos.length > 0) {
    for (const photoPath of photos) {
      try {
        const imgData = fs.readFileSync(photoPath);
        const imgType = getImageType(photoPath);
        photoCellChildren.push(new Paragraph({
          spacing: { before: 0, after: 80 },
          children: [new ImageRun({
            type: imgType,
            data: imgData,
            transformation: { width: 195, height: 145 },
            altText: { title: 'Photo', description: 'Place', name: 'photo' }
          })]
        }));
      } catch(e) {
        console.log(`Photo error: ${e.message}`);
      }
    }
  }
  if (photoCellChildren.length === 0) {
    photoCellChildren.push(new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ text: " ", size: 22 })]
    }));
  }

  // --- ПРАВАЯ КОЛОНКА: текст ---
  const textCellChildren = [];

  // Заголовок дня — "День 1 (07.05, четверг)" синим
  textCellChildren.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 80 },
    children: [new TextRun({
      text: day.day_label || `День ${day.day_number}`,
      color: COLORS.darkBlue,
      bold: false,
      size: 26,
      font: "Arial",
    })]
  }));

  // Названия мест через " - " жирным синим (подзаголовок дня)
  const foundPlaces = (day.places || []).filter(p => p.status === 'OK');
  if (foundPlaces.length > 0) {
    const subtitle = foundPlaces.map(p => p.name || p.query).join(' - ');
    textCellChildren.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 120 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.cyan } },
      children: [new TextRun({
        text: subtitle,
        color: COLORS.cyan,
        bold: true,
        size: 26,
        font: "Arial",
      })]
    }));
  }

  // Описания мест в виде буллетов
  for (const place of day.places || []) {
    const text = place.final_text || place.promo_text || place.description || '';
    if (!text.trim()) continue;

    textCellChildren.push(new Paragraph({
      spacing: { before: 60, after: 60 },
      numbering: { reference: "bullets", level: 0 },
      children: [
        new TextRun({
          text: text,
          size: 20,
          font: "Arial",
          color: COLORS.black,
        })
      ]
    }));
  }

  if (textCellChildren.length === 1) {
    // Только заголовок дня — пустой день (прилёт, трансфер)
    textCellChildren.push(new Paragraph({
      children: [new TextRun({ text: " ", size: 20 })]
    }));
  }

  // Таблица 2 колонки
  const dayTable = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [COL_PHOTO, COL_TEXT],
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder },
    rows: [
      new TableRow({
        children: [
          // Левая: фото
          new TableCell({
            width: { size: COL_PHOTO, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            borders: noBorders,
            margins: { top: 80, bottom: 80, left: 0, right: 160 },
            children: photoCellChildren
          }),
          // Правая: текст
          new TableCell({
            width: { size: COL_TEXT, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            borders: noBorders,
            margins: { top: 80, bottom: 80, left: 0, right: 0 },
            children: textCellChildren
          })
        ]
      })
    ]
  });

  elements.push(dayTable);

  // Разделитель между днями
  elements.push(new Paragraph({
    spacing: { before: 100, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" } },
    children: []
  }));

  return elements;
}

// ============================================================
// БЛОК "СТОИМОСТЬ ВКЛЮЧАЕТ / НЕ ВКЛЮЧАЕТ"
// ============================================================
function buildCostBlock() {
  return [
    new Paragraph({ spacing: { before: 200, after: 80 }, children: [
      new TextRun({ text: "Стоимость тура включает:", bold: true, size: 22, color: COLORS.cyan, font: "Arial" })
    ]}),
    ...["трансферы аэропорт-отель-аэропорт",
        "комфортабельное транспортное обслуживание",
        "услуги сопровождающего гида",
        "входные билеты в историко-культурные центры",
        "бутилированная вода в транспорте",
        "круглосуточная поддержка туристов по телефону"
    ].map(t => new Paragraph({
      spacing: { before: 40, after: 40 },
      numbering: { reference: "bullets", level: 0 },
      children: [new TextRun({ text: t, size: 20, font: "Arial" })]
    })),

    new Paragraph({ spacing: { before: 160, after: 80 }, children: [
      new TextRun({ text: "Стоимость тура не включает:", bold: true, size: 22, color: COLORS.red, font: "Arial" })
    ]}),
    ...["авиабилеты", "медицинская страховка"].map(t => new Paragraph({
      spacing: { before: 40, after: 40 },
      numbering: { reference: "bullets", level: 0 },
      children: [new TextRun({ text: t, size: 20, font: "Arial" })]
    })),
  ];
}

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================
async function buildDocument(inputJsonPath, outputDocxPath) {
  const raw = JSON.parse(fs.readFileSync(inputJsonPath, 'utf8'));
  const { days, meta } = raw;
  const tempDir = path.dirname(outputDocxPath);
  const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');

  // Страница 1: данные тура
  const page1 = buildTourInfoPage(meta);

  // Блоки дней
  const dayBlocks = [];
  for (const day of days) {
    const block = await buildDayBlock(day, tempDir);
    dayBlocks.push(...block);
  }

  // Блок стоимости
  const costBlock = buildCostBlock();

  const doc = new Document({
    numbering: {
      config: [{
        reference: "bullets",
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: "•",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 440, hanging: 260 } } }
        }]
      }]
    },
    styles: {
      default: {
        document: { run: { font: "Arial", size: 22 } }
      }
    },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN, header: 300, footer: 400 }
        }
      },
      headers: { default: createHeader(logoPath) },
      footers: { default: createFooter() },
      children: [
        ...page1,
        new Paragraph({ children: [new PageBreak()] }),
        ...dayBlocks,
        ...costBlock,
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputDocxPath, buffer);
  console.log(`✅ DOCX создан: ${outputDocxPath}`);
}

// CLI запуск
const [,, inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error("Использование: node docx_builder.js <input.json> <output.docx>");
  process.exit(1);
}

buildDocument(inputPath, outputPath)
  .then(() => process.exit(0))
  .catch(err => { console.error("❌", err); process.exit(1); });
