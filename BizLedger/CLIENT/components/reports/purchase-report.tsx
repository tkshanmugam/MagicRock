'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { DataTableProps, DataTableSortStatus } from 'mantine-datatable';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

import { apiGet } from '@/lib/apiClient';
import { authState } from '@/lib/authState';
import { organizationContext } from '@/lib/organizationContext';
import { exportToCsv } from '@/lib/exportUtils';
import { fetchPurchaseReport, PurchaseReportItem, PurchaseReportSummary } from '@/lib/reportApi';

const DataTable = dynamic<DataTableProps<PurchaseReportItem>>(() => import('mantine-datatable').then((mod) => mod.DataTable), {
    ssr: false,
    loading: () => (
        <div className="panel mt-5">
            <div className="text-center py-8">Loading purchase report...</div>
        </div>
    ),
});

const PurchaseReport = () => {
    const reportRef = useRef<HTMLDivElement | null>(null);
    const canViewReports = organizationContext.hasPermission('Reports', 'view');
    const [isSuperAdmin, setIsSuperAdmin] = useState(organizationContext.getIsSuperAdmin());
    const [organisationsList, setOrganisationsList] = useState<any[]>([]);
    const [orgsLoading, setOrgsLoading] = useState<boolean>(false);
    const [organisationId, setOrganisationId] = useState<string>('');

    const [records, setRecords] = useState<PurchaseReportItem[]>([]);
    const [summary, setSummary] = useState<PurchaseReportSummary | null>(null);
    const [totalRecords, setTotalRecords] = useState(0);
    const [loading, setLoading] = useState(false);

    const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<string>('');
    const [supplierFilter, setSupplierFilter] = useState<string>('');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [search, setSearch] = useState('');

    const [page, setPage] = useState(1);
    const PAGE_SIZES = [10, 20, 30, 50, 100];
    const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
    const [sortStatus, setSortStatus] = useState<DataTableSortStatus>({
        columnAccessor: 'purchase_date',
        direction: 'desc',
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

    const fetchReport = useCallback(async () => {
        if (!organisationId) {
            return;
        }
        setLoading(true);
        setRecords([]);
        setSummary(null);
        try {
            const response = await fetchPurchaseReport({
                organisation_id: Number(organisationId),
                from_date: startDate,
                to_date: endDate,
                invoice_type: invoiceTypeFilter,
                supplier: supplierFilter,
                skip: (page - 1) * pageSize,
                limit: pageSize,
            });
            setRecords(response.items || []);
            setSummary(response.summary || null);
            setTotalRecords(response.total || 0);
        } catch (error) {
            console.error('Failed to load purchase report', error);
        } finally {
            setLoading(false);
        }
    }, [organisationId, startDate, endDate, invoiceTypeFilter, supplierFilter, page, pageSize]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    useEffect(() => {
        setPage(1);
    }, [pageSize, invoiceTypeFilter, supplierFilter, startDate, endDate, organisationId]);

    const filteredRecords = useMemo(() => {
        if (!search) {
            return records;
        }
        const term = search.toLowerCase();
        return records.filter(
            (item) =>
                String(item.purchase_invoice_number || '').toLowerCase().includes(term) ||
                item.supplier_name?.toLowerCase().includes(term)
        );
    }, [records, search]);

    const downloadPdf = async () => {
        if (!reportRef.current) {
            return;
        }
        const canvas = await html2canvas(reportRef.current, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pdfWidth;
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 0;
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pdfHeight;
        }

        pdf.save(`purchase-report-${organisationId || 'org'}.pdf`);
    };

    const downloadExcel = () => {
        exportToCsv(`purchase-report-${organisationId || 'org'}.csv`, records, [
            { key: 'purchase_date', label: 'Purchase Date' },
            { key: 'purchase_invoice_number', label: 'Invoice Number' },
            { key: 'supplier_name', label: 'Supplier Name' },
            { key: 'subtotal', label: 'Subtotal' },
            { key: 'tax_amount', label: 'Tax Amount' },
            { key: 'invoice_total', label: 'Invoice Total' },
        ]);
    };

    if (!canViewReports) {
        return (
            <div className="panel border-white-light px-5 py-8 text-center font-semibold dark:border-[#1b2e4b]">
                You do not have permission to view Reports.
            </div>
        );
    }

    return (
        <div className="panel border-white-light px-0 dark:border-[#1b2e4b]">
            <div className="px-5 pt-5">
                <div className="flex flex-wrap items-center gap-3">
                    <button type="button" className="btn btn-primary gap-2" onClick={downloadPdf}>
                        Export PDF
                    </button>
                    <button type="button" className="btn btn-success gap-2" onClick={downloadExcel}>
                        Export Excel
                    </button>
                </div>
            </div>
            <div ref={reportRef} className="invoice-table">
                <div className="px-5 pt-6 text-center">
                    <div className="text-xl font-bold tracking-wide text-black dark:text-white">Purchase Report</div>
                    <div className="mt-1 text-sm text-gray-500">
                        {selectedOrganisationLabel}
                        {startDate || endDate ? ` • ${startDate || '...'} to ${endDate || '...'}` : ''}
                        {invoiceTypeFilter ? ` • ${invoiceTypeFilter}` : ''}
                        {supplierFilter ? ` • ${supplierFilter}` : ''}
                    </div>
                </div>
                <div className="mb-4.5 flex flex-col gap-5 px-5 pt-5 md:flex-row md:items-center">
                    <div className="flex flex-wrap items-center gap-3">
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
                        <select className="form-select w-full sm:w-40" value={invoiceTypeFilter} onChange={(e) => setInvoiceTypeFilter(e.target.value)}>
                            <option value="">All Types</option>
                            <option value="TAX">Tax</option>
                            <option value="NON_TAX">Non Tax</option>
                        </select>
                        <input
                            type="text"
                            className="form-input w-full sm:w-52"
                            placeholder="Supplier"
                            value={supplierFilter}
                            onChange={(e) => setSupplierFilter(e.target.value)}
                        />
                        <input type="date" className="form-input w-full sm:w-40" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        <input type="date" className="form-input w-full sm:w-40" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        <input type="text" className="form-input w-full sm:w-48" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                </div>

                <div className="grid gap-4 px-5 pb-5 md:grid-cols-3">
                    <div className="panel">
                        <div className="text-sm text-gray-500">Total Purchase Value</div>
                        <div className="mt-2 text-xl font-semibold">{Number(summary?.total_purchase_value || 0).toFixed(2)}</div>
                    </div>
                    <div className="panel">
                        <div className="text-sm text-gray-500">Total Input Tax</div>
                        <div className="mt-2 text-xl font-semibold">{Number(summary?.total_input_tax || 0).toFixed(2)}</div>
                    </div>
                    <div className="panel">
                        <div className="text-sm text-gray-500">Net Purchase Amount</div>
                        <div className="mt-2 text-xl font-semibold">{Number(summary?.net_purchase_amount || 0).toFixed(2)}</div>
                    </div>
                </div>

                <div className="datatables pagination-padding px-5 pb-5">
                    <DataTable
                        className="table-hover whitespace-nowrap"
                        records={filteredRecords}
                        columns={[
                            {
                                accessor: 'purchase_date',
                                title: 'Purchase Date',
                                sortable: true,
                                render: ({ purchase_date }) => (purchase_date ? <div>{new Date(purchase_date).toLocaleDateString()}</div> : <div>-</div>),
                            },
                            { accessor: 'purchase_invoice_number', title: 'Invoice Number', sortable: true },
                            { accessor: 'supplier_name', title: 'Supplier', sortable: true },
                            {
                                accessor: 'subtotal',
                                title: 'Subtotal',
                                sortable: true,
                                textAlignment: 'right',
                                render: ({ subtotal }) => <div className="text-right">{Number(subtotal || 0).toFixed(2)}</div>,
                            },
                            {
                                accessor: 'tax_amount',
                                title: 'Tax',
                                sortable: true,
                                textAlignment: 'right',
                                render: ({ tax_amount }) => <div className="text-right">{Number(tax_amount || 0).toFixed(2)}</div>,
                            },
                            {
                                accessor: 'invoice_total',
                                title: 'Invoice Total',
                                sortable: true,
                                textAlignment: 'right',
                                render: ({ invoice_total }) => <div className="text-right font-semibold">{Number(invoice_total || 0).toFixed(2)}</div>,
                            },
                        ]}
                        highlightOnHover
                        totalRecords={totalRecords}
                        recordsPerPage={pageSize}
                        page={page}
                        onPageChange={(p) => setPage(p)}
                        recordsPerPageOptions={PAGE_SIZES}
                        onRecordsPerPageChange={setPageSize}
                        sortStatus={sortStatus}
                        onSortStatusChange={setSortStatus}
                        paginationText={({ from, to, totalRecords }) => `Showing ${from} to ${to} of ${totalRecords} entries`}
                    />
                    {loading && <div className="px-5 py-3 text-sm text-gray-500">Loading purchase report...</div>}
                </div>
            </div>
        </div>
    );
};

export default PurchaseReport;
