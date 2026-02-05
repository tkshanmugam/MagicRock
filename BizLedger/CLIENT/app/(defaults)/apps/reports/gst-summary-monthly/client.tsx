'use client';

import AuthGuard from '@/components/auth/AuthGuard';
import GstSummaryMonthlyReport from '@/components/reports/gst-summary-monthly-report';
import React from 'react';

const GstSummaryMonthlyReportClient = () => {
    return (
        <AuthGuard>
            <GstSummaryMonthlyReport />
        </AuthGuard>
    );
};

export default GstSummaryMonthlyReportClient;
