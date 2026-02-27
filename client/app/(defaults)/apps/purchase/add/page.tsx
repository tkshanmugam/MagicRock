import ComponentsAppsPurchaseAdd from '@/components/apps/mailbox/purchase/components-apps-purchase-add';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Purchase Voucher Add',
};

const PurchaseAdd = () => {
    return <ComponentsAppsPurchaseAdd />;
};

export default PurchaseAdd;
