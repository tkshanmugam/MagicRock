'use client';

import AuthGuard from '@/components/auth/AuthGuard';
import SalesReport from '@/components/reports/sales-report';
import React from 'react';

const SalesReportClient = () => {
    return (
        <AuthGuard>
            <SalesReport />
        </AuthGuard>
    );
};

export default SalesReportClient;
