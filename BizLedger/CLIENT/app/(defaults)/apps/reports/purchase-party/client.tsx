'use client';

import AuthGuard from '@/components/auth/AuthGuard';
import PurchasePartyReport from '@/components/reports/purchase-party-report';
import React from 'react';

const PurchasePartyReportClient = () => {
    return (
        <AuthGuard>
            <PurchasePartyReport />
        </AuthGuard>
    );
};

export default PurchasePartyReportClient;
