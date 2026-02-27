'use client';

import ComponentsAppsRolePermissions from '@/components/apps/role-permissions/components-apps-role-permissions';
import AuthGuard from '@/components/auth/AuthGuard';
import React from 'react';

const RolePermissions = () => {
    return (
        <AuthGuard>
            <ComponentsAppsRolePermissions />
        </AuthGuard>
    );
};

export default RolePermissions;
