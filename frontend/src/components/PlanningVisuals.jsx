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
const roleLabels={layer:'Уровень трансформации',group:'Команда внедрения',curator:'Куратор команды',person:'Ответственный за паспорт',process:'Площадка / передел'};
const roleIcons={layer:'layers',group:'teams',curator:'decision',person:'owner',process:'process'};

export function StageGateFlow({rows,criteria=nextCriteria}){
 const known=rows.filter(row=>/^L[0-5]$/.test(row.code)),unassigned=rows.find(row=>row.code==='Уточнить');
 return <figure className="planning-visual planning-stage-distribution">
  <figcaption>Стадии ведут инициативы от предложения к измеренному эффекту</figcaption>
  <ol className="planning-stage-flow" aria-label="Распределение карточек по текущим стадиям">
   {known.map(row=><li key={row.code} className={'planning-stage-step'+(row.count>0?' has-initiatives':'')}>
    <span className="planning-stage-marker"><Icon name={stageIcons[row.code]} size={22}/></span>
    <span className="planning-stage-code">{row.code}</span>
    <strong className="planning-stage-count" aria-label={row.count+' карточек'}>{row.count}</strong>
    <h3>{row.name}</h3>
    {criteria[row.code]&&<p className="planning-stage-criterion"><span>{row.code==='L5'?'Результат':'Следующее решение'}</span>{criteria[row.code]}</p>}
   </li>)}
  </ol>
  {unassigned?.count>0&&<p className="planning-unassigned-stage"><Icon name="idea" size={18}/><span>Стадия ожидает определения: <strong>{unassigned.count}</strong> карточек</span></p>}
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
   {display(row.predecessor).trim()&&<div className="planning-work-predecessor"><span>Предшественник</span><p>{display(row.predecessor)}</p><Icon name="arrow" size={24}/></div>}
   <div className="planning-work-result"><h4>{display(row.result)}</h4><p className="planning-work-dates"><Icon name="clock" size={16}/><span>{shortDate(row.start)} – {shortDate(row.end)}</span></p><p className="planning-work-owner"><Icon name="owner" size={16}/><span>{display(row.owner)}</span></p></div>
  </article>)}
 </div>;
}
