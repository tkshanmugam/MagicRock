export type CustomerRecord = {
    id: string;
    organisation_id: number | null;
    name: string;
    address: string;
    state: string;
    state_code: string;
    gstin: string;
    contact_no: string;
    created_at: string;
    updated_at: string;
};

type CustomerInput = Omit<CustomerRecord, 'id' | 'created_at' | 'updated_at'> & {
    id?: string;
};

const STORAGE_KEY = 'bizledger.customers';

const normalizeText = (value?: string) => (value || '').trim().toLowerCase();
const normalizeGstin = (value?: string) => (value || '').trim().toUpperCase();

const readStore = (): CustomerRecord[] => {
    if (typeof window === 'undefined') {
        return [];
    }
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('Failed to read customer store', error);
        return [];
    }
};

const writeStore = (customers: CustomerRecord[]) => {
    if (typeof window === 'undefined') {
        return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
};

export const getCustomersForOrganisation = (_organisationId?: number | string | null) => {
    return readStore();
};

export const getCustomerById = (id: string) => {
    const customers = readStore();
    return customers.find((customer) => customer.id === id) || null;
};

export const saveCustomer = (customer: CustomerInput) => {
    const now = new Date().toISOString();
    const customers = readStore();
    const targetGstin = normalizeGstin(customer.gstin);
    const existingIndex = customers.findIndex((entry) => normalizeGstin(entry.gstin) === targetGstin);
    const record: CustomerRecord = {
        id: customer.id || (existingIndex >= 0 ? customers[existingIndex].id : `${Date.now()}`),
        organisation_id: customer.organisation_id ?? null,
        name: customer.name.trim(),
        address: customer.address.trim(),
        state: customer.state.trim(),
        state_code: customer.state_code.trim(),
        gstin: customer.gstin.trim().toUpperCase(),
        contact_no: customer.contact_no.trim(),
        created_at: existingIndex >= 0 ? customers[existingIndex].created_at : now,
        updated_at: now,
    };
    if (existingIndex >= 0) {
        customers[existingIndex] = record;
    } else {
        customers.unshift(record);
    }
    writeStore(customers);
    return record;
};

export const updateCustomer = (id: string, customer: CustomerInput) => {
    const now = new Date().toISOString();
    const customers = readStore();
    const existingIndex = customers.findIndex((entry) => entry.id === id);
    if (existingIndex < 0) {
        return null;
    }
    const record: CustomerRecord = {
        ...customers[existingIndex],
        name: customer.name.trim(),
        address: customer.address.trim(),
        state: customer.state.trim(),
        state_code: customer.state_code.trim(),
        gstin: customer.gstin.trim().toUpperCase(),
        contact_no: customer.contact_no.trim(),
        updated_at: now,
    };
    customers[existingIndex] = record;
    writeStore(customers);
    return record;
};

export const deleteCustomer = (id: string) => {
    const customers = readStore();
    const next = customers.filter((customer) => customer.id !== id);
    if (next.length === customers.length) {
        return false;
    }
    writeStore(next);
    return true;
};

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
