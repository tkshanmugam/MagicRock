import { useEffect } from 'react';
import { organizationContext } from './organizationContext';

type OrganisationLike = {
    id?: string | number | null;
};

type UseOrganizationSelectionParams = {
    organisationsList: OrganisationLike[];
    organisationId: string;
    setOrganisationId: (value: string) => void;
    onOrganisationChange?: (nextOrganisationId: string) => void | Promise<void>;
};

const matchOrganisation = (organisationsList: OrganisationLike[], id: string): OrganisationLike | null => {
    if (!id) {
        return null;
    }
    return organisationsList.find((org) => String(org.id) === String(id)) || null;
};

export const useOrganizationSelection = ({
    organisationsList,
    organisationId,
    setOrganisationId,
    onOrganisationChange,
}: UseOrganizationSelectionParams): void => {
    useEffect(() => {
        if (!organisationsList.length) {
            return;
        }
        const storedId = organizationContext.getSelectedOrganizationId();
        const storedMatch = storedId ? matchOrganisation(organisationsList, String(storedId)) : null;
        const currentMatch = matchOrganisation(organisationsList, organisationId);
        if (currentMatch) {
            return;
        }
        const fallback = storedMatch || organisationsList[0];
        if (fallback?.id !== undefined && fallback?.id !== null) {
            setOrganisationId(String(fallback.id));
        }
    }, [organisationsList, organisationId, setOrganisationId]);

    useEffect(() => {
        if (organisationId && onOrganisationChange) {
            onOrganisationChange(organisationId);
        }
    }, [organisationId, onOrganisationChange]);

    useEffect(() => {
        const syncSelected = () => {
            const selected = organizationContext.getSelectedOrganizationId();
            const idStr = selected ? String(selected) : '';
            const match = matchOrganisation(organisationsList, idStr);
            if (match?.id !== undefined && match?.id !== null) {
                setOrganisationId(String(match.id));
            }
        };
        syncSelected();
        window.addEventListener('organization-permissions-updated', syncSelected);
        return () => window.removeEventListener('organization-permissions-updated', syncSelected);
    }, [organisationsList, setOrganisationId]);
};
