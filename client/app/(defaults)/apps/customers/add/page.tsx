import { Metadata } from 'next';
import React from 'react';
import CustomerAddClient from './client';

export const metadata: Metadata = {
    title: 'Customer Add',
};

const CustomerAddPage = () => {
    return <CustomerAddClient />;
};

export default CustomerAddPage;
