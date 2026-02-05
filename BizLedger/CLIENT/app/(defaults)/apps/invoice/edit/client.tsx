'use client';

import ComponentsAppsInvoiceEdit from '@/components/apps/mailbox/invoice/components-apps-invoice-edit';
import AuthGuard from '@/components/auth/AuthGuard';
import React from 'react';

const InvoiceEditClient = () => {
    return (
        <AuthGuard>
            <ComponentsAppsInvoiceEdit />
        </AuthGuard>
    );
};

export default InvoiceEditClient;
