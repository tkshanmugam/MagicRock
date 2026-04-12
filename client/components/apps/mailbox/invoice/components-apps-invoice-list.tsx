'use client';
import IconEdit from '@/components/icon/icon-edit';
import IconEye from '@/components/icon/icon-eye';
import IconPlus from '@/components/icon/icon-plus';
import IconXCircle from '@/components/icon/icon-x-circle';
import type { DataTableColumn, DataTableProps, DataTableSortStatus } from 'mantine-datatable';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import React, { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { apiGet } from '@/lib/apiClient';
import { authState } from '@/lib/authState';
import { organizationContext } from '@/lib/organizationContext';
import { cancelSalesInvoice, listSalesInvoices, SalesInvoice } from '@/lib/salesInvoiceApi';
import { getTranslation } from '@/i18n';

const DataTable = dynamic<DataTableProps<SalesInvoice>>(() => import('mantine-datatable').then((mod) => mod.DataTable), {
    ssr: false,
    loading: () => (
        <div className="panel mt-5">
            <div className="text-center py-8">Loading invoice list...</div>
        </div>
    ),
});

const ComponentsAppsInvoiceList = () => {
    const { t } = getTranslation();
    const canViewSales = organizationContext.hasPermission('Sales', 'view');
    const canCreateSales = organizationContext.hasPermission('Sales', 'create');
    const canUpdateSales = organizationContext.hasPermission('Sales', 'update');
    const canDeleteSales = organizationContext.hasPermission('Sales', 'delete');
    const [isSuperAdmin, setIsSuperAdmin] = useState(organizationContext.getIsSuperAdmin());
    const [organisationsList, setOrganisationsList] = useState<any[]>([]);
    const [orgsLoading, setOrgsLoading] = useState<boolean>(false);
    const [organisationId, setOrganisationId] = useState<string>('');
    const [records, setRecords] = useState<SalesInvoice[]>([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<string>('');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    const [page, setPage] = useState(1);
    const PAGE_SIZES = [10, 20, 30, 50, 100];
    const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
    const [selectedRecords, setSelectedRecords] = useState<any>([]);

    const [search, setSearch] = useState('');
    const [sortStatus, setSortStatus] = useState<DataTableSortStatus>({
        columnAccessor: 'invoice_number',
        direction: 'asc',
    });

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

    const updateOrganisationSelection = useCallback(
        async (nextOrganisationId: string) => {
            const parsedId = Number(nextOrganisationId);
            if (!parsedId || Number.isNaN(parsedId)) {
                return;
            }
            organizationContext.setSelectedOrganizationId(parsedId);
            if (isSuperAdmin) {
                return;
            }
            try {
                const permissionsResponse = await apiGet<any>(`organisations/${parsedId}/permissions/me`);
                const permissionsPayload =
                    permissionsResponse?.modules ||
                    permissionsResponse?.data?.modules ||
                    permissionsResponse?.results?.modules ||
                    (Array.isArray(permissionsResponse) ? permissionsResponse : []);
                organizationContext.setPermissions(permissionsPayload || []);
            } catch (error) {
                // Keep existing permissions if the update fails.
            }
        },
        [isSuperAdmin]
    );

    useEffect(() => {
        if (organisationId) {
            updateOrganisationSelection(organisationId);
        }
    }, [organisationId, updateOrganisationSelection]);

    const selectedOrganisation = organisationsList.find((org: any) => String(org.id) === String(organisationId));
    const selectedOrganisationLabel = selectedOrganisation?.name || (organisationId ? `Organisation #${organisationId}` : 'Selected Organisation');

    const fetchInvoices = useCallback(async () => {
        if (!organisationId) {
            return;
        }
        setLoading(true);
        try {
            const response = await listSalesInvoices({
                skip: (page - 1) * pageSize,
                limit: pageSize,
                organisation_id: Number(organisationId),
                status: statusFilter,
                invoice_type: invoiceTypeFilter,
                start_date: startDate,
                end_date: endDate,
            });
            setRecords(response.items || []);
            setTotalRecords(response.total || 0);
        } catch (error) {
            console.error('Failed to load invoices', error);
        } finally {
            setLoading(false);
        }
    }, [organisationId, page, pageSize, statusFilter, invoiceTypeFilter, startDate, endDate]);

    useEffect(() => {
        fetchInvoices();
    }, [fetchInvoices]);

    useEffect(() => {
        setPage(1);
    }, [pageSize, statusFilter, invoiceTypeFilter, startDate, endDate, organisationId]);

    const handleCancel = async (invoiceId: number) => {
        const result = await Swal.fire({
            icon: 'warning',
            title: 'Cancel Invoice',
            text: 'Are you sure you want to cancel this invoice? This action cannot be undone.',
            showCancelButton: true,
            confirmButtonText: 'Yes, cancel it',
            cancelButtonText: 'No, keep it',
            confirmButtonColor: '#d33',
        });
        if (!result.isConfirmed) {
            return;
        }
        try {
            await cancelSalesInvoice(invoiceId);
            void Swal.fire({
                icon: 'success',
                title: 'Cancelled',
                text: 'Invoice has been cancelled successfully.',
                timer: 2000,
                showConfirmButton: false,
            });
            fetchInvoices();
        } catch (error) {
            console.error('Failed to cancel invoice', error);
            void Swal.fire({
                icon: 'error',
                title: 'Cancel Failed',
                text: error instanceof Error ? error.message : 'Failed to cancel invoice. Please try again.',
            });
        }
    };

    if (!canViewSales) {
        return (
            <div className="panel border-white-light px-5 py-8 text-center font-semibold dark:border-[#1b2e4b]">
                You do not have permission to view Sales.
            </div>
        );
    }

    const columns: DataTableColumn<SalesInvoice>[] = [
        {
            accessor: 'invoice_number',
            title: t('th_invoice'),
            sortable: true,
            render: ({ invoice_number, id }) => (
                <Link href={`/apps/invoice/preview?id=${id}`}>
                    <div className="font-semibold text-primary underline hover:no-underline">{`#${invoice_number}`}</div>
                </Link>
            ),
        },
        {
            accessor: 'customer_name',
            title: t('th_customer'),
            sortable: true,
            render: ({ customer_name }) => <div className="font-semibold">{customer_name}</div>,
        },
        {
            accessor: 'invoice_date',
            title: t('th_invoice_date'),
            sortable: true,
            render: ({ invoice_date }) => <div>{new Date(invoice_date).toLocaleDateString()}</div>,
        },
        {
            accessor: 'invoice_total',
            title: t('th_invoice_total'),
            sortable: true,
            titleClassName: 'text-right',
            render: ({ invoice_total }) => <div className="text-right font-semibold">{Number(invoice_total || 0).toFixed(2)}</div>,
        },
        {
            accessor: 'status',
            title: t('th_status'),
            sortable: true,
            render: ({ status }) => <span className={`badge badge-outline-${status === 'CANCELLED' ? 'danger' : 'success'}`}>{status}</span>,
        },
        {
            accessor: 'action',
            title: t('th_actions'),
            sortable: false,
            textAlignment: 'center',
            render: ({ id, status }) => (
                <div className="mx-auto flex w-max items-center gap-4">
                    {canUpdateSales && (
                        <Link href={`/apps/invoice/edit?id=${id}`} className="flex hover:text-info">
                            <IconEdit className="h-4.5 w-4.5" />
                        </Link>
                    )}
                    <Link href={`/apps/invoice/preview?id=${id}`} className="flex hover:text-primary">
                        <IconEye />
                    </Link>
                    {canDeleteSales && status !== 'CANCELLED' && (
                        <button type="button" className="flex hover:text-danger" onClick={() => handleCancel(id)} title="Cancel invoice">
                            <IconXCircle />
                        </button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="panel border-white-light px-0 dark:border-[#1b2e4b]">
            <div className="invoice-table">
                <div className="mb-4.5 flex flex-col gap-5 px-5 md:flex-row md:items-center">
                    <div className="flex items-center gap-2">
                        {canCreateSales && (
                            <Link href="/apps/invoice/add" className="btn btn-primary gap-2">
                                <IconPlus />
                                Add New
                            </Link>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 ltr:ml-auto rtl:mr-auto">
                        {organisationsList.length > 1 ? (
                            <select
                                id="organisationId"
                                className="form-select w-full sm:w-64"
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
                        ) : (
                            <input id="organisationId" className="form-input w-full sm:w-64" value={selectedOrganisationLabel} readOnly />
                        )}
                        <select
                            className="form-select w-full sm:w-40"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="">All Status</option>
                            <option value="ACTIVE">Active</option>
                            <option value="CANCELLED">Cancelled</option>
                        </select>
                        <select
                            className="form-select w-full sm:w-40"
                            value={invoiceTypeFilter}
                            onChange={(e) => setInvoiceTypeFilter(e.target.value)}
                        >
                            <option value="">All Types</option>
                            <option value="TAX">TAX</option>
                            <option value="BILL_OF_SUPPLY">Bill of Supply</option>
                            <option value="EXPORT">Export</option>
                        </select>
                        <input type="date" className="form-input w-full sm:w-40" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        <input type="date" className="form-input w-full sm:w-40" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        <input type="text" className="form-input w-full sm:w-48" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                </div>

                <div className="datatables pagination-padding">
                    <DataTable
                        className="table-hover whitespace-nowrap"
                        records={records.filter((item) => {
                            if (!search) {
                                return true;
                            }
                            const term = search.toLowerCase();
                            return (
                                item.invoice_number?.toLowerCase().includes(term) ||
                                item.customer_name?.toLowerCase().includes(term)
                            );
                        })}
                        columns={columns}
                        highlightOnHover
                        totalRecords={totalRecords}
                        recordsPerPage={pageSize}
                        page={page}
                        onPageChange={(p) => setPage(p)}
                        recordsPerPageOptions={PAGE_SIZES}
                        onRecordsPerPageChange={setPageSize}
                        sortStatus={sortStatus}
                        onSortStatusChange={setSortStatus}
                        selectedRecords={selectedRecords}
                        onSelectedRecordsChange={setSelectedRecords}
                        paginationText={({ from, to, totalRecords }) => `Showing  ${from} to ${to} of ${totalRecords} entries`}
                    />
                    {loading && <div className="px-5 py-3 text-sm text-gray-500">Loading invoices...</div>}
                </div>
            </div>
        </div>
    );
};

export default ComponentsAppsInvoiceList;
