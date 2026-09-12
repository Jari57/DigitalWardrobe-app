"use client";
import {useEffect,useState} from 'react';
import {api} from './ui';
type Allowance={enabled:boolean;remaining?:number;limit?:number;sharedLimitReached?:boolean;resetsAt?:string};
export default function AiAllowance(){
  const [value,setValue]=useState<Allowance>();
  useEffect(()=>{let active=true;const refresh=()=>{api<Allowance>('/api/ai-allowance').then(data=>{if(active)setValue(data);}).catch(()=>{if(active)setValue(undefined);});};refresh();window.addEventListener('wardrobe-ai-used',refresh);window.addEventListener('focus',refresh);return()=>{active=false;window.removeEventListener('wardrobe-ai-used',refresh);window.removeEventListener('focus',refresh);};},[]);
  return value?<small className="ai-allowance" aria-live="polite">{!value.enabled?'AI is currently unavailable.':`AI: ${value.remaining} of ${value.limit} daily actions left. Resets at midnight UTC.${value.sharedLimitReached?' Shared service limit reached; new generations are paused.':''} Saved results may be reused without another action.`}</small>:null;
}
