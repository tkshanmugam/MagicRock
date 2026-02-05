'use client';

import ComponentsAppsInvoiceList from '@/components/apps/mailbox/invoice/components-apps-invoice-list';
import AuthGuard from '@/components/auth/AuthGuard';
import React from 'react';

const InvoiceListClient = () => {
    return (
        <AuthGuard>
            <ComponentsAppsInvoiceList />
        </AuthGuard>
    );
};

export default InvoiceListClient;
