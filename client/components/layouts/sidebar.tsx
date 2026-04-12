'use client';
import PerfectScrollbar from 'react-perfect-scrollbar';
import { useDispatch, useSelector } from 'react-redux';
import Link from 'next/link';
import { toggleSidebar } from '@/store/themeConfigSlice';
import AnimateHeight from 'react-animate-height';
import { IRootState } from '@/store';
import { useState, useEffect } from 'react';
import IconCaretsDown from '@/components/icon/icon-carets-down';
import IconMenuDashboard from '@/components/icon/menu/icon-menu-dashboard';
import IconCaretDown from '@/components/icon/icon-caret-down';
import IconMinus from '@/components/icon/icon-minus';
import IconMenuInvoice from '@/components/icon/menu/icon-menu-invoice';
import IconMenuUsers from '@/components/icon/menu/icon-menu-users';
import IconMenuCharts from '@/components/icon/menu/icon-menu-charts';
import IconMenuContacts from '@/components/icon/menu/icon-menu-contacts';
import IconMenuComponents from '@/components/icon/menu/icon-menu-components';
import IconUsersGroup from '@/components/icon/icon-users-group';
import IconUsers from '@/components/icon/icon-users';
import IconUser from '@/components/icon/icon-user';
import IconShoppingCart from '@/components/icon/icon-shopping-cart';
import IconShoppingBag from '@/components/icon/icon-shopping-bag';
import IconTag from '@/components/icon/icon-tag';
import IconClipboardText from '@/components/icon/icon-clipboard-text';
import IconDollarSignCircle from '@/components/icon/icon-dollar-sign-circle';
import IconCalendar from '@/components/icon/icon-calendar';
import IconLockDots from '@/components/icon/icon-lock-dots';
import IconLink from '@/components/icon/icon-link';
import { usePathname } from 'next/navigation';
import { getTranslation } from '@/i18n';
import { organizationContext } from '@/lib/organizationContext';

