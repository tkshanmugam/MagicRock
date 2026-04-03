'use client';
import IconDownload from '@/components/icon/icon-download';
import IconEdit from '@/components/icon/icon-edit';
import IconPlus from '@/components/icon/icon-plus';
import IconPrinter from '@/components/icon/icon-printer';
import IconSend from '@/components/icon/icon-send';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import Swal from 'sweetalert2';
import { apiGet } from '@/lib/apiClient';
import { authState } from '@/lib/authState';
import { organizationContext } from '@/lib/organizationContext';
import { useSearchParams } from 'next/navigation';
import { numberToWords } from '@/lib/numberToWords';
import { fetchSalesInvoice, fetchSalesInvoiceForShare, SalesInvoice } from '@/lib/salesInvoiceApi';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const buildUploadsBaseUrl = (apiBaseUrl: string) => {
    if (!apiBaseUrl) return '/uploads';
    try {
        const url = new URL(apiBaseUrl);
        const apiPath = url.pathname.replace(/\/$/, '');
        const normalizedPath = apiPath.includes('/api/') ? apiPath.slice(0, apiPath.indexOf('/api/')) : apiPath;
        url.pathname = `${normalizedPath}/uploads`.replace(/\/{2,}/g, '/');
        return url.toString().replace(/\/$/, '');
    } catch {
        const trimmed = apiBaseUrl.replace(/\/$/, '');
        const base = trimmed.includes('/api/') ? trimmed.slice(0, trimmed.indexOf('/api/')) : trimmed;
        return `${base}/uploads`;
    }
};
const UPLOADS_BASE_URL = buildUploadsBaseUrl(API_BASE_URL);

type ActionVariant = 'full' | 'share' | 'none';

