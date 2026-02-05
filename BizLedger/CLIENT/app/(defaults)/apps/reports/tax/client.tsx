'use client';

import AuthGuard from '@/components/auth/AuthGuard';
import TaxReport from '@/components/reports/tax-report';
import React from 'react';

const TaxReportClient = () => {
    return (
        <AuthGuard>
            <TaxReport />
        </AuthGuard>
    );
};

export default TaxReportClient;
