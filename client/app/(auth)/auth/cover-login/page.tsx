import ComponentsAuthLoginForm from '@/components/auth/components-auth-login-form';
import LanguageDropdown from '@/components/language-dropdown';
import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

export const metadata: Metadata = {
    title: 'Login Cover',
};

type BrandLine = { text: string; className: string; emphasis?: boolean };

const brandLines: BrandLine[] = [
    { text: 'KUMARAN COCONUTS', className: 'border-orange-300/90 text-orange-200', emphasis: true },
    { text: 'JASWANTH COCONUTS', className: 'border-teal-300/90 text-teal-100' },
    { text: 'SREE AMMAN COIRS', className: 'border-amber-950/60 text-amber-100' },
];

const brandLinesLight: BrandLine[] = [
    { text: 'KUMARAN COCONUTS', className: 'border-orange-500 text-orange-700 dark:border-orange-400 dark:text-orange-200', emphasis: true },
    { text: 'JASWANTH COCONUTS', className: 'border-teal-500 text-teal-700 dark:border-teal-400 dark:text-teal-200' },
    { text: 'SREE AMMAN COIRS', className: 'border-amber-900 text-amber-950 dark:border-amber-700 dark:text-amber-200' },
];

function BrandStack({ variant }: { variant: 'onGradient' | 'onLight' }) {
    const lines = variant === 'onGradient' ? brandLines : brandLinesLight;
    return (
        <div className="flex w-full max-w-md flex-col gap-3.5 sm:gap-4">
            {lines.map(({ text, className, emphasis }) => (
                <p
                    key={text}
                    className={`rounded-md border-l-4 py-2.5 pl-4 pr-3 text-left text-base font-semibold leading-snug tracking-wide backdrop-blur-sm sm:text-lg ${
                        variant === 'onGradient'
                            ? 'bg-black/10'
                            : 'bg-white/90 shadow-sm ring-1 ring-black/[0.06] dark:bg-white/5 dark:ring-white/10'
                    } ${className} ${emphasis ? '!text-lg font-extrabold uppercase sm:!text-xl' : ''}`}
                >
                    {text}
                </p>
            ))}
        </div>
    );
}

function BrandLogos({ layout }: { layout: 'gradient' | 'light' }) {
    const kumaranCard =
        layout === 'gradient'
            ? 'inline-flex rounded-2xl bg-white/15 p-4 shadow-lg ring-1 ring-white/25 backdrop-blur-md transition hover:bg-white/25'
            : 'inline-flex rounded-2xl bg-primary/5 p-3 ring-1 ring-primary/10 transition hover:bg-primary/10 dark:bg-white/5 dark:ring-white/10 dark:hover:bg-white/10';
    const jaswanthCard =
        layout === 'gradient'
            ? 'inline-flex rounded-2xl bg-white/15 p-4 shadow-lg ring-1 ring-teal-200/45 backdrop-blur-md transition hover:bg-white/25'
            : 'inline-flex rounded-2xl bg-teal-50/90 p-3 ring-1 ring-teal-200/90 transition hover:bg-teal-50 dark:bg-teal-950/35 dark:ring-teal-400/25 dark:hover:bg-teal-950/50';
    const ammanCard =
        layout === 'gradient'
            ? 'inline-flex rounded-2xl bg-white/15 p-4 shadow-lg ring-1 ring-amber-200/40 backdrop-blur-md transition hover:bg-white/25'
            : 'inline-flex rounded-2xl bg-amber-50/90 p-3 ring-1 ring-amber-200/80 transition hover:bg-amber-50 dark:bg-amber-950/40 dark:ring-amber-400/30 dark:hover:bg-amber-950/55';
    const logoImg = layout === 'gradient' ? 'h-24 w-auto max-w-[140px] object-contain sm:h-28 sm:max-w-[160px]' : 'h-16 w-auto max-w-[100px] object-contain';

    return (
        <div className="flex w-full max-w-lg flex-wrap items-center justify-center gap-4 sm:gap-5 lg:justify-start">
            <Link href="/" className={kumaranCard}>
                <Image src="/assets/images/logo.svg" alt="Kumaran Coconuts logo" width={140} height={140} className={logoImg} priority={layout === 'gradient'} />
            </Link>
            <Link href="/" className={jaswanthCard}>
                <Image src="/assets/images/jaswanth-logo.png" alt="Jaswanth Coconuts logo" width={200} height={200} className={logoImg} />
            </Link>
            <Link href="/" className={ammanCard}>
                <Image src="/assets/images/amman-logo.png" alt="Sree Amman Coirs logo" width={200} height={200} className={logoImg} />
            </Link>
        </div>
    );
}

