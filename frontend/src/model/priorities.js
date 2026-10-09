import {isNumber,display,isHistorical} from './portfolio.js';

const number=(value)=>isNumber(value)?value:null;
const hourValue=i=>{if(isNumber(i.total_hours))return i.total_hours;const m=display(i.total_hours).match(/^\s*(\d+(?:[.,]\d+)?)\s*ч(?:ас.*)?\s*$/i);return m?Number(m[1].replace(',','.')):null;};

export function priorityMetrics(i){
 const missing=[],invalid=[];
 const read=(key,label,{nonnegative=false}={})=>{const value=number(i[key]);if(value===null)missing.push(label);else if(nonnegative&&value<0)invalid.push(label+' должно быть от 0');return value;};
 const ebitda=read('priority_annual_ebitda','Операционная прибыль после затрат ИТ'),depreciation=read('priority_annual_depreciation','Дополнительная амортизация'),rate=read('priority_hour_rate','Стоимость часа ИТ',{nonnegative:true}),equipment=read('one_off_2027','Оборудование и контракты 2027',{nonnegative:true}),run=read('run_2027','Сопровождение 2027',{nonnegative:true}),duration=read('priority_duration_months','Срок реализации',{nonnegative:true}),hours=hourValue(i);
 if(hours===null)missing.push('Часы ИТ 2027');else if(hours<0)invalid.push('Часы ИТ должны быть от 0');
 const ebit=ebitda!==null&&depreciation!==null?ebitda-depreciation:null;
 const resourceCost=hours!==null&&rate!==null&&equipment!==null&&run!==null&&run>=0&&hours>=0&&rate>=0&&equipment>=0?hours*rate/1e6+equipment+run:null;
 const capitalScopePending=i.provenance?.assessment?.requires_capital_scope_confirmation===true;if(capitalScopePending)missing.push('Требуется подтверждение: состав оборудования');
 const legal=i.legal_required==='Да'?'required':i.legal_required==='Нет'?'voluntary':'unknown';
 const legalBasis=display(i.legal_basis);if(legal==='required'&&!legalBasis.trim())missing.push('Основание и срок обязательства');
 const complete=ebit!==null&&resourceCost!==null&&duration!==null&&duration>=0&&!capitalScopePending&&invalid.length===0&&(legal!=='required'||legalBasis.trim().length>0);
 return {code:i.code,ebit,ebitda,depreciation,hours,rate,equipment,run,grossPayroll:hours!==null&&rate!==null?hours*rate/1e6:null,resourceCost,duration,complete,missing,invalid,legal,legalBasis,capitalScopePending,historical:isHistorical(i),status:'Расчётная оценка',financeStatus:display(i.finance_status)};
}

export function priorityProjection(points,{yaw=-35,pitch=20,mode='3d'}={}){
 const rad=Math.PI/180,cy=Math.cos(yaw*rad),sy=Math.sin(yaw*rad),cp=Math.cos(pitch*rad),sp=Math.sin(pitch*rad);
 const domain=key=>{const values=points.map(p=>p[key]);const min=Math.min(0,...values),max=Math.max(...values,0);return {min,max:max>min?max:min+1};};
 const ranges={resourceCost:domain('resourceCost'),ebit:domain('ebit'),duration:domain('duration')};
 const norm=(key,value)=>(value-ranges[key].min)/(ranges[key].max-ranges[key].min)*2-1;
 const project=(x,y,z)=>{if(mode==='2d')return {x:450+x*290,y:285-y*210,depth:z};const dx=x*cy-z*sy,dz=x*sy+z*cy,dy=y*cp-dz*sp,depth=y*sp+dz*cp;return {x:450+dx*215,y:285-dy*140,depth};};
 return {ranges,project,points:points.map(p=>({...p,...project(norm('resourceCost',p.resourceCost),norm('ebit',p.ebit),norm('duration',p.duration))})).sort((a,b)=>a.depth-b.depth)};
}
