import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/apiClient';

export type CustomerRecord = {
    id: number;
    name: string;
    address: string | null;
    state: string | null;
    state_code: string | null;
    gstin: string;
    contact_no: string | null;
    created_at: string;
    updated_at: string;
};

export type CustomerWritePayload = {
    name: string;
    address?: string | null;
    state?: string | null;
    state_code?: string | null;
    gstin: string;
    contact_no?: string | null;
};

export type CustomerListParams = {
    skip?: number;
    limit?: number;
    search?: string;
    sort_by?: 'name' | 'gstin' | 'contact_no' | 'state' | 'updated_at' | 'created_at' | 'id';
    sort_dir?: 'asc' | 'desc';
};

export type CustomerListResponse = { total: number; items: CustomerRecord[] };

const buildCustomerListQuery = (params: CustomerListParams) => {
    const query = new URLSearchParams();
    if (params.skip != null) query.set('skip', String(params.skip));
    if (params.limit != null) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.sort_by) query.set('sort_by', params.sort_by);
    if (params.sort_dir) query.set('sort_dir', params.sort_dir);
    const suffix = query.toString();
    return suffix ? `?${suffix}` : '';
};

/** Paginated list; send X-Organization-Id (selected org) for RBAC. */
export const listCustomersPaged = (params: CustomerListParams = {}) =>
    apiGet<CustomerListResponse>(`customers${buildCustomerListQuery(params)}`);

const DIRECTORY_FETCH_LIMIT = 10_000;

/**
 * Full customer rows for pickers/autocomplete (capped). Prefer listCustomersPaged in list UIs.
 * Global list; send X-Organization-Id (selected org) for RBAC.
 */
export const listCustomers = () =>
    listCustomersPaged({ skip: 0, limit: DIRECTORY_FETCH_LIMIT }).then((r) => r.items);

export const fetchCustomer = (id: number) => apiGet<CustomerRecord>(`customers/${id}`);

export const createCustomer = (payload: CustomerWritePayload) => apiPost<CustomerRecord>('customers', payload);

export const updateCustomer = (id: number, payload: Partial<CustomerWritePayload>) =>
    apiPut<CustomerRecord>(`customers/${id}`, payload);

export const deleteCustomer = (id: number) => apiDelete<void>(`customers/${id}`);

const normalizeText = (value?: string | null) => (value || '').trim().toLowerCase();
const normalizeGstin = (value?: string | null) => (value || '').trim().toUpperCase();

export const findCustomerByGstin = (customers: CustomerRecord[], gstin: string) => {
    const normalized = normalizeGstin(gstin);
    if (!normalized) {
        return null;
    }
    return customers.find((customer) => normalizeGstin(customer.gstin) === normalized) || null;
};

export const findCustomerByName = (customers: CustomerRecord[], name: string) => {
    const normalized = normalizeText(name);
    if (!normalized) {
        return null;
    }
    return customers.find((customer) => normalizeText(customer.name) === normalized) || null;
};
