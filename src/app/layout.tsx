import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/plus-jakarta-sans';
import InstallApp from '@/components/InstallApp';
import './globals.css';
import './themes.css';
export const metadata: Metadata = {title:'Digital Wardrobe Studio',description:'Your clothes. Your next fit. Build, save and share outfits from your own wardrobe.',manifest:'/manifest.webmanifest',appleWebApp:{capable:true,title:'Wardrobe',statusBarStyle:'default'},icons:{icon:'/icon.svg',apple:'/icons/icon-180.png'},robots:{index:true,follow:true}};
export const viewport: Viewport = {width:'device-width',initialScale:1,themeColor:'#FAF9F6'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html: `try{var t=localStorage.getItem('wardrobe-theme');document.documentElement.dataset.theme=t==='light'||t==='dark'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch{document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}`}}/></head><body>{children}<InstallApp/></body></html>;}

