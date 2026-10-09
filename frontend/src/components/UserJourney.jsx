import React from 'react';
import {initiativeTitle,display,person,isNewIdea,googleLink,isHistorical,isCompleted,executionLabel,actualFinishLabel,stageCode,cardReadiness} from '../model/portfolio.js';
import {Legend} from './Common.jsx';
import report from '../data/ideas-review.json';
import {passportGaps,passportCheckLevel} from '../model/user-journey.js';
import './user-journey.css';

const reviewCodes=new Set(report.ideas.map(i=>i.code));
const counted=(n,forms)=>n+' '+forms[n%100>=11&&n%100<=14?2:n%10===1?0:n%10>=2&&n%10<=4?1:2];
const passportWord=n=>n%100>=11&&n%100<=14?'паспортов':n%10===1?'паспорт':n%10>=2&&n%10<=4?'паспорта':'паспортов';

export default function UserJourney({data,list,employee,initiative,onEmployee,onSelect,onOpen,coordinator}){
 const people=[...new Set((data.staff||[]).map(s=>s.employee).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
 const owned=employee?list.filter(i=>!isNewIdea(i)&&person(i)===employee):[],cards=owned.filter(i=>!isHistorical(i)),completed=owned.filter(isCompleted),closed=owned.filter(i=>isHistorical(i)&&!isCompleted(i)),ideas=employee?list.filter(i=>isNewIdea(i)&&person(i)===employee):[],selected=cards.find(i=>i.code===initiative?.code)||cards[0],gaps=passportGaps(selected),level=passportCheckLevel(selected);
 const curator=display(coordinator||selected?.curator),readiness=cardReadiness(selected);
 const supporting=employee?data.initiatives.filter(i=>person(i)!==employee&&String(i.team||'').includes(employee)):[];
 return <section className="employee-journey">
  <div className="journey-heading"><h1>Мои инициативы</h1><p>Проверьте свои паспорта до <strong>13 октября, 18:00</strong></p></div>
  <label className="journey-person">Выберите себя<select aria-label="Выберите себя" value={employee} onChange={e=>onEmployee(e.target.value)}><option value="">Выбрать сотрудника</option>{people.map(name=><option key={name} value={name}>{name}</option>)}</select></label>
  {!employee?<p className="journey-start">Выберите имя, чтобы открыть свои карточки и задачи к проверке</p>:<>
   <div className="journey-count"><strong>{cards.length} {passportWord(cards.length)} текущих инициатив</strong><span>Руководитель проверяет пакет текущих инициатив</span></div>
   {cards.length>0?<div className="journey-workspace">{cards.length>1&&<label className="journey-card-select">Выберите паспорт<select aria-label="Выберите паспорт" value={selected.code} onChange={e=>onSelect(e.target.value)}>{cards.map(i=><option key={i.code} value={i.code}>{i.code} / {initiativeTitle(i)}</option>)}</select></label>}
    <div className="journey-list" role="group" aria-label="Мои паспорта">{cards.map(i=><button type="button" key={i.code} aria-pressed={i.code===selected.code} onClick={()=>onSelect(i.code)}><span className={'journey-code '+(i.provenance?.origin==='primary'?'source-primary':'addition')}>{i.code}</span><span>{initiativeTitle(i)}</span></button>)}</div>
    <div className="journey-check" aria-live="polite"><h2>{initiativeTitle(selected)}</h2>{readiness&&<p className="journey-gaps" data-field="admission">Проверка карточки: {readiness}</p>}<p className="journey-instruction">{level===2?'Заполните показатель, базу, цель, эффект и затраты':'Проверьте название, проблему, решение, работы и ответственного. Куратор рассчитывается автоматически'}</p>
     {gaps.length>0?<div className="journey-gaps"><h3>Дополните данные</h3><ul>{gaps.slice(0,3).map(label=><li key={label}>{label}</li>)}</ul></div>:!readiness&&<p className="journey-gaps">{level===1?'Состав готов к проверке перехода в L2':'Состав готов к обсуждению'}</p>}
     <div className="journey-actions"><button className="journey-main-action" onClick={()=>onOpen(selected.code)}>Проверить паспорт</button><a className="button-link" href={googleLink(selected)} target="_blank" rel="noopener noreferrer">Открыть в таблице</a></div>
     <p className="journey-handoff">{level===1?'Для перехода в L2 отметьте готовность в таблице':'Передайте оценку и подтверждения руководителю'}{curator&&<span>Куратор выбранной инициативы: {curator}</span>}</p>
    </div>
   </div>:<p className="journey-start">{ideas.length?'Новые идеи для вашего анализа доступны ниже':'Руководитель закрепляет за вами карточки в общем реестре'}</p>}
   {ideas.length>0&&<section className="journey-ideas"><h2>Новые идеи для анализа / {ideas.length}</h2><p>Рассмотрите предмет, владельца и целесообразность каждой идеи</p>{ideas.map(i=><button key={i.code} onClick={()=>onOpen(i.code)}><span className="journey-code addition">{i.code}</span><span>{initiativeTitle(i)}</span><span>Проверить паспорт</span></button>)}</section>}
   {[[completed,'Выполненные проекты'],[closed,'Закрытые задачи']].filter(([rows])=>rows.length).map(([rows,label])=><section className="journey-history" key={label}><h2>{label} / {rows.length}</h2>{rows.map(i=><button key={i.code} onClick={()=>onOpen(i.code)}><span className="journey-code source-primary">{i.code}</span><span>{initiativeTitle(i)}<small>{executionLabel(i)}{actualFinishLabel(i)?' / '+actualFinishLabel(i):''}</small></span><span>Открыть паспорт</span></button>)}</section>)}
   {supporting.length>0&&<section className="journey-participation"><h2>Участвую в других проектах / {supporting.length}</h2>{supporting.map(i=><a key={i.code} href={googleLink(i)} target="_blank" rel="noopener noreferrer">{i.code} / {initiativeTitle(i)}</a>)}</section>}
  </>}
  
 </section>;
}

export function InitiativeCollection({list,history=false,all=false,onOpen,children,section="ideas",onSection}){
 const reviewed=list.filter(i=>reviewCodes.has(i.code)).length;
 const status=i=>isCompleted(i)?"Выполнено":isHistorical(i)?"Отменено":stageCode(i);
 return <section className="initiative-collection">
  <div className="journey-heading"><h1>{all?'Все инициативы':history?'История проектов':'Новые идеи'} / {list.length}</h1><p>{all?'Выберите паспорт для проверки, расчёта и обсуждения':history?'Исходные реестры фиксируют завершение и отмену работ':'Руководители команд проверяют предмет, владельца и целесообразность входящих предложений'}</p>{!all&&!history&&<p className="ideas-cohort-count" aria-live="polite">{counted(list.length-reviewed,['прежнее предложение','прежних предложения','прежних предложений'])} / {counted(reviewed,['новое','новых','новых'])} по итогам ревью</p>}</div>
  {children&&<nav className="ideas-section-tabs" aria-label="Содержание новых идей"><button className={section==='ideas'?'active':''} aria-pressed={section==='ideas'} onClick={()=>onSection('ideas')}>Идеи / {list.length}</button><button className={section==='review'?'active':''} aria-pressed={section==='review'} onClick={()=>onSection('review')}>Результаты ревью</button></nav>}
  {children&&section==='review'?children:<><div className="collection-list">{list.map(i=><article data-code={i.code} key={i.code} className={'collection-item '+(isHistorical(i)?'is-historical':'')}>
   <span className={'journey-code '+(i.provenance?.origin==='primary'?'source-primary':'addition')}>{i.code}</span>
   <div className="collection-content"><h2>{initiativeTitle(i)}</h2><p>{status(i)} / {person(i)}{(history||all)&&i.execution_fact&&executionLabel(i)!==status(i)?' / '+executionLabel(i):''}{history&&actualFinishLabel(i)?' / '+actualFinishLabel(i):''}</p>{history&&isCompleted(i)&&!actualFinishLabel(i)&&<p>Требуется дата завершения</p>}</div>
   <div className="collection-actions"><button aria-label={i.code+' / открыть паспорт'} onClick={()=>onOpen(i.code)}>Паспорт</button><a aria-label={i.code+' / открыть в таблице'} className="button-link" href={googleLink(i)} target="_blank" rel="noopener noreferrer">Таблица</a></div>
  </article>)}</div>
  {!list.length&&<p className="journey-start">Выбранный состав содержит 0 карточек</p>}</>}
 </section>;
}
