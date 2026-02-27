import ComponentsAppsPurchasePreview from '@/components/apps/mailbox/purchase/components-apps-purchase-preview';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Purchase Voucher Preview',
};

const PurchasePreview = () => {
    return <ComponentsAppsPurchasePreview />;
};

export default PurchasePreview;
