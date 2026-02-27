'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_ROUTES } from '@/lib/routes';

export default function RootPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace(DEFAULT_ROUTES.LOGIN);
    }, [router]);

    return null;
}

