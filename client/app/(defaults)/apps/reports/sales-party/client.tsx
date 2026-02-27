'use client';

import AuthGuard from '@/components/auth/AuthGuard';
import SalesPartyReport from '@/components/reports/sales-party-report';
import React from 'react';

const SalesPartyReportClient = () => {
    return (
        <AuthGuard>
            <SalesPartyReport />
        </AuthGuard>
    );
};

export default SalesPartyReportClient;
