import ComponentsAppsPurchaseEdit from '@/components/apps/mailbox/purchase/components-apps-purchase-edit';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Purchase Voucher Edit',
};

const PurchaseEdit = () => {
    return <ComponentsAppsPurchaseEdit />;
};

export default PurchaseEdit;
