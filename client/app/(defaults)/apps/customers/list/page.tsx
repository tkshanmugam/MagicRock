import { Metadata } from 'next';
import React from 'react';
import CustomerListClient from './client';

export const metadata: Metadata = {
    title: 'Customers',
};

const CustomerListPage = () => {
    return <CustomerListClient />;
};

export default CustomerListPage;
