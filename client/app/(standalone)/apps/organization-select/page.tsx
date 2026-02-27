'use client';

import AuthGuard from '@/components/auth/AuthGuard';
import { DEFAULT_ROUTES } from '@/lib/routes';
import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';

const OrganizationSelect = () => {
    const router = useRouter();

    useEffect(() => {
        router.replace(DEFAULT_ROUTES.AFTER_LOGIN);
    }, [router]);

    return <AuthGuard>{null}</AuthGuard>;
};

export default OrganizationSelect;
