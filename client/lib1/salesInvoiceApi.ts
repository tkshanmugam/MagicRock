import { apiGet, apiPost, apiPut, apiRequest } from '@/lib/apiClient';

export type SalesInvoiceItemPayload = {
    item_id?: number | null;
    item_name: string;
    hsn_code?: string | null;
    quantity: number;
    uom?: string | null;
    rate: number;
};

export type SalesInvoicePayload = {
    organisation_id: number;
    invoice_number?: string;
    invoice_date: string;
    invoice_type: 'TAX' | 'BILL_OF_SUPPLY' | 'EXPORT';
    transport?: string | null;
    customer_name: string;
    customer_address?: string | null;
    customer_state?: string | null;
    customer_state_code?: string | null;
    customer_gstin?: string | null;
    customer_contact?: string | null;
    place_of_supply?: string | null;
    vehicle_no?: string | null;
    other_charges?: number;
    round_off?: number;
    items: SalesInvoiceItemPayload[];
};

export type SalesInvoiceItem = SalesInvoiceItemPayload & {
    id: number;
    total_amount: number;
};

export type SalesInvoice = Omit<SalesInvoicePayload, 'items' | 'invoice_number'> & {
    invoice_number: string;
    id: number;
    taxable_value: number;
    cgst_amount: number;
    sgst_amount: number;
    igst_amount: number;
    invoice_total: number;
    invoice_value_words?: string | null;
    status: 'ACTIVE' | 'CANCELLED';
    created_at: string;
    created_by: number;
    modified_at?: string | null;
    modified_by?: number | null;
    items: SalesInvoiceItem[];
};

export type SalesInvoiceListResponse = {
    total: number;
    items: SalesInvoice[];
};

export const createSalesInvoice = (payload: SalesInvoicePayload) =>
    apiPost<SalesInvoice>('sales-invoices', payload);

export const updateSalesInvoice = (id: number, payload: Partial<SalesInvoicePayload>) =>
    apiPut<SalesInvoice>(`sales-invoices/${id}`, payload);

export const fetchSalesInvoice = (id: number) =>
    apiGet<SalesInvoice>(`sales-invoices/${id}`);

export const fetchNextSalesInvoiceNumber = (organisationId: number) =>
    apiGet<{ invoice_number: string }>(`sales-invoices/next-number?organisation_id=${organisationId}`);

export const cancelSalesInvoice = async (id: number) => {
    const response = await apiRequest(`sales-invoices/${id}/cancel`, { method: 'PATCH' });
    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(error.detail || `HTTP ${response.status}`);
    }
    return response.json() as Promise<SalesInvoice>;
};

export const listSalesInvoices = (params: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.set(key, String(value));
        }
    });
    const suffix = query.toString();
    return apiGet<SalesInvoiceListResponse>(`sales-invoices${suffix ? `?${suffix}` : ''}`);
};
