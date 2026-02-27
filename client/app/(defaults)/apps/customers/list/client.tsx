'use client';

import React from 'react';
import AuthGuard from '@/components/auth/AuthGuard';
import ComponentsAppsCustomerList from '@/components/apps/customers/components-apps-customer-list';

const CustomerListClient = () => {
    return (
        <AuthGuard>
            <ComponentsAppsCustomerList />
        </AuthGuard>
    );
};

export default CustomerListClient;
