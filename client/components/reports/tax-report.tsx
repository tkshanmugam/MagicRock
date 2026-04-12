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
import { fetchTaxReport, TaxReportItem, TaxReportSummary } from '@/lib/reportApi';
import { getTranslation } from '@/i18n';

const DataTable = dynamic<DataTableProps<TaxReportItem>>(() => import('mantine-datatable').then((mod) => mod.DataTable), {
    ssr: false,
    loading: () => (
        <div className="panel mt-5">
            <div className="text-center py-8">Loading tax report...</div>
        </div>
    ),
});

const TaxReport = () => {
    const { t } = getTranslation();
    const reportRef = useRef<HTMLDivElement | null>(null);
    const canViewReports = organizationContext.hasPermission('Reports', 'view');
    const [isSuperAdmin, setIsSuperAdmin] = useState(organizationContext.getIsSuperAdmin());
    const [organisationsList, setOrganisationsList] = useState<any[]>([]);
    const [orgsLoading, setOrgsLoading] = useState<boolean>(false);
    const [organisationId, setOrganisationId] = useState<string>('');

    const [records, setRecords] = useState<TaxReportItem[]>([]);
    const [summary, setSummary] = useState<TaxReportSummary | null>(null);
    const [loading, setLoading] = useState(false);

    const [taxTypeFilter, setTaxTypeFilter] = useState<string>('ALL');
    const defaultMonthRange = useMemo(() => getCurrentMonthDateRange(), []);
    const [startDate, setStartDate] = useState<string>(defaultMonthRange.start);
    const [endDate, setEndDate] = useState<string>(defaultMonthRange.end);

    const [sortStatus, setSortStatus] = useState<DataTableSortStatus>({
        columnAccessor: 'report_date',
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

    const fetchReport = useCallback(async () => {
        if (!organisationId) {
            return;
        }
        setLoading(true);
        setRecords([]);
        setSummary(null);
        try {
            const response = await fetchTaxReport({
                organisation_id: Number(organisationId),
                from_date: startDate,
                to_date: endDate,
                tax_type: taxTypeFilter,
            });
            setRecords(response.items || []);
            setSummary(response.summary || null);
        } catch (error) {
            console.error('Failed to load tax report', error);
        } finally {
            setLoading(false);
        }
    }, [organisationId, startDate, endDate, taxTypeFilter]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    const totals = useMemo(() => {
        return {
            output: Number(summary?.total_output_tax || 0).toFixed(2),
            net: Number(summary?.net_tax_payable || 0).toFixed(2),
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

                clonedEl.querySelectorAll('.tax-report-pdf-hide').forEach((node) => {
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

        pdf.save(`tax-report-${organisationId || 'org'}.pdf`);
    };

    const downloadExcel = () => {
        exportToCsv(`tax-report-${organisationId || 'org'}.csv`, records, [
            { key: 'report_date', label: 'Date' },
            { key: 'taxable_amount', label: 'Taxable Amount' },
            { key: 'cgst_rate', label: 'CGST %' },
            { key: 'cgst_amount', label: 'CGST Amount' },
            { key: 'sgst_rate', label: 'SGST %' },
            { key: 'sgst_amount', label: 'SGST Amount' },
            { key: 'total_tax_amount', label: 'Total Tax Amount' },
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
        <div className="tax-report-page-view panel border-white-light px-0 dark:border-[#1b2e4b]">
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
                    <select className="form-select w-full sm:w-40" value={taxTypeFilter} onChange={(e) => setTaxTypeFilter(e.target.value)}>
                        <option value="ALL">All Types</option>
                        <option value="CGST">CGST</option>
                        <option value="SGST">SGST</option>
                    </select>
                    <input type="date" className="form-input w-full sm:w-40" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    <input type="date" className="form-input w-full sm:w-40" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
            </div>

            <div
                ref={reportRef}
                className="invoice-table w-full min-w-0 rounded-lg bg-white text-gray-900 shadow-sm dark:bg-black dark:text-white"
            >
                <div className="border-b border-slate-500 px-5 pb-6 pt-6 text-center dark:border-slate-500">
                    <div className="text-2xl font-bold uppercase tracking-wide text-black dark:text-white">GST Summary</div>
                    <div className="mt-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {selectedOrganisationLabel}
                        {startDate || endDate ? ` • ${startDate || '...'} to ${endDate || '...'}` : ''}
                        {taxTypeFilter ? ` • ${taxTypeFilter}` : ''}
                    </div>
                </div>

                <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
                    <div className="tax-report-summary-card panel shadow-none dark:shadow-none">
                        <div className="text-sm text-gray-500 dark:text-gray-400">Total Output Tax</div>
                        <div className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">{totals.output}</div>
                    </div>
                    <div className="tax-report-summary-card panel shadow-none dark:shadow-none">
                        <div className="text-sm text-gray-500 dark:text-gray-400">Net Tax Payable</div>
                        <div className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">{totals.net}</div>
                    </div>
                </div>

                <div className="tax-report-datatable-wrap datatables pagination-padding px-5 pb-5">
                    <DataTable
                        className="table-hover whitespace-nowrap"
                        withBorder
                        withColumnBorders
                        borderColor="#64748b"
                        borderRadius="sm"
                        classNames={{ pagination: 'tax-report-pdf-hide' }}
                        records={records}
                        columns={[
                            {
                                accessor: 'report_date',
                                title: t('th_date'),
                                sortable: true,
                                render: ({ report_date }) => <div>{new Date(report_date).toLocaleDateString()}</div>,
                            },
                            {
                                accessor: 'taxable_amount',
                                title: t('th_taxable_amount'),
                                sortable: true,
                                textAlignment: 'right',
                                render: ({ taxable_amount }) => <div className="text-right">{Number(taxable_amount || 0).toFixed(2)}</div>,
                            },
                            {
                                accessor: 'cgst_rate',
                                title: t('th_cgst_pct'),
                                sortable: true,
                                textAlignment: 'right',
                                render: ({ cgst_rate }) => <div className="text-right">{Number(cgst_rate || 0).toFixed(2)}</div>,
                            },
                            {
                                accessor: 'cgst_amount',
                                title: t('th_cgst_amount'),
                                sortable: true,
                                textAlignment: 'right',
                                render: ({ cgst_amount }) => <div className="text-right">{Number(cgst_amount || 0).toFixed(2)}</div>,
                            },
                            {
                                accessor: 'sgst_rate',
                                title: t('th_sgst_pct'),
                                sortable: true,
                                textAlignment: 'right',
                                render: ({ sgst_rate }) => <div className="text-right">{Number(sgst_rate || 0).toFixed(2)}</div>,
                            },
                            {
                                accessor: 'sgst_amount',
                                title: t('th_sgst_amount'),
                                sortable: true,
                                textAlignment: 'right',
                                render: ({ sgst_amount }) => <div className="text-right">{Number(sgst_amount || 0).toFixed(2)}</div>,
                            },
                            {
                                accessor: 'total_tax_amount',
                                title: t('th_total_tax'),
                                sortable: true,
                                textAlignment: 'right',
                                render: ({ total_tax_amount }) => (
                                    <div className="text-right font-semibold">{Number(total_tax_amount || 0).toFixed(2)}</div>
                                ),
                            },
                        ]}
                        highlightOnHover
                        sortStatus={sortStatus}
                        onSortStatusChange={setSortStatus}
                    />
                    {loading && <div className="px-5 py-3 text-sm text-gray-500">Loading tax report...</div>}
                </div>
            </div>
        </div>
    );
};

export default TaxReport;
