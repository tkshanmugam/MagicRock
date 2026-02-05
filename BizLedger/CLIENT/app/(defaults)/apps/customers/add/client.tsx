'use client';

import React from 'react';
import AuthGuard from '@/components/auth/AuthGuard';
import ComponentsAppsCustomerAdd from '@/components/apps/customers/components-apps-customer-add';

const CustomerAddClient = () => {
    return (
        <AuthGuard>
            <ComponentsAppsCustomerAdd />
        </AuthGuard>
    );
};

export default CustomerAddClient;
