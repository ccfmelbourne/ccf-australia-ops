import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { PDFDocument } from "pdf-lib";
import { REQUEST_TYPES, REQUEST_TYPE_LABELS, MINISTRY_TYPE_LABELS } from "@/lib/request-types";
import { getApproverRoleLabel } from "@/lib/approval-routing";
import type { ApproverRoleValue } from "@/lib/approval-routing";
import type { ApprovedRequestDetail, ApproverDirectory } from "@/lib/request-data";

// The official Finance-facing document for an approved request -- once
// Finance no longer logs into the app, this PDF (not the email body, not a
// link) is the artifact Finance actually acts on to process payment. Layout
// deliberately mirrors CCF Australia's actual paper voucher (shared by the
// decision-maker as CCOMMS-Reibursement_June292026_signed.pdf), not just the
// Track A pilot's simplified HTML version: org header, request-type
// checkboxes, a line-items table alongside a ministry checklist, a
// requisitioned-by/bank-details row, per-role signature columns, the
// Approval Limit tier legend, and a live Ministry->Overseer directory.
// Deliberately dropped from the real form: the WEST/NORTH region checkboxes
// (no region concept exists anywhere in this app's data model -- adding one
// would be a real new feature, not a formatting change) and the "If paid in
// cash" section (this app only ever captures bank transfer details).
// @react-pdf/renderer has no real HTML <table> or checkbox input -- rows and
// checkboxes below are plain flexbox Views styled to look like them.
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
// which the caller (notifications.ts) still includes either way. Approver
// signatures are small PNGs captured client-side (ApprovalDrawer.tsx's
// signature pad) -- always PNG, so they go through the same Buffer-accepting
// Image source, no format detection needed like receipts.

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
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica" },

  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  orgName: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  topRight: { alignItems: "flex-end" },
  topRightLine: { fontSize: 9, marginBottom: 2 },

  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    textTransform: "uppercase",
    color: "#333333",
  },

  checkboxRow: { flexDirection: "row", flexWrap: "wrap" },
  checkboxItem: { flexDirection: "row", alignItems: "center", marginRight: 14, marginBottom: 4 },
  // A filled vs. empty square, not a text glyph inside the box -- a glyph
  // that small (needed to fit a 9x9 box) turned out unreliable to see once
  // actually rendered, so this avoids font/line-height sizing entirely.
  checkboxBox: {
    width: 9,
    height: 9,
    borderWidth: 1,
    borderColor: "#333333",
    marginRight: 4,
  },
  checkboxBoxChecked: { backgroundColor: "#333333" },
  checkboxLabel: { fontSize: 9 },

  twoCol: { flexDirection: "row" },
  mainCol: { flex: 2, paddingRight: 16 },
  sideCol: { flex: 1 },

  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
    paddingBottom: 4,
    marginBottom: 2,
  },
  tableHeaderCell: { fontFamily: "Helvetica-Bold", fontSize: 8 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#dddddd", paddingVertical: 4 },
  descCell: { flex: 3 },
  amountCell: { flex: 1, textAlign: "right" },
  totalRow: { flexDirection: "row", paddingTop: 6 },
  totalLabel: { flex: 3, fontFamily: "Helvetica-Bold", textAlign: "right", paddingRight: 8 },
  totalValue: { flex: 1, fontFamily: "Helvetica-Bold", textAlign: "right" },

  fieldLabel: { color: "#666666", fontSize: 8 },
  fieldValue: { fontSize: 9, marginBottom: 6 },

  approvalRow: { flexDirection: "row" },
  approvalCol: { flex: 1, paddingRight: 8, alignItems: "flex-start" },
  approvalRoleLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  signatureImage: { width: 100, height: 36, marginBottom: 4 },
  noSignature: { fontSize: 8, color: "#999999", fontStyle: "italic", marginBottom: 4, height: 36 },
  approvalName: { fontSize: 8 },
  approvalDate: { fontSize: 7, color: "#666666" },

  legendLine: { fontSize: 8, marginBottom: 2 },

  directoryGrid: { flexDirection: "row", flexWrap: "wrap" },
  directoryCard: {
    width: "16.6%",
    paddingRight: 6,
    marginBottom: 8,
    borderRightWidth: 1,
    borderRightColor: "#dddddd",
  },
  directoryMinistryText: { fontSize: 7, color: "#666666", marginBottom: 2 },
  directoryOverseerText: { fontSize: 8, fontFamily: "Helvetica-Bold" },

  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#999999" },
  receiptPage: { padding: 32, alignItems: "center" },
  receiptCaption: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 12 },
  receiptImage: { maxWidth: 500, maxHeight: 700 },
  unembeddedItem: { fontSize: 9, marginBottom: 2 },
});

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function formatDecidedAt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
}

