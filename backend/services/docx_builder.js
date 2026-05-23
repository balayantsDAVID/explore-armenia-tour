const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, BorderStyle, WidthType
} = require('docx');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const COLORS = { red: "CC0000", cyan: "009DC4", black: "000000", gray: "555555" };
const FONT = "Arial"; // Заменим, когда скажете точное название

const DICT = {
  ru: {
    day: "День", title: "ПРОГРАММА ТУРА ПО АРМЕНИИ", slogan: "Армения - страна, в которую можно влюбиться!",
    start: "Дата начала тура:", end: "Дата окончания тура:", fIn: "Рейс прилета:", fOut: "Рейс вылета:",
    guests: "Количество участников:", hotel: "Отель:", contact: "Контактное лицо:",
    incTitle: "Стоимость тура включает:", excTitle: "Стоимость тура не включает:"
  }
};

async function downloadImage(url, destPath) {
  if (!url || !url.trim()) return null;
  return new Promise((resolve) => {
    const req = (url.startsWith('https') ? https : http).get(url, (res) => {
      if (res.statusCode !== 200) { resolve(null); return; }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => resolve(destPath));
    });
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
  });
}

function createHeader(t) {
  const headerItems = [];

  // TODO: Если нужен логотип картинкой, раскомментируйте код ниже и укажите правильный путь

  if (fs.existsSync('logo.png')) {
    headerItems.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new ImageRun({ type: 'png', data: fs.readFileSync('logo.png'), transformation: { width: 200, height: 60 } })]
    }));
  }

  headerItems.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: t.title, bold: true, size: 36, font: FONT, color: COLORS.cyan })] // 36 = 18pt
    })
  );

  return new Header({ children: headerItems });
}

function createFooter(t) {
  return new Footer({
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t.slogan, color: COLORS.red, bold: true, size: 24, font: FONT })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "(+374 91) 01 56 60 (Viber, WhatsApp) | info@explorearmenia.am", color: COLORS.gray, size: 18, font: FONT })] })
    ]
  });
}

async function buildDocument(inputJsonPath, outputDocxPath) {
  const raw = JSON.parse(fs.readFileSync(inputJsonPath, 'utf8'));
  const t = DICT[raw.lang] || DICT.ru;
  const tempDir = path.dirname(outputDocxPath);
  const docContent = [];

  // 1. Метаданные (Размер шрифта 24 = 12pt)
  const lines = [
    [t.start, raw.meta.start], [t.end, raw.meta.end], [t.fIn, raw.meta.flight_in], [t.fOut, raw.meta.flight_out],
    [t.guests, raw.meta.guests], [t.hotel, raw.meta.hotel], [t.contact, raw.meta.contact]
  ];
  lines.forEach(([label, val]) => {
    docContent.push(new Paragraph({
      spacing: { after: 100 },
      children: [new TextRun({ text: `${label} `, bold: true, size: 24, font: FONT }), new TextRun({ text: val || "—", size: 24, font: FONT })]
    }));
  });

  docContent.push(new Paragraph({ spacing: { after: 400 }, children: [] })); // Отступ вместо разрыва страницы

  // 2. Дни тура
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  for (const day of raw.days || []) {
    const photoParagraphs = [];
    let photoCount = 0;
    for (const place of day.places || []) {
      if (place.photo_main && photoCount < 3) {
        const fpath = path.join(tempDir, `photo_${Date.now()}.jpg`);
        if (await downloadImage(place.photo_main, fpath)) {
          photoParagraphs.push(new Paragraph({ spacing: { after: 120 }, children: [new ImageRun({ type: 'jpg', data: fs.readFileSync(fpath), transformation: { width: 220, height: 150 } })] }));
          photoCount++;
        }
      }
    }
    if (photoParagraphs.length === 0) photoParagraphs.push(new Paragraph({ text: " " }));
    const leftCell = new TableCell({ width: { size: 3000, type: WidthType.DXA }, borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }, children: photoParagraphs, margins: { right: 200 } });

    const textParagraphs = [];
    const dayTitle = `${t.day} ${day.day_number} (${day.date_str || ''})`;
    textParagraphs.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: dayTitle, color: COLORS.cyan, bold: true, size: 32, font: FONT })] })); // 16pt

    const cleanRawText = (day.raw_text || '').replace(/^(День|Day|Tag|Օր)\s*\d+\s*[-—–]+\s*/i, '').trim();
    textParagraphs.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: cleanRawText, bold: true, size: 24, font: FONT })] })); // 12pt

    for (const place of day.places || []) {
      const text = place.final_text || '';
      if (!text.trim()) continue;
      textParagraphs.push(new Paragraph({
        spacing: { after: 120 }, alignment: AlignmentType.JUSTIFIED,
        children: [new TextRun({ text: `• ${text}`, size: 24, font: FONT })] // 12pt
      }));
    }
    const rightCell = new TableCell({ width: { size: 7000, type: WidthType.DXA }, borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }, children: textParagraphs });

    docContent.push(new Table({
      width: { size: 10000, type: WidthType.DXA },
      borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder },
      rows: [new TableRow({ children: [leftCell, rightCell] })]
    }));
    docContent.push(new Paragraph({ spacing: { before: 200, after: 200 }, children: [] }));
  }

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } },
      headers: { default: createHeader(t) },
      footers: { default: createFooter(t) },
      children: docContent
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputDocxPath, buffer);
}

const [, , inputPath, outputPath] = process.argv;
buildDocument(inputPath, outputPath).then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });