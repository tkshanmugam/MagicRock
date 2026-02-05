'use client';

import AuthGuard from '@/components/auth/AuthGuard';
import PurchaseReport from '@/components/reports/purchase-report';
import React from 'react';

const PurchaseReportClient = () => {
    return (
        <AuthGuard>
            <PurchaseReport />
        </AuthGuard>
    );
};

export default PurchaseReportClient;
