import React from 'react';
import {display,person,isNewIdea,googleLink,isHistorical,isCompleted,executionLabel,actualFinishLabel,stageCode} from '../model/portfolio.js';
import {Legend} from './Common.jsx';
import {passportGaps,passportCheckLevel} from '../model/user-journey.js';
import './user-journey.css';

const passportWord=n=>n%100>=11&&n%100<=14?'паспортов':n%10===1?'паспорт':n%10>=2&&n%10<=4?'паспорта':'паспортов';

export default function UserJourney({data,list,employee,initiative,onEmployee,onSelect,onOpen,coordinator}){
 const people=[...new Set((data.staff||[]).map(s=>s.employee).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
 const owned=employee?list.filter(i=>!isNewIdea(i)&&person(i)===employee):[],cards=owned.filter(i=>!isHistorical(i)),completed=owned.filter(isCompleted),closed=owned.filter(i=>isHistorical(i)&&!isCompleted(i)),ideas=employee?list.filter(i=>isNewIdea(i)&&person(i)===employee):[],selected=cards.find(i=>i.code===initiative?.code)||cards[0],gaps=passportGaps(selected),level=passportCheckLevel(selected);
 const curator=display(coordinator||selected?.curator);
 const supporting=employee?data.initiatives.filter(i=>person(i)!==employee&&String(i.team||'').includes(employee)):[];
 return <section className="employee-journey">
  <div className="journey-heading"><h1>Мои инициативы</h1><p>Проверьте свои паспорта до <strong>13 октября, 18:00</strong></p></div>
  <label className="journey-person">Выберите себя<select aria-label="Выберите себя" value={employee} onChange={e=>onEmployee(e.target.value)}><option value="">Выбрать сотрудника</option>{people.map(name=><option key={name} value={name}>{name}</option>)}</select></label>
  {!employee?<p className="journey-start">Выберите имя, чтобы открыть свои карточки и задачи к проверке</p>:<>
   <div className="journey-count"><strong>{cards.length} {passportWord(cards.length)} текущих инициатив</strong><span>Руководитель проверяет пакет текущих инициатив</span></div>
   {cards.length>0?<div className="journey-workspace">{cards.length>1&&<label className="journey-card-select">Выберите паспорт<select aria-label="Выберите паспорт" value={selected.code} onChange={e=>onSelect(e.target.value)}>{cards.map(i=><option key={i.code} value={i.code}>{i.code} / {display(i.title)}</option>)}</select></label>}
    <div className="journey-list" role="group" aria-label="Мои паспорта">{cards.map(i=><button type="button" key={i.code} aria-pressed={i.code===selected.code} onClick={()=>onSelect(i.code)}><span className={'journey-code '+(i.provenance?.origin==='primary'?'source-primary':'addition')}>{i.code}</span><span>{display(i.title)}</span></button>)}</div>
    <div className="journey-check" aria-live="polite"><h2>{display(selected.title)}</h2><p className="journey-instruction">{level===2?'Подтвердите показатель, базу, цель и источники':'Сверьте задачу, основной результат и владельцев'}</p>
     {gaps.length>0?<div className="journey-gaps"><h3>Дополните данные</h3><ul>{gaps.slice(0,3).map(label=><li key={label}>{label}</li>)}</ul>{gaps.length>3&&<details className="journey-extra-checks"><summary>Остальные пункты / {gaps.length-3}</summary><ul>{gaps.slice(3).map(label=><li key={label}>{label}</li>)}</ul></details>}</div>:<p className="journey-gaps">Проверьте содержание паспорта перед обсуждением</p>}
     <div className="journey-actions"><button className="journey-main-action" onClick={()=>onOpen(selected.code)}>Проверить паспорт</button><a className="button-link" href={googleLink(selected)} target="_blank" rel="noopener noreferrer">Открыть в таблице</a></div>
     {level===1&&<details className="journey-assessment"><summary>Оценка к 20 октября</summary><p>Подготовьте показатель, базу и её источник, цель и дату достижения. Владельцы подтверждают расчёт эффекта на этапе оценки</p></details>}<p className="journey-handoff">Передайте проверенные паспорта руководителю{curator&&<span>Куратор выбранной инициативы: {curator}</span>}</p>
    </div>
   </div>:<p className="journey-start">{ideas.length?'Новые идеи для вашего анализа доступны ниже':'Руководитель закрепляет за вами карточки в общем реестре'}</p>}
   {ideas.length>0&&<details className="journey-ideas"><summary>Новые идеи для анализа / {ideas.length}</summary><p>Рассмотрите предмет, владельца и целесообразность каждой идеи</p>{ideas.map(i=><button key={i.code} onClick={()=>onOpen(i.code)}><span className="journey-code addition">{i.code}</span><span>{display(i.title)}</span><span>Проверить паспорт</span></button>)}</details>}
   {[[completed,'Выполненные проекты'],[closed,'Закрытые задачи']].filter(([rows])=>rows.length).map(([rows,label])=><details className="journey-history" key={label}><summary>{label} / {rows.length}</summary>{rows.map(i=><button key={i.code} onClick={()=>onOpen(i.code)}><span className="journey-code source-primary">{i.code}</span><span>{display(i.title)}<small>{executionLabel(i)}{actualFinishLabel(i)?' / '+actualFinishLabel(i):''}</small></span><span>Открыть паспорт</span></button>)}</details>)}
   {supporting.length>0&&<details className="journey-participation"><summary>Участвую в других проектах / {supporting.length}</summary>{supporting.map(i=><a key={i.code} href={googleLink(i)} target="_blank" rel="noopener noreferrer">{i.code} / {display(i.title)}</a>)}</details>}
  </>}
  
 </section>;
}

export function InitiativeCollection({list,history=false,all=false,onOpen}){
 return <section className="initiative-collection"><div className="journey-heading"><h1>{all?'Все инициативы':history?'История проектов':'Новые идеи'} / {list.length}</h1><p>{all?'Выберите паспорт для проверки, расчёта и обсуждения':history?'Исходные реестры фиксируют завершение и отмену работ':'Руководители команд проверяют предмет, владельца и целесообразность входящих предложений'}</p></div><div className="collection-list">{list.map(i=><article key={i.code} className={'collection-item '+(isHistorical(i)?'is-historical':'')}><span className={'journey-code '+(i.provenance?.origin==='primary'?'source-primary':'addition')}>{i.code}</span><div><h2>{display(i.title)}</h2><p>{stageCode(i)} / {person(i)}{(history||all)&&i.execution_fact?' / '+executionLabel(i):''}{history&&actualFinishLabel(i)?' / '+actualFinishLabel(i):''}</p>{history&&i.execution_fact?.source_status&&<p className="source-primary">Статус источника: {display(i.execution_fact.source_status)}</p>}{history&&isCompleted(i)&&!actualFinishLabel(i)&&<p>Требуется дата завершения</p>}{history&&i.execution_fact?.basis==='user_confirmation'&&<p className="addition">Пользователь подтвердил завершение</p>}<div className="collection-actions"><button onClick={()=>onOpen(i.code)}>Открыть паспорт</button><a className="button-link" href={googleLink(i)} target="_blank" rel="noopener noreferrer">Открыть в таблице</a></div></div></article>)}</div>{!list.length&&<p className="journey-start">Выбранный состав содержит 0 карточек</p>}</section>;
}
