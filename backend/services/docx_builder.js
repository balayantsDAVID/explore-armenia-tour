// ============================================================
// ExploreArmenia — DOCX Builder v3 (Multilingual & Strict DB)
// ============================================================
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat
} = require('docx');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const COLORS = {
  blue: "00AACC", red: "CC0000", darkBlue: "003366", cyan: "009DC4",
  white: "FFFFFF", black: "000000", gray: "555555", lightGray: "888888",
};

const PAGE_W = 11906, PAGE_H = 16838, MARGIN = 851;
const CONTENT_W = PAGE_W - MARGIN * 2;
const COL_PHOTO = Math.round(CONTENT_W * 0.38);
const COL_TEXT = CONTENT_W - COL_PHOTO;

// СЛОВАРИ ПЕРЕВОДОВ
const DICT = {
  ru: {
    day: "День", title: "ПРОГРАММА ТУРА ПО АРМЕНИИ", slogan: "Армения - страна, в которую можно влюбиться!",
    footer: "стр.", start: "Дата начала тура:", end: "Дата окончания тура:", fIn: "Рейс прилета:", fOut: "Рейс вылета:",
    guests: "Количество участников:", hotel: "Отель:", contact: "Контактное лицо:",
    incTitle: "Стоимость тура включает:", excTitle: "Стоимость тура не включает:",
    incList: ["трансферы аэропорт-отель-аэропорт", "комфортабельное транспортное обслуживание", "услуги сопровождающего гида", "входные билеты в историко-культурные центры", "бутилированная вода в транспорте", "круглосуточная поддержка туристов по телефону"],
    excList: ["авиабилеты", "медицинская страховка"]
  },
  en: {
    day: "Day", title: "ARMENIA TOUR PROGRAM", slogan: "Armenia - a country to fall in love with!",
    footer: "page", start: "Tour start date:", end: "Tour end date:", fIn: "Arrival flight:", fOut: "Departure flight:",
    guests: "Number of participants:", hotel: "Hotel:", contact: "Contact person:",
    incTitle: "The tour price includes:", excTitle: "The tour price does not include:",
    incList: ["airport-hotel-airport transfers", "comfortable transportation", "professional guide services", "entrance tickets to historical and cultural centers", "bottled water in transport", "24/7 tourist support"],
    excList: ["air tickets", "medical insurance"]
  },
  de: {
    day: "Tag", title: "TOURPROGRAMM IN ARMENIEN", slogan: "Armenien - ein Land zum Verlieben!",
    footer: "Seite", start: "Tourstartdatum:", end: "Tourenddatum:", fIn: "Ankunftsflug:", fOut: "Abflug:",
    guests: "Teilnehmerzahl:", hotel: "Hotel:", contact: "Ansprechpartner:",
    incTitle: "Im Tourpreis inbegriffen:", excTitle: "Nicht im Tourpreis inbegriffen:",
    incList: ["Flughafentransfers", "komfortabler Transport", "Reiseleiterdienste", "Eintrittskarten für historische Stätten", "Wasser in Flaschen im Transport", "24/7 Touristenunterstützung"],
    excList: ["Flugtickets", "Krankenversicherung"]
  },
  hy: {
    day: "Օր", title: "ՏՈՒՐԻ ԾՐԱԳԻՐ ՀԱՅԱՍՏԱՆՈՒՄ", slogan: "Հայաստան՝ երկիր, որին կարելի է սիրահարվել։",
    footer: "էջ", start: "Տուրի սկիզբ՝", end: "Տուրի ավարտ՝", fIn: "Ժամանման չվերթ՝", fOut: "Մեկնման չվերթ՝",
    guests: "Մասնակիցների քանակ՝", hotel: "Հյուրանոց՝", contact: "Կոնտակտային անձ՝",
    incTitle: "Գինը ներառում է՝", excTitle: "Գինը չի ներառում՝",
    incList: ["օդանավակայան-հյուրանոց տրանսֆեր", "հարմարավետ տրանսպորտային սպասարկում", "զբոսավարի ծառայություններ", "մուտքի տոմսեր", "շշալցված ջուր", "24/7 աջակցություն"],
    excList: ["ավիատոմսեր", "բժշկական ապահովագրություն"]
  }
};

async function downloadImage(url, destPath) {
  if (!url || !url.trim()) return null;
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, { headers: { 'User-Agent': 'ExploreArmenia' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) { downloadImage(res.headers.location, destPath).then(resolve); return; }
      if (res.statusCode !== 200) { resolve(null); return; }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => resolve(destPath));
    });
    req.setTimeout(10000, () => { req.destroy(); resolve(null); });
  });
}

function createHeader(logoPath, t) {
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const logoCell = new TableCell({
    width: { size: 2200, type: WidthType.DXA }, shading: { fill: COLORS.blue }, borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
    children: [fs.existsSync(logoPath) ? new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'png', data: fs.readFileSync(logoPath), transformation: { width: 95, height: 68 } })] }) : new Paragraph({ children: [] })]
  });
  const titleCell = new TableCell({
    width: { size: CONTENT_W - 2200, type: WidthType.DXA }, shading: { fill: COLORS.blue }, borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t.title, color: COLORS.white, bold: true, size: 36, font: "Arial" })] })]
  });
  return new Header({ children: [new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, rows: [new TableRow({ children: [logoCell, titleCell] })] })] });
}

