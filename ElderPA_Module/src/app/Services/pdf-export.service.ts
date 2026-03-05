import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface FormSubmissionData {
  templateName: string;
  submittedAt: Date;
  submittedBy?: string;
  formData: Record<string, any>;
  fields: any[]; // Your AuditField[]
}

@Injectable({
  providedIn: 'root'
})
export class PdfExportService {

  /**
   * Export form submission to PDF
   */
  /**
   * Export form submission to PDF
   */
  exportFormToPdf(data: FormSubmissionData): void {
    const doc = new jsPDF();
    let yPosition = 20;

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(data.templateName, 14, yPosition);
    yPosition += 10;

    // Metadata
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Submitted: ${new Date(data.submittedAt).toLocaleString()}`, 14, yPosition);
    yPosition += 6;
    if (data.submittedBy) {
      doc.text(`By: ${data.submittedBy}`, 14, yPosition);
      yPosition += 6;
    }

    doc.setTextColor(0);
    yPosition += 10;

    // ✅ Filter out sections and process only data fields
    const dataFields = data.fields.filter(f => f.type !== 'section');

    dataFields.forEach((field) => {
      const value = data.formData[field.id];

      // ✅ Skip fields with no value
      if (value === undefined || value === null || value === '') {
        return;
      }

      // Check if we need a new page
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }

      // Field label
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(field.label || 'Untitled Field', 14, yPosition);
      yPosition += 6;

      // Field value based on type
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      try {
        switch (field.type) {
          case 'text':
          case 'number':
          case 'date':
            const textValue = value.toString() || '-';
            const lines = doc.splitTextToSize(textValue, 180);
            doc.text(lines, 14, yPosition);
            yPosition += lines.length * 5 + 5;
            break;

          case 'textarea': {
            const textareaValue = value.toString() || '-';
            const textareaLines = doc.splitTextToSize(textareaValue, 180);
            const lineHeight = 5;

            textareaLines.forEach((line: string) => {
              // If we're too close to the bottom, add a page
              if (yPosition > 270) {
                doc.addPage();
                yPosition = 20;
              }
              doc.text(line, 14, yPosition);
              yPosition += lineHeight;
            });

            yPosition += 8; // extra gap after the block
            break;
          }

          case 'checkbox': {
            const options: string[] = field.options || [];
            const lineHeight = 5;

            if (Array.isArray(value)) {
              // value is string[] of selected options
              const selectedOptions = value as string[];

              options.forEach((opt: string) => {
                if (yPosition > 270) {
                  doc.addPage();
                  yPosition = 20;
                }
                const checked = selectedOptions.includes(opt);
                const mark = checked ? '☑' : '☐';
                doc.text(`${mark} ${opt}`, 14, yPosition);
                yPosition += lineHeight;
              });
            } else {
              // Fallback: single boolean, no options
              const mark = value ? '☑ Yes' : '☐ No';
              doc.text(mark, 14, yPosition);
              yPosition += 8;
            }

            yPosition += 5;
            break;
          }

          case 'radio': {
            const options: string[] = field.options || [];
            const selected = value?.toString() ?? '';
            const lineHeight = 5;

            options.forEach((opt: string) => {
              if (yPosition > 270) {
                doc.addPage();
                yPosition = 20;
              }
              const mark = opt === selected ? '◉' : '○';
              doc.text(`${mark} ${opt}`, 14, yPosition);
              yPosition += lineHeight;
            });

            yPosition += 5;
            break;
          }
          case 'select':{
            const options: string[] = field.options || [];
            const selected = value?.toString() ?? '';
            const lineHeight = 5;

            options.forEach((opt: string) => {
              if (yPosition > 270) {
                doc.addPage();
                yPosition = 20;
              }
              const mark = opt === selected ? '▶' : '•';
              doc.text(`${mark} ${opt}`, 14, yPosition);
              yPosition += lineHeight;
            });

            yPosition += 5;
            break;
          }

          case 'table':
            if (Array.isArray(value) && value.length > 0) {
              const headers = field.tableConfig?.headers || [];
              const tableData = value.map((row: any) =>
                headers.map((header: string) => {
                  const cellValue = row[header];
                  // ✅ Handle different cell types
                  if (typeof cellValue === 'boolean') {
                    return cellValue ? '✓' : '✗';
                  }
                  return cellValue !== undefined && cellValue !== null ? cellValue.toString() : '';
                })
              );

              autoTable(doc, {
                startY: yPosition,
                head: [headers],
                body: tableData,
                theme: 'grid',
                styles: { fontSize: 9, cellPadding: 2 },
                headStyles: { fillColor: [63, 81, 181], fontStyle: 'bold' },
                margin: { left: 14, right: 14 }
              });

              yPosition = (doc as any).lastAutoTable.finalY + 10;
            } else {
              doc.text('No data', 14, yPosition);
              yPosition += 8;
            }
            break;

          case 'question':
            if (value && typeof value === 'object') {
              doc.text(`Score: ${value.score !== undefined ? value.score : 'N/A'} / 5`, 14, yPosition);
              yPosition += 6;

              if (value.evidence) {
                const evidenceLines = doc.splitTextToSize(`Evidence: ${value.evidence}`, 180);
                doc.text(evidenceLines, 14, yPosition);
                yPosition += evidenceLines.length * 5 + 3;
              }

              if (value.actionRequired) {
                const actionLines = doc.splitTextToSize(`Action: ${value.actionRequired}`, 180);
                doc.text(actionLines, 14, yPosition);
                yPosition += actionLines.length * 5 + 3;
              }

              yPosition += 5;
            }
            break;

          default:{
            const defaultValue = typeof value === 'object' ? JSON.stringify(value) : value.toString();
            const defaultLines = doc.splitTextToSize(defaultValue, 180);
            const lineHeight = 5;

            defaultLines.forEach((line: string) => {
              if (yPosition > 270) {
                doc.addPage();
                yPosition = 20;
              }
              doc.text(line, 14, yPosition);
              yPosition += lineHeight;
            });

            yPosition += 8;
            break;
          }
        }
      } catch (error) {
        console.error(`Error rendering field ${field.id}:`, error);
        doc.setTextColor(255, 0, 0);
        doc.text(`[Error rendering ${field.type} field]`, 14, yPosition);
        doc.setTextColor(0);
        yPosition += 8;
      }

      yPosition += 5; // Gap between fields
    });

    // Save PDF
    const fileName = `${data.templateName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
    doc.save(fileName);
  }


  /**
   * Export multiple submissions to single PDF
   */
  exportMultipleSubmissionsToPdf(submissions: FormSubmissionData[]): void {
    const doc = new jsPDF();

    submissions.forEach((submission, index) => {
      if (index > 0) {
        doc.addPage();
      }

      let yPosition = 20;

      // Title page for each submission
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(`Submission ${index + 1}: ${submission.templateName}`, 14, yPosition);
      yPosition += 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Submitted: ${new Date(submission.submittedAt).toLocaleString()}`, 14, yPosition);
      yPosition += 15;

      // Add form data (simplified for multiple submissions)
      submission.fields.forEach((field) => {
        const value = submission.formData[field.id];

        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`${field.label}:`, 14, yPosition);

        doc.setFont('helvetica', 'normal');
        const displayValue = this.formatValueForPdf(value, field.type);
        doc.text(displayValue, 14, yPosition + 5);

        yPosition += 12;
      });
    });

    doc.save(`Multiple_Submissions_${Date.now()}.pdf`);
  }

  /**
   * Helper to format values for PDF display
   */
  private formatValueForPdf(value: any, fieldType: string): string {
    if (!value) return '-';

    if (fieldType === 'table' && Array.isArray(value)) {
      return `[${value.length} rows]`;
    }

    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }

    return value.toString();
  }
}
