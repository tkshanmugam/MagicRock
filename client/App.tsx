'use client';
import { PropsWithChildren, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { usePathname } from 'next/navigation';
import { IRootState } from '@/store';
import { toggleRTL, toggleTheme, toggleMenu, toggleLayout, toggleAnimation, toggleNavbar, toggleSemidark } from '@/store/themeConfigSlice';
import Loading from '@/components/layouts/loading';
import { isPublicRoute } from '@/lib/routes';

function App({ children }: PropsWithChildren) {
    const themeConfig = useSelector((state: IRootState) => state.themeConfig);
    const dispatch = useDispatch();
    const pathname = usePathname();
    const isPublic = pathname ? isPublicRoute(pathname) : false;
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const initializeTheme = async () => {
            try {
                dispatch(toggleTheme(localStorage.getItem('theme') || themeConfig.theme));
                dispatch(toggleMenu(localStorage.getItem('menu') || themeConfig.menu));
                dispatch(toggleLayout(localStorage.getItem('layout') || themeConfig.layout));
                dispatch(toggleRTL(localStorage.getItem('rtlClass') || themeConfig.rtlClass));
                dispatch(toggleAnimation(localStorage.getItem('animation') || themeConfig.animation));
                dispatch(toggleNavbar(localStorage.getItem('navbar') || themeConfig.navbar));
                dispatch(toggleSemidark(localStorage.getItem('semidark') || themeConfig.semidark));

                if (!isPublic) {
                    const { getTranslation } = await import('@/i18n');
                    const { initLocale } = getTranslation();
                    initLocale(themeConfig.locale);
                }
            } catch (error) {
                console.error('Failed to initialize theme/locale', error);
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        void initializeTheme();

        return () => {
            isMounted = false;
        };
    }, [
        dispatch,
        isPublic,
        themeConfig.theme,
        themeConfig.menu,
        themeConfig.layout,
        themeConfig.rtlClass,
        themeConfig.animation,
        themeConfig.navbar,
        themeConfig.locale,
        themeConfig.semidark,
    ]);

    return (
        <div
            className={`${(themeConfig.sidebar && 'toggle-sidebar') || ''} ${themeConfig.menu} ${themeConfig.layout} ${
                themeConfig.rtlClass
            } main-section relative font-nunito text-sm font-normal antialiased`}
        >
            {isLoading ? <Loading /> : children}
        </div>
    );
}

export default App;
