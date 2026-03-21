import { apiGet } from '@/lib/apiClient';

export type AuditLogItem = {
    id: number;
    organisation_id?: number | null;
    organisation_name?: string | null;
    user_id?: number | null;
    user_name?: string | null;
    module_name: string;
    entity_name?: string | null;
    entity_id?: number | null;
    action: string;
    old_value?: Record<string, any> | null;
    new_value?: Record<string, any> | null;
    ip_address?: string | null;
    user_agent?: string | null;
    remarks?: string | null;
    created_date: string;
};

export type AuditLogListResponse = {
    total: number;
    items: AuditLogItem[];
};

const buildQuery = (params: Record<string, string | number | undefined | null>) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.set(key, String(value));
        }
    });
    const suffix = query.toString();
    return suffix ? `?${suffix}` : '';
};

export const fetchAuditLogs = (params: Record<string, string | number | undefined | null>) =>
    apiGet<AuditLogListResponse>(`audit-logs${buildQuery(params)}`);

export const fetchAuditLog = (id: number) => apiGet<AuditLogItem>(`audit-logs/${id}`);
