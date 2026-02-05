'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { apiGet } from '@/lib/apiClient';
import { authState } from '@/lib/authState';
import { organizationContext, ModulePermission } from '@/lib/organizationContext';
import { useRouter } from 'next/navigation';
import { DEFAULT_ROUTES } from '@/lib/routes';
import ComponentsPricingTableToggle from '@/components/components/pricing-table/components-pricing-table-toggle';

const ComponentsAppsOrganizationSelect = () => {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [selectingOrgId, setSelectingOrgId] = useState<number | null>(null);
    const [isSuperAdmin, setIsSuperAdmin] = useState(organizationContext.getIsSuperAdmin());

    const showMessage = (msg = '', type = 'success') => {
        const toast: any = Swal.mixin({
            toast: true,
            position: 'top',
            showConfirmButton: false,
            timer: 3000,
            customClass: { container: 'toast' },
        });
        toast.fire({
            icon: type,
            title: msg,
            padding: '10px 20px',
        });
    };

    const fetchOrganizations = useCallback(async () => {
        try {
            setLoading(true);
            const response = await apiGet<any>('organisations/me');
            const list = Array.isArray(response) ? response : response.data || response.results || [];
            setOrganizations(list);
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to fetch organisations';
            const isAuthError =
                error.isAuthError ||
                errorMessage.includes('401') ||
                errorMessage.includes('Unauthorized') ||
                errorMessage.includes('Token refresh failed') ||
                errorMessage.includes('No refresh token') ||
                errorMessage.toLowerCase().includes('token');

            if (!isAuthError) {
                showMessage(errorMessage, 'error');
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (authState.isAuthStateReady()) {
            fetchOrganizations();
        } else {
            let attempts = 0;
            const maxAttempts = 20;
            const interval = setInterval(() => {
                attempts++;
                if (authState.isAuthStateReady() || attempts >= maxAttempts) {
                    clearInterval(interval);
                    if (authState.isAuthStateReady()) {
                        fetchOrganizations();
                    }
                }
            }, 100);

            return () => clearInterval(interval);
        }
    }, [fetchOrganizations]);

    useEffect(() => {
        organizationContext.updateIsSuperAdminFromToken();
        setIsSuperAdmin(organizationContext.getIsSuperAdmin());
    }, []);

    const selectOrganization = async (organizationId: number) => {
        try {
            setSelectingOrgId(organizationId);
            const response = await apiGet<any>(`organisations/${organizationId}/permissions/me`);
            const permissions = (response?.modules || []) as ModulePermission[];
            organizationContext.setSelectedOrganizationId(organizationId);
            if (organizationContext.getIsSuperAdmin()) {
                organizationContext.setPermissions([]);
            } else {
                organizationContext.setPermissions(permissions);
            }
            router.push(DEFAULT_ROUTES.AFTER_ORG_SELECT);
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to load permissions for organization';
            const isAuthError =
                error.isAuthError ||
                errorMessage.includes('401') ||
                errorMessage.includes('Unauthorized') ||
                errorMessage.includes('Token refresh failed') ||
                errorMessage.includes('No refresh token') ||
                errorMessage.toLowerCase().includes('token');

            if (!isAuthError) {
                showMessage(errorMessage, 'error');
            }
        } finally {
            setSelectingOrgId(null);
        }
    };

        const pricingItems = organizations.map((org, index) => ({
        id: org.id,
        title: org.name,
        status: `Status: ${org.status || 'active'}`,
        description: org.address ? `Address: ${org.address}` : undefined,
        highlight: index === 1 && organizations.length >= 3,
    }));

    return (
        <div>
            <div className="absolute inset-0">
                <img src="/assets/images/auth/bg-gradient.png" alt="background" className="h-full w-full object-cover" />
            </div>
            <div className="relative flex min-h-screen items-center justify-center bg-[url(/assets/images/auth/map.png)] bg-cover bg-center bg-no-repeat px-6 py-10 dark:bg-[#060818] sm:px-16">
                <img src="/assets/images/auth/coming-soon-object1.png" alt="decor" className="absolute left-0 top-1/2 h-full max-h-[893px] -translate-y-1/2" />
                <img src="/assets/images/auth/coming-soon-object2.png" alt="decor" className="absolute left-24 top-0 h-40 md:left-[30%]" />
                <img src="/assets/images/auth/coming-soon-object3.png" alt="decor" className="absolute right-0 top-0 h-[300px]" />
                <img src="/assets/images/auth/polygon-object.svg" alt="decor" className="absolute bottom-0 end-[28%]" />

                <div className="relative w-full max-w-[1200px] overflow-hidden rounded-2xl bg-white/70 p-8 shadow-lg backdrop-blur-lg dark:bg-black/50">
                    <div className="text-center">
                        <h1 className="text-3xl font-extrabold uppercase !leading-snug text-primary md:text-4xl">Select Organisation</h1>
                        <p className="mt-2 text-base font-medium text-white-dark">Choose the organisation you want to work with</p>
                    </div>

                    {!loading && organizations.length === 0 && (
                        <div className="panel mt-8 text-center font-semibold">No organisations available.</div>
                    )}
                    <ComponentsPricingTableToggle
                        items={pricingItems}
                        loading={loading}
                        selectingId={selectingOrgId}
                        onSelect={selectOrganization}
                        actionLabel="Select"
                        showToggle={false}
                        showCodeHighlight={false}
                    />
                </div>
            </div>
        </div>
    );
};

export default ComponentsAppsOrganizationSelect;
