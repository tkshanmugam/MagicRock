const cookieObj = typeof window === 'undefined' ? require('next/headers') : require('universal-cookie');

import en from './public/locales/en.json';
import ta from './public/locales/ta.json';

const langObj: Record<string, Record<string, string>> = { en, ta };

const getLang = () => {
    let lang = null;
    if (typeof window !== 'undefined') {
        const cookies = new cookieObj(null, { path: '/' });
        lang = cookies.get('i18nextLng');
    } else {
        const cookies = cookieObj.cookies();
        lang = cookies.get('i18nextLng')?.value;
    }
    return lang;
};

export const getTranslation = () => {
    const lang = getLang();
    const resolved = lang && langObj[lang] ? lang : 'en';
    const data = langObj[resolved];

    const t = (key: string) => {
        return data[key] ? data[key] : key;
    };

    const initLocale = (themeLocale: string) => {
        const current = getLang();
        const resolvedInit = current && langObj[current] ? current : themeLocale;
        const safeInit = langObj[resolvedInit] ? resolvedInit : 'en';
        i18n.changeLanguage(safeInit);
    };

    const i18n = {
        language: resolved,
        changeLanguage: (nextLang: string) => {
            const safe = langObj[nextLang] ? nextLang : 'en';
            const cookies = new cookieObj(null, { path: '/' });
            cookies.set('i18nextLng', safe, { path: '/' });
        },
    };

    return { t, i18n, initLocale };
};
