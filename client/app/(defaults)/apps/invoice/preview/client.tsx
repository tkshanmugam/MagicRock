'use client';

import ComponentsAppsInvoicePreview from '@/components/apps/mailbox/invoice/components-apps-invoice-preview';
import AuthGuard from '@/components/auth/AuthGuard';
import React from 'react';

const InvoicePreviewClient = () => {
    return (
        <AuthGuard>
            <ComponentsAppsInvoicePreview />
        </AuthGuard>
    );
};

export default InvoicePreviewClient;