const CoverLogin = () => {
    return (
        <div>
            <div className="absolute inset-0">
                <Image src="/assets/images/auth/bg-gradient.png" alt="image" width={1946} height={856} className="h-full w-full object-cover" />
            </div>
            <div className="relative flex min-h-screen items-center justify-center px-6 py-10 dark:bg-[#060818] sm:px-16">
                <Image src="/assets/images/auth/map.png" alt="image" width={1946} height={823} className="absolute inset-0 z-0 h-full w-full object-cover" />
                <Image
                    src="/assets/images/auth/coming-soon-object1.png"
                    alt="image"
                    width={238}
                    height={693}
                    className="absolute left-0 top-1/2 h-full max-h-[893px] w-auto -translate-y-1/2"
                />
                <Image
                    src="/assets/images/auth/coming-soon-object2.png"
                    alt="image"
                    width={220}
                    height={225}
                    className="absolute left-24 top-0 h-40 w-auto md:left-[30%]"
                />
                <Image src="/assets/images/auth/coming-soon-object3.png" alt="image" width={912} height={576} className="absolute right-0 top-0 h-[300px] w-auto" />
                <Image src="/assets/images/auth/polygon-object.svg" alt="image" width={403} height={203} className="absolute bottom-0 end-[28%]" />
                <div className="relative flex w-full max-w-[1502px] flex-col justify-between overflow-hidden rounded-md bg-white/60 backdrop-blur-lg dark:bg-black/50 lg:min-h-[758px] lg:flex-row lg:gap-10 xl:gap-0">
                    <div className="relative hidden w-full items-center justify-center bg-[linear-gradient(225deg,rgba(239,18,98,1)_0%,rgba(67,97,238,1)_100%)] p-8 lg:inline-flex lg:max-w-[835px] xl:-ms-28 ltr:xl:skew-x-[14deg] rtl:xl:skew-x-[-14deg]">
                        <div className="absolute inset-y-0 w-8 from-primary/10 via-transparent to-transparent ltr:-right-10 ltr:bg-gradient-to-r rtl:-left-10 rtl:bg-gradient-to-l xl:w-16 ltr:xl:-right-20 rtl:xl:-left-20"></div>
                        <div className="flex w-full max-w-lg flex-col items-center gap-10 px-4 text-center ltr:xl:-skew-x-[14deg] rtl:xl:skew-x-[14deg] lg:items-start lg:text-left xl:ms-10">
                            <BrandLogos layout="gradient" />
                            <BrandStack variant="onGradient" />
                        </div>
                    </div>
                    <div className="relative flex w-full flex-col items-center justify-center gap-6 px-4 pb-16 pt-6 sm:px-6 lg:max-w-[667px]">
                        <div className="flex w-full max-w-[440px] items-center justify-end lg:absolute lg:end-6 lg:top-6 lg:max-w-full">
                            <LanguageDropdown className="w-max" />
                        </div>
                        <div className="w-full max-w-[440px] lg:mt-16">
                            <div className="mb-8 lg:hidden">
                                <div className="mb-6">
                                    <BrandLogos layout="light" />
                                </div>
                                <BrandStack variant="onLight" />
                            </div>
                            <div className="mb-10">
                                <h1 className="text-3xl font-extrabold uppercase !leading-snug text-primary md:text-4xl">Sign in</h1>
                                <p className="text-base font-bold leading-normal text-white-dark">Enter your username and password to continue</p>
                            </div>
                            <ComponentsAuthLoginForm />

                        </div>
                        <p className="absolute bottom-6 w-full px-4 text-center text-sm text-gray-600 dark:text-gray-300">
                            © {new Date().getFullYear()} KUMARAN COCONUTS · JASWANTH COCONUTS · SREE AMMAN COIRS
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CoverLogin;
