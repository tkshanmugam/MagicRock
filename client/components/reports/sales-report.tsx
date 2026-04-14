'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import dynamic from 'next/dynamic';
import type { DataTableProps, DataTableSortStatus } from 'mantine-datatable';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

import { apiGet } from '@/lib/apiClient';
import { authState } from '@/lib/authState';
import { organizationContext } from '@/lib/organizationContext';
import { useOrganizationSelection } from '@/lib/useOrganizationSelection';
import { exportToCsv } from '@/lib/exportUtils';
import { getCurrentMonthDateRange } from '@/lib/reportDateRange';
import { fetchAllPaginatedReportItems, waitNextPaint } from '@/lib/reportPdfExport';
import { fetchSalesReport, SalesReportItem, SalesReportSummary } from '@/lib/reportApi';
import { getTranslation } from '@/i18n';

/** Period line display: DD-MM-YYYY (e.g. 01-04-2026). */
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

/** Local display for HTML date input values (YYYY-MM-DD) without UTC shift issues. */
function formatReportDate(isoDate: string): string {
    if (!isoDate?.trim()) {
        return '';
    }
    const parts = isoDate.split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
        return isoDate;
    }
    const [y, m, d] = parts;
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

const DataTable = dynamic<DataTableProps<SalesReportItem>>(() => import('mantine-datatable').then((mod) => mod.DataTable), {
    ssr: false,
    loading: () => (
        <div className="panel mt-5">
            <div className="text-center py-8">Loading sales report...</div>
        </div>
    ),
});

