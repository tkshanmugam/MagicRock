'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_ROUTES } from '@/lib/routes';

export default function DashboardPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace(DEFAULT_ROUTES.AFTER_LOGIN);
    }, [router]);

    return null;
}
