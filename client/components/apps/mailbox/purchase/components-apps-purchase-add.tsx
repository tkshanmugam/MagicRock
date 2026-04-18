'use client';
import IconPrinter from '@/components/icon/icon-printer';
import IconSave from '@/components/icon/icon-save';
import IconX from '@/components/icon/icon-x';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { apiGet, apiPost } from '@/lib/apiClient';
import { authState } from '@/lib/authState';
import { organizationContext } from '@/lib/organizationContext';
import { useOrganizationSelection } from '@/lib/useOrganizationSelection';
import { CustomerRecord, findCustomerByGstin, findCustomerByName, listCustomers } from '@/lib/customerApi';

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

const ORGANISATION_DEFAULTS: Array<{ keys: string[]; particulars: string; rate: number }> = [
    { keys: ['amman'], particulars: "Coconut's husk", rate: 1 },
    { keys: ['jaswanth', 'jaswant'], particulars: 'Coconuts', rate: 10 },
    { keys: ['kumaran'], particulars: "Coconut's Shell", rate: 10 },
];

/** Map org ID -> { particulars, rate }. If name matching fails, add mapping here. */
const ORG_ID_DEFAULTS: Record<number, { particulars: string; rate: number }> = {};

const getDefaultParticularsAndRateForOrganisation = (
    org?: { id?: number; name?: string; default_particulars?: string } | null
): { particulars: string; rate: number } | null => {
    if (!org) return null;
    const defaultFromDb = (org as any)?.default_particulars ?? (org as any)?.defaultParticulars ?? '';
    if (defaultFromDb && String(defaultFromDb).trim()) {
        const particulars = String(defaultFromDb).trim();
        const match = ORGANISATION_DEFAULTS.find((d) => d.particulars === particulars);
        return { particulars, rate: match?.rate ?? 10 };
    }
    const id = org.id != null ? Number(org.id) : null;
    if (id != null && ORG_ID_DEFAULTS[id]) {
        return ORG_ID_DEFAULTS[id];
    }
    const orgName = (org as any)?.name ?? (org as any)?.organisation_name ?? (org as any)?.organisationName ?? '';
    if (!orgName) return null;
    const normalized = String(orgName).trim().toLowerCase().replace(/\s+/g, ' ');
    for (const { keys, particulars, rate } of ORGANISATION_DEFAULTS) {
        for (const key of keys) {
            if (
                normalized === key ||
                normalized.startsWith(key + ' ') ||
                normalized.endsWith(' ' + key) ||
                normalized.includes(' ' + key + ' ') ||
                normalized.includes(key)
            ) {
                return { particulars, rate };
            }
        }
    }
    return null;
};

type PurchaseItemRow = {
    id: number;
    particulars: string;
    bags: string | number;
    qtls: string | number;
    kgs: string | number;
    rateRs: string | number;
    amountRs: string | number;
    [key: string]: string | number;
};

