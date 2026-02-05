'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactApexChart from 'react-apexcharts';
import { apiGet } from '@/lib/apiClient';
import { organizationContext } from '@/lib/organizationContext';

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
    const [range, setRange] = useState<RangeMode>('month');
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [trends, setTrends] = useState<DashboardTrends | null>(null);
    const [taxSummary, setTaxSummary] = useState<DashboardTaxSummary | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canView = organizationContext.hasPermission('DASHBOARD', 'view');
    const isSuperAdmin = organizationContext.getIsSuperAdmin();
    const selectedOrgId = organizationContext.getSelectedOrganizationId();

    const buildQuery = useCallback(() => {
        const params = new URLSearchParams();
        params.set('range', range);
        return params.toString();
    }, [range]);

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
                type: 'line',
                height: 320,
                toolbar: { show: false },
            },
            stroke: {
                curve: 'smooth',
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
                type: 'bar',
                height: 320,
                toolbar: { show: false },
            },
            plotOptions: {
                bar: { columnWidth: '40%', borderRadius: 6 },
            },
            dataLabels: { enabled: false },
            xaxis: { categories: summary?.top_products?.map((item) => item.name || 'Unknown') || [] },
            colors: ['#f59e0b'],
        }),
        [summary?.top_products]
    );

    if (!canView) {
        return (
            <div className="panel text-center text-danger">
                You do not have permission to view the dashboard.
            </div>
        );
    }

    if (!isSuperAdmin && !selectedOrgId) {
        return (
            <div className="panel text-center text-warning">
                Select an organization to view dashboard metrics.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="panel flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-lg font-semibold">Dashboard</h2>
                    <p className="text-sm text-white-dark">Real-time metrics scoped to your organization.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        className={`btn ${range === 'today' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setRange('today')}
                        type="button"
                    >
                        Today
                    </button>
                    <button
                        className={`btn ${range === 'month' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setRange('month')}
                        type="button"
                    >
                        This Month
                    </button>
                </div>
            </div>

            {isLoading && (
                <div className="panel text-center text-white-dark">Loading dashboard metrics...</div>
            )}

            {error && !isLoading && (
                <div className="panel text-center text-danger">{error}</div>
            )}

            {!isLoading && !error && summary && (
                <>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="panel">
                            <h3 className="text-sm font-semibold text-white-dark">Total Sales</h3>
                            <p className="text-xl font-bold">{formatCurrency(summary.kpis.sales.range)}</p>
                            <p className="text-xs text-white-dark">
                                Today {formatCurrency(summary.kpis.sales.today)} · Month {formatCurrency(summary.kpis.sales.month)}
                            </p>
                        </div>
                        <div className="panel">
                            <h3 className="text-sm font-semibold text-white-dark">Total Purchases</h3>
                            <p className="text-xl font-bold">{formatCurrency(summary.kpis.purchases.range)}</p>
                            <p className="text-xs text-white-dark">
                                Today {formatCurrency(summary.kpis.purchases.today)} · Month {formatCurrency(summary.kpis.purchases.month)}
                            </p>
                        </div>
                        <div className="panel">
                            <h3 className="text-sm font-semibold text-white-dark">Net Revenue</h3>
                            <p className="text-xl font-bold">{formatCurrency(summary.kpis.net_revenue.range)}</p>
                            <p className="text-xs text-white-dark">
                                Today {formatCurrency(summary.kpis.net_revenue.today)} · Month {formatCurrency(summary.kpis.net_revenue.month)}
                            </p>
                        </div>
                        <div className="panel">
                            <h3 className="text-sm font-semibold text-white-dark">Tax Collected</h3>
                            <p className="text-xl font-bold">{formatCurrency(summary.kpis.tax.range)}</p>
                            <p className="text-xs text-white-dark">
                                Today {formatCurrency(summary.kpis.tax.today)} · Month {formatCurrency(summary.kpis.tax.month)}
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="panel">
                            <h3 className="text-sm font-semibold text-white-dark">Outstanding Receivables</h3>
                            <p className="text-2xl font-bold">{formatCurrency(summary.kpis.receivables)}</p>
                        </div>
                        <div className="panel">
                            <h3 className="text-sm font-semibold text-white-dark">Outstanding Payables</h3>
                            <p className="text-2xl font-bold">{formatCurrency(summary.kpis.payables)}</p>
                        </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">
                        <div className="panel lg:col-span-2">
                            <div className="mb-4 flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-white-dark">Sales vs Purchases Trend</h3>
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
                                        { name: 'Sales', data: salesTrendSeries.sales },
                                        { name: 'Purchases', data: salesTrendSeries.purchases },
                                    ]}
                                />
                            ) : (
                                <div className="text-center text-white-dark">No trend data available.</div>
                            )}
                        </div>
                        <div className="panel">
                            <h3 className="mb-4 text-sm font-semibold text-white-dark">Tax Summary</h3>
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
                                        Total {formatCurrency(taxSummary.total)}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center text-white-dark">No tax data available.</div>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <div className="panel">
                            <h3 className="mb-4 text-sm font-semibold text-white-dark">Top Products</h3>
                            {summary.top_products.length ? (
                                <>
                                    <ReactApexChart
                                        type="bar"
                                        height={320}
                                        options={barChartOptions}
                                        series={[
                                            {
                                                name: 'Total Value',
                                                data: summary.top_products.map((item) => item.total_value),
                                            },
                                        ]}
                                    />
                                    <div className="mt-4 space-y-2 text-sm text-white-dark">
                                        {summary.top_products.map((item) => (
                                            <div key={item.name || 'unknown'} className="flex items-center justify-between">
                                                <span>{item.name || 'Unknown'}</span>
                                                <span>
                                                    {formatNumber(item.quantity)} qty · {formatCurrency(item.total_value)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="text-center text-white-dark">No product data available.</div>
                            )}
                        </div>
                        <div className="panel">
                            <h3 className="mb-4 text-sm font-semibold text-white-dark">Top Customers</h3>
                            {summary.top_customers.length ? (
                                <div className="table-responsive">
                                    <table className="table-hover table">
                                        <thead>
                                            <tr>
                                                <th>Customer</th>
                                                <th className="text-right">Revenue</th>
                                                <th className="text-right">Invoices</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {summary.top_customers.map((customer) => (
                                                <tr key={customer.name || 'unknown'}>
                                                    <td>{customer.name || 'Unknown'}</td>
                                                    <td className="text-right">{formatCurrency(customer.total_value)}</td>
                                                    <td className="text-right">{customer.invoice_count}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center text-white-dark">No customer data available.</div>
                            )}
                        </div>
                    </div>

                    <div className="panel text-sm text-white-dark">
                        Sales invoices: {summary.kpis.invoice_counts.sales} · Purchase vouchers: {summary.kpis.invoice_counts.purchases}
                    </div>
                </>
            )}
        </div>
    );
};

export default ComponentsDashboardFinance;
