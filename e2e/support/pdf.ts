/**
 * PDF minimal (une ligne de texte Helvetica par page, ASCII) pour les parcours e2e de la visionneuse : la table
 * des références croisées est calculée pour que pdf.js l'ouvre sans reconstruction.
 */
export function textPdf(pages: string[]): Buffer {
	const objects: string[] = [];
	const pageIds = pages.map((_, i) => 4 + i * 2);
	objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
	objects[2] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
	objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
	pages.forEach((text, i) => {
		const pageId = pageIds[i];
		const stream = `BT /F1 14 Tf 72 720 Td (${text.replace(/[\\()]/g, char => `\\${char}`)}) Tj ET`;
		objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageId + 1} 0 R >>`;
		objects[pageId + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
	});

	let pdf = '%PDF-1.4\n';
	const offsets: number[] = [];
	for (let id = 1; id < objects.length; id++) {
		offsets[id] = pdf.length;
		pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
	}
	const xref = pdf.length;
	pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
	for (let id = 1; id < objects.length; id++) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
	pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
	return Buffer.from(pdf, 'latin1');
}
