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
import { getCurrentMonthDateRange } from '@/lib/reportDateRange';
import { fetchSalesPartyReport, SalesPartyReportItem, SalesPartyReportSummary } from '@/lib/reportApi';
import { getTranslation } from '@/i18n';

/** Period display: DD-MM-YYYY from HTML date input value (YYYY-MM-DD). */
function formatIsoDateDdMmYyyy(isoDate: string): string {
    if (!isoDate?.trim()) {
        return '';
    }
    const parts = isoDate.split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
        return isoDate;
    }
    const [y, m, d] = parts;
    return `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`;
}

const DataTable = dynamic<DataTableProps<SalesPartyReportItem>>(() => import('mantine-datatable').then((mod) => mod.DataTable), {
    ssr: false,
    loading: () => (
        <div className="panel mt-5">
            <div className="text-center py-8">Loading sales party report...</div>
        </div>
    ),
});

const SalesPartyReport = () => {
    const { t } = getTranslation();
    const reportRef = useRef<HTMLDivElement | null>(null);
    const canViewReports = organizationContext.hasPermission('Reports', 'view');
    const [isSuperAdmin, setIsSuperAdmin] = useState(organizationContext.getIsSuperAdmin());
    const [organisationsList, setOrganisationsList] = useState<any[]>([]);
    const [orgsLoading, setOrgsLoading] = useState<boolean>(false);
    const [organisationId, setOrganisationId] = useState<string>('');

    const [records, setRecords] = useState<SalesPartyReportItem[]>([]);
    const [summary, setSummary] = useState<SalesPartyReportSummary | null>(null);
    const [totalRecords, setTotalRecords] = useState(0);
    const [loading, setLoading] = useState(false);

    const [statusFilter, setStatusFilter] = useState<string>('');
    const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<string>('');
    const [startDate, setStartDate] = useState<string>(() => getCurrentMonthDateRange().start);
    const [endDate, setEndDate] = useState<string>(() => getCurrentMonthDateRange().end);
    const [partySearch, setPartySearch] = useState('');

    const [page, setPage] = useState(1);
    const PAGE_SIZES = [10, 20, 30, 50, 100];
    const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
    const [sortStatus, setSortStatus] = useState<DataTableSortStatus>({
        columnAccessor: 'invoice_total',
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

    const reportPeriodLine = useMemo(() => {
        const from = formatIsoDateDdMmYyyy(startDate);
        const to = formatIsoDateDdMmYyyy(endDate);
        if (startDate && endDate) {
            return `${from} to ${to}`;
        }
        if (startDate) {
            return `From ${from}`;
        }
        if (endDate) {
            return `Up to ${to}`;
        }
        return 'All dates';
    }, [startDate, endDate]);

    const fetchReport = useCallback(async () => {
        if (!organisationId) {
            return;
        }
        setLoading(true);
        setRecords([]);
        setSummary(null);
        try {
            const response = await fetchSalesPartyReport({
                organisation_id: Number(organisationId),
                from_date: startDate,
                to_date: endDate,
                invoice_type: invoiceTypeFilter,
                status: statusFilter,
                party: partySearch,
                skip: (page - 1) * pageSize,
                limit: pageSize,
            });
            setRecords(response.items || []);
            setSummary(response.summary || null);
            setTotalRecords(response.total || 0);
        } catch (error) {
            console.error('Failed to load sales party report', error);
        } finally {
            setLoading(false);
        }
    }, [organisationId, startDate, endDate, invoiceTypeFilter, statusFilter, partySearch, page, pageSize]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    useEffect(() => {
        setPage(1);
    }, [pageSize, statusFilter, invoiceTypeFilter, startDate, endDate, organisationId, partySearch]);

    const totals = useMemo(() => {
        return {
            taxable: Number(summary?.total_taxable_amount || 0).toFixed(2),
            tax: Number(summary?.total_tax_amount || 0).toFixed(2),
            invoice: Number(summary?.total_invoice_amount || 0).toFixed(2),
        };
    }, [summary]);

    const downloadPdf = async () => {
        if (!reportRef.current) {
            return;
        }
        const canvas = await html2canvas(reportRef.current, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            onclone: (_doc, clonedEl) => {
                clonedEl.style.backgroundColor = '#ffffff';

                clonedEl.querySelectorAll('.mantine-ScrollArea-root').forEach((node) => {
                    if (node instanceof HTMLElement) {
                        node.style.overflow = 'visible';
                        node.style.height = 'auto';
                        node.style.maxHeight = 'none';
                    }
                });
                clonedEl.querySelectorAll('.mantine-ScrollArea-viewport').forEach((node) => {
                    if (node instanceof HTMLElement) {
                        node.style.overflow = 'visible';
                        node.style.height = 'auto';
                        node.style.maxHeight = 'none';
                    }
                });

                clonedEl.style.border = '1px solid rgb(148, 163, 184)';
                clonedEl.style.borderRadius = '8px';

                const table = clonedEl.querySelector('table');
                if (table instanceof HTMLElement) {
                    table.style.borderCollapse = 'collapse';
                }
                clonedEl.querySelectorAll('table th, table td').forEach((cell) => {
                    if (cell instanceof HTMLElement) {
                        cell.style.border = '1px solid rgb(100, 116, 139)';
                    }
                });
                clonedEl.querySelectorAll('table thead th').forEach((th) => {
                    if (th instanceof HTMLElement) {
                        th.style.backgroundColor = 'rgb(203, 213, 225)';
                        th.style.color = 'rgb(2, 6, 23)';
                    }
                });

                clonedEl.querySelectorAll('.sales-party-pdf-hide').forEach((node) => {
                    (node as HTMLElement).style.display = 'none';
                });
            },
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

        pdf.save(`sales-party-report-${organisationId || 'org'}.pdf`);
    };

    const downloadExcel = () => {
        exportToCsv(`sales-party-report-${organisationId || 'org'}.csv`, records, [
            { key: 'party_name', label: 'Party Name' },
            { key: 'invoice_count', label: 'Invoice Count' },
            { key: 'taxable_amount', label: 'Taxable Amount' },
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
        <div className="sales-party-report-page-view panel border-white-light px-0 dark:border-[#1b2e4b]">
            <div className="px-5 pt-5 print:hidden">
                <div className="flex flex-wrap items-center gap-3">
                    <button type="button" className="btn btn-primary gap-2" onClick={downloadPdf}>
                        Export PDF
                    </button>
                    <button type="button" className="btn btn-success gap-2" onClick={downloadExcel}>
                        Export Excel
                    </button>
                </div>
            </div>
            <div className="mb-4.5 flex flex-col gap-5 px-5 pt-5 md:flex-row md:items-center print:hidden">
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
                    <select className="form-select w-full sm:w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
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
                        <option value="NON_TAX">Non Tax</option>
                    </select>
                    <input type="date" className="form-input w-full sm:w-40" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    <input type="date" className="form-input w-full sm:w-40" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    <input
                        type="text"
                        className="form-input w-full sm:w-48"
                        placeholder="Search party..."
                        value={partySearch}
                        onChange={(e) => setPartySearch(e.target.value)}
                    />
                </div>
            </div>

            <div
                ref={reportRef}
                className="invoice-table w-full min-w-0 rounded-lg bg-white text-base text-gray-900 shadow-sm dark:bg-black dark:text-white"
            >
                <div className="border-b border-slate-500 px-5 pb-6 pt-6 text-center dark:border-slate-500">
                    <div className="text-3xl font-bold uppercase tracking-wide text-black dark:text-white">Sales by Party</div>
                    <div className="mt-3 text-lg font-bold text-gray-900 dark:text-white">{selectedOrganisationLabel}</div>
                    <div className="mt-2 text-base text-gray-700 dark:text-gray-300">
                        <span className="font-semibold text-gray-900 dark:text-white">Period: </span>
                        {reportPeriodLine}
                    </div>
                </div>

                <div className="grid gap-4 px-5 py-5 md:grid-cols-3">
                    <div className="sales-party-summary-card panel shadow-none dark:shadow-none">
                        <div className="text-base text-gray-500 dark:text-gray-400">Total Taxable Amount</div>
                        <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{totals.taxable}</div>
                    </div>
                    <div className="sales-party-summary-card panel shadow-none dark:shadow-none">
                        <div className="text-base text-gray-500 dark:text-gray-400">Total Tax Amount</div>
                        <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{totals.tax}</div>
                    </div>
                    <div className="sales-party-summary-card panel shadow-none dark:shadow-none">
                        <div className="text-base text-gray-500 dark:text-gray-400">Total Invoice Amount</div>
                        <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{totals.invoice}</div>
                    </div>
                </div>

                <div className="sales-party-datatable-wrap datatables pagination-padding px-5 pb-5">
                    <DataTable
                        className="table-hover whitespace-nowrap"
                        withBorder
                        withColumnBorders
                        borderColor="#64748b"
                        borderRadius="sm"
                        fontSize="md"
                        horizontalSpacing="md"
                        verticalSpacing="sm"
                        classNames={{ pagination: 'sales-party-pdf-hide' }}
                        records={records}
                        columns={[
                            {
                                accessor: 'party_name',
                                title: t('th_party_name'),
                                sortable: true,
                                render: ({ party_name }) => <div className="font-semibold">{party_name || '-'}</div>,
                            },
                            {
                                accessor: 'invoice_count',
                                title: t('th_invoices'),
                                sortable: true,
                                textAlignment: 'right',
                                render: ({ invoice_count }) => <div className="text-right">{Number(invoice_count || 0)}</div>,
                            },
                            {
                                accessor: 'taxable_amount',
                                title: t('th_taxable_amount'),
                                sortable: true,
                                textAlignment: 'right',
                                render: ({ taxable_amount }) => <div className="text-right">{Number(taxable_amount || 0).toFixed(2)}</div>,
                            },
                            {
                                accessor: 'tax_amount',
                                title: t('th_tax_amount'),
                                sortable: true,
                                textAlignment: 'right',
                                render: ({ tax_amount }) => <div className="text-right">{Number(tax_amount || 0).toFixed(2)}</div>,
                            },
                            {
                                accessor: 'invoice_total',
                                title: t('th_invoice_total'),
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
                    />
                    {loading && <div className="px-5 py-3 text-base text-gray-500">Loading sales party report...</div>}
                </div>
            </div>
        </div>
    );
};

export default SalesPartyReport;
