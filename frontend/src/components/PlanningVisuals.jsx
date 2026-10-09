import React from 'react';
import {stages,stageCode,gateProof,dateText,shortDate,display,stageDeadlineLabel,stageDeadlineDate} from '../model/portfolio.js';
import Icon from './Icon.jsx';
import '../planning-ui.css';

const stageIcons={L0:'idea',L1:'passport',L2:'evaluate',L3:'decision',L4:'acceptance',L5:'effect'};
const nextCriteria={
 L0:'Владелец фиксирует состав инициативы',
 L1:'Расчёт обосновывает эффект и затраты',
 L2:'Решение разрешает запуск',
 L3:'Приёмка подтверждает результат',
 L4:'Замер подтверждает фактический эффект',
 L5:'Владелец фиксирует измеренный результат'
};
const roleLabels={layer:'Уровень трансформации',group:'Команда внедрения',curator:'Куратор команды',person:'Ответственный за паспорт',process:'Передел'};
const roleIcons={layer:'layers',group:'teams',curator:'decision',person:'owner',process:'process'};

export function StageGateFlow({rows}){
 const known=rows.filter(row=>/^L[0-5]$/.test(row.code)),unassigned=rows.find(row=>row.code==='Уточнить');
 const conditions=['Владелец','Состав и цель','Эффект и ресурсы','Решение о запуске','Приёмка результата','Подтверждённый эффект'];
 return <figure className="planning-visual planning-stage-distribution">
  <figcaption>Стадии снижают риск и направляют ресурсы в приоритетные инициативы</figcaption>
  <div className="stage-risk"><span>Неопределённость решения</span><svg viewBox="0 0 1100 92" preserveAspectRatio="none" role="img" aria-label="Схема снижения неопределённости от идеи к подтверждённому результату"><path d="M0 4 L1100 46 L0 88 Z" fill="#EDF3F8" stroke="#6E8CA8" strokeWidth="1.3"/></svg></div>
  <ol className="planning-stage-flow" aria-label="Распределение карточек по текущим стадиям">
   {known.map(row=><li key={row.code} className={'planning-stage-step'+(row.count>0?' has-initiatives':'')}><span className="planning-stage-code">{row.code}</span><strong className="planning-stage-count" aria-label={row.count+' карточек'}>{row.count}</strong><h3>{row.name}</h3></li>)}
  </ol>
  <div className="stage-gate-conditions"><span>Условия допуска</span><ol>{known.map((row,k)=><li key={row.code}>{conditions[k]}</li>)}</ol></div>
  <div className="stage-resource-allocation"><span>Ресурсы</span><p>Проверяем идеи</p><p>Выделяем на приоритетные работы после L3</p></div>
  {unassigned?.count>0&&<p className="caption">Стадия требует уточнения: {unassigned.count}</p>}
 </figure>;
}

export function ResponsibilityFlow({levels,list}){
 return <figure className="planning-visual planning-responsibility">
  <figcaption>Каскад связывает выбранный состав с ответственными и участками</figcaption>
  <ol className="planning-responsibility-flow" style={{'--planning-levels':levels.length}} aria-label="Текущая иерархия выбранных инициатив">
   {levels.map(level=>{const values=[...new Set(list.map(level.read))];return <li key={level.name}>
    <span className="planning-role-icon"><Icon name={roleIcons[level.name]} size={23}/></span>
    <h3>{roleLabels[level.name]}</h3>
    {values.length===1?<p className="planning-role-value">{values[0]}</p>:<p className="planning-role-value">Ветвей выбранного состава: <strong>{values.length}</strong></p>}
   </li>;})}
  </ol>
 </figure>;
}

export function DeadlineFlow({data,initiative}){
 const current=stageCode(initiative);
 return <ol className="planning-deadline-flow" aria-label={'Сроки и подтверждение стадий '+initiative.code}>
  {stages.filter(([code])=>code!=='L0').map(([code,name])=>{const level=Number(code.slice(1)),due=stageDeadlineDate(initiative,level),proof=gateProof(data,initiative,level);return <li key={code} className={(proof?'is-confirmed ':'')+(current===code?'is-current':'')}>
   <span className="planning-deadline-marker"><Icon name={proof?'check':'clock'} size={16}/></span>
   <span className="planning-deadline-code">{code}</span>
   <span className="planning-deadline-name">{name}</span>
   {due?<time dateTime={dateText(due)}>{stageDeadlineLabel(initiative,level)}</time>:<span className="planning-deadline-missing">Требуется срок</span>}
   <span className="planning-deadline-proof" title={proof?display(proof.approved_by)+' / '+shortDate(proof.date):undefined}>{proof?'Решение подтверждено':'Решение ожидается'}</span>
  </li>;})}
 </ol>;
}

export function PlanDependencyFlow({rows}){
 return <div className="planning-dependencies" aria-label="Работы и явные предшественники">
  {rows.map(row=><article className={'planning-work'+(display(row.predecessor).trim()?' has-predecessor':'')} key={row._row}>
   {display(row.predecessor).trim()&&<div className="planning-work-predecessor"><span>Предшественник</span><p>{display(row.predecessor)}</p></div>}
   <div className="planning-work-result"><h4>{display(row.result)}</h4><p className="planning-work-dates"><Icon name="clock" size={16}/><span>{shortDate(row.start)} – {shortDate(row.end)}</span></p><p className="planning-work-owner"><Icon name="owner" size={16}/><span>{display(row.owner)}</span></p></div>
  </article>)}
 </div>;
}
