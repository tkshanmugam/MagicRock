'use client';

import IconSave from '@/components/icon/icon-save';
import Swal from 'sweetalert2';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CustomerRecord, getCustomerById, getCustomersForOrganisation, saveCustomer, updateCustomer } from '@/lib/customerStore';

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

    const refreshCustomers = useCallback(() => {
        const list = getCustomersForOrganisation();
        setRecentCustomers(list.slice(0, 5));
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
        refreshCustomers();
    }, [refreshCustomers]);

    useEffect(() => {
        if (mode !== 'edit') {
            return;
        }
        if (!customerId) {
            setCustomerMissing(true);
            return;
        }
        setLoadingCustomer(true);
        const existing = getCustomerById(customerId);
        if (!existing) {
            setCustomerMissing(true);
            setLoadingCustomer(false);
            return;
        }
        setName(existing.name);
        setAddress(existing.address);
        setStateName(existing.state);
        setStateCode(existing.state_code);
        setGstin(existing.gstin);
        setContactNo(existing.contact_no);
        setCustomerMissing(false);
        setLoadingCustomer(false);
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
        if (!canSave || saving) {
            showMessage('Name and GSTIN are required.', 'error');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                organisation_id: null,
                name,
                address,
                state: stateName,
                state_code: stateCode,
                gstin,
                contact_no: contactNo,
            };
            const record = mode === 'edit' && customerId ? updateCustomer(customerId, payload) : saveCustomer(payload);
            if (!record) {
                showMessage('Customer not found.', 'error');
                setSaving(false);
                return;
            }
            refreshCustomers();
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
                <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">Customers are shared across all organisations.</div>

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
                        disabled={!canSave || saving || (mode === 'edit' && customerMissing)}
                    >
                        <IconSave className="shrink-0 ltr:mr-2 rtl:ml-2" />
                        {saving ? 'Saving...' : mode === 'edit' ? 'Update Customer' : 'Save Customer'}
                    </button>
                </div>
            </div>
    );
};

export default ComponentsAppsCustomerAdd;
