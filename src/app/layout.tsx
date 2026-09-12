import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/plus-jakarta-sans';
import './globals.css';
export const metadata: Metadata = {title:'Digital Wardrobe Studio',description:'Your clothes. Your next fit. Build, save and share outfits from your own wardrobe.',icons:{icon:'/icon.svg'},robots:{index:true,follow:true}};
export const viewport: Viewport = {width:'device-width',initialScale:1,themeColor:'#FAF9F6'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>;}
