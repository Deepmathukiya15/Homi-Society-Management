const money = (value) => `INR ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateLabel = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const safePart = (value) => String(value || '').replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '');

const loadSocietyIcon = async () => {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}homi-icon.png`);
    if (!response.ok) return null;
    const objectUrl = URL.createObjectURL(await response.blob());
    try {
      const image = new Image();
      image.src = objectUrl;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const context = canvas.getContext('2d');
      if (!context) return null;
      // Preserve the supplied logo's aspect ratio while keeping a transparent square canvas.
      const scale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
      return canvas.toDataURL('image/png');
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
};

/** Generate a clean, printable A4 maintenance invoice with HOMI branding. */
export async function downloadInvoicePdf(bill) {
  const { jsPDF } = await import('jspdf');
  const societyIcon = await loadSocietyIcon();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const status = String(bill.status || 'PENDING').toUpperCase();
  const residentName = String(bill.residentName || bill.ownerName || `Resident of Flat ${bill.flatId || '—'}`);
  const invoiceId = String(bill.invoiceNumber || bill._id || 'HOMI-INVOICE').slice(-8).toUpperCase();

  doc.setProperties({
    title: `Maintenance Invoice ${invoiceId}`,
    subject: `HOMI maintenance invoice for Flat ${bill.flatId}`,
    author: 'HOMI Society Management',
    creator: 'HOMI Society Management',
  });

  // Brand header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 45, 'F');
  if (societyIcon) {
    doc.addImage(societyIcon, 'PNG', margin, 11, 19, 19);
  } else {
    doc.setFillColor(79, 70, 229);
    doc.roundedRect(margin, 11, 19, 19, 4, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('H', margin + 6.2, 23.5);
  }
  // High-contrast wordmark remains readable on the dark header when the SVG loads.
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.text('HOMI', margin + 25, 19);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text('Integrated Home & Community Management Solutions', margin + 25, 25);
  doc.text('Khodaldham Society | Ahmedabad, Gujarat', margin + 25, 31);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('MAINTENANCE INVOICE', pageWidth - margin, 17, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(`Invoice No. ${invoiceId}`, pageWidth - margin, 24, { align: 'right' });
  doc.text(`${bill.month || ''} ${bill.year || ''}`.trim(), pageWidth - margin, 30, { align: 'right' });

  // Status chip
  const statusColor = status === 'PAID' ? [5, 150, 105] : status === 'OVERDUE' ? [225, 29, 72] : [217, 119, 6];
  doc.setFillColor(...statusColor);
  doc.roundedRect(pageWidth - margin - 31, 34, 31, 7, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(status === 'PENDING' ? 'UNPAID' : status, pageWidth - margin - 15.5, 38.7, { align: 'center' });

  // Bill-to and invoice details cards
  const cardY = 55;
  const cardGap = 6;
  const cardWidth = (contentWidth - cardGap) / 2;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, cardY, cardWidth, 36, 3, 3, 'FD');
  doc.roundedRect(margin + cardWidth + cardGap, cardY, cardWidth, 36, 3, 3, 'FD');

  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('RESIDENT NAME', margin + 5, cardY + 7);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(doc.splitTextToSize(residentName, cardWidth - 10).slice(0, 2), margin + 5, cardY + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Flat ${bill.flatId || '—'}`, margin + 5, cardY + 27);

  const detailX = margin + cardWidth + cardGap + 5;
  const detailRight = pageWidth - margin - 5;
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('INVOICE DETAILS', detailX, cardY + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Billing period', detailX, cardY + 15);
  doc.text(`${bill.month || ''} ${bill.year || ''}`.trim(), detailRight, cardY + 15, { align: 'right' });
  doc.text('Issue date', detailX, cardY + 22);
  doc.text(dateLabel(bill.createdAt || new Date()), detailRight, cardY + 22, { align: 'right' });
  doc.text('Due date', detailX, cardY + 29);
  doc.text(dateLabel(bill.dueDate), detailRight, cardY + 29, { align: 'right' });

  // Itemized charges table
  const tableY = 103;
  const descX = margin + 5;
  const amountX = pageWidth - margin - 5;
  const rowHeight = 11;
  const base = Number(bill.baseMaintenance || 0);
  const parking = Number(bill.parkingCharge || 0);
  const water = Number(bill.waterCharge || 0);
  const security = Number(bill.securityCharge || 0);
  const total = Number(bill.amount || 0);
  const adjustment = total - base - parking - water - security;
  const rows = [
    ['Base maintenance', base],
    ['Parking charge', parking],
    ['Water charge', water],
    ['Security charge', security],
  ];
  if (Math.abs(adjustment) >= 0.01) rows.push([adjustment >= 0 ? 'Other charges / adjustment' : 'Adjustment', adjustment]);

  doc.setFillColor(238, 242, 255);
  doc.roundedRect(margin, tableY, contentWidth, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(67, 56, 202);
  doc.text('DESCRIPTION', descX, tableY + 6.5);
  doc.text('AMOUNT', amountX, tableY + 6.5, { align: 'right' });

  let rowY = tableY + 10;
  rows.forEach(([label, value], index) => {
    if (index % 2 === 0) {
      doc.setFillColor(250, 251, 255);
      doc.rect(margin, rowY, contentWidth, rowHeight, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(label, descX, rowY + 7);
    doc.text(money(value), amountX, rowY + 7, { align: 'right' });
    rowY += rowHeight;
  });
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, rowY, pageWidth - margin, rowY);

  // Grand total
  rowY += 4;
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, rowY, contentWidth, 17, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL PAYABLE', margin + 5, rowY + 10.5);
  doc.setFontSize(13);
  doc.text(money(total), pageWidth - margin - 5, rowY + 10.5, { align: 'right' });
  rowY += 25;

  // Payment record / next steps
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('PAYMENT RECORD', margin, rowY);
  rowY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  if (status === 'PAID') {
    doc.text(`Payment method: ${bill.paymentMode || '—'}`, margin, rowY);
    doc.text(`Paid on: ${dateLabel(bill.paidAt)}`, margin + 75, rowY);
    rowY += 6;
    doc.text(`Transaction reference: ${bill.paymentTxnid || '—'}`, margin, rowY);
  } else {
    doc.text('Payment status: Payment is due by the due date shown above.', margin, rowY);
    rowY += 6;
    doc.text('Please pay through the resident portal or contact the society office.', margin, rowY);
  }

  // Footer
  const footerY = 276;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY, pageWidth - margin, footerY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Computer-generated maintenance invoice. Please retain this document for your records.', margin, footerY + 6);
  doc.text('HOMI Society Management', pageWidth - margin, footerY + 6, { align: 'right' });

  const filename = `HOMI-Invoice-${safePart(bill.flatId)}-${safePart(bill.month)}-${safePart(bill.year)}.pdf`;
  doc.save(filename);
}
