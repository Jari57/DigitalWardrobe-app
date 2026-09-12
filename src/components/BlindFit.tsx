"use client";
import {useState} from "react";
import {Lock,Unlock,Shuffle} from "lucide-react";
import type {Garment,Piece} from "@/lib/types";
import {Modal,categories} from "./ui";
import {arrange} from "./OutfitCanvas";
export default function BlindFit({garments,onClose,onUse}:{garments:Garment[];onClose:()=>void;onUse:(pieces:Piece[])=>void}){
 const[chosen,setChosen]=useState<Garment[]>([]),[locks,setLocks]=useState<string[]>([]);
 function shuffle(){const result=categories.filter(c=>c!=="dresses").flatMap(category=>{const locked=chosen.find(g=>g.category===category&&locks.includes(g.id));const pool=garments.filter(g=>g.category===category);return locked?[locked]:pool.length?[pool[Math.floor(Math.random()*pool.length)]]:[];});if(!result.some(g=>g.category==="tops")&&!result.some(g=>g.category==="bottoms")){const dress=garments.filter(g=>g.category==="dresses");if(dress.length)result.unshift(chosen.find(g=>g.category==="dresses"&&locks.includes(g.id))||dress[Math.floor(Math.random()*dress.length)]);}setChosen(result);}
 return <Modal title="Blind Fit Challenge" dark onClose={onClose}><div className="stack"><div className="blind-intro"><span className="eyebrow">LET YOUR CLOSET COOK</span><h3>No overthinking.<br/>Just a new combination.</h3><p>Random pieces from your own wardrobe. Lock your favorites and shuffle the rest.</p></div>{!garments.length?<p>Add pieces to your closet to start the challenge.</p>:<><div className="blind-grid">{chosen.map(g=><button key={g.id} className={locks.includes(g.id)?"locked":""} onClick={()=>setLocks(locks.includes(g.id)?locks.filter(id=>id!==g.id):[...locks,g.id])}><img src={g.imageUrl} alt={g.name}/><span>{g.name}</span>{locks.includes(g.id)?<Lock size={16}/>:<Unlock size={16}/>}</button>)}</div><button className="fuchsia" onClick={shuffle}><Shuffle size={18}/>{chosen.length?"Shuffle unlocked pieces":"Reveal my fit"}</button>{chosen.length>0&&<button onClick={()=>onUse(arrange(chosen))}>Style this on canvas</button>}</>}</div></Modal>;
}
