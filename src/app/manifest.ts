import type { MetadataRoute } from 'next';
export default function manifest():MetadataRoute.Manifest{return{
  id:'/',name:'Digital Wardrobe Studio',short_name:'Wardrobe',description:'Your clothes. Your next fit.',start_url:'/',scope:'/',display:'standalone',background_color:'#faf7f2',theme_color:'#151218',
  icons:[{src:'/icons/icon-192.png',sizes:'192x192',type:'image/png'},{src:'/icons/icon-512.png',sizes:'512x512',type:'image/png'},{src:'/icons/maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}],
};}
