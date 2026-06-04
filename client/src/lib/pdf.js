import { formatEAT } from './datetime';

// jsPDF + autotable are heavy; load them on demand (only when exporting).

// SwahiliPot brand colours
const BRAND = [30, 64, 175];
const INK = [55, 65, 81];
const MUTED = [107, 114, 128];
const ZEBRA = [248, 250, 255];

const LOGO_RATIO = 503 / 2971; // height / width of sph-logo.png

let logoPromise;
function loadLogo() {
  if (!logoPromise) {
    logoPromise = fetch('/sph-logo.png')
      .then((r) => r.blob())
      .then(
        (b) =>
          new Promise((resolve) => {
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result);
            fr.onerror = () => resolve(null);
            fr.readAsDataURL(b);
          })
      )
      .catch(() => null);
  }
  return logoPromise;
}

/**
 * Export a branded PDF (SwahiliPot logo header, title, metadata, EAT
 * timestamp, and a styled data table).
 *
 *   exportTablePdf({ title, subtitle, meta: ['Department: Tech'],
 *     columns: ['Name', 'Phone'], rows: [['Ali','07..'], ...], filename })
 */
export async function exportTablePdf({ title, subtitle, meta = [], columns, rows, filename }) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const landscape = columns.length > 5;
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  const logo = await loadLogo();
  if (logo) {
    try {
      const w = 130;
      doc.addImage(logo, 'PNG', 40, 30, w, w * LOGO_RATIO);
    } catch {
      /* ignore bad image */
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...BRAND);
  doc.text('Swahilipot Hub Foundation', pageW - 40, 44, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text('Internal Management System', pageW - 40, 58, { align: 'right' });

  let y = 92;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...INK);
  doc.text(title, 40, y);
  y += 16;

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text(subtitle, 40, y);
    y += 14;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  meta.filter(Boolean).forEach((line) => {
    doc.text(String(line), 40, y);
    y += 12;
  });

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated ${formatEAT(new Date())} EAT`, 40, y);
  y += 6;

  autoTable(doc, {
    startY: y + 8,
    head: [columns],
    body: rows.length ? rows : [columns.map(() => '—')],
    styles: { fontSize: 9, cellPadding: 5, textColor: INK, lineColor: [226, 232, 240], lineWidth: 0.5 },
    headStyles: { fillColor: BRAND, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: ZEBRA },
    margin: { left: 40, right: 40 },
    didDrawPage: () => {
      const ph = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('Swahilipot Hub Foundation · swahilipothub.co.ke', 40, ph - 20);
      doc.text(`Page ${doc.internal.getNumberOfPages()}`, pageW - 40, ph - 20, { align: 'right' });
    },
  });

  const safe = (filename || title || 'export').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
  doc.save(`${safe}.pdf`);
}
