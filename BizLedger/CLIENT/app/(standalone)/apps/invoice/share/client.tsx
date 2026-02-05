'use client';

import ComponentsAppsInvoicePreview from '@/components/apps/mailbox/invoice/components-apps-invoice-preview';
import AuthGuard from '@/components/auth/AuthGuard';
import React from 'react';

const InvoiceShareClient = () => {
    return (
        <AuthGuard>
            <ComponentsAppsInvoicePreview actionVariant="share" />
        </AuthGuard>
    );
};

export default InvoiceShareClient;
