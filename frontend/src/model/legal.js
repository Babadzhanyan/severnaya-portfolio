import {display} from './portfolio.js';
export const obligations=i=>Array.isArray(i.provenance?.legal_obligations)?i.provenance.legal_obligations:[];
export function obligationIndex(list){const found=new Map();for(const i of list)for(const law of obligations(i)){if(!law||typeof law.id!=='string'||!law.id)continue;const row=found.get(law.id)||{...law,codes:[]};if(!row.codes.includes(i.code))row.codes.push(i.code);found.set(law.id,row);}return [...found.values()].sort((a,b)=>a.id.localeCompare(b.id,'ru',{numeric:true}));}
export const obligationStatus=law=>law.enterprise_mandatory===true?'Обязанность компании':law.enterprise_mandatory===false?law.applicability?.status==='not_proven'?'Требуется проверка охвата':'Добровольное условие':'Требуется проверка применимости';
export const obligationDeadlines=law=>(Array.isArray(law.deadlines)?law.deadlines:[]).map(d=>[d.date,d.relative,d.label||d.event||d.title,d.condition].filter(Boolean).map(display).join(' / ')).filter(Boolean);
export function officialLinks(law){return (Array.isArray(law.urls)?law.urls:[]).filter(item=>{try{return ['https:','http:'].includes(new URL(item.url).protocol);}catch{return false;}});}