function Checkbox({ checked, label }: { checked: boolean; label: string }) {
  return (
    <View style={styles.checkboxItem} wrap={false}>
      <View style={[styles.checkboxBox, checked ? styles.checkboxBoxChecked : undefined]} />
      <Text style={styles.checkboxLabel}>{label}</Text>
    </View>
  );
}

export function VoucherDocument({
  detail,
  receiptImages,
  unembeddableReceiptFilenames,
  signaturesByRole,
}: {
  detail: ApprovedRequestDetail;
  receiptImages: ReceiptImageInput[];
  unembeddableReceiptFilenames: string[];
  signaturesByRole: Map<ApproverRoleValue, Buffer>;
}) {
  const generatedAt = new Date().toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topRow}>
          <Text style={styles.orgName}>CCF AUSTRALIA - MELBOURNE</Text>
          <View style={styles.topRight}>
            <Text style={styles.topRightLine}>VOUCHER NO.: {detail.voucherNo}</Text>
            <Text style={styles.topRightLine}>DATE: {formatDate(detail.submittedAt)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.checkboxRow}>
            {REQUEST_TYPES.map((rt) => (
              <Checkbox key={rt} checked={rt === detail.requestType} label={REQUEST_TYPE_LABELS[rt]} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.twoCol}>
            <View style={styles.mainCol}>
              <Text style={styles.sectionTitle}>Description / Receipts Attached</Text>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, styles.descCell]}>Description</Text>
                <Text style={[styles.tableHeaderCell, styles.amountCell]}>Amount</Text>
              </View>
              {detail.lineItems.map((li, i) => (
                <View style={styles.row} key={i} wrap={false}>
                  <Text style={styles.descCell}>{li.description}</Text>
                  <Text style={styles.amountCell}>${li.amount}</Text>
                </View>
              ))}
              <View style={styles.totalRow} wrap={false}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>${detail.totalAmount}</Text>
              </View>
            </View>
            <View style={styles.sideCol}>
              <Text style={styles.sectionTitle}>Ministry (one per voucher)</Text>
              {Object.entries(MINISTRY_TYPE_LABELS).map(([mt, label]) => (
                <Checkbox key={mt} checked={mt === detail.ministryType} label={label} />
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.twoCol}>
            <View style={styles.mainCol}>
              <Text style={styles.sectionTitle}>Requisitioned By</Text>
              <Text style={styles.fieldValue}>{detail.requesterName}</Text>
            </View>
            <View style={styles.sideCol}>
              <Text style={styles.sectionTitle}>Bank Details for Payment</Text>
              <Text style={styles.fieldLabel}>Account Name</Text>
              <Text style={styles.fieldValue}>{detail.bankDetails.accountName}</Text>
              <Text style={styles.fieldLabel}>BSB</Text>
              <Text style={styles.fieldValue}>{detail.bankDetails.bsb}</Text>
              <Text style={styles.fieldLabel}>Account Number</Text>
              <Text style={styles.fieldValue}>{detail.bankDetails.accountNumber}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Approval</Text>
          <View style={styles.approvalRow} wrap={false}>
            {detail.approvals.map((a, i) => {
              const signature = signaturesByRole.get(a.role);
              // A tier-4 voucher can reach APPROVED without a direct
              // Regional Director decision -- Ross Callado's "within
              // budget" confirmation (regionalDirectorOverrideConfirmedAt)
              // is an alternative to it, so his row can stay genuinely
              // PENDING/unsigned forever. That's correct data, not a bug --
              // represent it accurately here rather than showing a
              // misleadingly-blank column on an otherwise fully approved
              // voucher.
              const waivedRegionalDirector = a.role === "REGIONAL_DIRECTOR" && a.status !== "APPROVED";
              return (
                <View style={styles.approvalCol} key={i}>
                  <Text style={styles.approvalRoleLabel}>{getApproverRoleLabel(a.role, detail.ministryType)}</Text>
                  {signature ? (
                    // eslint-disable-next-line jsx-a11y/alt-text -- this is @react-pdf/renderer's PDF-drawing Image, not an HTML <img>; it has no alt prop
                    <Image src={{ data: signature, format: "png" }} style={styles.signatureImage} />
                  ) : (
                    <Text style={styles.noSignature}>
                      {waivedRegionalDirector
                        ? detail.regionalDirectorOverrideConfirmedAt
                          ? `Waived — Ross Callado confirmed within budget on ${formatDecidedAt(detail.regionalDirectorOverrideConfirmedAt)}`
                          : "Waived"
                        : "No signature on file"}
                    </Text>
                  )}
                  <Text style={styles.approvalName}>{a.approverName ?? "—"}</Text>
                  <Text style={styles.approvalDate}>
                    {waivedRegionalDirector ? "" : formatDecidedAt(a.decidedAt)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Approval Limit</Text>
          <Text style={styles.legendLine}>Note: no breaking of total amount for less approval.</Text>
          <Text style={styles.legendLine}>{"<="}$500 — Ministry Overseer</Text>
          <Text style={styles.legendLine}>{">"}$500 to $2,000 — Ministry Overseer + 1 COS</Text>
          <Text style={styles.legendLine}>{">"}$2,000 to $5,000 — 2 COS + Finance Overseer</Text>
          <Text style={styles.legendLine}>{">"}$5,000 — 2 COS + Finance Overseer + Regional Director</Text>
        </View>

        <MinistryOverseerDirectory directory={detail.approverDirectory} />

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

// Live "who approves what" reference (request-data.ts's getApproverDirectory
// re-queries ApproverAssignment fresh every time this is generated) --
// deliberately distinct from the Approval section above, which is a
// historical record of who actually signed *this* voucher. Grouped by
// overseer (several ministries commonly share one) into compact cards,
// matching the real form's compact grouped-column layout rather than a tall
// one-row-per-ministry table.
function groupMinistriesByOverseer(
  directory: ApproverDirectory,
): { ministryLabels: string[]; overseerName: string }[] {
  const groups = new Map<string, string[]>();
  for (const entry of directory) {
    const overseerName = entry.overseerName ?? "Unassigned";
    const labels = groups.get(overseerName) ?? [];
    labels.push(MINISTRY_TYPE_LABELS[entry.ministryType]);
    groups.set(overseerName, labels);
  }
  return Array.from(groups, ([overseerName, ministryLabels]) => ({ overseerName, ministryLabels }));
}

function MinistryOverseerDirectory({ directory }: { directory: ApproverDirectory }) {
  const groups = groupMinistriesByOverseer(directory);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Ministry Overseer Directory</Text>
      <View style={styles.directoryGrid}>
        {groups.map((g, i) => (
          <View style={styles.directoryCard} key={i} wrap={false}>
            <Text style={styles.directoryMinistryText}>{g.ministryLabels.join(" / ")}</Text>
            <Text style={styles.directoryOverseerText}>{g.overseerName}</Text>
          </View>
        ))}
      </View>
    </View>
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
  signaturesByRole: Map<ApproverRoleValue, Buffer>,
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
      signaturesByRole={signaturesByRole}
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
