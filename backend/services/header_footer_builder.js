const { Header, Footer, Paragraph, TextRun, AlignmentType, ImageRun } = require('docx');
const fs = require('fs');
const path = require('path');
const { createVmlRectangle, createVmlCircle } = require('./docx_shapes.js');

const PAGE_W_CM = 21.06;

function createHeader(t, logoPath, daysNights) {
    const logoExists = fs.existsSync(logoPath);
    const headerChildren = [];

    // 1. Светло-голубой фон (на всю ширину)
    headerChildren.push(createVmlRectangle(PAGE_W_CM, 3.48, '#deebf7', 0, 0, -3));

    // 2. Синяя полоса для текста (на всю ширину)
    headerChildren.push(createVmlRectangle(PAGE_W_CM, 2.51, '#36c6f5', 0.97, 0, -2)); // Сдвиг вниз, чтобы оставить #deebf7 сверху

    // 3. Белый круг для логотипа (слева)
    headerChildren.push(createVmlCircle(3.35, '#ffffff', 0.06, 0.25, -1));

    // 4. Само лого (плавающее изображение поверх круга)
    if (logoExists) {
        headerChildren.push(new Paragraph({
            children: [
                new ImageRun({
                    data: fs.readFileSync(logoPath),
                    transformation: { width: 95, height: 95 }, // 3.35cm
                    floating: {
                        horizontalPosition: { offset: 360000 * 0.25 }, // 0.25cm в EMU
                        verticalPosition: { offset: 360000 * 0.06 },   // 0.06cm в EMU
                        wrap: { type: "none" }
                    }
                })
            ]
        }));
    }

    // 5. Текст (Заголовок программы) поверх синего фона
    headerChildren.push(new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 500 }, // Отступ сверху, чтобы текст попал ровно на синюю полосу
        children: [
            new TextRun({ text: t.title, bold: true, size: 52, font: 'Cambria', color: 'FFFFFF' }),
        ]
    }));

    // 6. Текст (Дни/Ночи)
    headerChildren.push(new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 40 },
        children: [
            new TextRun({ text: daysNights, bold: true, size: 44, font: 'Cambria', color: 'FFFFFF' })
        ]
    }));

    return new Header({ children: headerChildren });
}

function createFooter(t) {
    const footerChildren = [];

    // 1. Фон футера
    footerChildren.push(createVmlRectangle(PAGE_W_CM, 2.49, '#deebf7', 0, 0, -1));

    // 2. Текст (Слоган красным)
    footerChildren.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 40 },
        children: [
            new TextRun({ text: t.slogan, bold: true, size: 36, font: 'Cambria', color: 'c10000' })
        ]
    }));

    // 3. Текст (Контакты бордовым, номер страницы убрали)
    footerChildren.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0 },
        children: [
            new TextRun({ text: t.contacts, size: 20, font: 'Cambria', color: '800000' })
        ]
    }));

    return new Footer({ children: footerChildren });
}

module.exports = { createHeader, createFooter };