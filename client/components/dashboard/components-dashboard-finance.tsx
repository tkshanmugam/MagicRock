'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });
import { apiGet } from '@/lib/apiClient';
import { authState } from '@/lib/authState';
import { organizationContext } from '@/lib/organizationContext';
import { getTranslation } from '@/i18n';

type RangeMode = 'today' | 'month';

type DashboardSummary = {
    range: { mode: string; start_date: string; end_date: string };
    kpis: {
        sales: { today: number; month: number; range: number };
        purchases: { today: number; month: number; range: number };
        net_revenue: { today: number; month: number; range: number };
        tax: { today: number; month: number; range: number };
        receivables: number;
        payables: number;
        invoice_counts: { sales: number; purchases: number };
    };
    top_customers: { name?: string | null; total_value: number; invoice_count: number }[];
    top_products: { name?: string | null; quantity: number; total_value: number }[];
};

type DashboardTrends = {
    range: { mode: string; start_date: string; end_date: string };
    data: { date: string; sales: number; purchases: number }[];
};

type DashboardTaxSummary = {
    range: { mode: string; start_date: string; end_date: string };
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
};

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value || 0);

const formatNumber = (value: number) =>
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value || 0);

const ComponentsDashboardFinance = () => {
    const { t } = getTranslation();
    const [range, setRange] = useState<RangeMode>('month');
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [trends, setTrends] = useState<DashboardTrends | null>(null);
    const [taxSummary, setTaxSummary] = useState<DashboardTaxSummary | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [organisationsList, setOrganisationsList] = useState<any[]>([]);
    const [orgsLoading, setOrgsLoading] = useState(false);
    const [organisationId, setOrganisationId] = useState<string>('');

    const canView = organizationContext.hasPermission('DASHBOARD', 'view');
    const isSuperAdmin = organizationContext.getIsSuperAdmin();
    const selectedOrgId = organisationId ? Number(organisationId) : organizationContext.getSelectedOrganizationId();

    const buildQuery = useCallback(() => {
        const params = new URLSearchParams();
        params.set('range', range);
        return params.toString();
    }, [range]);

    const fetchOrganisations = useCallback(async () => {
        if (!authState.isAuthStateReady()) {
            return;
        }
        try {
            setOrgsLoading(true);
            const endpoint = organizationContext.getIsSuperAdmin() ? 'organisations' : 'organisations/me';
            const response = await apiGet<any>(endpoint);
            const organisations = Array.isArray(response) ? response : response.data || response.results || [];
            setOrganisationsList(organisations);
        } catch (error) {
            console.error('Failed to fetch organisations', error);
        } finally {
            setOrgsLoading(false);
        }
    }, []);

    useEffect(() => {
        organizationContext.updateIsSuperAdminFromToken();
    }, []);

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
                    fetchOrganisations();
                }
            }
        }, 100);
        return () => clearInterval(interval);
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
            updateOrganisationSelection(organisationId);
        }
    }, [organisationId, updateOrganisationSelection]);

    const loadDashboard = useCallback(async () => {
        if (!canView) {
            return;
        }
        if (!isSuperAdmin && !selectedOrgId) {
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const query = buildQuery();
            const [summaryResponse, trendsResponse, taxResponse] = await Promise.all([
                apiGet<DashboardSummary>(`dashboard/summary?${query}`),
                apiGet<DashboardTrends>(`dashboard/sales-trends?${query}`),
                apiGet<DashboardTaxSummary>(`dashboard/tax-summary?${query}`),
            ]);
            setSummary(summaryResponse);
            setTrends(trendsResponse);
            setTaxSummary(taxResponse);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load dashboard data';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, [buildQuery, canView, isSuperAdmin, selectedOrgId]);

    useEffect(() => {
        void loadDashboard();
    }, [loadDashboard]);

    useEffect(() => {
        const onOrgUpdate = () => {
            void loadDashboard();
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('organization-permissions-updated', onOrgUpdate);
        }
        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('organization-permissions-updated', onOrgUpdate);
            }
        };
    }, [loadDashboard]);

    const salesTrendSeries = useMemo(() => {
        const labels = trends?.data?.map((point) => point.date) || [];
        const sales = trends?.data?.map((point) => point.sales) || [];
        const purchases = trends?.data?.map((point) => point.purchases) || [];
        return { labels, sales, purchases };
    }, [trends]);

    const lineChartOptions = useMemo(
        () => ({
            chart: {
                type: 'line' as const,
                height: 320,
                toolbar: { show: false },
            },
            stroke: {
                curve: 'smooth' as const,
                width: 3,
            },
            dataLabels: { enabled: false },
            xaxis: { categories: salesTrendSeries.labels },
            colors: ['#4361ee', '#00ab55'],
            legend: { position: 'top' as const },
        }),
        [salesTrendSeries.labels]
    );

    const barChartOptions = useMemo(
        () => ({
            chart: {
                type: 'bar' as const,
                height: 320,
                toolbar: { show: false },
            },
            plotOptions: {
                bar: { columnWidth: '40%', borderRadius: 6 },
            },
            dataLabels: { enabled: false },
            xaxis: { categories: summary?.top_products?.map((item) => item.name || t('db_unknown')) || [] },
            colors: ['#f59e0b'],
        }),
        [summary?.top_products, t]
    );

    if (!canView) {
        return (
            <div className="panel text-center text-danger">
                {t('db_no_permission')}
            </div>
        );
    }

    if (!isSuperAdmin && !selectedOrgId) {
        return (
            <div className="panel text-center text-warning">
                {t('db_select_org_prompt')}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="panel flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-lg font-semibold">{t('dashboard')}</h2>
                    <p className="text-sm text-white-dark">{t('db_dashboard_subtitle')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {organisationsList.length > 1 ? (
                        <select
                            id="dashboardOrganisationId"
                            className="form-select w-full sm:w-64"
                            value={organisationId}
                            onChange={(e) => setOrganisationId(e.target.value)}
                        >
                            <option value="">{orgsLoading ? t('db_loading_orgs') : t('db_select_organisation')}</option>
                            {organisationsList.map((org: any) => (
                                <option key={org.id} value={org.id}>
                                    {org.name}
                                </option>
                            ))}
                        </select>
                    ) : organisationsList.length === 1 ? (
                        <div className="text-sm font-medium text-white-dark">
                            {organisationsList[0]?.name || t('th_organisation')}
                        </div>
                    ) : null}
                    <div className="flex gap-2">
                    <button
                        className={`btn ${range === 'today' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setRange('today')}
                        type="button"
                    >
                        {t('db_today')}
                    </button>
                    <button
                        className={`btn ${range === 'month' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setRange('month')}
                        type="button"
                    >
                        {t('db_this_month')}
                    </button>
                    </div>
                </div>
            </div>

            {isLoading && (
                <div className="panel text-center text-white-dark">{t('db_loading_metrics')}</div>
            )}

            {error && !isLoading && (
                <div className="panel text-center text-danger">{error}</div>
            )}

            {!isLoading && !error && summary && (
                <>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="panel">
                            <h3 className="text-sm font-semibold text-white-dark">{t('db_total_sales')}</h3>
                            <p className="text-xl font-bold">{formatCurrency(summary.kpis.sales.range)}</p>
                            <p className="text-xs text-white-dark">
                                {t('db_today')} {formatCurrency(summary.kpis.sales.today)} · {t('th_month')}{' '}
                                {formatCurrency(summary.kpis.sales.month)}
                            </p>
                        </div>
                        <div className="panel">
                            <h3 className="text-sm font-semibold text-white-dark">{t('db_total_purchases')}</h3>
                            <p className="text-xl font-bold">{formatCurrency(summary.kpis.purchases.range)}</p>
                            <p className="text-xs text-white-dark">
                                {t('db_today')} {formatCurrency(summary.kpis.purchases.today)} · {t('th_month')}{' '}
                                {formatCurrency(summary.kpis.purchases.month)}
                            </p>
                        </div>
                        <div className="panel">
                            <h3 className="text-sm font-semibold text-white-dark">{t('db_net_revenue')}</h3>
                            <p className="text-xl font-bold">{formatCurrency(summary.kpis.net_revenue.range)}</p>
                            <p className="text-xs text-white-dark">
                                {t('db_today')} {formatCurrency(summary.kpis.net_revenue.today)} · {t('th_month')}{' '}
                                {formatCurrency(summary.kpis.net_revenue.month)}
                            </p>
                        </div>
                        <div className="panel">
                            <h3 className="text-sm font-semibold text-white-dark">{t('db_tax_collected')}</h3>
                            <p className="text-xl font-bold">{formatCurrency(summary.kpis.tax.range)}</p>
                            <p className="text-xs text-white-dark">
                                {t('db_today')} {formatCurrency(summary.kpis.tax.today)} · {t('th_month')}{' '}
                                {formatCurrency(summary.kpis.tax.month)}
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="panel">
                            <h3 className="text-sm font-semibold text-white-dark">{t('db_outstanding_receivables')}</h3>
                            <p className="text-2xl font-bold">{formatCurrency(summary.kpis.receivables)}</p>
                        </div>
                        <div className="panel">
                            <h3 className="text-sm font-semibold text-white-dark">{t('db_outstanding_payables')}</h3>
                            <p className="text-2xl font-bold">{formatCurrency(summary.kpis.payables)}</p>
                        </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">
                        <div className="panel lg:col-span-2">
                            <div className="mb-4 flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-white-dark">{t('db_sales_vs_purchases_trend')}</h3>
                                <span className="text-xs text-white-dark">
                                    {summary.range.start_date} → {summary.range.end_date}
                                </span>
                            </div>
                            {trends?.data?.length ? (
                                <ReactApexChart
                                    type="line"
                                    height={320}
                                    options={lineChartOptions}
                                    series={[
                                        { name: t('db_chart_sales'), data: salesTrendSeries.sales },
                                        { name: t('db_chart_purchases'), data: salesTrendSeries.purchases },
                                    ]}
                                />
                            ) : (
                                <div className="text-center text-white-dark">{t('db_no_trend_data')}</div>
                            )}
                        </div>
                        <div className="panel">
                            <h3 className="mb-4 text-sm font-semibold text-white-dark">{t('db_tax_summary')}</h3>
                            {taxSummary ? (
                                <div className="space-y-3 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span>CGST</span>
                                        <span className="font-semibold">{formatCurrency(taxSummary.cgst)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span>SGST</span>
                                        <span className="font-semibold">{formatCurrency(taxSummary.sgst)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span>IGST</span>
                                        <span className="font-semibold">{formatCurrency(taxSummary.igst)}</span>
                                    </div>
                                    <div className="border-t border-white-light pt-2 text-base font-semibold">
                                        {t('db_total')} {formatCurrency(taxSummary.total)}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center text-white-dark">{t('db_no_tax_data')}</div>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <div className="panel">
                            <h3 className="mb-4 text-sm font-semibold text-white-dark">{t('db_top_products')}</h3>
                            {summary.top_products.length ? (
                                <>
                                    <ReactApexChart
                                        type="bar"
                                        height={320}
                                        options={barChartOptions}
                                        series={[
                                            {
                                                name: t('db_chart_total_value'),
                                                data: summary.top_products.map((item) => item.total_value),
                                            },
                                        ]}
                                    />
                                    <div className="mt-4 space-y-2 text-sm text-white-dark">
                                        {summary.top_products.map((item) => (
                                            <div key={item.name || 'unknown'} className="flex items-center justify-between">
                                                <span>{item.name || t('db_unknown')}</span>
                                                <span>
                                                    {formatNumber(item.quantity)} {t('db_qty')} · {formatCurrency(item.total_value)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="text-center text-white-dark">{t('db_no_product_data')}</div>
                            )}
                        </div>
                        <div className="panel">
                            <h3 className="mb-4 text-sm font-semibold text-white-dark">{t('db_top_customers')}</h3>
                            {summary.top_customers.length ? (
                                <div className="table-responsive">
                                    <table className="table-hover table">
                                        <thead>
                                            <tr>
                                                <th>{t('th_customer')}</th>
                                                <th className="text-right">{t('th_revenue')}</th>
                                                <th className="text-right">{t('th_invoices')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {summary.top_customers.map((customer) => (
                                                <tr key={customer.name || 'unknown'}>
                                                    <td>{customer.name || t('db_unknown')}</td>
                                                    <td className="text-right">{formatCurrency(customer.total_value)}</td>
                                                    <td className="text-right">{customer.invoice_count}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center text-white-dark">{t('db_no_customer_data')}</div>
                            )}
                        </div>
                    </div>

                    <div className="panel text-sm text-white-dark">
                        {t('db_footer_sales_invoices')} {summary.kpis.invoice_counts.sales} · {t('db_footer_purchase_vouchers')}{' '}
                        {summary.kpis.invoice_counts.purchases}
                    </div>
                </>
            )}
        </div>
    );
};

export default ComponentsDashboardFinance;
