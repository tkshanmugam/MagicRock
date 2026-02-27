'use client';

import React from 'react';
import AuthGuard from '@/components/auth/AuthGuard';
import ComponentsAppsCustomerAdd from '@/components/apps/customers/components-apps-customer-add';
import { useSearchParams } from 'next/navigation';

const CustomerEditClient = () => {
    const searchParams = useSearchParams();
    const customerId = searchParams.get('id') || undefined;
    return (
        <AuthGuard>
            <ComponentsAppsCustomerAdd mode="edit" customerId={customerId} />
        </AuthGuard>
    );
};

export default CustomerEditClient;
