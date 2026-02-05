import { Metadata } from 'next';
import React from 'react';
import CustomerEditClient from './client';

export const metadata: Metadata = {
    title: 'Customer Edit',
};

const CustomerEditPage = () => {
    return <CustomerEditClient />;
};

export default CustomerEditPage;