const ComponentsAppsPurchaseAdd = () => {
    const canCreatePurchase = organizationContext.hasPermission('Purchase', 'create');
    const [isSuperAdmin, setIsSuperAdmin] = useState(organizationContext.getIsSuperAdmin());
    const [organisationsList, setOrganisationsList] = useState<any[]>([]);
    const [orgsLoading, setOrgsLoading] = useState<boolean>(false);
    const [organisationId, setOrganisationId] = useState<string>('');
    const [voucherNo, setVoucherNo] = useState<string>('');
    const [voucherDate, setVoucherDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [supplierName, setSupplierName] = useState<string>('');
    const [supplierAddress, setSupplierAddress] = useState<string>('');
    const [supplierState, setSupplierState] = useState<string>('');
    const [supplierStateCode, setSupplierStateCode] = useState<string>('');
    const [supplierGstin, setSupplierGstin] = useState<string>('');
    const [supplierContact, setSupplierContact] = useState<string>('');
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [customerDirectory, setCustomerDirectory] = useState<CustomerRecord[]>([]);
    const inputBorderClass = 'form-input !border-t-0 !border-l-0 !border-r-0 !rounded-none';
    const getLogoUrl = useCallback((logoName: string) => {
        if (!logoName) return '';
        const normalized = logoName.startsWith('/') ? logoName.slice(1) : logoName;
        return `${UPLOADS_BASE_URL}/${normalized}`;
    }, []);
    const formatVoucherNo = (value?: string | number) => {
        if (value === undefined || value === null || value === '') {
            return '';
        }
        return String(value).padStart(4, '0');
    };
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
    const [items, setItems] = useState<PurchaseItemRow[]>([
        {
            id: 1,
            particulars: '',
            bags: '',
            qtls: '',
            kgs: '',
            rateRs: '',
            amountRs: '',
        },
    ]);

    const updateParticularsForOrganisation = useCallback(
        (orgId: string) => {
            const selectedOrg = organisationsList.find((org: any) => String(org.id) === String(orgId));
            const defaults = getDefaultParticularsAndRateForOrganisation(selectedOrg);
            if (!defaults) return;
            setItems((prev) =>
                prev.map((item: any) => ({
                    ...item,
                    particulars: defaults.particulars,
                    rateRs: defaults.rate,
                    amountRs: defaults.rate * (Number(item.bags) || Number(item.qtls) || Number(item.kgs) || 0) || '',
                }))
            );
        },
        [organisationsList]
    );

    const handleOrganisationChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            const newId = e.target.value;
            setOrganisationId(newId);
            if (newId) {
                const selectedOrg = organisationsList.find((org: any) => String(org.id) === String(newId));
                const defaults = getDefaultParticularsAndRateForOrganisation(selectedOrg);
                if (defaults) {
                    setItems((prev) =>
                        prev.map((item: any) => ({
                            ...item,
                            particulars: defaults.particulars,
                            rateRs: defaults.rate,
                            amountRs: defaults.rate * (Number(item.bags) || Number(item.qtls) || Number(item.kgs) || 0) || '',
                        }))
                    );
                }
            }
        },
        [organisationsList]
    );

    const addItem = () => {
        const selectedOrg = organisationsList.find((org: any) => String(org.id) === String(organisationId));
        const defaults = getDefaultParticularsAndRateForOrganisation(selectedOrg);
        const particulars = defaults?.particulars ?? '';
        const rate = defaults?.rate ?? 0;
        let maxId = 0;
        maxId = items?.length ? items.reduce((max: number, character: any) => (character.id > max ? character.id : max), items[0].id) : 0;

        setItems([
            ...items,
            {
                id: maxId + 1,
                particulars,
                bags: '',
                qtls: '',
                kgs: '',
                rateRs: rate,
                amountRs: '',
            },
        ]);
    };

    const removeItem = (item: any = null) => {
        setItems(items.filter((d: any) => d.id !== item.id));
    };

    const changeItemField = (field: string, value: string, id: number) => {
        const list = [...items];
        const item = list.find((d: any) => d.id === id);
        if (!item) {
            return;
        }
        item[field] = value === '' ? '' : Number.isNaN(Number(value)) ? value : Number(value);
        if (['rateRs', 'bags', 'qtls', 'kgs'].includes(field)) {
            const rate = Number(item.rateRs || 0);
            const qty = Number(item.kgs || 0) || Number(item.qtls || 0) || Number(item.bags || 0);
            if (rate > 0 && qty > 0) {
                item.amountRs = Number((rate * qty).toFixed(2));
            } else {
                item.amountRs = '';
            }
        }
        setItems([...list]);
    };

    const fetchNextVoucherNo = useCallback(async (orgId: string) => {
        if (!orgId) {
            return;
        }
        try {
            const response = await apiGet<any>(`purchase-vouchers/next-number?organisation_id=${orgId}`, {
                headers: {
                    'X-Organization-Id': String(orgId),
                },
            });
            const nextNo = response?.voucher_no ?? response?.voucherNo;
            if (nextNo) {
                setVoucherNo(String(nextNo));
            }
        } catch (error) {
            console.error('Failed to fetch next voucher number', error);
        }
    }, []);

    useEffect(() => {
        if (!organisationId || voucherNo) {
            return;
        }
        fetchNextVoucherNo(organisationId);
    }, [organisationId, voucherNo, fetchNextVoucherNo]);


    useEffect(() => {
        organizationContext.updateIsSuperAdminFromToken();
        setIsSuperAdmin(organizationContext.getIsSuperAdmin());
    }, []);

    const fetchOrganisations = useCallback(async () => {
        try {
            setOrgsLoading(true);
            const superAdminNow = organizationContext.getIsSuperAdmin();
            setIsSuperAdmin(superAdminNow);
            const endpoints = superAdminNow ? ['organisations', 'organisations/me'] : ['organisations/me', 'organisations'];
            let resolved: any[] = [];
            for (const endpoint of endpoints) {
                try {
                    const response = await apiGet<any>(endpoint);
                    const organisations = Array.isArray(response) ? response : response.data || response.results || [];
                    if (organisations.length) {
                        resolved = organisations;
                        break;
                    }
                } catch (_error) {
                    // Try next endpoint as a fallback.
                }
            }
            setOrganisationsList(resolved);
        } catch (error) {
            console.error('Failed to fetch organisations', error);
            // Keep the previous list on transient errors to avoid flicker.
        }
        finally {
            setOrgsLoading(false);
        }
    }, []);

    const updateOrganisationSelection = useCallback(
        (nextOrganisationId: string) => {
            const parsedId = Number(nextOrganisationId);
            if (!parsedId || Number.isNaN(parsedId)) {
                return;
            }
            organizationContext.setSelectedOrganizationId(parsedId);
            setVoucherNo('');
            updateParticularsForOrganisation(nextOrganisationId);
        },
        [updateParticularsForOrganisation]
    );

    useOrganizationSelection({
        organisationsList,
        organisationId,
        setOrganisationId,
        onOrganisationChange: updateOrganisationSelection,
    });

    useEffect(() => {
        if (!organisationId || !organisationsList.length) return;
        const selectedOrg = organisationsList.find((org: any) => String(org.id) === String(organisationId));
        const defaults = getDefaultParticularsAndRateForOrganisation(selectedOrg);
        if (!defaults) return;
        setItems((prev) =>
            prev.map((item: any) => ({
                ...item,
                particulars: defaults.particulars,
                rateRs: defaults.rate,
                amountRs: defaults.rate * (Number(item.bags) || Number(item.qtls) || Number(item.kgs) || 0) || '',
            }))
        );
    }, [organisationId, organisationsList]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!organisationId) {
                setCustomerDirectory([]);
                return;
            }
            try {
                const rows = await listCustomers();
                if (!cancelled) {
                    setCustomerDirectory(rows);
                }
            } catch {
                if (!cancelled) {
                    setCustomerDirectory([]);
                }
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [organisationId]);

    useEffect(() => {
        const load = () => {
            organizationContext.updateIsSuperAdminFromToken();
            setIsSuperAdmin(organizationContext.getIsSuperAdmin());
            fetchOrganisations();
        };
        load();
        const unsubscribe = authState.onAuthStateReady(load);
        return unsubscribe;
    }, [fetchOrganisations]);

    const selectedOrganisation = organisationsList.find((org: any) => String(org.id) === String(organisationId));
    const selectedOrganisationLabel = selectedOrganisation?.name || (organisationId ? `Organisation #${organisationId}` : 'Selected Organisation');
    const selectedOrganisationValue = selectedOrganisation?.id ?? organisationId ?? '';
    const selectedOrganisationAddressLines = [selectedOrganisation?.address, selectedOrganisation?.city].filter(Boolean);
    const selectedOrganisationLogoUrl = selectedOrganisation?.logo_name ? getLogoUrl(selectedOrganisation.logo_name) : '';
    const totals = useMemo(() => {
        return items.reduce(
            (acc: any, item: any) => {
                acc.bags += Number(item.bags || 0);
                acc.qtls += Number(item.qtls || 0);
                acc.kgs += Number(item.kgs || 0);
                acc.amount += Number(item.amountRs || 0);
                return acc;
            },
            { bags: 0, qtls: 0, kgs: 0, amount: 0 }
        );
    }, [items]);

    const applyCustomerSelection = useCallback((customer: CustomerRecord) => {
        setSupplierName(customer.name);
        setSupplierAddress((prev) => (prev.trim() ? prev : customer.address || ''));
        setSupplierState(customer.state || '');
        setSupplierStateCode(customer.state_code || '');
        setSupplierGstin(customer.gstin);
        setSupplierContact(customer.contact_no || '');
    }, []);

    const handleSupplierNameChange = (value: string) => {
        setSupplierName(value);
        const match = findCustomerByName(customerDirectory, value);
        if (match) {
            applyCustomerSelection(match);
        }
    };

    const handleSupplierGstinChange = (value: string) => {
        setSupplierGstin(value);
        const match = findCustomerByGstin(customerDirectory, value);
        if (match) {
            applyCustomerSelection(match);
        }
    };

    const handleSave = async () => {
        if (!voucherNo) {
            window.alert('Voucher number is required.');
            return;
        }
        setIsSaving(true);
        try {
            await apiPost('purchase-vouchers', {
                organisation_id: organisationId ? Number(organisationId) : null,
                voucher_no: Number(voucherNo),
                voucher_date: voucherDate || null,
                supplier_name: supplierName || null,
                supplier_address: supplierAddress || null,
                supplier_mobile: supplierContact || null,
                items: items.map((item: any) => ({
                    rate: Number(item.rateRs || 0),
                    particulars: item.particulars || null,
                    bags: Number(item.bags || 0),
                    qtls: Number(item.qtls || 0),
                    kgs: Number(item.kgs || 0),
                    amount: Number(item.amountRs || 0),
                })),
            });
            showMessage('Purchase voucher saved successfully.');
            // Reload to guarantee fresh voucher state after save.
            setTimeout(() => window.location.reload(), 300);
        } catch (error: any) {
            showMessage(error?.message || 'Failed to save purchase voucher.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (!canCreatePurchase) {
        return (
            <div className="panel border-white-light px-5 py-8 text-center font-semibold dark:border-[#1b2e4b]">
                You do not have permission to create Purchase.
            </div>
        );
    }

    return (
        <div className="panel px-4 py-6">
            <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
                <label htmlFor="organisationId" className="mb-0">
                    Organisation Name
                </label>
                {organisationsList.length > 0 ? (
                    <select
                        id="organisationId"
                        className="form-select w-full sm:w-72"
                        value={organisationId}
                        onChange={handleOrganisationChange}
                    >
                        <option value="">Select Organisation</option>
                        {organisationsList.map((org: any) => (
                            <option key={org.id} value={org.id}>
                                {org.name}
                            </option>
                        ))}
                    </select>
                ) : (
                    <input
                        id="organisationId"
                        className="form-input w-full sm:w-72"
                        value={orgsLoading ? 'Loading organisations...' : 'Select Organisation'}
                        readOnly
                    />
                )}
            </div>
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
                        <div className="text-lg font-bold text-black dark:text-white">PURCHASE VOUCHER</div>
                        <div className="mt-2 text-2xl font-extrabold text-black dark:text-white">{selectedOrganisationLabel}</div>
                        <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {selectedOrganisationAddressLines.length ? (
                                selectedOrganisationAddressLines.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)
                            ) : (
                                <div>Address not available</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded border border-white-light p-3 text-sm dark:border-[#1b2e4b]">
                    <div className="font-semibold text-gray-600">Voucher Details</div>
                    <div className="mt-2 grid gap-2">
                        <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                            <div>No.</div>
                            <input id="voucherNo" className={`${inputBorderClass} h-8 text-sm`} value={formatVoucherNo(voucherNo)} readOnly />
                        </div>
                        <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                            <div>Date</div>
                            <input
                                id="voucherDate"
                                type="date"
                                className={`${inputBorderClass} h-8 text-sm`}
                                value={voucherDate}
                                onChange={(e) => setVoucherDate(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                            <div>To</div>
                            <div className="min-w-0 w-full">
                                <input
                                    id="voucherTo"
                                    className={`${inputBorderClass} h-8 w-full text-sm`}
                                    list="supplierNameOptions"
                                    value={supplierName}
                                    onChange={(e) => handleSupplierNameChange(e.target.value)}
                                />
                                <datalist id="supplierNameOptions">
                                    {customerDirectory.map((customer) => (
                                        <option key={customer.id} value={customer.name} label={customer.gstin} />
                                    ))}
                                </datalist>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="rounded border border-white-light p-3 text-sm dark:border-[#1b2e4b]">
                    <div className="font-semibold text-gray-600">Supplier Details</div>
                    <div className="mt-2 grid gap-2">
                        <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                            <div>Name</div>
                            <input className={`${inputBorderClass} h-8 text-sm`} value={supplierName} onChange={(e) => handleSupplierNameChange(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                            <div>Address</div>
                            <input className={`${inputBorderClass} h-8 text-sm`} value={supplierAddress} onChange={(e) => setSupplierAddress(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                            <div>Contact No</div>
                            <input className={`${inputBorderClass} h-8 text-sm`} value={supplierContact} onChange={(e) => setSupplierContact(e.target.value)} />
                        </div>
                    </div>
                </div>
            </div>

                <div className="overflow-x-visible">
                    <table>
                        <thead>
                            <tr>
                                <th className="w-24 text-center">Rate</th>
                                <th>Particulars</th>
                                <th className="w-20 text-center">Bags</th>
                                <th className="w-20 text-center">Qtls.</th>
                                <th className="w-20 text-center">Kgs.</th>
                                <th className="w-28 text-center">Amount</th>
                                <th className="w-10"></th>
                            </tr>
                            <tr>
                                <th className="text-center text-xs text-gray-500 dark:text-gray-400">Rs.</th>
                                <th></th>
                                <th></th>
                                <th></th>
                                <th></th>
                                <th className="text-center text-xs text-gray-500 dark:text-gray-400">Rs.</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.length <= 0 && (
                                <tr>
                                    <td colSpan={7} className="!text-center font-semibold">
                                        No Item Available
                                    </td>
                                </tr>
                            )}
                            {items.map((item: any) => (
                                <tr className="align-top" key={item.id}>
                                    <td>
                                        <input
                                            type="number"
                                            className={`${inputBorderClass} w-24`}
                                            placeholder="Rate"
                                            min={0}
                                            value={item.rateRs}
                                            onChange={(e) => changeItemField('rateRs', e.target.value, item.id)}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="text"
                                            className={`${inputBorderClass} min-w-[220px]`}
                                            placeholder="Enter particulars"
                                            value={item.particulars}
                                            onChange={(e) => changeItemField('particulars', e.target.value, item.id)}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="number"
                                            className={`${inputBorderClass} w-20`}
                                            min={0}
                                            value={item.bags}
                                            onChange={(e) => changeItemField('bags', e.target.value, item.id)}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="number"
                                            className={`${inputBorderClass} w-20`}
                                            min={0}
                                            value={item.qtls}
                                            onChange={(e) => changeItemField('qtls', e.target.value, item.id)}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="number"
                                            className={`${inputBorderClass} w-20`}
                                            min={0}
                                            value={item.kgs}
                                            onChange={(e) => changeItemField('kgs', e.target.value, item.id)}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="number"
                                            className={`${inputBorderClass} w-24`}
                                            placeholder="Amount"
                                            min={0}
                                            value={item.amountRs}
                                            readOnly
                                        />
                                    </td>
                                    <td>
                                        <button type="button" onClick={() => removeItem(item)}>
                                            <IconX className="h-5 w-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td className="font-semibold text-center">Total</td>
                                <td></td>
                                <td className="text-center font-semibold">{totals.bags}</td>
                                <td className="text-center font-semibold">{totals.qtls}</td>
                                <td className="text-center font-semibold">{totals.kgs}</td>
                                <td className="text-center font-semibold">{totals.amount.toFixed(2)}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

            <div className="border-t border-white-light px-4 py-3 dark:border-[#1b2e4b]"></div>

            <div className="mt-6 flex flex-wrap gap-3 print:hidden">
                <button type="button" className="btn btn-primary gap-2" onClick={() => addItem()}>
                    Add Row
                </button>
                <button type="button" className="btn btn-outline-info gap-2" onClick={() => window.print()}>
                    <IconPrinter className="h-5 w-5" />
                    Printing
                </button>
                <button type="button" className="btn btn-success gap-2" onClick={handleSave} disabled={isSaving}>
                    <IconSave className="h-5 w-5" />
                    {isSaving ? 'Saving...' : 'Save'}
                </button>
            </div>
        </div>
    );
};

export default ComponentsAppsPurchaseAdd;