const SalesReport = () => {
    const { t } = getTranslation();
    const reportRef = useRef<HTMLDivElement | null>(null);
    const canViewReports = organizationContext.hasPermission('Reports', 'view');
    const [isSuperAdmin, setIsSuperAdmin] = useState(organizationContext.getIsSuperAdmin());
    const [organisationsList, setOrganisationsList] = useState<any[]>([]);
    const [orgsLoading, setOrgsLoading] = useState<boolean>(false);
    const [organisationId, setOrganisationId] = useState<string>('');

    const [records, setRecords] = useState<SalesReportItem[]>([]);
    const [summary, setSummary] = useState<SalesReportSummary | null>(null);
    const [totalRecords, setTotalRecords] = useState(0);
    const [loading, setLoading] = useState(false);

    const [statusFilter, setStatusFilter] = useState<string>('');
    const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<string>('');
    const [startDate, setStartDate] = useState<string>(() => getCurrentMonthDateRange().start);
    const [endDate, setEndDate] = useState<string>(() => getCurrentMonthDateRange().end);
    const [search, setSearch] = useState('');

    const [page, setPage] = useState(1);
    const PAGE_SIZES = [10, 20, 30, 50, 100];
    const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
    const [sortStatus, setSortStatus] = useState<DataTableSortStatus>({
        columnAccessor: 'invoice_date',
        direction: 'desc',
    });
    const [pdfExportRecords, setPdfExportRecords] = useState<SalesReportItem[] | null>(null);

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
        const load = () => {
            organizationContext.updateIsSuperAdminFromToken();
            setIsSuperAdmin(organizationContext.getIsSuperAdmin());
            fetchOrganisations();
        };
        const unsubscribe = authState.onAuthStateReady(load);
        return unsubscribe;
    }, [fetchOrganisations]);

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

    useOrganizationSelection({
        organisationsList,
        organisationId,
        setOrganisationId,
        onOrganisationChange: updateOrganisationSelection,
    });

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

    const filterSummaryLine = useMemo(() => {
        const parts: string[] = [];
        if (statusFilter === 'ACTIVE') {
            parts.push('Status: Active');
        } else if (statusFilter === 'CANCELLED') {
            parts.push('Status: Cancelled');
        }
        if (invoiceTypeFilter === 'TAX') {
            parts.push('Invoice type: Tax');
        } else if (invoiceTypeFilter === 'NON_TAX') {
            parts.push('Invoice type: Non-tax');
        }
        return parts.length ? parts.join(' · ') : '';
    }, [statusFilter, invoiceTypeFilter]);

    const fetchReport = useCallback(async () => {
        if (!organisationId) {
            return;
        }
        setLoading(true);
        setRecords([]);
        setSummary(null);
        try {
            const response = await fetchSalesReport({
                organisation_id: Number(organisationId),
                from_date: startDate,
                to_date: endDate,
                invoice_type: invoiceTypeFilter,
                status: statusFilter,
                skip: (page - 1) * pageSize,
                limit: pageSize,
            });
            setRecords(response.items || []);
            setSummary(response.summary || null);
            setTotalRecords(response.total || 0);
        } catch (error) {
            console.error('Failed to load sales report', error);
        } finally {
            setLoading(false);
        }
    }, [organisationId, startDate, endDate, invoiceTypeFilter, statusFilter, page, pageSize]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    useEffect(() => {
        setPage(1);
    }, [pageSize, statusFilter, invoiceTypeFilter, startDate, endDate, organisationId]);

    const filteredRecords = useMemo(() => {
        if (!search) {
            return records;
        }
        const term = search.toLowerCase();
        return records.filter(
            (item) =>
                item.invoice_number?.toLowerCase().includes(term) ||
                item.customer_name?.toLowerCase().includes(term)
        );
    }, [records, search]);

    const tableRecords = pdfExportRecords ?? filteredRecords;

    const downloadPdf = async () => {
        if (!reportRef.current || !organisationId) {
            return;
        }
        const applySearch = (items: SalesReportItem[]) => {
            if (!search.trim()) {
                return items;
            }
            const term = search.toLowerCase();
            return items.filter(
                (item) =>
                    item.invoice_number?.toLowerCase().includes(term) ||
                    item.customer_name?.toLowerCase().includes(term)
            );
        };

        try {
            const allRows = await fetchAllPaginatedReportItems(async (skip, limit) => {
                const response = await fetchSalesReport({
                    organisation_id: Number(organisationId),
                    from_date: startDate,
                    to_date: endDate,
                    invoice_type: invoiceTypeFilter,
                    status: statusFilter,
                    skip,
                    limit,
                });
                return { items: response.items || [], total: response.total || 0 };
            });
            const rowsForPdf = applySearch(allRows);
            flushSync(() => setPdfExportRecords(rowsForPdf));
            await waitNextPaint();

            const canvas = await html2canvas(reportRef.current, {
                scale: 2.5,
                useCORS: true,
                backgroundColor: '#ffffff',
                windowWidth: reportRef.current.scrollWidth,
                windowHeight: reportRef.current.scrollHeight,
                onclone: (_doc, clonedEl) => {
                clonedEl.style.backgroundColor = '#ffffff';
                clonedEl.style.border = '2px solid #1e293b';
                clonedEl.style.borderRadius = '8px';
                clonedEl.style.overflow = 'visible';

                const reportHeader = clonedEl.querySelector('header');
                if (reportHeader instanceof HTMLElement) {
                    reportHeader.style.backgroundColor = '#e2e8f0';
                    reportHeader.style.borderBottom = '4px solid #0f172a';
                    reportHeader.style.paddingBottom = '28px';
                    reportHeader.style.paddingTop = '32px';
                    reportHeader.style.overflow = 'visible';
                }

                /* Flatten ScrollArea so sticky thead is not clipped by html2canvas */
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

                const table = clonedEl.querySelector('table');
                if (table instanceof HTMLElement) {
                    table.style.borderCollapse = 'collapse';
                }
                clonedEl.querySelectorAll('table th, table td').forEach((cell) => {
                    if (cell instanceof HTMLElement) {
                        cell.style.border = '1px solid #475569';
                    }
                });
                clonedEl.querySelectorAll('table thead th').forEach((th) => {
                    if (th instanceof HTMLElement) {
                        th.style.backgroundColor = '#94a3b8';
                        th.style.color = '#020617';
                        th.style.fontWeight = '800';
                        th.style.fontSize = '13px';
                        th.style.paddingTop = '18px';
                        th.style.paddingBottom = '18px';
                        th.style.paddingLeft = '12px';
                        th.style.paddingRight = '12px';
                        th.style.minHeight = '56px';
                        th.style.lineHeight = '1.45';
                        th.style.verticalAlign = 'middle';
                        th.style.overflow = 'visible';
                        th.style.position = 'relative';
                        th.style.top = 'auto';
                        th.style.zIndex = 'auto';
                    }
                });
                clonedEl.querySelectorAll('table thead th .mantine-Group-root').forEach((node) => {
                    if (node instanceof HTMLElement) {
                        node.style.alignItems = 'center';
                        node.style.minHeight = '36px';
                        node.style.overflow = 'visible';
                    }
                });
                clonedEl.querySelectorAll('table thead th .mantine-Box-root, table thead th div').forEach((node) => {
                    if (node instanceof HTMLElement && node.closest('thead')) {
                        node.style.overflow = 'visible';
                        node.style.lineHeight = '1.45';
                    }
                });

                clonedEl.querySelectorAll('.sales-report-pdf-hide').forEach((node) => {
                    (node as HTMLElement).style.display = 'none';
                });

                clonedEl.querySelectorAll('[data-orientation="horizontal"], [data-orientation="vertical"]').forEach((node) => {
                    if (node instanceof HTMLElement) {
                        node.style.display = 'none';
                    }
                });

                const view = _doc.defaultView;
                if (view) {
                    const bumpFontOnePx = (el: HTMLElement) => {
                        const px = parseFloat(view.getComputedStyle(el).fontSize);
                        if (!Number.isNaN(px)) {
                            el.style.fontSize = `${px + 1}px`;
                        }
                    };
                    clonedEl.querySelectorAll(
                        'header p, header h1, .grid.gap-4 .text-base, .grid.gap-4 .text-xl, table th, table td'
                    ).forEach((node) => {
                        if (node instanceof HTMLElement) {
                            bumpFontOnePx(node);
                        }
                    });
                }
            },
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const marginMm = 12;
            const pageWidthMm = pdf.internal.pageSize.getWidth();
            const pageHeightMm = pdf.internal.pageSize.getHeight();
            const contentWidthMm = pageWidthMm - 2 * marginMm;
            const contentHeightMm = pageHeightMm - 2 * marginMm;

            const imgRenderWidth = contentWidthMm;
            const imgRenderHeight = (canvas.height * contentWidthMm) / canvas.width;

            let heightLeft = imgRenderHeight;
            pdf.addImage(imgData, 'PNG', marginMm, marginMm, imgRenderWidth, imgRenderHeight);
            heightLeft -= contentHeightMm;

            while (heightLeft > 0) {
                const y = marginMm + (heightLeft - imgRenderHeight);
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', marginMm, y, imgRenderWidth, imgRenderHeight);
                heightLeft -= contentHeightMm;
            }

            pdf.save(`sales-report-${organisationId || 'org'}.pdf`);
        } catch (e) {
            console.error('Failed to export sales report PDF', e);
        } finally {
            flushSync(() => setPdfExportRecords(null));
        }
    };

    const downloadExcel = () => {
        const preamble = [
            `Organisation: ${selectedOrganisationLabel}`,
            'Report: Sales Report',
            `Period: ${reportPeriodLine}`,
            ...(filterSummaryLine ? [filterSummaryLine] : []),
            '',
        ];
        exportToCsv(
            `sales-report-${organisationId || 'org'}.csv`,
            records,
            [
                {
                    key: 'invoice_date',
                    label: 'Invoice Date',
                    format: (v) => {
                        if (v == null || v === '') {
                            return '';
                        }
                        const s = String(v);
                        const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
                        if (m) {
                            return formatReportDate(m[1]);
                        }
                        return new Date(s).toLocaleDateString();
                    },
                },
                { key: 'invoice_number', label: 'Invoice Number' },
                { key: 'invoice_type', label: 'Invoice Type' },
                { key: 'subtotal', label: 'Subtotal' },
                { key: 'tax_amount', label: 'Tax Amount' },
                { key: 'round_off', label: 'Round Off' },
                { key: 'invoice_total', label: 'Invoice Total' },
                { key: 'customer_name', label: 'Customer Name' },
            ],
            preamble
        );
    };

    if (!canViewReports) {
        return (
            <div className="panel border-white-light px-5 py-8 text-center font-semibold dark:border-[#1b2e4b]">
                You do not have permission to view Reports.
            </div>
        );
    }

    return (
        <div className="sales-report-page sales-report-page-view panel border-white-light px-0 dark:border-[#1b2e4b]">
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
                    <select className="form-select w-full sm:w-40" value={invoiceTypeFilter} onChange={(e) => setInvoiceTypeFilter(e.target.value)}>
                        <option value="">All Types</option>
                        <option value="TAX">Tax</option>
                        <option value="NON_TAX">Non Tax</option>
                    </select>
                    <input type="date" className="form-input w-full sm:w-40" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    <input type="date" className="form-input w-full sm:w-40" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    <input type="text" className="form-input w-full sm:w-48" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
            </div>

            <div
                ref={reportRef}
                className="invoice-table w-full min-w-0 rounded-lg border-2 border-slate-700 bg-white text-gray-900 shadow-sm dark:border-slate-700 dark:bg-white dark:text-gray-900"
            >
                <header className="border-b-4 border-slate-900 bg-slate-200 px-6 pb-6 pt-8 text-center">
                    <p className="text-lg font-bold tracking-wide text-slate-950">{selectedOrganisationLabel}</p>
                    <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Sales Report</h1>
                    <p className="mt-3 text-base text-slate-800">
                        <span className="font-semibold text-slate-900">Period: </span>
                        {reportPeriodLine}
                    </p>
                    {filterSummaryLine ? <p className="mt-2 text-sm font-medium text-slate-700">{filterSummaryLine}</p> : null}
                </header>

                <div className="grid gap-4 bg-white px-6 pb-5 pt-6 md:grid-cols-4">
                    <div className="sales-report-summary-card rounded-md border-2 border-slate-500 bg-white p-4 shadow-none">
                        <div className="text-base font-semibold text-slate-700">Total Taxable Sales</div>
                        <div className="mt-2 text-xl font-bold text-slate-900">{Number(summary?.total_taxable_sales || 0).toFixed(2)}</div>
                    </div>
                    <div className="sales-report-summary-card rounded-md border-2 border-slate-500 bg-white p-4 shadow-none">
                        <div className="text-base font-semibold text-slate-700">Total Non-Tax Sales</div>
                        <div className="mt-2 text-xl font-bold text-slate-900">{Number(summary?.total_non_tax_sales || 0).toFixed(2)}</div>
                    </div>
                    <div className="sales-report-summary-card rounded-md border-2 border-slate-500 bg-white p-4 shadow-none">
                        <div className="text-base font-semibold text-slate-700">Total Tax Collected</div>
                        <div className="mt-2 text-xl font-bold text-slate-900">{Number(summary?.total_tax_collected || 0).toFixed(2)}</div>
                    </div>
                    <div className="sales-report-summary-card rounded-md border-2 border-slate-500 bg-white p-4 shadow-none">
                        <div className="text-base font-semibold text-slate-700">Net Sales Value</div>
                        <div className="mt-2 text-xl font-bold text-slate-900">{Number(summary?.net_sales_value || 0).toFixed(2)}</div>
                    </div>
                </div>

                <div className="sales-report-datatable-wrap datatables min-w-0 bg-white px-6 pb-6">
                    <DataTable
                        className="table-hover"
                        horizontalSpacing="sm"
                        verticalSpacing="md"
                        withBorder
                        borderRadius="sm"
                        withColumnBorders
                        borderColor="#475569"
                        classNames={{ pagination: 'sales-report-pdf-hide' }}
                        records={tableRecords}
                        totalRecords={pdfExportRecords === null ? totalRecords : pdfExportRecords.length}
                        recordsPerPage={pdfExportRecords === null ? pageSize : Math.max(pdfExportRecords.length, 1)}
                        page={pdfExportRecords === null ? page : 1}
                        onPageChange={pdfExportRecords === null ? setPage : () => {}}
                        recordsPerPageOptions={
                            pdfExportRecords === null ? PAGE_SIZES : [Math.max(pdfExportRecords.length, 1)]
                        }
                        onRecordsPerPageChange={pdfExportRecords === null ? setPageSize : () => {}}
                        paginationText={({ from, to, totalRecords: tr }) => `Showing ${from} to ${to} of ${tr} entries`}
                        columns={[
                            {
                                accessor: 'invoice_date',
                                title: t('th_invoice_date'),
                                sortable: true,
                                width: 118,
                                render: ({ invoice_date }) => <div className="whitespace-nowrap">{new Date(invoice_date).toLocaleDateString()}</div>,
                            },
                            { accessor: 'invoice_number', title: t('th_invoice_number'), sortable: true, width: 140, noWrap: true },
                            { accessor: 'invoice_type', title: t('th_type'), sortable: true, width: 96, noWrap: true },
                            { accessor: 'customer_name', title: t('th_customer'), sortable: true, width: 200, noWrap: true },
                            {
                                accessor: 'subtotal',
                                title: t('th_subtotal'),
                                sortable: true,
                                width: 112,
                                textAlignment: 'right',
                                noWrap: true,
                                render: ({ subtotal }) => <div className="text-right tabular-nums">{Number(subtotal || 0).toFixed(2)}</div>,
                            },
                            {
                                accessor: 'tax_amount',
                                title: t('th_tax'),
                                sortable: true,
                                width: 100,
                                textAlignment: 'right',
                                noWrap: true,
                                render: ({ tax_amount }) => <div className="text-right tabular-nums">{Number(tax_amount || 0).toFixed(2)}</div>,
                            },
                            {
                                accessor: 'round_off',
                                title: t('th_round_off'),
                                sortable: true,
                                width: 100,
                                textAlignment: 'right',
                                noWrap: true,
                                render: ({ round_off }) => <div className="text-right tabular-nums">{Number(round_off || 0).toFixed(2)}</div>,
                            },
                            {
                                accessor: 'invoice_total',
                                title: t('th_invoice_total'),
                                sortable: true,
                                width: 128,
                                textAlignment: 'right',
                                noWrap: true,
                                render: ({ invoice_total }) => (
                                    <div className="text-right font-semibold tabular-nums">{Number(invoice_total || 0).toFixed(2)}</div>
                                ),
                            },
                        ]}
                        highlightOnHover
                        sortStatus={sortStatus}
                        onSortStatusChange={setSortStatus}
                    />
                    {loading && <div className="px-6 py-3 text-sm text-gray-500">Loading sales report...</div>}
                </div>
            </div>
        </div>
    );
};

export default SalesReport;
