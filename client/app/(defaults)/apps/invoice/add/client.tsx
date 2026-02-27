'use client';

import ComponentsAppsInvoiceAdd from '@/components/apps/mailbox/invoice/components-apps-invoice-add';
import AuthGuard from '@/components/auth/AuthGuard';
import React from 'react';

const InvoiceAddClient = () => {
    return (
        <AuthGuard>
            <ComponentsAppsInvoiceAdd />
        </AuthGuard>
    );
};

export default InvoiceAddClient;
