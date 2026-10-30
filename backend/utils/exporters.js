// Turns report columns and rows into a PDF or Excel download.
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const text = (value) => (value === null || value === undefined ? '' : String(value));

async function sendExcel(res, { title, columns, rows }) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet(title.slice(0, 31));
  sheet.columns = columns.map((c) => ({ header: c.label, key: c.key, width: Math.max(c.label.length + 4, 16) }));
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/\s+/g, '-').toLowerCase()}.xlsx"`);
  await book.xlsx.write(res);
  res.end();
}

function sendPdf(res, { title, columns, rows }) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/\s+/g, '-').toLowerCase()}.pdf"`);
  doc.pipe(res);

  doc.fontSize(16).font('Helvetica-Bold').text(title);
  doc.fontSize(9).font('Helvetica').text(`Generated ${new Date().toLocaleString('en-IN')}  |  ${rows.length} record(s)`);
  doc.moveDown();

  const left = doc.page.margins.left;
  const width = (doc.page.width - left - doc.page.margins.right) / columns.length;
  const drawRow = (values, bold) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
    const height = Math.max(...values.map((v) => doc.heightOfString(v, { width: width - 6 }))) + 6;
    if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
    const top = doc.y;
    values.forEach((v, i) => doc.text(v, left + i * width + 3, top + 3, { width: width - 6 }));
    doc.moveTo(left, top + height).lineTo(doc.page.width - doc.page.margins.right, top + height)
      .strokeColor('#d0d5dd').stroke();
    doc.x = left;
    doc.y = top + height;
  };

  drawRow(columns.map((c) => c.label), true);
  rows.forEach((row) => drawRow(columns.map((c) => text(row[c.key])), false));
  doc.end();
}

module.exports = { sendExcel, sendPdf };
