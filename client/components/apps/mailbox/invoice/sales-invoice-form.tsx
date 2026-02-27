'use client';
import IconEye from '@/components/icon/icon-eye';
import IconSave from '@/components/icon/icon-save';
import IconX from '@/components/icon/icon-x';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { apiGet } from '@/lib/apiClient';
import { authState } from '@/lib/authState';
import { organizationContext } from '@/lib/organizationContext';
import { numberToWords } from '@/lib/numberToWords';
import { SalesInvoicePayload, createSalesInvoice, fetchNextSalesInvoiceNumber, fetchSalesInvoice, updateSalesInvoice } from '@/lib/salesInvoiceApi';
import { CustomerRecord, findCustomerByGstin, findCustomerByName, getCustomersForOrganisation } from '@/lib/customerStore';

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

type InvoiceItem = {
    id: number;
    item_name: string;
    hsn_code?: string;
    quantity: string;
    uom?: string;
    rate: string;
};

type TaxConfig = {
    sgst_percentage: number;
    cgst_percentage: number;
    igst_percentage: number;
};

type Props = {
    mode: 'create' | 'edit';
    invoiceId?: number;
};

const SalesInvoiceForm = ({ mode, invoiceId }: Props) => {
    const canCreateSales = organizationContext.hasPermission('Sales', 'create');
    const canUpdateSales = organizationContext.hasPermission('Sales', 'update');
    const canSubmit = mode === 'create' ? canCreateSales : canUpdateSales;
    const [isSuperAdmin, setIsSuperAdmin] = useState(organizationContext.getIsSuperAdmin());
    const [organisationsList, setOrganisationsList] = useState<any[]>([]);
    const [orgsLoading, setOrgsLoading] = useState<boolean>(false);
    const [organisationId, setOrganisationId] = useState<string>('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [invoiceNumberLoading, setInvoiceNumberLoading] = useState(false);
    const todayDate = new Date().toISOString().split('T')[0];
    const [invoiceDate, setInvoiceDate] = useState<string>(todayDate);
    const [invoiceType, setInvoiceType] = useState<'TAX' | 'BILL_OF_SUPPLY' | 'EXPORT'>('TAX');
    const [vehicleNo, setVehicleNo] = useState('');
    const [transportName, setTransportName] = useState('');
    const [placeOfSupply, setPlaceOfSupply] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [customerState, setCustomerState] = useState('');
    const [customerStateCode, setCustomerStateCode] = useState('');
    const [customerGstin, setCustomerGstin] = useState('');
    const [customerContact, setCustomerContact] = useState('');
    const [otherCharges, setOtherCharges] = useState<string>('0');
    const [roundOff, setRoundOff] = useState<string>('0');
    const [customerDirectory, setCustomerDirectory] = useState<CustomerRecord[]>([]);
    const [items, setItems] = useState<InvoiceItem[]>([
        {
            id: 1,
            item_name: '',
            hsn_code: '',
            quantity: '',
            uom: '',
            rate: '',
        },
    ]);
    const [taxConfig, setTaxConfig] = useState<TaxConfig | null>(null);
    const [taxSettingsConfigured, setTaxSettingsConfigured] = useState<boolean>(true);
    const [taxConfigMessage, setTaxConfigMessage] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [saving, setSaving] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');

    const inputBorderClass = 'form-input !border-t-0 !border-l-0 !border-r-0 !rounded-none';
    const getLogoUrl = useCallback((logoName: string) => {
        if (!logoName) return '';
        const normalized = logoName.startsWith('/') ? logoName.slice(1) : logoName;
        return `${UPLOADS_BASE_URL}/${normalized}`;
    }, []);

    const showMessage = (msg = '', type: 'success' | 'error' | 'warning' = 'success') => {
        const toast: any = Swal.mixin({
            toast: true,
            position: 'top',
            showConfirmButton: false,
            timer: 3000,
            customClass: { container: 'toast' },
        });
        toast.fire({
            icon: type,
            title: msg,
            padding: '10px 20px',
        });
    };

    const addItem = () => {
        const maxId = items.length ? items.reduce((max, item) => (item.id > max ? item.id : max), items[0].id) : 0;
        setItems([
            ...items,
            {
                id: maxId + 1,
                item_name: '',
                hsn_code: '',
                quantity: '',
                uom: '',
                rate: '',
            },
        ]);
    };

    const removeItem = (item: InvoiceItem) => {
        setItems(items.filter((d) => d.id !== item.id));
    };

    const updateItemField = (field: keyof InvoiceItem, value: string, id: number) => {
        const list = items.map((item) => (item.id === id ? { ...item, [field]: value } : item));
        setItems(list);
    };

    useEffect(() => {
        organizationContext.updateIsSuperAdminFromToken();
        setIsSuperAdmin(organizationContext.getIsSuperAdmin());
    }, []);

    const fetchOrganisations = useCallback(async () => {
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
    }, [isSuperAdmin]);

    useEffect(() => {
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
    }, [fetchOrganisations]);

    useEffect(() => {
        if (!organisationsList.length) {
            return;
        }
        const storedId = organizationContext.getSelectedOrganizationId();
        const storedMatch = storedId ? organisationsList.find((org: any) => String(org.id) === String(storedId)) : null;
        if (storedMatch && !organisationId) {
            setOrganisationId(String(storedMatch.id));
            return;
        }
        if (!organisationId) {
            setOrganisationId(String(organisationsList[0].id));
        }
    }, [organisationsList, organisationId]);

    useEffect(() => {
        if (organisationId) {
            organizationContext.setSelectedOrganizationId(Number(organisationId));
        }
    }, [organisationId]);

    useEffect(() => {
        setCustomerDirectory(getCustomersForOrganisation(organisationId));
    }, [organisationId]);

    useEffect(() => {
        const handleStorage = () => {
            setCustomerDirectory(getCustomersForOrganisation(organisationId));
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, [organisationId]);

    const fetchNextInvoiceNumber = useCallback(async () => {
        if (mode !== 'create' || !organisationId) {
            return;
        }
        setInvoiceNumberLoading(true);
        setInvoiceNumber('');
        try {
            const response = await fetchNextSalesInvoiceNumber(Number(organisationId));
            setInvoiceNumber(response.invoice_number);
        } catch (error) {
            console.error('Failed to fetch next invoice number', error);
        } finally {
            setInvoiceNumberLoading(false);
        }
    }, [mode, organisationId]);

    useEffect(() => {
        fetchNextInvoiceNumber();
    }, [fetchNextInvoiceNumber]);

    const fetchInvoice = useCallback(async () => {
        if (!invoiceId) {
            return;
        }
        setLoading(true);
        try {
            const invoice = await fetchSalesInvoice(invoiceId);
            setOrganisationId(String(invoice.organisation_id));
            setInvoiceNumber(invoice.invoice_number);
            setInvoiceDate(invoice.invoice_date);
            setInvoiceType(invoice.invoice_type);
            setVehicleNo(invoice.vehicle_no || '');
            setTransportName((invoice as any)?.transport || '');
            setPlaceOfSupply(invoice.place_of_supply || '');
            setCustomerName(invoice.customer_name || '');
            setCustomerAddress(invoice.customer_address || '');
            setCustomerState(invoice.customer_state || '');
            setCustomerStateCode(invoice.customer_state_code || '');
            setCustomerGstin(invoice.customer_gstin || '');
            setCustomerContact(invoice.customer_contact || '');
            setOtherCharges(String(invoice.other_charges ?? 0));
            setRoundOff(String(invoice.round_off ?? 0));
            setItems(
                invoice.items.map((item) => ({
                    id: item.id,
                    item_name: item.item_name,
                    hsn_code: item.hsn_code || '',
                    quantity: String(item.quantity),
                    uom: item.uom || '',
                    rate: String(item.rate),
                }))
            );
        } catch (error) {
            console.error('Failed to fetch invoice', error);
        } finally {
            setLoading(false);
        }
    }, [invoiceId]);

    useEffect(() => {
        if (mode === 'edit') {
            fetchInvoice();
        }
    }, [fetchInvoice, mode]);

    const fetchTaxConfig = useCallback(async () => {
        if (!organisationId || invoiceType !== 'TAX') {
            setTaxSettingsConfigured(true);
            setTaxConfigMessage('');
            setTaxConfig(null);
            return;
        }
        try {
            const response = await apiGet<any>(`tax-configurations/active?organisation_id=${organisationId}`);
            setTaxConfig({
                sgst_percentage: Number(response.sgst_percentage || 0),
                cgst_percentage: Number(response.cgst_percentage || 0),
                igst_percentage: Number(response.igst_percentage || 0),
            });
            setTaxSettingsConfigured(true);
            setTaxConfigMessage('');
        } catch (error) {
            setTaxSettingsConfigured(false);
            setTaxConfigMessage('Tax settings are not configured for this organisation.');
            setTaxConfig(null);
        }
    }, [organisationId, invoiceType]);

    useEffect(() => {
        fetchTaxConfig();
    }, [fetchTaxConfig]);

    const totals = useMemo(() => {
        const parsedOtherCharges = Number(otherCharges || 0);
        const parsedRoundOff = Number(roundOff || 0);
        const subtotal = items.reduce((sum, item) => {
            const qty = Number(item.quantity || 0);
            const rate = Number(item.rate || 0);
            return sum + qty * rate;
        }, 0);
        const cgst = invoiceType === 'TAX' ? (subtotal * (taxConfig?.cgst_percentage || 0)) / 100 : 0;
        const sgst = invoiceType === 'TAX' ? (subtotal * (taxConfig?.sgst_percentage || 0)) / 100 : 0;
        const igst = invoiceType === 'TAX' ? (subtotal * (taxConfig?.igst_percentage || 0)) / 100 : 0;
        const invoiceTotal = subtotal + cgst + sgst + igst + parsedOtherCharges - parsedRoundOff;
        return {
            subtotal,
            cgst,
            sgst,
            igst,
            invoiceTotal,
            words: numberToWords(invoiceTotal),
        };
    }, [items, otherCharges, roundOff, invoiceType, taxConfig]);

    const applyCustomerSelection = useCallback((customer: CustomerRecord) => {
        setCustomerName(customer.name);
        setCustomerAddress(customer.address);
        setCustomerState(customer.state);
        setCustomerStateCode(customer.state_code);
        setCustomerGstin(customer.gstin);
        setCustomerContact(customer.contact_no);
    }, []);

    const handleCustomerNameChange = (value: string) => {
        setCustomerName(value);
        const match = findCustomerByName(customerDirectory, value);
        if (match) {
            applyCustomerSelection(match);
        }
    };

    const handleCustomerGstinChange = (value: string) => {
        setCustomerGstin(value);
        const match = findCustomerByGstin(customerDirectory, value);
        if (match) {
            applyCustomerSelection(match);
        }
    };

    const validateForm = () => {
        if (!organisationId) {
            setErrorMessage('Organisation is required.');
            return false;
        }
        if (mode === 'create' && !invoiceNumber) {
            setErrorMessage('Invoice number is being generated.');
            return false;
        }
        if (!customerName) {
            setErrorMessage('Customer name is required.');
            return false;
        }
        if (!items.length) {
            setErrorMessage('Invoice must have at least one item.');
            return false;
        }
        for (const item of items) {
            if (!item.item_name || Number(item.quantity) <= 0 || Number(item.rate) <= 0) {
                setErrorMessage('Each item must have name, quantity, and rate.');
                return false;
            }
        }
        if (Math.abs(Number(roundOff || 0)) > totals.subtotal) {
            setErrorMessage('Round off cannot exceed subtotal.');
            return false;
        }
        if (invoiceType === 'TAX' && !taxSettingsConfigured) {
            setErrorMessage('Active tax configuration is required for TAX invoices.');
            return false;
        }
        setErrorMessage('');
        return true;
    };

    const handleSave = async () => {
        if (!validateForm() || !canSubmit) {
            return;
        }
        setSaving(true);
        try {
            const orgId = Number(organisationId);
            if (!orgId) {
                setErrorMessage('Please select a valid organisation.');
                setSaving(false);
                return;
            }
            const payload: SalesInvoicePayload = {
                organisation_id: orgId,
                invoice_date: invoiceDate,
                invoice_type: invoiceType,
                customer_name: customerName,
                customer_address: customerAddress || null,
                customer_state: customerState || null,
                customer_state_code: customerStateCode || null,
                customer_gstin: customerGstin || null,
                customer_contact: customerContact || null,
                place_of_supply: placeOfSupply || null,
                vehicle_no: vehicleNo || null,
                transport: transportName || null,
                other_charges: Number(otherCharges || 0),
                round_off: Number(roundOff || 0),
                items: items.map((item) => ({
                    item_name: item.item_name,
                    hsn_code: item.hsn_code || null,
                    quantity: Number(item.quantity || 0),
                    uom: item.uom || null,
                    rate: Number(item.rate || 0),
                })),
            };
            if (mode === 'create') {
                payload.invoice_number = invoiceNumber;
                await createSalesInvoice(payload);
                showMessage('Sales voucher saved successfully.');
                setTimeout(() => window.location.reload(), 300);
            } else if (invoiceId) {
                await updateSalesInvoice(invoiceId, payload);
                showMessage('Sales voucher updated successfully.');
            }
            setErrorMessage('');
        } catch (error: any) {
            setErrorMessage(error.message || 'Failed to save invoice.');
        } finally {
            setSaving(false);
        }
    };

    const selectedOrganisation = organisationsList.find((org: any) => String(org.id) === String(organisationId));
    const selectedOrganisationLabel = selectedOrganisation?.name || (organisationId ? `Organisation #${organisationId}` : 'Selected Organisation');
    const selectedOrganisationAddressLines = [selectedOrganisation?.address, selectedOrganisation?.city].filter(Boolean);
    const selectedOrganisationLogoUrl = selectedOrganisation?.logo_name ? getLogoUrl(selectedOrganisation.logo_name) : '';

    if (!canSubmit) {
        return (
            <div className="panel border-white-light px-5 py-8 text-center font-semibold dark:border-[#1b2e4b]">
                You do not have permission to {mode === 'create' ? 'create' : 'update'} Sales.
            </div>
        );
    }

    return (
        <div className="panel px-4 py-6">
            {isSuperAdmin ? (
                <div className="mb-4 flex flex-wrap items-center gap-3">
                    <label htmlFor="organisationId" className="mb-0">
                        Organisation Name
                    </label>
                    <select
                        id="organisationId"
                        className="form-select w-full sm:w-72"
                        value={organisationId}
                        onChange={(e) => setOrganisationId(e.target.value)}
                    >
                        <option value="">{orgsLoading ? 'Loading organisations...' : 'Select Organisation'}</option>
                        {organisationsList.map((org: any) => (
                            <option key={org.id} value={org.id}>
                                {org.name}
                            </option>
                        ))}
                    </select>
                </div>
            ) : (
                <div className="mb-4 flex flex-wrap items-center gap-3">
                    <label htmlFor="organisationId" className="mb-0">
                        Organisation Name
                    </label>
                    <input id="organisationId" className={`${inputBorderClass} w-full sm:w-72`} value={selectedOrganisationLabel} readOnly />
                </div>
            )}

            <div className="rounded border border-white-light p-4 dark:border-[#1b2e4b]">
                <div className="flex items-start justify-between gap-4">
                    {selectedOrganisationLogoUrl && (
                        <div className="shrink-0">
                            <img
                                src={selectedOrganisationLogoUrl}
                                alt={`${selectedOrganisationLabel} logo`}
                                className="h-[150px] w-[150px] rounded-full object-contain"
                            />
                        </div>
                    )}
                    <div className="flex-1 text-center">
                        <div className="text-lg font-bold text-black dark:text-white">{invoiceType === 'TAX' ? 'TAX INVOICE' : 'SALES INVOICE'}</div>
                        <div className="mt-2 text-2xl font-extrabold text-black dark:text-white">{selectedOrganisationLabel}</div>
                        <div className="mt-1 text-sm text-gray-500">
                            {selectedOrganisationAddressLines.length ? (
                                selectedOrganisationAddressLines.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)
                            ) : (
                                <div>Address not available</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-4 grid gap-2 border-y border-white-light py-3 text-sm dark:border-[#1b2e4b] md:grid-cols-5">
                    <div className="space-y-1">
                        <div className="font-semibold text-gray-600">Invoice Number</div>
                        <input
                            className={`${inputBorderClass} h-8 text-sm`}
                            value={invoiceNumber}
                            placeholder={invoiceNumberLoading ? 'Generating...' : ''}
                            readOnly
                        />
                    </div>
                    <div className="space-y-1">
                        <div className="font-semibold text-gray-600">Invoice Date</div>
                        <input
                            type="date"
                            className={`${inputBorderClass} h-8 text-sm`}
                            value={invoiceDate}
                            max={todayDate}
                            onChange={(e) => setInvoiceDate(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <div className="font-semibold text-gray-600">Invoice Type</div>
                        <select className={`${inputBorderClass} h-8 text-sm`} value={invoiceType} onChange={(e) => setInvoiceType(e.target.value as any)}>
                            <option value="TAX">TAX</option>
                            <option value="BILL_OF_SUPPLY">BILL OF SUPPLY</option>
                            <option value="EXPORT">EXPORT</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <div className="font-semibold text-gray-600">Vehicle No</div>
                        <input className={`${inputBorderClass} h-8 text-sm`} value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <div className="font-semibold text-gray-600">Transport Name</div>
                        <input className={`${inputBorderClass} h-8 text-sm`} value={transportName} onChange={(e) => setTransportName(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <div className="font-semibold text-gray-600">Place of Supply</div>
                        <input className={`${inputBorderClass} h-8 text-sm`} value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)} />
                    </div>
                </div>

                {invoiceType === 'TAX' && !taxSettingsConfigured && (
                    <div className="mt-3 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-500/40 dark:bg-yellow-900/20 dark:text-yellow-100">
                        <div>{taxConfigMessage}</div>
                        <div className="mt-2">
                            <Link href="/apps/tsettings" className="font-semibold text-yellow-900 underline dark:text-yellow-100">
                                Configure Tax Settings
                            </Link>
                        </div>
                    </div>
                )}

                <div className="mt-4 grid gap-4 md:grid-cols-[2fr_1fr]">
                    <div className="rounded border border-white-light p-3 text-sm dark:border-[#1b2e4b]">
                        <div className="font-semibold text-gray-600">Details Of Recipient ( Billed to ) :</div>
                        <div className="mt-2 grid gap-2">
                            <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                                <div>Name</div>
                                <input
                                    className={`${inputBorderClass} h-8 text-sm`}
                                    list="customerNameOptions"
                                    value={customerName}
                                    onChange={(e) => handleCustomerNameChange(e.target.value)}
                                />
                                <datalist id="customerNameOptions">
                                    {customerDirectory.map((customer) => (
                                        <option key={customer.id} value={customer.name} label={customer.gstin} />
                                    ))}
                                </datalist>
                            </div>
                            <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                                <div>Address</div>
                                <input className={`${inputBorderClass} h-8 text-sm`} value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                                <div>State</div>
                                <input className={`${inputBorderClass} h-8 text-sm`} value={customerState} onChange={(e) => setCustomerState(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                                <div>State Code</div>
                                <input className={`${inputBorderClass} h-8 text-sm`} value={customerStateCode} onChange={(e) => setCustomerStateCode(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                                <div>GSTIN</div>
                                <input
                                    className={`${inputBorderClass} h-8 text-sm`}
                                    list="customerGstinOptions"
                                    value={customerGstin}
                                    onChange={(e) => handleCustomerGstinChange(e.target.value)}
                                />
                                <datalist id="customerGstinOptions">
                                    {customerDirectory.map((customer) => (
                                        <option key={customer.id} value={customer.gstin} label={customer.name} />
                                    ))}
                                </datalist>
                            </div>
                            <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                                <div>Contact No</div>
                                <input className={`${inputBorderClass} h-8 text-sm`} value={customerContact} onChange={(e) => setCustomerContact(e.target.value)} />
                            </div>
                        </div>
                    </div>
                    <div className="rounded border border-white-light p-3 text-sm dark:border-[#1b2e4b]">
                        <div className="font-semibold text-gray-600">Invoice Value ( In Words )</div>
                        <textarea className={`${inputBorderClass} mt-2 min-h-[160px] text-sm`} value={totals.words} readOnly />
                    </div>
                </div>

                <div className="mt-4">
                    <div className="table-responsive">
                        <table className="table-striped">
                            <thead>
                                <tr>
                                    <th className="w-12 text-center">S.No.</th>
                                    <th>Description Of Goods</th>
                                    <th className="w-32 text-center">HSN / SAC Code</th>
                                    <th className="w-20 text-center">Qty</th>
                                    <th className="w-20 text-center">UOM</th>
                                    <th className="w-28 text-center">Rate</th>
                                    <th className="w-28 text-center">Total</th>
                                    <th className="w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.length <= 0 && (
                                    <tr>
                                        <td colSpan={8} className="!text-center font-semibold">
                                            No Item Available
                                        </td>
                                    </tr>
                                )}
                                {items.map((item, index) => {
                                    const itemTotal = Number(item.quantity || 0) * Number(item.rate || 0);
                                    return (
                                        <tr key={item.id}>
                                            <td className="text-center">{index + 1}</td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className={inputBorderClass}
                                                    placeholder="Description"
                                                    value={item.item_name}
                                                    onChange={(e) => updateItemField('item_name', e.target.value, item.id)}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className={`${inputBorderClass} text-center`}
                                                    placeholder="HSN/SAC"
                                                    value={item.hsn_code}
                                                    onChange={(e) => updateItemField('hsn_code', e.target.value, item.id)}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className={`${inputBorderClass} w-24 text-center`}
                                                    placeholder="Qty"
                                                    value={item.quantity}
                                                    onChange={(e) => updateItemField('quantity', e.target.value, item.id)}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className={`${inputBorderClass} text-center`}
                                                    placeholder="UOM"
                                                    value={item.uom}
                                                    onChange={(e) => updateItemField('uom', e.target.value, item.id)}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    className={`${inputBorderClass} w-20 text-center`}
                                                    placeholder="Rate"
                                                    value={item.rate}
                                                    onChange={(e) => updateItemField('rate', e.target.value, item.id)}
                                                />
                                            </td>
                                            <td>
                                                <input type="text" className={`${inputBorderClass} w-20 text-center`} value={itemTotal.toFixed(2)} readOnly />
                                            </td>
                                            <td>
                                                <button type="button" onClick={() => removeItem(item)}>
                                                    <IconX className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <button type="button" className="btn btn-primary" onClick={() => addItem()}>
                            Add Item
                        </button>
                    </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-[2fr_1fr]">
                    <div className="rounded border border-white-light p-3 text-sm dark:border-[#1b2e4b]">
                        <div className="font-semibold text-gray-600">Bank Details</div>
                        <div className="mt-2 grid gap-2">
                            <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                                <div>Bank Name</div>
                                <div className="text-sm text-gray-800 dark:text-gray-200">{selectedOrganisation?.bank_name || ''}</div>
                            </div>
                            <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                                <div>Account No</div>
                                <div className="text-sm text-gray-800 dark:text-gray-200">{selectedOrganisation?.account_number || ''}</div>
                            </div>
                            <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                                <div>IFSC Code</div>
                                <div className="text-sm text-gray-800 dark:text-gray-200">{selectedOrganisation?.ifsc_code || ''}</div>
                            </div>
                            <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                                <div>Branch</div>
                                <div className="text-sm text-gray-800 dark:text-gray-200">{selectedOrganisation?.branch || ''}</div>
                            </div>
                        </div>
                    </div>
                    <div className="rounded border border-white-light p-3 text-sm dark:border-[#1b2e4b]">
                        <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                                <div>Other Charges</div>
                                <input
                                    className={`${inputBorderClass} h-8 w-28 text-right text-sm`}
                                    value={otherCharges}
                                    onChange={(e) => setOtherCharges(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>Round Off</div>
                                <input
                                    className={`${inputBorderClass} h-8 w-28 text-right text-sm`}
                                    value={roundOff}
                                    onChange={(e) => setRoundOff(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>Taxable Value</div>
                                <input className={`${inputBorderClass} h-8 w-28 text-right text-sm`} value={totals.subtotal.toFixed(2)} readOnly />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>{`SGST ${taxConfig?.sgst_percentage?.toFixed(2) || '0.00'}%`}</div>
                                <input className={`${inputBorderClass} h-8 w-28 text-right text-sm`} value={totals.sgst.toFixed(2)} readOnly />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>{`CGST ${taxConfig?.cgst_percentage?.toFixed(2) || '0.00'}%`}</div>
                                <input className={`${inputBorderClass} h-8 w-28 text-right text-sm`} value={totals.cgst.toFixed(2)} readOnly />
                            </div>
                            {Number(taxConfig?.igst_percentage || 0) > 0 && (
                                <div className="flex items-center justify-between">
                                    <div>{`IGST ${taxConfig?.igst_percentage?.toFixed(2) || '0.00'}%`}</div>
                                    <input className={`${inputBorderClass} h-8 w-28 text-right text-sm`} value={totals.igst.toFixed(2)} readOnly />
                                </div>
                            )}
                            <div className="flex items-center justify-between font-semibold">
                                <div>Invoice Total</div>
                                <input className={`${inputBorderClass} h-8 w-28 text-right text-sm`} value={totals.invoiceTotal.toFixed(2)} readOnly />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {errorMessage && <div className="mt-4 text-sm text-danger">{errorMessage}</div>}

            <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" className="btn btn-success gap-2" onClick={handleSave} disabled={saving || loading}>
                    <IconSave className="shrink-0 ltr:mr-2 rtl:ml-2" />
                    {saving ? 'Saving...' : 'Save'}
                </button>
                {invoiceId ? (
                    <Link href={`/apps/invoice/preview?id=${invoiceId}`} className="btn btn-primary gap-2">
                        <IconEye className="shrink-0 ltr:mr-2 rtl:ml-2" />
                        Preview
                    </Link>
                ) : null}
            </div>
        </div>
    );
};

export default SalesInvoiceForm;