function createFooter(t) {
  return new Footer({
    children: [
      new Paragraph({ spacing: { before: 0, after: 40 }, border: { top: { style: BorderStyle.SINGLE, size: 6, color: COLORS.blue } }, children: [] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 40 }, children: [new TextRun({ text: t.slogan, color: COLORS.red, bold: true, size: 22, font: "Arial" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `(+374 91) 01 56 60 | info@explorearmenia.am | www.explorearmenia.am | ${t.footer} `, color: COLORS.lightGray, size: 15, font: "Arial" }), new TextRun({ children: [PageNumber.CURRENT], color: COLORS.lightGray, size: 15 })] })
    ]
  });
}

function buildTourInfoPage(meta, t) {
  const items = [new Paragraph({ spacing: { before: 200, after: 100 }, children: [] })];
  const lines = [
    [t.start, meta.start], [t.end, meta.end, 160], [t.fIn, meta.flight_in], [t.fOut, meta.flight_out],
    [t.guests, meta.guests, 160], [t.hotel, meta.hotel, 160, COLORS.red], [t.contact, meta.contact]
  ];
  lines.forEach(([label, val, afterSpace, valColor]) => {
    items.push(new Paragraph({
      spacing: { before: 60, after: afterSpace || 60 },
      children: [
        new TextRun({ text: `${label} `, bold: true, size: 24, font: "Arial" }),
        new TextRun({ text: val || "—", size: 24, font: "Arial", color: valColor || COLORS.black })
      ]
    }));
  });
  return items;
}

async function buildDayBlock(day, tempDir, t) {
  const elements = [];
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

  // Скачиваем 1 главное фото
  const photos = [];
  for (const place of day.places || []) {
    if (place.photo_main && photos.length < 1) {
      const fpath = path.join(tempDir, `photo_${day.day_number}_${Date.now()}.jpg`);
      if (await downloadImage(place.photo_main, fpath)) photos.push(fpath);
    }
  }

  const photoCellChildren = photos.length ? [new Paragraph({ children: [new ImageRun({ type: 'jpg', data: fs.readFileSync(photos[0]), transformation: { width: 195, height: 145 } })] })] : [new Paragraph({ children: [] })];

  const textCellChildren = [];

  // 1. Заголовок (День 1 (07.05, четверг))
  const dayTitle = `${t.day} ${day.day_number} (${day.date_str || ''})`;
  textCellChildren.push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: 20, after: 80 },
    children: [new TextRun({ text: dayTitle, color: COLORS.darkBlue, bold: true, size: 28, font: "Arial" })]
  }));

  // 2. Подзаголовок (Маршрут из промта)
  const cleanRawText = (day.raw_text || '').replace(/^(День|Day|Tag|Օր)\s*\d+\s*[-—–]+\s*/i, '').trim();
  textCellChildren.push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: 0, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.cyan } },
    children: [new TextRun({ text: cleanRawText, color: COLORS.cyan, bold: true, size: 24, font: "Arial" })]
  }));

  // 3. Строгое описание из БД
  for (const place of day.places || []) {
    const text = place.final_text || '';
    if (!text.trim()) continue;
    textCellChildren.push(new Paragraph({
      spacing: { before: 60, after: 60 },
      children: [new TextRun({ text: text, size: 20, font: "Arial", color: COLORS.black })]
    }));
  }

  const dayTable = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [COL_PHOTO, COL_TEXT],
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder },
    rows: [new TableRow({
      children: [
        new TableCell({ width: { size: COL_PHOTO, type: WidthType.DXA }, borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }, margins: { top: 80, right: 160 }, children: photoCellChildren }),
        new TableCell({ width: { size: COL_TEXT, type: WidthType.DXA }, borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }, children: textCellChildren })
      ]
    })]
  });

  elements.push(dayTable);
  elements.push(new Paragraph({ spacing: { before: 100, after: 100 }, border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" } }, children: [] }));
  return elements;
}

function buildCostBlock(t) {
  return [
    new Paragraph({ spacing: { before: 200, after: 80 }, children: [new TextRun({ text: t.incTitle, bold: true, size: 22, color: COLORS.cyan, font: "Arial" })] }),
    ...t.incList.map(item => new Paragraph({ spacing: { before: 40, after: 40 }, numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: item, size: 20, font: "Arial" })] })),
    new Paragraph({ spacing: { before: 160, after: 80 }, children: [new TextRun({ text: t.excTitle, bold: true, size: 22, color: COLORS.red, font: "Arial" })] }),
    ...t.excList.map(item => new Paragraph({ spacing: { before: 40, after: 40 }, numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: item, size: 20, font: "Arial" })] }))
  ];
}

async function buildDocument(inputJsonPath, outputDocxPath) {
  const raw = JSON.parse(fs.readFileSync(inputJsonPath, 'utf8'));
  const t = DICT[raw.lang] || DICT.ru;
  const tempDir = path.dirname(outputDocxPath);
  const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');

  const page1 = buildTourInfoPage(raw.meta, t);
  const dayBlocks = [];
  for (const day of raw.days) dayBlocks.push(...(await buildDayBlock(day, tempDir, t)));
  const costBlock = buildCostBlock(t);

  const doc = new Document({
    numbering: { config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 440, hanging: 260 } } } }] }] },
    styles: { default: { document: { run: { font: "Arial", size: 22 } } } },
    sections: [{
      properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN, header: 300, footer: 400 } } },
      headers: { default: createHeader(logoPath, t) },
      footers: { default: createFooter(t) },
      children: [...page1, new Paragraph({ children: [new PageBreak()] }), ...dayBlocks, ...costBlock]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputDocxPath, buffer);
}

const [, , inputPath, outputPath] = process.argv;
buildDocument(inputPath, outputPath).then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });