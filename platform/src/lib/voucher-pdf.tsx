import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { PDFDocument } from "pdf-lib";
import { REQUEST_TYPE_LABELS, MINISTRY_TYPE_LABELS } from "@/lib/request-types";
import { APPROVER_ROLE_LABELS } from "@/lib/approval-routing";
import type { ApprovedRequestDetail } from "@/lib/request-data";

// The official Finance-facing document for an approved request -- once
// Finance no longer logs into the app, this PDF (not the email body, not a
// link) is the artifact Finance actually acts on to process payment. Layout
// mirrors the Track A pilot's voucher (mvp/reimbursement-voucher/js/app.js's
// downloadWord/downloadPDF): header, line items + total, bank details,
// approval summary. @react-pdf/renderer has no real HTML <table> -- rows
// below are plain flexbox Views styled to look like one.
//
// Receipts are embedded INTO this same PDF, not just left as separate email
// attachments -- Finance's official document should be openable on its own
// and show everything. @react-pdf/renderer can only render its own JSX tree
// (it has no way to ingest an existing PDF's pages), so the two receipt
// formats are handled differently: JPEG/PNG receipts become extra <Page>s
// rendered by react-pdf itself (via its Buffer-accepting Image source,
// confirmed against @react-pdf/types/image.d.ts's SourceDataBuffer type);
// PDF-format receipts have their actual pages copied in afterwards with
// pdf-lib, since that's real page-merging, not something react-pdf does.
// HEIC receipts can't be embedded by either (no HEIC decoder here, same
// limitation the Vision OCR feature already accepts) -- they're listed by
// name on the voucher page as a pointer to the separate raw attachment,
// which the caller (notifications.ts) still includes either way.

export interface ReceiptImageInput {
  filename: string;
  buffer: Buffer;
  format: "jpg" | "png";
}

export interface ReceiptPdfInput {
  filename: string;
  buffer: Buffer;
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 16, marginBottom: 4 },
  voucherNo: { fontSize: 11, color: "#444444", marginBottom: 16 },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    textTransform: "uppercase",
    color: "#333333",
  },
  headerGrid: { flexDirection: "row", flexWrap: "wrap" },
  headerField: { width: "50%", marginBottom: 6 },
  fieldLabel: { color: "#666666", fontSize: 9 },
  fieldValue: { fontSize: 10 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#dddddd",
    paddingVertical: 4,
  },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
    paddingBottom: 4,
    marginBottom: 2,
  },
  headerCell: { fontFamily: "Helvetica-Bold", fontSize: 9 },
  descCell: { flex: 3 },
  amountCell: { flex: 1, textAlign: "right" },
  roleCell: { flex: 2 },
  nameCell: { flex: 2 },
  dateCell: { flex: 2, textAlign: "right" },
  totalRow: { flexDirection: "row", paddingTop: 6 },
  totalLabel: { flex: 3, fontFamily: "Helvetica-Bold", textAlign: "right", paddingRight: 8 },
  totalValue: { flex: 1, fontFamily: "Helvetica-Bold", textAlign: "right" },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#999999" },
  receiptPage: { padding: 32, alignItems: "center" },
  receiptCaption: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 12 },
  receiptImage: { maxWidth: 500, maxHeight: 700 },
  unembeddedItem: { fontSize: 10, marginBottom: 2 },
});

function formatDecidedAt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function VoucherDocument({
  detail,
  receiptImages,
  unembeddableReceiptFilenames,
}: {
  detail: ApprovedRequestDetail;
  receiptImages: ReceiptImageInput[];
  unembeddableReceiptFilenames: string[];
}) {
  const generatedAt = new Date().toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Approved Reimbursement Voucher</Text>
        <Text style={styles.voucherNo}>{detail.voucherNo}</Text>

        <View style={styles.section}>
          <View style={styles.headerGrid}>
            <View style={styles.headerField}>
              <Text style={styles.fieldLabel}>Request Type</Text>
              <Text style={styles.fieldValue}>{REQUEST_TYPE_LABELS[detail.requestType]}</Text>
            </View>
            <View style={styles.headerField}>
              <Text style={styles.fieldLabel}>Ministry</Text>
              <Text style={styles.fieldValue}>{MINISTRY_TYPE_LABELS[detail.ministryType]}</Text>
            </View>
            <View style={styles.headerField}>
              <Text style={styles.fieldLabel}>Approval Tier</Text>
              <Text style={styles.fieldValue}>Tier {detail.tier}</Text>
            </View>
            <View style={styles.headerField}>
              <Text style={styles.fieldLabel}>Total Amount</Text>
              <Text style={styles.fieldValue}>${detail.totalAmount}</Text>
            </View>
            <View style={styles.headerField}>
              <Text style={styles.fieldLabel}>Requisitioned By</Text>
              <Text style={styles.fieldValue}>{detail.requesterName}</Text>
            </View>
            <View style={styles.headerField}>
              <Text style={styles.fieldLabel}>Requester Email</Text>
              <Text style={styles.fieldValue}>{detail.requesterEmail}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Line Items</Text>
          <View style={styles.headerRow}>
            <Text style={[styles.headerCell, styles.descCell]}>Description</Text>
            <Text style={[styles.headerCell, styles.amountCell]}>Amount</Text>
          </View>
          {detail.lineItems.map((li, i) => (
            <View style={styles.row} key={i}>
              <Text style={styles.descCell}>{li.description}</Text>
              <Text style={styles.amountCell}>${li.amount}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${detail.totalAmount}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bank Details for Payment</Text>
          <View style={styles.headerGrid}>
            <View style={styles.headerField}>
              <Text style={styles.fieldLabel}>Account Name</Text>
              <Text style={styles.fieldValue}>{detail.bankDetails.accountName}</Text>
            </View>
            <View style={styles.headerField}>
              <Text style={styles.fieldLabel}>BSB</Text>
              <Text style={styles.fieldValue}>{detail.bankDetails.bsb}</Text>
            </View>
            <View style={styles.headerField}>
              <Text style={styles.fieldLabel}>Account Number</Text>
              <Text style={styles.fieldValue}>{detail.bankDetails.accountNumber}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Approval Summary</Text>
          <View style={styles.headerRow}>
            <Text style={[styles.headerCell, styles.roleCell]}>Role</Text>
            <Text style={[styles.headerCell, styles.nameCell]}>Approver</Text>
            <Text style={[styles.headerCell, styles.dateCell]}>Decided</Text>
          </View>
          {detail.approvals.map((a, i) => (
            <View style={styles.row} key={i}>
              <Text style={styles.roleCell}>{APPROVER_ROLE_LABELS[a.role]}</Text>
              <Text style={styles.nameCell}>{a.approverName ?? "—"}</Text>
              <Text style={styles.dateCell}>{formatDecidedAt(a.decidedAt)}</Text>
            </View>
          ))}
        </View>

        {unembeddableReceiptFilenames.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Receipts (attached separately to this email)</Text>
            {unembeddableReceiptFilenames.map((filename, i) => (
              <Text style={styles.unembeddedItem} key={i}>
                {filename}
              </Text>
            ))}
          </View>
        )}

        <Text style={styles.footer}>Generated {generatedAt}</Text>
      </Page>

      {receiptImages.map((receipt, i) => (
        <Page key={i} size="A4" style={styles.receiptPage}>
          <Text style={styles.receiptCaption}>Receipt — {receipt.filename}</Text>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- this is @react-pdf/renderer's PDF-drawing Image, not an HTML <img>; it has no alt prop */}
          <Image src={{ data: receipt.buffer, format: receipt.format }} style={styles.receiptImage} />
        </Page>
      ))}
    </Document>
  );
}

// Buffer -> "jpg" | "png" | "pdf" | null (null = can't be embedded, e.g.
// HEIC). Based on the receipt's stored content type, not its filename.
function classifyReceiptFormat(contentType: string): "jpg" | "png" | "pdf" | null {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  if (contentType === "application/pdf") return "pdf";
  return null;
}

export interface RenderedVoucherPdf {
  buffer: Buffer;
  // Receipts that couldn't be embedded (e.g. HEIC) -- the caller still needs
  // to attach these separately, since the PDF's own "Additional Receipts"
  // section only lists their names, it doesn't carry the file itself.
  unembeddableReceiptFilenames: string[];
}

export async function renderVoucherPdf(
  detail: ApprovedRequestDetail,
  receiptFiles: { filename: string; buffer: Buffer; contentType: string }[],
): Promise<RenderedVoucherPdf> {
  const receiptImages: ReceiptImageInput[] = [];
  const receiptPdfs: ReceiptPdfInput[] = [];
  const unembeddableReceiptFilenames: string[] = [];

  for (const file of receiptFiles) {
    const format = classifyReceiptFormat(file.contentType);
    if (format === "jpg" || format === "png") {
      receiptImages.push({ filename: file.filename, buffer: file.buffer, format });
    } else if (format === "pdf") {
      receiptPdfs.push({ filename: file.filename, buffer: file.buffer });
    } else {
      unembeddableReceiptFilenames.push(file.filename);
    }
  }

  const baseBuffer = await renderToBuffer(
    <VoucherDocument
      detail={detail}
      receiptImages={receiptImages}
      unembeddableReceiptFilenames={unembeddableReceiptFilenames}
    />,
  );

  if (receiptPdfs.length === 0) {
    return { buffer: baseBuffer, unembeddableReceiptFilenames };
  }

  // Merge each PDF-format receipt's actual pages in after the voucher's own
  // pages -- react-pdf can't ingest existing PDF content, so this step uses
  // pdf-lib instead, only for the receipts that need it.
  const mergedDoc = await PDFDocument.load(baseBuffer);
  for (const receipt of receiptPdfs) {
    const receiptDoc = await PDFDocument.load(receipt.buffer);
    const copiedPages = await mergedDoc.copyPages(receiptDoc, receiptDoc.getPageIndices());
    copiedPages.forEach((page) => mergedDoc.addPage(page));
  }
  return { buffer: Buffer.from(await mergedDoc.save()), unembeddableReceiptFilenames };
}
