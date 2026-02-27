import { tokenStorage } from './tokenStorage';

export type ModulePermission = {
    code: string;
    name?: string;
    canView: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
};

const SELECTED_ORG_KEY = 'selected_organization_id';
const PERMISSIONS_KEY = 'selected_organization_permissions';
const SUPERADMIN_KEY = 'is_superadmin';

const notifyPermissionsUpdated = (): void => {
    if (typeof window === 'undefined') {
        return;
    }
    window.dispatchEvent(new Event('organization-permissions-updated'));
};

const decodeJwtPayload = (token: string): Record<string, any> | null => {
    const parts = token.split('.');
    if (parts.length < 2) {
        return null;
    }
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '==='.slice((base64.length + 3) % 4);
    try {
        const decoded = atob(padded);
        return JSON.parse(decoded);
    } catch (error) {
        return null;
    }
};

const isSuperAdminRole = (role?: string | null): boolean => {
    if (!role) {
        return false;
    }
    const normalized = role.trim().toLowerCase().replace(/_/g, '');
    return normalized === 'superadmin';
};

const isSuperAdminUser = (): boolean => {
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(SUPERADMIN_KEY);
        if (stored) {
            return stored === 'yes';
        }
    }
    const token = tokenStorage.getAccessToken();
    if (!token) {
        return false;
    }
    const payload = decodeJwtPayload(token);
    return isSuperAdminRole(payload?.role);
};

export const organizationContext = {
    getIsSuperAdmin(): boolean {
        if (typeof window === 'undefined') {
            return false;
        }
        const stored = localStorage.getItem(SUPERADMIN_KEY);
        if (!stored) {
            return false;
        }
        return stored === 'yes';
    },

    setIsSuperAdmin(value: boolean): void {
        if (typeof window === 'undefined') {
            return;
        }
        localStorage.setItem(SUPERADMIN_KEY, value ? 'yes' : 'no');
        notifyPermissionsUpdated();
    },

    updateIsSuperAdminFromToken(): void {
        if (typeof window === 'undefined') {
            return;
        }
        const token = tokenStorage.getAccessToken();
        if (!token) {
            localStorage.removeItem(SUPERADMIN_KEY);
            return;
        }
        const payload = decodeJwtPayload(token);
        this.setIsSuperAdmin(isSuperAdminRole(payload?.role));
    },

    setSelectedOrganizationId(organizationId: number): void {
        if (typeof window === 'undefined') {
            return;
        }
        localStorage.setItem(SELECTED_ORG_KEY, String(organizationId));
        notifyPermissionsUpdated();
    },

    getSelectedOrganizationId(): number | null {
        if (typeof window === 'undefined') {
            return null;
        }
        const stored = localStorage.getItem(SELECTED_ORG_KEY);
        if (!stored) {
            return null;
        }
        const parsed = Number(stored);
        return Number.isNaN(parsed) ? null : parsed;
    },

    clearSelectedOrganization(): void {
        if (typeof window === 'undefined') {
            return;
        }
        localStorage.removeItem(SELECTED_ORG_KEY);
        localStorage.removeItem(PERMISSIONS_KEY);
        localStorage.removeItem(SUPERADMIN_KEY);
        notifyPermissionsUpdated();
    },

    setPermissions(permissions: ModulePermission[]): void {
        if (typeof window === 'undefined') {
            return;
        }
        localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions || []));
        notifyPermissionsUpdated();
    },

    getPermissions(): ModulePermission[] {
        if (typeof window === 'undefined') {
            return [];
        }
        const stored = localStorage.getItem(PERMISSIONS_KEY);
        if (!stored) {
            return [];
        }
        try {
            return JSON.parse(stored) as ModulePermission[];
        } catch (error) {
            return [];
        }
    },

    hasPermission(moduleName: string, action: 'view' | 'create' | 'update' | 'delete'): boolean {
        if (isSuperAdminUser()) {
            return true;
        }
        const permissions = this.getPermissions();
        const normalizedName = moduleName.trim().toLowerCase();
        const permission = permissions.find((perm) => {
            const permName = (perm.name || '').trim().toLowerCase();
            const permCode = (perm.code || '').trim().toLowerCase();
            return permName === normalizedName || permCode === normalizedName;
        });
        if (!permission) {
            return false;
        }
        if (action === 'view') {
            return !!permission.canView;
        }
        if (action === 'create') {
            return !!permission.canCreate;
        }
        if (action === 'update') {
            return !!permission.canUpdate;
        }
        if (action === 'delete') {
            return !!permission.canDelete;
        }
        return false;
    },
};
