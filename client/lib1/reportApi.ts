import { apiGet } from '@/lib/apiClient';

export type SalesReportItem = {
    invoice_date: string;
    invoice_number: string;
    invoice_type: 'TAX' | 'NON_TAX';
    subtotal: number;
    tax_amount: number;
    round_off: number;
    invoice_total: number;
    customer_name?: string | null;
};

export type SalesReportSummary = {
    total_taxable_sales: number;
    total_non_tax_sales: number;
    total_tax_collected: number;
    net_sales_value: number;
};

export type SalesReportResponse = {
    total: number;
    items: SalesReportItem[];
    summary: SalesReportSummary;
};

export type PurchaseReportItem = {
    purchase_date?: string | null;
    purchase_invoice_number: number;
    supplier_name?: string | null;
    subtotal: number;
    tax_amount: number;
    invoice_total: number;
};

export type PurchaseReportSummary = {
    total_purchase_value: number;
    total_input_tax: number;
    net_purchase_amount: number;
};

export type PurchaseReportResponse = {
    total: number;
    items: PurchaseReportItem[];
    summary: PurchaseReportSummary;
};

export type TaxReportItem = {
    report_date: string;
    taxable_amount: number;
    cgst_amount: number;
    sgst_amount: number;
    total_tax_amount: number;
    cgst_rate: number;
    sgst_rate: number;
};

export type TaxReportSummary = {
    total_output_tax: number;
    total_input_tax: number;
    net_tax_payable: number;
};

export type TaxReportResponse = {
    items: TaxReportItem[];
    summary: TaxReportSummary;
};

export type GstSummaryMonthlyItem = {
    report_year: number;
    report_month: number;
    taxable_amount: number;
    cgst_amount: number;
    sgst_amount: number;
    igst_amount: number;
    total_tax_amount: number;
};

export type GstSummaryMonthlySummary = {
    total_taxable_amount: number;
    total_output_tax: number;
    total_input_tax: number;
    net_tax_payable: number;
};

export type GstSummaryMonthlyResponse = {
    items: GstSummaryMonthlyItem[];
    summary: GstSummaryMonthlySummary;
};

export type SalesPartyReportItem = {
    party_name?: string | null;
    invoice_count: number;
    taxable_amount: number;
    tax_amount: number;
    invoice_total: number;
};

export type SalesPartyReportSummary = {
    total_taxable_amount: number;
    total_tax_amount: number;
    total_invoice_amount: number;
};

export type SalesPartyReportResponse = {
    total: number;
    items: SalesPartyReportItem[];
    summary: SalesPartyReportSummary;
};

export type PurchasePartyReportItem = {
    party_name?: string | null;
    invoice_count: number;
    subtotal: number;
    tax_amount: number;
    invoice_total: number;
};

export type PurchasePartyReportSummary = {
    total_purchase_value: number;
    total_input_tax: number;
    net_purchase_amount: number;
};

export type PurchasePartyReportResponse = {
    total: number;
    items: PurchasePartyReportItem[];
    summary: PurchasePartyReportSummary;
};

const buildQuery = (params: Record<string, string | number | undefined | null>) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.set(key, String(value));
        }
    });
    const suffix = query.toString();
    return suffix ? `?${suffix}` : '';
};

export const fetchSalesReport = (params: Record<string, string | number | undefined>) =>
    apiGet<SalesReportResponse>(`reports/sales${buildQuery(params)}`);

export const fetchPurchaseReport = (params: Record<string, string | number | undefined>) =>
    apiGet<PurchaseReportResponse>(`reports/purchase${buildQuery(params)}`);

export const fetchTaxReport = (params: Record<string, string | number | undefined>) =>
    apiGet<TaxReportResponse>(`reports/tax${buildQuery(params)}`);

export const fetchGstSummaryMonthlyReport = (params: Record<string, string | number | undefined>) =>
    apiGet<GstSummaryMonthlyResponse>(`reports/gst-summary-monthly${buildQuery(params)}`);

export const fetchSalesPartyReport = (params: Record<string, string | number | undefined>) =>
    apiGet<SalesPartyReportResponse>(`reports/sales-party${buildQuery(params)}`);

export const fetchPurchasePartyReport = (params: Record<string, string | number | undefined>) =>
    apiGet<PurchasePartyReportResponse>(`reports/purchase-party${buildQuery(params)}`);