const Sidebar = () => {
    const dispatch = useDispatch();
    const { t } = getTranslation();
    const pathname = usePathname();
    const [currentMenu, setCurrentMenu] = useState<string>('');
    const [, setPermissionsVersion] = useState(0);
    const themeConfig = useSelector((state: IRootState) => state.themeConfig);
    const semidark = useSelector((state: IRootState) => state.themeConfig.semidark);
    const canViewUsers = organizationContext.hasPermission('Users', 'view');
    const canViewOrganizations = organizationContext.hasPermission('Organizations', 'view');
    const canViewRoles = organizationContext.hasPermission('Roles', 'view');
    const canViewModules = organizationContext.hasPermission('Modules', 'view');
    const canViewRolePermissions = organizationContext.hasPermission('Role Permissions', 'view');
    const canViewTaxSettings = organizationContext.hasPermission('TSettings', 'view');
    const canViewSales = organizationContext.hasPermission('Sales', 'view');
    const canViewCustomers = organizationContext.hasPermission('Customers', 'view');
    const canViewPurchase = organizationContext.hasPermission('Purchase', 'view');
    const canViewReports = organizationContext.hasPermission('Reports', 'view');
    const canViewAuditLogs = organizationContext.getIsSuperAdmin() || organizationContext.hasPermission('Audit', 'view');
    const renderNavItem = (label: string, href: string, IconComponent: React.ComponentType<{ className?: string }>, enabled: boolean) => {
        const iconClass = enabled
            ? 'h-5 w-5 shrink-0 group-hover:!text-primary'
            : 'h-5 w-5 shrink-0 text-gray-400 dark:text-gray-500';
        const content = (
            <div className="flex items-center gap-3">
                <span className="flex h-5 w-5 items-center justify-center">
                    <IconComponent className={iconClass} />
                </span>
                <span className="text-black ltr:pl-3 rtl:pr-3 dark:text-[#506690] dark:group-hover:text-white-dark">{label}</span>
            </div>
        );
        if (enabled) {
            return (
                <Link href={href} className="nav-link group">
                    {content}
                </Link>
            );
        }
        return (
            <div className="nav-link group cursor-not-allowed opacity-50" aria-disabled="true">
                {content}
            </div>
        );
    };
    const toggleMenu = (value: string) => {
        setCurrentMenu((oldValue) => {
            return oldValue === value ? '' : value;
        });
    };

    useEffect(() => {
        const selector = document.querySelector('.sidebar ul a[href="' + window.location.pathname + '"]');
        if (selector) {
            selector.classList.add('active');
            const ul: any = selector.closest('ul.sub-menu');
            if (ul) {
                let ele: any = ul.closest('li.menu').querySelectorAll('.nav-link') || [];
                if (ele.length) {
                    ele = ele[0];
                    setTimeout(() => {
                        ele.click();
                    });
                }
            }
        }
    }, []);

    useEffect(() => {
        const handlePermissionsUpdate = () => {
            setPermissionsVersion((version) => version + 1);
        };
        window.addEventListener('organization-permissions-updated', handlePermissionsUpdate);
        return () => {
            window.removeEventListener('organization-permissions-updated', handlePermissionsUpdate);
        };
    }, []);

    useEffect(() => {
        setActiveRoute();
        if (window.innerWidth < 1024 && themeConfig.sidebar) {
            dispatch(toggleSidebar());
        }
    }, [pathname]);

    const setActiveRoute = () => {
        let allLinks = document.querySelectorAll('.sidebar ul a.active');
        for (let i = 0; i < allLinks.length; i++) {
            const element = allLinks[i];
            element?.classList.remove('active');
        }
        const selector = document.querySelector('.sidebar ul a[href="' + window.location.pathname + '"]');
        selector?.classList.add('active');
    };

    return (
        <div className={semidark ? 'dark' : ''}>
            <nav
                className={`sidebar fixed bottom-0 top-0 z-50 h-full min-h-screen w-[260px] shadow-[5px_0_25px_0_rgba(94,92,154,0.1)] transition-all duration-300 ${semidark ? 'text-white-dark' : ''}`}
            >
                <div className="h-full bg-white dark:bg-black">
                    <div className="flex items-center justify-between gap-2 px-4 py-3">
                        <Link href="/" className="main-logo flex min-w-0 flex-1 items-center gap-2">
                            <img className="h-8 w-8 shrink-0" src="/assets/images/logo.svg" alt="Kumaran Coconuts" />
                            <span className="min-w-0 text-left text-lg font-semibold leading-snug text-black dark:text-white-light lg:inline">
                                Kumaran Coconuts
                            </span>
                        </Link>

                        <button
                            type="button"
                            className="collapse-icon flex h-8 w-8 items-center rounded-full transition duration-300 hover:bg-gray-500/10 rtl:rotate-180 dark:text-white-light dark:hover:bg-dark-light/10"
                            onClick={() => dispatch(toggleSidebar())}
                        >
                            <IconCaretsDown className="m-auto rotate-90" />
                        </button>
                    </div>
                    <PerfectScrollbar className="relative h-[calc(100vh-80px)]">
                        <ul className="relative space-y-0.5 p-4 py-0 font-semibold">
                            <li className="menu nav-item">
                                <Link href="/finance" className="nav-link group w-full">
                                    <div className="flex items-center">
                                        <IconMenuDashboard className="h-5 w-5 shrink-0 group-hover:!text-primary" />
                                        <span className="text-black ltr:pl-3 rtl:pr-3 dark:text-[#506690] dark:group-hover:text-white-dark">{t('dashboard')}</span>
                                    </div>
                                </Link>
                            </li>

                            <h2 className="-mx-4 mb-1 flex items-center bg-white-light/30 px-7 py-3 font-extrabold uppercase dark:bg-dark dark:bg-opacity-[0.08]">
                                <IconMinus className="hidden h-5 w-4 flex-none" />
                                <span>{t('Voucher')}</span>
                            </h2>

                            <li className="nav-item">
                                <ul className="space-y-1">
                                    <li className="nav-item">
                                        {renderNavItem(t('Sales'), '/apps/invoice/list', IconMenuInvoice, canViewSales)}
                                    </li>
                                    <li className="nav-item">
                                        {renderNavItem(t('Purchase'), '/apps/purchase/list', IconShoppingCart, canViewPurchase)}
                                    </li>
                                </ul>
                            </li>

                            <h2 className="-mx-4 mb-1 flex items-center bg-white-light/30 px-7 py-3 font-extrabold uppercase dark:bg-dark dark:bg-opacity-[0.08]">
                                <IconMinus className="hidden h-5 w-4 flex-none" />
                                <span>{t('Organisation')}</span>
                            </h2>

                            <li className="nav-item">
                                <ul className="space-y-1">
                                    <li className="nav-item">
                                        {renderNavItem(t('Organisation'), '/apps/organisation', IconMenuContacts, canViewOrganizations)}
                                    </li>
                                    <li className="nav-item">
                                        {renderNavItem(t('Customers'), '/apps/customers/list', IconUsersGroup, canViewCustomers)}
                                    </li>
                                </ul>
                            </li>

                            <h2 className="-mx-4 mb-1 flex items-center bg-white-light/30 px-7 py-3 font-extrabold uppercase dark:bg-dark dark:bg-opacity-[0.08]">
                                <IconMinus className="hidden h-5 w-4 flex-none" />
                                <span>{t('Settings')}</span>
                            </h2>

                            <li className="nav-item">
                                <ul className="space-y-1">
                                    <li className="nav-item">
                                        {renderNavItem(t('Tax'), '/apps/tsettings', IconTag, canViewTaxSettings)}
                                    </li>
                                    <li className="nav-item">
                                        {renderNavItem(t('Audit Logs'), '/apps/audit-logs', IconClipboardText, canViewAuditLogs)}
                                    </li>
                                </ul>
                            </li>

                            <h2 className="-mx-4 mb-1 flex items-center bg-white-light/30 px-7 py-3 font-extrabold uppercase dark:bg-dark dark:bg-opacity-[0.08]">
                                <IconMinus className="hidden h-5 w-4 flex-none" />
                                <span>{t('Reports')}</span>
                            </h2>

                            <li className="nav-item">
                                <ul className="space-y-1">
                                    <li className="nav-item">
                                        {renderNavItem(t('Sales Report'), '/apps/reports/sales', IconMenuCharts, canViewReports)}
                                    </li>
                                    <li className="nav-item">
                                        {renderNavItem(t('Sales by Party'), '/apps/reports/sales-party', IconUser, canViewReports)}
                                    </li>
                                    <li className="nav-item">
                                        {renderNavItem(t('Purchase Report'), '/apps/reports/purchase', IconShoppingBag, canViewReports)}
                                    </li>
                                    <li className="nav-item">
                                        {renderNavItem(t('Purchase by Party'), '/apps/reports/purchase-party', IconUsers, canViewReports)}
                                    </li>
                                    <li className="nav-item">
                                        {renderNavItem(t('GST Summary'), '/apps/reports/tax', IconDollarSignCircle, canViewReports)}
                                    </li>
                                    <li className="nav-item">
                                        {renderNavItem(t('GST Summary (Monthly)'), '/apps/reports/gst-summary-monthly', IconCalendar, canViewReports)}
                                    </li>
                                </ul>
                            </li>

                            <h2 className="-mx-4 mb-1 flex items-center bg-white-light/30 px-7 py-3 font-extrabold uppercase dark:bg-dark dark:bg-opacity-[0.08]">
                                <IconMinus className="hidden h-5 w-4 flex-none" />
                                <span>{t('User')}</span>
                            </h2>

                            <li className="nav-item">
                                <ul className="space-y-1">
                                    <li className="nav-item">
                                        {renderNavItem(t('Users'), '/apps/user', IconMenuUsers, canViewUsers)}
                                    </li>
                                    <li className="nav-item">
                                        {renderNavItem(t('Roles'), '/apps/roles', IconLockDots, canViewRoles)}
                                    </li>
                                    <li className="nav-item">
                                        {renderNavItem(t('Role Permissions'), '/apps/role-permissions', IconLink, canViewRolePermissions)}
                                    </li>
                                    <li className="nav-item">
                                        {renderNavItem(t('Modules'), '/apps/modules', IconMenuComponents, canViewModules)}
                                    </li>
                                </ul>
                            </li>

                        </ul>
                    </PerfectScrollbar>
                </div>
            </nav>
        </div>
    );
};

export default Sidebar;
