import ComponentsAppsPurchaseList from '@/components/apps/mailbox/purchase/components-apps-purchase-list';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Purchase Voucher List',
};

const PurchaseList = () => {
    return <ComponentsAppsPurchaseList />;
};

export default PurchaseList;
