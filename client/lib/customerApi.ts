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

/** Global list; send X-Organization-Id (selected org) for RBAC. */
export const listCustomers = () => apiGet<CustomerRecord[]>('customers');

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