const ComponentsAppsInvoicePreview = ({ actionVariant = 'full' }: { actionVariant?: ActionVariant }) => {
    const canCreateSales = organizationContext.hasPermission('Sales', 'create');
    const canUpdateSales = organizationContext.hasPermission('Sales', 'update');
    const [isSuperAdmin, setIsSuperAdmin] = useState(organizationContext.getIsSuperAdmin());
    const [organisationsList, setOrganisationsList] = useState<any[]>([]);
    const [orgsLoading, setOrgsLoading] = useState<boolean>(false);
    const invoiceRef = useRef<HTMLDivElement | null>(null);
    const searchParams = useSearchParams();
    const invoiceId = Number(searchParams.get('id') || 0);
    const [invoice, setInvoice] = useState<SalesInvoice | null>(null);
    const [loading, setLoading] = useState(false);
    const getLogoUrl = useCallback((logoName: string) => {
        if (!logoName) return '';
        const normalized = logoName.startsWith('/') ? logoName.slice(1) : logoName;
        return `${UPLOADS_BASE_URL}/${normalized}`;
    }, []);

    const exportTable = () => {
        window.print();
    };
    const showShareNotice = (title: string, message: string) => {
        void Swal.fire({
            icon: 'info',
            title,
            text: message,
            confirmButtonText: 'OK',
        });
    };
    const downloadInvoicePdf = async () => {
        if (!invoiceRef.current || !invoice) {
            return;
        }
        const canvas = await html2canvas(invoiceRef.current, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pdfWidth;
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 0;
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pdfHeight;
        }

        const filename = `invoice-${invoice.invoice_number || invoiceId}.pdf`;
        pdf.save(filename);
    };
    const sanitizeWhatsAppNumber = (rawNumber: string) => rawNumber.replace(/[^\d+]/g, '').replace(/^00/, '+');
    const buildInvoiceMessage = () => {
        const invoiceLink = invoiceId ? `${window.location.origin}/apps/invoice/share?id=${invoiceId}` : '';
        const parts = [
            `Invoice ${invoice?.invoice_number || ''}`.trim(),
            selectedOrganisationLabel ? `from ${selectedOrganisationLabel}` : '',
            invoice?.invoice_total ? `Total: ${Number(invoice.invoice_total).toFixed(2)}` : '',
            invoiceLink ? `View: ${invoiceLink}` : '',
        ].filter(Boolean);
        return parts.join(' - ') || 'Invoice details';
    };
    const sendInvoiceInWhatsApp = async () => {
        if (!invoice) {
            return;
        }
        const rawNumber = invoice.customer_contact || '';
        const phoneNumber = rawNumber ? sanitizeWhatsAppNumber(rawNumber) : '';
        const message = buildInvoiceMessage();
        const previewText = message.split(' - ').join('<br />');
        const whatsappIconHtml =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="36" height="36" fill="none"><path fill="#25D366" d="M16.02 3C9.39 3 4 8.35 4 14.94c0 2.63.86 5.06 2.33 7.04L4 29l7.25-2.28a12.2 12.2 0 0 0 4.77.95h.01C22.65 27.67 28 22.3 28 15.72 28 9.12 22.63 3 16.02 3Z"/><path fill="#fff" d="M22.61 18.98c-.26-.13-1.5-.74-1.74-.82-.24-.09-.42-.13-.6.13-.18.26-.69.82-.85.98-.16.16-.31.19-.57.06-.26-.13-1.1-.41-2.1-1.3-.78-.7-1.3-1.56-1.46-1.82-.15-.26-.02-.4.11-.54.12-.12.26-.31.39-.46.13-.16.18-.26.27-.43.09-.17.04-.32-.02-.45-.06-.13-.6-1.45-.82-1.99-.22-.53-.45-.46-.62-.47l-.53-.01c-.18 0-.47.07-.71.32-.24.26-.93.91-.93 2.23 0 1.31.95 2.58 1.08 2.76.13.18 1.87 2.85 4.54 4 .64.28 1.14.44 1.53.56.65.21 1.24.18 1.7.11.52-.08 1.5-.62 1.71-1.22.21-.6.21-1.11.15-1.22-.06-.1-.24-.16-.5-.29Z"/></svg>';
        const confirmSend = await Swal.fire({
            icon: 'info',
            iconHtml: whatsappIconHtml,
            title: 'Send invoice via WhatsApp?',
            html: `<div class="text-left">${previewText}</div>`,
            showCancelButton: true,
            confirmButtonText: 'Send',
            cancelButtonText: 'Cancel',
        });
        if (!confirmSend.isConfirmed) {
            return;
        }
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = phoneNumber ? `https://wa.me/${phoneNumber}?text=${encodedMessage}` : `https://wa.me/?text=${encodedMessage}`;

        if (!phoneNumber) {
            showShareNotice(
                'Contact number missing',
                'We will open WhatsApp Web in a new tab. Please paste the contact number before sending.',
            );
        } else {
            showShareNotice(
                'WhatsApp Web opened',
                `Message ready for ${phoneNumber}. Please review and send.`,
            );
        }
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    };

    const formatDate = (value?: string | null) => {
        if (!value) {
            return '-';
        }
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString('en-GB');
    };
    const formatNumber = (value?: number | string | null, fractionDigits = 2) => {
        if (value === undefined || value === null || value === '') {
            return '-';
        }
        const numeric = typeof value === 'number' ? value : Number(value);
        return Number.isNaN(numeric) ? String(value) : numeric.toFixed(fractionDigits);
    };
    const formatCurrency = (value?: number | string | null) => {
        if (value === undefined || value === null || value === '') {
            return '-';
        }
        const numeric = typeof value === 'number' ? value : Number(value);
        if (Number.isNaN(numeric)) {
            return String(value);
        }
        return `₹${numeric.toFixed(2)}`;
    };

    const splitAddressLines = (address?: string | null, city?: string | null) => {
        const raw = [address, city].filter(Boolean).join(', ');
        if (!raw) {
            return [];
        }
        const parts = raw
            .split(/,|\n| {2,}/)
            .map((part) => part.trim())
            .filter(Boolean);
        return parts.length ? parts : [raw.trim()];
    };

    useEffect(() => {
        organizationContext.updateIsSuperAdminFromToken();
        setIsSuperAdmin(organizationContext.getIsSuperAdmin());
    }, []);

    const fetchOrganisations = useCallback(async () => {
        if (actionVariant === 'share') {
            return;
        }
        if (!authState.isAuthStateReady()) {
            return;
        }
        try {
            setOrgsLoading(true);
            const endpoint = isSuperAdmin ? 'organisations' : 'organisations/me';
            const response = await apiGet<any>(endpoint);
            const organisations = Array.isArray(response) ? response : response.data || response.results || [];
            setOrganisationsList(organisations);
        } catch (error) {
            console.error('Failed to fetch organisations', error);
        } finally {
            setOrgsLoading(false);
        }
    }, [isSuperAdmin, actionVariant]);

    useEffect(() => {
        if (actionVariant === 'share') {
            return;
        }
        if (authState.isAuthStateReady()) {
            fetchOrganisations();
            return;
        }
        let attempts = 0;
        const maxAttempts = 20;
        const interval = setInterval(() => {
            attempts++;
            if (authState.isAuthStateReady() || attempts >= maxAttempts) {
                clearInterval(interval);
                if (authState.isAuthStateReady()) {
                    organizationContext.updateIsSuperAdminFromToken();
                    setIsSuperAdmin(organizationContext.getIsSuperAdmin());
                    fetchOrganisations();
                }
            }
        }, 100);
        return () => clearInterval(interval);
    }, [fetchOrganisations, actionVariant]);

    useEffect(() => {
        if (!invoiceId) {
            return;
        }
        setLoading(true);
        const load =
            actionVariant === 'share' ? fetchSalesInvoiceForShare(invoiceId) : fetchSalesInvoice(invoiceId);
        load.then((data) => setInvoice(data))
            .catch((error) => console.error('Failed to load invoice', error))
            .finally(() => setLoading(false));
    }, [invoiceId, actionVariant]);

    const { selectedOrganisationLabel, selectedOrganisationAddressLines, selectedOrganisationLogoUrl, selectedOrganisationBankDetails, selectedOrganisationMeta } = useMemo(() => {
        const organisationId = invoice?.organisation_id;
        const p = invoice?.organisation_profile;
        if (actionVariant === 'share' && p) {
            const addressLines = splitAddressLines(p.address, p.city);
            return {
                selectedOrganisationLabel: p.name || (organisationId ? `Organisation #${organisationId}` : 'Organisation'),
                selectedOrganisationAddressLines: addressLines,
                selectedOrganisationLogoUrl: p.logo_name ? getLogoUrl(p.logo_name) : '',
                selectedOrganisationBankDetails: {
                    bank_name: p.bank_name || '',
                    account_number: p.account_number || '',
                    ifsc_code: p.ifsc_code || '',
                    branch: p.branch || '',
                    upi_id: p.upi_id || '',
                },
                selectedOrganisationMeta: {
                    pan: p.pan || '',
                    gstin: p.gstin || '',
                    phone: p.phone || '',
                    email: p.email || '',
                    website: p.website || '',
                    tagline: p.tagline || '',
                },
            };
        }
        const selectedOrganisation = organisationsList.find((org: any) => String(org.id) === String(organisationId));
        const addressLines = splitAddressLines(selectedOrganisation?.address, selectedOrganisation?.city);
        return {
            selectedOrganisationLabel: selectedOrganisation?.name || (organisationId ? `Organisation #${organisationId}` : 'Organisation'),
            selectedOrganisationAddressLines: addressLines,
            selectedOrganisationLogoUrl: selectedOrganisation?.logo_name ? getLogoUrl(selectedOrganisation.logo_name) : '',
            selectedOrganisationBankDetails: {
                bank_name: selectedOrganisation?.bank_name || '',
                account_number: selectedOrganisation?.account_number || '',
                ifsc_code: selectedOrganisation?.ifsc_code || '',
                branch: selectedOrganisation?.branch || '',
                upi_id: selectedOrganisation?.upi_id || selectedOrganisation?.upi || '',
            },
            selectedOrganisationMeta: {
                pan: selectedOrganisation?.pan || selectedOrganisation?.pan_number || '',
                gstin: selectedOrganisation?.gstin || selectedOrganisation?.gst_number || '',
                phone: selectedOrganisation?.phone || selectedOrganisation?.mobile || selectedOrganisation?.contact || '',
                email: selectedOrganisation?.email || '',
                website: selectedOrganisation?.website || selectedOrganisation?.web || '',
                tagline: selectedOrganisation?.tagline || selectedOrganisation?.slogan || selectedOrganisation?.description || '',
            },
        };
    }, [invoice, invoice?.organisation_id, invoice?.organisation_profile, organisationsList, getLogoUrl, actionVariant]);

    const invoiceMeta = useMemo(() => {
        return {
            challanNo: (invoice as any)?.challan_no || (invoice as any)?.challanNo || '',
            challanDate: (invoice as any)?.challan_date || (invoice as any)?.challanDate || '',
            ewayBillNo: (invoice as any)?.eway_bill_no || (invoice as any)?.ewayBillNo || '',
            transport: (invoice as any)?.transport || invoice?.vehicle_no || '',
            transportId: (invoice as any)?.transport_id || (invoice as any)?.transportId || '',
        };
    }, [invoice]);

    const itemTotals = useMemo(() => {
        if (!invoice) {
            return { quantity: 0, taxable: 0, sgst: 0, cgst: 0, total: 0 };
        }
        const totals = invoice.items.reduce(
            (acc, item) => {
                const qty = Number(item.quantity ?? 0);
                const rate = Number(item.rate ?? 0);
                const taxable = qty * rate;
                acc.quantity += qty;
                acc.taxable += taxable;
                return acc;
            },
            { quantity: 0, taxable: 0, sgst: 0, cgst: 0, total: 0 }
        );
        const sgstTotal = Number(invoice.sgst_amount ?? 0);
        const cgstTotal = Number(invoice.cgst_amount ?? 0);
        totals.sgst = sgstTotal;
        totals.cgst = cgstTotal;
        totals.total = Number(invoice.invoice_total ?? totals.taxable + sgstTotal + cgstTotal);
        return totals;
    }, [invoice]);

    const taxRates = useMemo(() => {
        const taxableBase = itemTotals.taxable || 0;
        const sgstRate = taxableBase ? (itemTotals.sgst / taxableBase) * 100 : 0;
        const cgstRate = taxableBase ? (itemTotals.cgst / taxableBase) * 100 : 0;
        return { sgstRate, cgstRate };
    }, [itemTotals]);

    return (
        <>
        <div>
            {actionVariant !== 'none' && (
                <div className="mt-4 mb-6 flex flex-wrap items-center justify-center gap-3 px-4 print:hidden">
                    {actionVariant === 'full' && (
                        <button type="button" className="btn btn-info gap-2" onClick={sendInvoiceInWhatsApp} disabled={!invoice}>
                            <IconSend />
                            Send Invoice in WhatsApp
                        </button>
                    )}
                    <button type="button" className="btn btn-primary gap-2" onClick={() => exportTable()}>
                        <IconPrinter />
                        Print
                    </button>
                    <button type="button" className="btn btn-success gap-2" onClick={downloadInvoicePdf} disabled={!invoice}>
                        <IconDownload />
                        Download
                    </button>
                    {actionVariant === 'full' && canCreateSales && (
                        <Link href="/apps/invoice/add" className="btn btn-secondary gap-2">
                            <IconPlus />
                            Create
                        </Link>
                    )}
                    {actionVariant === 'full' && canUpdateSales && invoiceId ? (
                        <Link href={`/apps/invoice/edit?id=${invoiceId}`} className="btn btn-warning gap-2">
                            <IconEdit />
                            Edit
                        </Link>
                    ) : null}
                </div>
            )}

            <div className="panel px-4 py-6 print:m-0 print:border-0 print:bg-transparent print:p-0 print:shadow-none">
                {loading && <div className="py-6 text-center text-sm text-gray-500">Loading invoice...</div>}
                {!loading && !invoice && <div className="py-6 text-center text-sm text-gray-500">Invoice not found.</div>}
                {!loading && invoice && (
                    <div
                        ref={invoiceRef}
                        className="gst-invoice mx-auto w-[210mm] min-h-[297mm] rounded bg-white p-[6mm] text-[10px] text-black dark:bg-white dark:text-black print:rounded-none print:p-[5mm]"
                        style={{ fontFamily: 'Inter, Helvetica, Arial, sans-serif' }}
                    >
                        <div className="p-0">
                            <div className="gst-header flex items-center justify-between gap-4 print:gap-5">
                                <div className="flex-1 text-left">
                                    <div className="gst-org-name uppercase tracking-wide">{selectedOrganisationLabel}</div>
                                    {selectedOrganisationMeta.tagline ? <div className="gst-org-tagline">{selectedOrganisationMeta.tagline}</div> : null}
                                    <div className="gst-org-meta">
                                        {orgsLoading && !selectedOrganisationAddressLines.length ? (
                                            <div>Loading organisation...</div>
                                        ) : selectedOrganisationAddressLines.length ? (
                                            selectedOrganisationAddressLines.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)
                                        ) : (
                                            <div>Address not available</div>
                                        )}
                                    </div>
                                    <div className="gst-org-ids">
                                        {selectedOrganisationMeta.gstin ? <div>GSTIN: {selectedOrganisationMeta.gstin}</div> : null}
                                    </div>
                                    <div className="gst-contact">
                                        {selectedOrganisationMeta.phone ? <div>Tel: {selectedOrganisationMeta.phone}</div> : null}
                                        {selectedOrganisationMeta.website ? <div>Web: {selectedOrganisationMeta.website}</div> : null}
                                        {selectedOrganisationMeta.email ? <div>Email: {selectedOrganisationMeta.email}</div> : null}
                                    </div>
                                </div>
                                {selectedOrganisationLogoUrl && (
                                    <div className="gst-logo-box flex h-[120px] w-[120px] items-center justify-center">
                                        <img src={selectedOrganisationLogoUrl} alt={`${selectedOrganisationLabel} logo`} className="gst-logo max-h-[120px] w-full object-contain" />
                                    </div>
                                )}
                            </div>
                            {invoice.status && invoice.status !== 'ACTIVE' && (
                                <div className="mt-1 text-right text-[10px] text-gray-600 print:text-[9px]">{invoice.status}</div>
                            )}
                        </div>

                        <div className="gst-title-row border border-black px-2 py-2">
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center">
                                <div className="gst-title-side text-[9px] text-gray-700">
                                    {selectedOrganisationMeta.pan ? `PAN: ${selectedOrganisationMeta.pan}` : ''}
                                </div>
                                <div className="gst-title text-center uppercase">TAX INVOICE</div>
                                <div className="gst-title-side text-right text-[9px] font-medium text-black">ORIGINAL FOR RECIPIENT</div>
                            </div>
                        </div>

                        <div className="mt-3 border border-black text-[10px]">
                            <div className="gst-detail-grid">
                                <div className="gst-detail-card border-r border-black p-2">
                                    <div className="gst-section-title mb-2 border-b border-black pb-1 text-center font-semibold">Customer Details</div>
                                    <div className="grid gap-2">
                                        <div className="gst-info-row">
                                            <div className="gst-label">M/S</div>
                                            <div className="gst-value font-semibold">{invoice.customer_name}</div>
                                        </div>
                                        <div className="gst-info-row">
                                            <div className="gst-label">Address</div>
                                            <div className="gst-value break-words">{invoice.customer_address || '-'}</div>
                                        </div>
                                        <div className="gst-info-row">
                                            <div className="gst-label">Phone</div>
                                            <div className="gst-value">{invoice.customer_contact || '-'}</div>
                                        </div>
                                        <div className="gst-info-row">
                                            <div className="gst-label">GSTIN</div>
                                            <div className="gst-value">{invoice.customer_gstin || '-'}</div>
                                        </div>
                                        <div className="gst-info-row">
                                            <div className="gst-label">Place of Supply</div>
                                            <div className="gst-value">{invoice.place_of_supply || '-'}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="gst-detail-card p-2">
                                    <div className="grid gap-2">
                                        <div className="gst-info-row gst-info-row-right">
                                            <div className="gst-label gst-label-wrap">Invoice No.</div>
                                            <div className="gst-value font-semibold">{invoice.invoice_number}</div>
                                        </div>
                                        <div className="gst-info-row gst-info-row-right">
                                            <div className="gst-label gst-label-wrap">Invoice Date</div>
                                            <div className="gst-value">{formatDate(invoice.invoice_date)}</div>
                                        </div>
                                        <div className="gst-info-row gst-info-row-right">
                                            <div className="gst-label gst-label-wrap">State</div>
                                            <div className="gst-value">{invoice.customer_state || '-'}</div>
                                        </div>
                                        <div className="gst-info-row gst-info-row-right">
                                            <div className="gst-label gst-label-wrap">E-Way Bill No.</div>
                                            <div className="gst-value">{invoiceMeta.ewayBillNo || '-'}</div>
                                        </div>
                                        <div className="gst-info-row gst-info-row-right hidden">
                                            <div className="gst-label gst-label-wrap">Transport</div>
                                            <div className="gst-value">{invoiceMeta.transport || '-'}</div>
                                        </div>
                                        <div className="gst-info-row gst-info-row-right">
                                            <div className="gst-label gst-label-wrap">Vehicle No</div>
                                            <div className="gst-value">{invoice.vehicle_no || '-'}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-3 gst-no-break print:mt-2">
                            <div className="overflow-hidden print:overflow-visible">
                                <table className="gst-table table-fixed w-full border border-black text-[10px] leading-tight print:text-[9.4px]" style={{ pageBreakInside: 'avoid' }}>
                                    <colgroup>
                                        <col style={{ width: '5%' }} />
                                        <col style={{ width: '21%' }} />
                                        <col style={{ width: '8%' }} />
                                        <col style={{ width: '7%' }} />
                                        <col style={{ width: '8%' }} />
                                        <col style={{ width: '12%' }} />
                                        <col style={{ width: '5%' }} />
                                        <col style={{ width: '7%' }} />
                                        <col style={{ width: '5%' }} />
                                        <col style={{ width: '7%' }} />
                                        <col style={{ width: '15%' }} />
                                    </colgroup>
                                    <thead>
                                        <tr className="gst-head-row-main">
                                            <th className="gst-head gst-sr gst-table-head gst-table-head-bg border border-black text-center font-semibold">
                                                Sr.
                                            </th>
                                            <th className="gst-head gst-table-head gst-table-head-bg border border-black px-0.5 text-left font-semibold">
                                                Product
                                            </th>
                                            <th className="gst-head gst-head-wrap gst-head-wrap-allow gst-table-head gst-table-head-bg gst-hsn border border-black px-0.5 text-center font-semibold">
                                                HSN /<br />SAC
                                            </th>
                                            <th className="gst-head gst-head-center gst-table-head gst-table-head-bg border border-black px-0.5 font-semibold whitespace-nowrap">
                                                Qty
                                            </th>
                                            <th className="gst-head gst-head-center gst-table-head gst-table-head-bg border border-black px-0.5 font-semibold whitespace-nowrap">
                                                Rate
                                            </th>
                                            <th className="gst-head gst-head-center gst-head-wrap gst-head-wrap-allow gst-table-head gst-table-head-bg border border-black px-0.5 font-semibold">
                                                <span className="gst-head-stack">
                                                    Taxable<br />Value
                                                </span>
                                            </th>
                                            <th className="gst-head gst-head-center gst-table-head gst-table-head-bg border border-black font-semibold" colSpan={2}>
                                                SGST
                                            </th>
                                            <th className="gst-head gst-head-center gst-table-head gst-table-head-bg border border-black font-semibold" colSpan={2}>
                                                CGST
                                            </th>
                                            <th className="gst-head gst-head-center gst-table-head gst-table-head-bg border border-black px-0.5 font-semibold whitespace-nowrap">
                                                Total
                                            </th>
                                        </tr>
                                        <tr className="gst-head-row-sub">
                                            <th className="gst-head gst-head-spacer gst-table-head gst-table-head-bg border border-black" aria-hidden="true"></th>
                                            <th className="gst-head gst-head-spacer gst-table-head gst-table-head-bg border border-black" aria-hidden="true"></th>
                                            <th className="gst-head gst-head-spacer gst-table-head gst-table-head-bg border border-black" aria-hidden="true"></th>
                                            <th className="gst-head gst-head-spacer gst-table-head gst-table-head-bg border border-black" aria-hidden="true"></th>
                                            <th className="gst-head gst-head-spacer gst-table-head gst-table-head-bg border border-black" aria-hidden="true"></th>
                                            <th className="gst-head gst-head-spacer gst-table-head gst-table-head-bg border border-black" aria-hidden="true"></th>
                                            <th className="gst-head gst-table-head gst-table-head-bg border border-black px-0.5 text-center font-semibold">%</th>
                                            <th className="gst-head gst-table-head gst-table-head-bg border border-black px-0.5 text-center font-semibold">Amt</th>
                                            <th className="gst-head gst-table-head gst-table-head-bg border border-black px-0.5 text-center font-semibold">%</th>
                                            <th className="gst-head gst-table-head gst-table-head-bg border border-black px-0.5 text-center font-semibold">Amt</th>
                                            <th className="gst-head gst-head-spacer gst-table-head gst-table-head-bg border border-black" aria-hidden="true"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {invoice.items.map((item, index) => {
                                            const qty = Number(item.quantity ?? 0);
                                            const rate = Number(item.rate ?? 0);
                                            const taxableValue = qty * rate;
                                            const sgstAmount = taxableValue * (taxRates.sgstRate / 100);
                                            const cgstAmount = taxableValue * (taxRates.cgstRate / 100);
                                            return (
                                                <tr key={item.id}>
                                                    <td className="gst-cell gst-sr border border-black text-center">{index + 1}</td>
                                                    <td className="gst-cell gst-product border border-black text-left">{item.item_name}</td>
                                                    <td className="gst-cell gst-hsn border border-black text-center">{item.hsn_code || '-'}</td>
                                                    <td className="gst-cell gst-qty border border-black">{formatNumber(qty, 2)}</td>
                                                    <td className="gst-cell gst-num border border-black">{formatCurrency(rate)}</td>
                                                    <td className="gst-cell gst-num border border-black">{formatCurrency(taxableValue)}</td>
                                                    <td className="gst-cell gst-pct border border-black">{formatNumber(taxRates.sgstRate, 2)}</td>
                                                    <td className="gst-cell gst-num border border-black">{formatCurrency(sgstAmount)}</td>
                                                    <td className="gst-cell gst-pct border border-black">{formatNumber(taxRates.cgstRate, 2)}</td>
                                                    <td className="gst-cell gst-num border border-black">{formatCurrency(cgstAmount)}</td>
                                                    <td className="gst-cell gst-num border border-black">{formatCurrency(taxableValue + sgstAmount + cgstAmount)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t border-black">
                                            <td className="gst-cell border border-black text-center font-semibold" colSpan={3}>
                                                Total
                                            </td>
                                            <td className="gst-cell gst-qty border border-black font-semibold">{formatNumber(itemTotals.quantity, 2)}</td>
                                            <td className="gst-cell gst-num border border-black"></td>
                                            <td className="gst-cell gst-num border border-black font-semibold">{formatCurrency(itemTotals.taxable)}</td>
                                            <td className="gst-cell gst-pct border border-black font-semibold">{formatNumber(taxRates.sgstRate, 2)}</td>
                                            <td className="gst-cell gst-num border border-black font-semibold">{formatCurrency(itemTotals.sgst)}</td>
                                            <td className="gst-cell gst-pct border border-black font-semibold">{formatNumber(taxRates.cgstRate, 2)}</td>
                                            <td className="gst-cell gst-num border border-black font-semibold">{formatCurrency(itemTotals.cgst)}</td>
                                            <td className="gst-cell gst-num border border-black font-semibold">{formatCurrency(itemTotals.total)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        <div className="mt-4 grid grid-cols-[2fr_1fr] gap-0 border border-black text-[10px] gst-no-break">
                            <div className="border-r border-black">
                                <div className="gst-section-title border-b border-black py-1 text-center font-semibold">Total in words</div>
                                <div className="p-2 text-sm leading-[1.35] print:text-[10px]">{numberToWords(Number(invoice.invoice_total || 0))}</div>
                            </div>
                            <div>
                                <div className="divide-y divide-black gst-totals">
                                    <div className="flex items-center justify-between px-2 py-1 print:py-2">
                                        <div>Taxable Amount</div>
                                        <div className="gst-amount text-right tabular-nums">{formatCurrency(itemTotals.taxable)}</div>
                                    </div>
                                    <div className="flex items-center justify-between px-2 py-1 print:py-2">
                                        <div>Add : SGST</div>
                                        <div className="gst-amount text-right tabular-nums">{formatCurrency(itemTotals.sgst)}</div>
                                    </div>
                                    <div className="flex items-center justify-between px-2 py-1 print:py-2">
                                        <div>Add : CGST</div>
                                        <div className="gst-amount text-right tabular-nums">{formatCurrency(itemTotals.cgst)}</div>
                                    </div>
                                    {Number(invoice.igst_amount || 0) > 0 && (
                                        <div className="flex items-center justify-between px-2 py-1 print:py-2">
                                            <div>Add : IGST</div>
                                            <div className="gst-amount text-right tabular-nums">{formatCurrency(invoice.igst_amount)}</div>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between px-2 py-1 print:py-2">
                                        <div>Total Tax</div>
                                        <div className="gst-amount text-right tabular-nums">{formatCurrency(itemTotals.sgst + itemTotals.cgst + Number(invoice.igst_amount || 0))}</div>
                                    </div>
                                    <div className="gst-total-highlight flex items-center justify-between px-2 py-1 font-semibold print:py-2">
                                        <div>Total Amount After Tax</div>
                                        <div className="gst-amount text-right tabular-nums">{formatCurrency(itemTotals.total)}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="gst-footer-grid grid grid-cols-[2fr_1fr] gap-0 border border-black border-t-0 text-[10px] gst-no-break">
                            <div className="border-r border-black">
                                <div className="gst-section-title border-b border-black py-1 text-center font-semibold">Bank Details</div>
                                <div className="gst-bank-compact grid gap-1 px-2 py-2 gst-footer-text">
                                    <div className="gst-bank-row grid grid-cols-[120px_1fr] items-center gap-2 print:grid-cols-[35mm_1fr]">
                                        <div>Name</div>
                                        <div>{selectedOrganisationBankDetails.bank_name || '-'}</div>
                                    </div>
                                    <div className="gst-bank-row grid grid-cols-[120px_1fr] items-center gap-2 print:grid-cols-[35mm_1fr]">
                                        <div>Branch</div>
                                        <div>{selectedOrganisationBankDetails.branch || '-'}</div>
                                    </div>
                                    <div className="gst-bank-row grid grid-cols-[120px_1fr] items-center gap-2 print:grid-cols-[35mm_1fr]">
                                        <div>Acc. Number</div>
                                        <div>{selectedOrganisationBankDetails.account_number || '-'}</div>
                                    </div>
                                    <div className="gst-bank-row grid grid-cols-[120px_1fr] items-center gap-2 print:grid-cols-[35mm_1fr]">
                                        <div>IFSC</div>
                                        <div>{selectedOrganisationBankDetails.ifsc_code || '-'}</div>
                                    </div>
                                    {selectedOrganisationBankDetails.upi_id ? (
                                        <div className="gst-bank-row grid grid-cols-[120px_1fr] items-center gap-2 print:grid-cols-[35mm_1fr]">
                                            <div>UPI ID</div>
                                            <div>{selectedOrganisationBankDetails.upi_id}</div>
                                        </div>
                                    ) : null}
                                </div>
                                <div className="gst-section-title border-t border-black py-1 text-center font-semibold">Terms and Conditions</div>
                                <div className="gst-terms-pad p-2 gst-footer-text leading-[1.35] text-gray-700">
                                    <div>Subject to local jurisdiction.</div>
                                    <div>Our responsibility ceases as goods leave our premises.</div>
                                    <div>Goods once sold will not be taken back.</div>
                                    <div>Delivery ex-premises.</div>
                                </div>
                                <div className="border-t border-black px-2 py-2 text-[10px] text-gray-700">Customer Signature</div>
                            </div>
                            <div className="flex h-full flex-col">
                                <div className="gst-signature-block border-b border-black p-2 text-center">
                                    <div className="gst-section-title text-center font-normal">Certified that the particulars given above are true and correct.</div>
                                    <div className="mt-2 text-sm font-semibold print:text-[10.5px]">For {selectedOrganisationLabel}</div>
                                    <div className="gst-auth-sign mt-3 text-[10px] text-gray-600 print:text-[9.4px]">Authorised Signatory</div>
                                </div>
                                <div className="flex flex-1 items-center justify-center p-2 text-center text-[9px] leading-[1.35] text-gray-600 print:text-[9px]">
                                    <div className="gst-section-title text-center font-semibold">
                                        This is a computer generated invoice no signature require
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="gst-footer mt-1 grid grid-cols-[1fr_1fr] border border-black border-t-0 text-[10px] text-gray-700">
                            <div className="px-2 py-2 text-left print:py-[3mm]">Thank you for shopping with us!</div>
                            <div className="px-2 py-2 text-right text-[9px] italic leading-tight text-gray-600"></div>
                        </div>
                    </div>
                )}
            </div>
        </div>
        <style jsx global>{`
            .gst-invoice {
                position: relative;
                box-sizing: border-box;
                border: 1px solid #000;
            }
            .gst-header {
                margin-bottom: 8px;
                padding: 8px 0;
                border-bottom: 2px solid #003399;
            }
            .gst-org-name {
                font-size: 18pt;
                font-weight: 700;
                line-height: 1.2;
                color: #003399;
            }
            .gst-org-tagline {
                margin-top: 4px;
                font-size: 10px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.06em;
                color: #000;
            }
            .gst-org-meta {
                margin-top: 4px;
                font-size: 10pt;
                line-height: 1.35;
                color: #2b2b2b;
                font-weight: 700;
            }
            .gst-org-ids {
                margin-top: 4px;
                font-size: 10pt;
                font-weight: 500;
                color: #000;
            }
            .gst-contact {
                margin-top: 4px;
                font-size: 10pt;
                line-height: 1.35;
                color: #000;
            }
            .gst-title {
                font-size: 15px;
                font-weight: 700;
                letter-spacing: 0.12em;
                color: #000;
            }
            .gst-title-row {
                padding-top: 8px;
                padding-bottom: 8px;
            }
            .gst-detail-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                align-items: stretch;
            }
            .gst-detail-card {
                display: flex;
                flex-direction: column;
                height: 100%;
            }
            .gst-info-row {
                display: grid;
                grid-template-columns: minmax(0, 110px) minmax(0, 1fr);
                align-items: start;
                gap: 5px;
            }
            .gst-info-row-right {
                grid-template-columns: minmax(0, 110px) minmax(0, 1fr);
                justify-items: stretch;
            }
            .gst-label {
                font-size: 10px;
                font-weight: 700;
                color: #000;
                white-space: nowrap;
                align-self: start;
                padding-top: 1px;
            }
            .gst-label-wrap {
                white-space: normal;
                line-height: 1.2;
                hyphens: none;
                word-break: normal;
            }
            .gst-value {
                font-size: 10px;
                font-weight: 400;
                color: #000;
                min-width: 0;
                overflow-wrap: anywhere;
                line-height: 1.25;
            }
            .gst-info-row-right .gst-label,
            .gst-info-row-right .gst-value {
                text-align: left;
            }
            .gst-table {
                border-collapse: collapse;
                table-layout: fixed;
                width: 100%;
                border: 1px solid #000;
                font-size: 9px;
            }
            .gst-table .gst-cell {
                padding: 6px 8px;
                vertical-align: middle;
            }
            .gst-table th,
            .gst-table td {
                border-left: 1px solid #000;
                border-right: 1px solid #000;
            }
            .gst-table .gst-head {
                padding: 3px 4px;
                font-size: 9px;
                line-height: 1.2;
                white-space: nowrap;
            }
            .gst-table .gst-table-head {
                font-weight: 700;
            }
            .gst-table .gst-table-head-bg {
                background: #e3f2fd;
            }
            .gst-table .gst-head-wrap {
                white-space: nowrap;
                font-size: 9px;
                line-height: 1.1;
            }
            .gst-table .gst-head-wrap-allow {
                white-space: normal;
                line-height: 1.15;
                word-break: normal;
            }
            .gst-table .gst-head-center {
                text-align: center;
                vertical-align: middle;
            }
            .gst-table .gst-head-stack {
                display: inline-block;
                line-height: 1.1;
            }
            .gst-table thead th {
                vertical-align: middle;
            }
            .gst-table .gst-sr {
                text-align: center !important;
            }
            .gst-table .gst-head-spacer {
                padding-top: 0 !important;
                padding-bottom: 0 !important;
                padding-left: 0 !important;
                padding-right: 0 !important;
                height: 0;
                line-height: 0;
                font-size: 0;
            }
            .gst-table .gst-hsn {
                white-space: nowrap;
                word-break: keep-all;
            }
            .gst-table .gst-num {
                text-align: right;
                font-variant-numeric: tabular-nums;
                white-space: nowrap;
                padding-left: 4px;
                padding-right: 4px;
                font-size: 9px;
            }
            .gst-table .gst-qty {
                text-align: right;
                font-variant-numeric: tabular-nums;
                white-space: normal;
                padding-left: 4px;
                padding-right: 4px;
                font-size: 9px;
            }
            .gst-table .gst-pct {
                text-align: right;
                font-variant-numeric: tabular-nums;
                white-space: nowrap;
                padding-left: 4px;
                padding-right: 4px;
                font-size: 9px;
            }
            .gst-table .gst-product {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .gst-section-title {
                letter-spacing: 0.04em;
            }
            .gst-totals {
                border-left: 0;
            }
            .gst-total-highlight {
                background: #e6f0ff;
                font-weight: 700;
                font-size: 10px;
            }
            .gst-total-highlight .gst-amount {
                font-size: 12pt;
                font-weight: 700;
            }
            .gst-amount {
                display: inline-flex;
                align-items: baseline;
                justify-content: flex-end;
                min-width: 70px;
                padding-right: 0;
                font-variant-numeric: tabular-nums;
            }
            .gst-footer-text {
                font-size: 9px;
                color: #000;
            }
            .gst-footer-row {
                align-items: stretch;
            }
            .gst-bank-compact {
                line-height: 1.3;
                padding-top: 10px;
                padding-bottom: 10px;
            }
            .gst-bank-row {
                border-bottom: 1px solid #000;
                padding-bottom: 4px;
            }
            .gst-terms-pad {
                padding-top: 10px;
                padding-bottom: 10px;
            }
            .gst-auth-sign {
                margin-top: auto;
                text-align: right;
                width: 100%;
            }
            .gst-hide-print {
                /* visible on screen */
            }
            .gst-signature-block {
                padding-top: 12px;
                padding-bottom: 12px;
            }
            @media print {
                .gst-table .gst-table-head-bg,
                .gst-total-highlight {
                    background: #fff !important;
                }
                @page {
                    size: A4 portrait;
                    margin: 20mm 18mm;
                }
                html,
                body {
                    margin: 0;
                    padding: 0;
                    width: 100%;
                    height: 100%;
                    overflow: visible;
                }
                body {
                    color: #000;
                    background: #fff;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .gst-invoice {
                    width: 100%;
                    height: 257mm;
                    min-height: 257mm;
                    max-height: 257mm;
                    margin: 0 auto;
                    padding: 0;
                    color: #000;
                    background: #fff;
                    font-size: 8.8pt;
                    line-height: 1.3;
                    display: flex;
                    flex-direction: column;
                    box-shadow: none;
                    border: none;
                    overflow: hidden;
                }
                .gst-invoice > div {
                    break-inside: avoid;
                    page-break-inside: avoid;
                }
                .gst-header {
                    margin-bottom: 2mm;
                    padding: 1.5mm 0;
                    border-bottom: 2px solid #003399;
                }
                .gst-org-name {
                    font-size: 18pt;
                    font-weight: 700;
                }
                .gst-org-meta {
                    font-size: 10pt;
                    line-height: 1.3;
                    font-weight: 700;
                }
                .gst-org-ids {
                    font-size: 10pt;
                    font-weight: 500;
                }
                .gst-contact {
                    font-size: 10pt;
                }
                .gst-title {
                    font-size: 14pt;
                    font-weight: 700;
                    letter-spacing: 0.12em;
                }
                .gst-title-row {
                    padding-top: 5px;
                    padding-bottom: 5px;
                }
                .gst-section-title {
                    font-size: 10pt;
                }
                .gst-label {
                    font-size: 10pt;
                    font-weight: 700;
                }
                .gst-value {
                    font-size: 9.5pt;
                }
                .gst-info-row {
                    grid-template-columns: minmax(0, 30mm) minmax(0, 1fr);
                    gap: 2.6mm;
                }
                .gst-info-row-right {
                    grid-template-columns: minmax(0, 30mm) minmax(0, 1fr);
                    justify-items: stretch;
                    padding-top: 2px;
                    padding-bottom: 2px;
                }
                .gst-detail-card {
                    min-height: 0;
                }
                .gst-footer {
                    margin-top: 1.5mm;
                }
                .gst-table {
                    border-collapse: collapse;
                    table-layout: fixed;
                    width: 100%;
                    font-size: 8.5pt;
                    line-height: 1.2;
                }
                .gst-table th,
                .gst-table td {
                    padding: 4px 6px;
                    vertical-align: middle;
                    overflow: hidden;
                }
                .gst-table thead th {
                    overflow: visible;
                }
                .gst-table .gst-sr {
                    text-align: center !important;
                }
                .gst-table .gst-cell {
                    padding: 3px 4px !important;
                    overflow: hidden;
                    text-overflow: clip;
                    white-space: nowrap;
                }
                .gst-table .gst-head {
                    font-size: 9.5pt;
                    line-height: 1.2;
                    padding: 2px 3px;
                }
                .gst-table .gst-num,
                .gst-table .gst-qty,
                .gst-table .gst-pct {
                    font-size: 8pt;
                    padding-left: 2px;
                    padding-right: 2px;
                    letter-spacing: -0.2px;
                }
                .gst-table tbody tr {
                    height: 5.8mm;
                    min-height: 5.8mm;
                    break-inside: avoid;
                }
                .gst-invoice .mt-3 {
                    margin-top: 1.8mm !important;
                }
                .gst-invoice .mt-1 {
                    margin-top: 0.8mm !important;
                }
                .gst-invoice .mt-8 {
                    margin-top: 3.5mm !important;
                }
                .gst-invoice .mt-4 {
                    margin-top: 2.5mm !important;
                }
                .gst-invoice .text-[9px] {
                    line-height: 1.2;
                }
                .gst-invoice .p-2 {
                    padding: 1.6mm !important;
                }
                .gst-invoice .py-2 {
                    padding-top: 1.6mm !important;
                    padding-bottom: 1.6mm !important;
                }
                .gst-invoice .py-1 {
                    padding-top: 0.9mm !important;
                    padding-bottom: 0.9mm !important;
                }
                .gst-invoice .px-2 {
                    padding-left: 1.6mm !important;
                    padding-right: 1.6mm !important;
                }
                .gst-total-highlight {
                    background: #e6f0ff;
                    font-size: 10.5pt;
                }
                .gst-total-highlight .gst-amount {
                    font-size: 12pt;
                    font-weight: 700;
                }
                .gst-footer-text {
                    font-size: 8.5pt;
                }
                .gst-bank-compact {
                    padding-top: 10px;
                    padding-bottom: 10px;
                }
                .gst-bank-row {
                    padding-bottom: 3px;
                }
                .gst-terms-pad {
                    padding-top: 10px;
                    padding-bottom: 10px;
                }
                .gst-signature-block {
                    padding-top: 3mm;
                    padding-bottom: 3mm;
                }
                .gst-hide-print {
                    display: none !important;
                }
                .gst-invoice table {
                    page-break-inside: avoid;
                }
                .gst-invoice thead {
                    display: table-header-group;
                }
                .gst-invoice tbody {
                    display: table-row-group;
                }
                .gst-logo-box {
                    height: 120px;
                    width: 120px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .gst-logo {
                    max-height: 120px;
                    width: 100%;
                    object-fit: contain;
                }
                .gst-no-break {
                    break-inside: avoid;
                    page-break-inside: avoid;
                }
                .gst-table {
                    page-break-inside: avoid;
                }
                .gst-table tr,
                .gst-table td,
                .gst-table th {
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                .gst-section-title {
                    font-size: 10px;
                    line-height: 1.2;
                }
            }
        `}</style>
        </>
    );
};

export default ComponentsAppsInvoicePreview;
