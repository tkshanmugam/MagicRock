'use client';

import IconSave from '@/components/icon/icon-save';
import Swal from 'sweetalert2';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CustomerRecord, createCustomer, fetchCustomer, listCustomers, updateCustomer } from '@/lib/customerApi';
import { organizationContext } from '@/lib/organizationContext';

type Props = {
    mode?: 'create' | 'edit';
    customerId?: string;
};

const ComponentsAppsCustomerAdd = ({ mode = 'create', customerId }: Props) => {
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [stateName, setStateName] = useState('');
    const [stateCode, setStateCode] = useState('');
    const [gstin, setGstin] = useState('');
    const [contactNo, setContactNo] = useState('');
    const [saving, setSaving] = useState(false);
    const [loadingCustomer, setLoadingCustomer] = useState(false);
    const [customerMissing, setCustomerMissing] = useState(false);

    const [recentCustomers, setRecentCustomers] = useState<CustomerRecord[]>([]);
    const inputBorderClass = 'form-input !border-t-0 !border-l-0 !border-r-0 !rounded-none';

    const organisationId = organizationContext.getSelectedOrganizationId();
    const canCreate = organizationContext.hasPermission('Customers', 'create');
    const canUpdate = organizationContext.hasPermission('Customers', 'update');

    const refreshRecent = useCallback(async () => {
        const orgId = organizationContext.getSelectedOrganizationId();
        if (!orgId || !organizationContext.hasPermission('Customers', 'view')) {
            setRecentCustomers([]);
            return;
        }
        try {
            const list = await listCustomers();
            setRecentCustomers(list.slice(0, 5));
        } catch {
            setRecentCustomers([]);
        }
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

    useEffect(() => {
        refreshRecent();
    }, [refreshRecent]);

    useEffect(() => {
        const onOrgChange = () => refreshRecent();
        window.addEventListener('organization-permissions-updated', onOrgChange);
        return () => window.removeEventListener('organization-permissions-updated', onOrgChange);
    }, [refreshRecent]);

    useEffect(() => {
        if (mode !== 'edit') {
            return;
        }
        if (!customerId) {
            setCustomerMissing(true);
            return;
        }
        const numericId = Number(customerId);
        if (!Number.isFinite(numericId)) {
            setCustomerMissing(true);
            return;
        }
        setLoadingCustomer(true);
        (async () => {
            try {
                const existing = await fetchCustomer(numericId);
                setName(existing.name);
                setAddress(existing.address || '');
                setStateName(existing.state || '');
                setStateCode(existing.state_code || '');
                setGstin(existing.gstin);
                setContactNo(existing.contact_no || '');
                setCustomerMissing(false);
            } catch {
                setCustomerMissing(true);
            } finally {
                setLoadingCustomer(false);
            }
        })();
    }, [mode, customerId]);

    const clearForm = () => {
        setName('');
        setAddress('');
        setStateName('');
        setStateCode('');
        setGstin('');
        setContactNo('');
    };

    const canSave = useMemo(() => {
        return Boolean(name.trim() && gstin.trim());
    }, [name, gstin]);

    const handleSave = async () => {
        const orgId = organizationContext.getSelectedOrganizationId();
        if (!orgId) {
            showMessage('Select an organisation first.', 'error');
            return;
        }
        if (mode === 'create' && !canCreate) {
            showMessage('You do not have permission to create customers.', 'error');
            return;
        }
        if (mode === 'edit' && !canUpdate) {
            showMessage('You do not have permission to update customers.', 'error');
            return;
        }
        if (!canSave || saving) {
            showMessage('Name and GSTIN are required.', 'error');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                name,
                address: address.trim() || null,
                state: stateName.trim() || null,
                state_code: stateCode.trim() || null,
                gstin,
                contact_no: contactNo.trim() || null,
            };
            if (mode === 'edit' && customerId) {
                const numericId = Number(customerId);
                if (!Number.isFinite(numericId)) {
                    showMessage('Customer not found.', 'error');
                    setSaving(false);
                    return;
                }
                await updateCustomer(numericId, payload);
            } else {
                await createCustomer(payload);
            }
            await refreshRecent();
            if (mode === 'create') {
                clearForm();
            }
            showMessage(mode === 'edit' ? 'Customer updated successfully.' : 'Customer saved successfully.');
        } catch (error: any) {
            showMessage(error?.message || 'Failed to save customer.', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="panel px-4 py-6">
            {mode === 'edit' && customerMissing && (
                <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-900/20 dark:text-red-100">
                    Customer not found.
                </div>
            )}
            {mode === 'edit' && loadingCustomer && <div className="mb-4 text-sm text-gray-500">Loading customer...</div>}
            {!organisationId && (
                <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-900/20 dark:text-amber-100">
                    Select an organisation (header) for permissions. Customer records are shared across all organisations.
                </div>
            )}
            <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                One customer directory for the whole system (unique GSTIN). Any organisation can use the same customers on invoices and vouchers.
            </div>

            <div className="rounded border border-white-light p-4 text-sm dark:border-[#1b2e4b]">
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <label htmlFor="customerName" className="font-semibold text-gray-600">
                            Name <span className="text-danger">*</span>
                        </label>
                        <input
                            id="customerName"
                            className={`${inputBorderClass} h-9`}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="customerGstin" className="font-semibold text-gray-600">
                            GSTIN <span className="text-danger">*</span>
                        </label>
                        <input
                            id="customerGstin"
                            className={`${inputBorderClass} h-9`}
                            value={gstin}
                            onChange={(e) => setGstin(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="customerAddress" className="font-semibold text-gray-600">
                            Address
                        </label>
                        <input
                            id="customerAddress"
                            className={`${inputBorderClass} h-9`}
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="customerContact" className="font-semibold text-gray-600">
                            Contact No
                        </label>
                        <input
                            id="customerContact"
                            className={`${inputBorderClass} h-9`}
                            value={contactNo}
                            onChange={(e) => setContactNo(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="customerState" className="font-semibold text-gray-600">
                            State
                        </label>
                        <input
                            id="customerState"
                            className={`${inputBorderClass} h-9`}
                            value={stateName}
                            onChange={(e) => setStateName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="customerStateCode" className="font-semibold text-gray-600">
                            State Code
                        </label>
                        <input
                            id="customerStateCode"
                            className={`${inputBorderClass} h-9`}
                            value={stateCode}
                            onChange={(e) => setStateCode(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {recentCustomers.length > 0 && (
                <div className="mt-4 rounded border border-white-light p-3 text-sm dark:border-[#1b2e4b]">
                    <div className="mb-2 font-semibold text-gray-600">Recently Added</div>
                    <div className="grid gap-2">
                        {recentCustomers.map((customer) => (
                            <div key={customer.id} className="flex flex-wrap items-center justify-between gap-2 text-gray-600">
                                <span>{customer.name}</span>
                                <span className="text-xs text-gray-500">{customer.gstin}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
                <button
                    type="button"
                    className="btn btn-success gap-2"
                    onClick={handleSave}
                    disabled={
                        !canSave ||
                        saving ||
                        (mode === 'edit' && customerMissing) ||
                        !organisationId ||
                        (mode === 'create' && !canCreate) ||
                        (mode === 'edit' && !canUpdate)
                    }
                >
                    <IconSave className="shrink-0 ltr:mr-2 rtl:ml-2" />
                    {saving ? 'Saving...' : mode === 'edit' ? 'Update Customer' : 'Save Customer'}
                </button>
            </div>
        </div>
    );
};

export default ComponentsAppsCustomerAdd;
