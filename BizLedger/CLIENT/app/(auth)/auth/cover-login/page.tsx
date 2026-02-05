import ComponentsAuthLoginForm from '@/components/auth/components-auth-login-form';
import IconFacebookCircle from '@/components/icon/icon-facebook-circle';
import IconGoogle from '@/components/icon/icon-google';
import IconInstagram from '@/components/icon/icon-instagram';
import IconTwitter from '@/components/icon/icon-twitter';
import LanguageDropdown from '@/components/language-dropdown';
import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

export const metadata: Metadata = {
    title: 'Login Cover',
};

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
                    <div className="relative hidden w-full items-center justify-center bg-[linear-gradient(225deg,rgba(239,18,98,1)_0%,rgba(67,97,238,1)_100%)] p-5 lg:inline-flex lg:max-w-[835px] xl:-ms-28 ltr:xl:skew-x-[14deg] rtl:xl:skew-x-[-14deg]">
                        <div className="absolute inset-y-0 w-8 from-primary/10 via-transparent to-transparent ltr:-right-10 ltr:bg-gradient-to-r rtl:-left-10 rtl:bg-gradient-to-l xl:w-16 ltr:xl:-right-20 rtl:xl:-left-20"></div>
                        <div className="ltr:xl:-skew-x-[14deg] rtl:xl:skew-x-[14deg]">
                            <Link href="/" className="ms-10 block w-48 lg:w-72">
                                <Image src="/assets/images/auth/logo-white.svg" alt="Logo" width={612} height={408} className="h-auto w-full" />
                            </Link>
                            <div className="mt-24 hidden w-full max-w-[430px] lg:block">
                                <Image src="/assets/images/auth/login.svg" alt="Cover Image" width={522} height={522} className="h-auto w-full" />
                            </div>
                        </div>
                    </div>
                    <div className="relative flex w-full flex-col items-center justify-center gap-6 px-4 pb-16 pt-6 sm:px-6 lg:max-w-[667px]">
                        <div className="flex w-full max-w-[440px] items-center gap-2 lg:absolute lg:end-6 lg:top-6 lg:max-w-full">
                            <Link href="/" className="block w-8 lg:hidden">
                                <Image src="/assets/images/logo.svg" alt="Logo" width={56} height={49} className="mx-auto h-auto w-10" />
                            </Link>
                            <LanguageDropdown className="ms-auto w-max" />
                        </div>
                        <div className="w-full max-w-[440px] lg:mt-16">
                            <div className="mb-10">
                                <h1 className="text-3xl font-extrabold uppercase !leading-snug text-primary md:text-4xl">Sign in</h1>
                                <p className="text-base font-bold leading-normal text-white-dark">Enter your email and password to login</p>
                            </div>
                            <ComponentsAuthLoginForm />

                        </div>
                        <p className="absolute bottom-6 w-full text-center dark:text-white">© {new Date().getFullYear()}.BizLedger All Rights Reserved.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CoverLogin;
