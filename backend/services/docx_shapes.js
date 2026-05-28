const { ImportedXmlComponent } = require('docx');

// Вспомогательная функция для генерации плавающей фигуры
function createVmlShape(type, wCm, hCm, colorHex, topCm = 0, leftCm = 0, zIndex = -1) {
    // type: 'rect' (прямоугольник) или 'oval' (круг/овал)
    return new ImportedXmlComponent(`
        <w:p>
            <w:r>
                <w:pict>
                    <v:${type} 
                        style="position:absolute;margin-left:${leftCm}cm;margin-top:${topCm}cm;width:${wCm}cm;height:${hCm}cm;z-index:${zIndex}" 
                        fillcolor="${colorHex}" 
                        stroked="f" 
                    />
                </w:pict>
            </w:r>
        </w:p>
    `);
}

module.exports = {
    createVmlRectangle: (w, h, c, top, left, z) => createVmlShape('rect', w, h, c, top, left, z),
    createVmlCircle: (d, c, top, left, z) => createVmlShape('oval', d, d, c, top, left, z)
};