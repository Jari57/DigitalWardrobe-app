'use client';
export default function ErrorPage({reset}:{reset:()=>void}) {return <main style={{padding:32}}><h1>Something interrupted your studio.</h1><p>Your saved wardrobe is safe. Try loading the view again.</p><button onClick={reset}>Try again</button></main>;}
