import React from 'react';
import Icon from './Icon.jsx';
import {PassportStagePath} from './PassportVisuals.jsx';
import PassportTimeline from './PassportTimeline.jsx';
import {display,fmt,longDate,dateTimeLabel,color,stageCode,stages,person,group,aliasCodes,digitalLayer,finances,deadlineStatus,isNewIdea,isHistorical,executionFact,executionLabel,actualFinishLabel,isNumber,hours} from '../model/portfolio.js';
import '../passport-ui.css';

function Field({i,name,label,icon,format,children,className='',empty='Требуется заполнение',originName=name}) {
  const value=children ?? (format ? format(i[name]) : display(i[name]) || empty);
  return <div className={'pc-field '+className} data-field={name}><h3>{icon && <Icon name={icon}/>}<span>{label}</span></h3><p className={'pc-value '+color(i,originName)}>{value}</p></div>;
}

function ProvenanceValue({i,name,children}) {
  return <span className={'pc-inline-value '+color(i,name)} data-field={name}>{children ?? (display(i[name]) || 'Требуется заполнение')}</span>;
}

// finance получает текущий допуск модели; поддерживающий вклад сохраняет код конечного эффекта
export default function PassportCanvas({data,i,finance}) {
  if(!i)return null;
  const admitted=finance ?? finances(data,[i]);
  const aliases=aliasCodes(i),supporting=i.effect_role==='Поддерживающий вклад';
  const stageItems=stages.map(([code,label])=>({code,label}));
  const deadline=deadlineStatus(data,i),isIdea=isNewIdea(i),historical=isHistorical(i),fact=executionFact(i);
  return <article className="passport-core passport-canvas" data-code={i.code}>
    <header className="pc-header">
      <div className="pc-identity pc-group-path"><ProvenanceValue i={i} name="digital_layer">{digitalLayer(i)}</ProvenanceValue><span> / </span><ProvenanceValue i={i} name="it_group">{group(i)}</ProvenanceValue><span> / </span><span className="pc-path-role">Куратор:</span><ProvenanceValue i={i} name="curator"/><span> / </span><span className="pc-path-role">{isIdea?'Ответственный за анализ:':'Ответственный за паспорт:'}</span><ProvenanceValue i={i} name="initiative_lead">{person(i)}</ProvenanceValue><span> / </span><ProvenanceValue i={i} name="process"/><span> / </span><ProvenanceValue i={i} name="code"/></div>
      <h1 className={color(i,'title')} data-field="title">{display(i.title)}</h1>
      {aliases.length>0 && <p className="pc-aliases">Карточка объединяет прежние коды {aliases.join(' / ')}</p>}
    </header>
    <div className="pc-columns">
      <section className="pc-purpose" aria-label="Проблема, решение и результат">
        <h2><Icon name="target"/>Зачем делаем</h2>
        <Field i={i} name="problem" label="Проблема" icon="flag"/>
        <div className="pc-solution"><Field i={i} name="solution" label="Решение" icon="idea"/></div>
        <Field i={i} name="success" label="Критерий приёмки" icon="check"/>
        <div className="pc-measure">
          <Field i={i} name="metric" label="Результат и показатель успеха" icon="target"/>
          <div className="pc-base-target"><div><span>База</span><strong><ProvenanceValue i={i} name="baseline">{fmt(i.baseline,3,'База ожидается')}</ProvenanceValue></strong></div><Icon name="arrow"/><div><span>Цель</span><strong><ProvenanceValue i={i} name="target">{fmt(i.target,3,'Цель ожидается')}</ProvenanceValue>{display(i.unit)&&<small className="pc-target-unit"><ProvenanceValue i={i} name="unit"/></small>}</strong></div></div>
          <p className="pc-measure-details"><ProvenanceValue i={i} name="baseline_period"/><span> / цель </span><ProvenanceValue i={i} name="target_date">{longDate(i.target_date)}</ProvenanceValue></p>
          {display(i.baseline_source) && <p className="pc-baseline-reference"><ProvenanceValue i={i} name="baseline_source"/></p>}
        </div>
        <section className="pc-effect" aria-label="Ожидаемый эффект">
          <h2><Icon name="effect"/>Эффект</h2>
          <Field i={i} name="priority_annual_ebitda" label="Годовой прирост EBITDA, млн руб" className={'pc-main-number '+(supporting?'pc-supporting-number':'')}>{historical?'Исторический проект':fmt(i.priority_annual_ebitda,2,'Требуется оценка')}</Field>
          {!historical&&<Field i={i} name="priority_annual_depreciation" label="Годовой прирост EBIT, млн руб">{fmt(isNumber(i.priority_annual_ebitda)&&isNumber(i.priority_annual_depreciation)?i.priority_annual_ebitda-i.priority_annual_depreciation:null,2,'Требуется амортизация')}</Field>}
          <Field i={i} name="net_2027" label="Деньги 2027 до налога, млн руб" className="pc-main-number">{fmt(admitted.cash,2,'Требуется согласование')}</Field>
        </section>
      </section>
      <section className="pc-project" aria-label="Описание, статус и план проекта">
        <h2><Icon name="gantt"/>Что и когда</h2>
        <Field i={i} name="scope" label="Описание проекта и состав работ" icon="product"/>
        <div className="pc-project-status">
          <div className="pc-stage-label"><span>{fact?fact.basis==='user_confirmation'?'Стадия по подтверждённому выполнению':'Стадия по исходному реестру':'Стадия проекта'}</span><ProvenanceValue i={i} name="stage">{display(i.stage)||'Требуется стадия'}</ProvenanceValue></div>
          <PassportStagePath compact stages={stageItems} currentStage={stageCode(i)}/>
          {fact&&<div className="pc-execution-status source-primary">{historical?'Фактический статус: ':'Рабочий статус по исходному реестру: '}{executionLabel(i)}</div>}
          {fact?.date_conflict&&!historical&&<p className="pc-execution-conflict source-primary">Финиш по исходному реестру: {actualFinishLabel(i)} / требуется сверка</p>}
          {!historical&&<div className={'pc-deadline pc-deadline-'+deadline.code}><Icon name="clock"/><span>{deadline.text}{deadline.due&&<time>{deadline.dueLabel||longDate(deadline.due)}</time>}</span></div>}
          <Field i={i} name="decision" label="Решение по инициативе" icon="decision" empty="Требуется решение"/>
        </div>
        <PassportTimeline data={data} i={i}/>
        <div className="pc-action">
          <Field i={i} name="next_action" label="Ближайшее действие" icon="arrow" empty="Требуется действие"/>
          <p><Icon name="clock"/><ProvenanceValue i={i} name="action_due">{dateTimeLabel(i.action_due)}</ProvenanceValue></p>
        </div>
        <div className="pc-project-conditions">
          <div className="pc-risk"><Field i={i} name="risk" label="Главный риск" icon="risk"/><Field i={i} name="risk_action" label="Действие и владелец риска" icon="shield"/></div>
          <Field i={i} name="dependency_codes" label="Зависимости" icon="dependency" empty="Требуется проверка"/>
        </div>
        <Field i={i} name="effect_formula" label="Связь показателя с финансовым эффектом" icon="arrow"/>
        <div className="pc-effect-role"><Field i={i} name="effect_role" label="Роль в финансовом эффекте" empty="Требуется роль эффекта"/><Field i={i} name="effect_group" label="Код конечного эффекта" empty="Требуется связь эффекта"/></div>
      </section>
      <aside className="pc-resources" aria-label="Люди, часы и деньги">
        <h2><Icon name="teams"/>Кто и что нужно</h2>
        <div className="pc-owners"><Field i={i} name="customer" label="Заказчик / инициатор" icon="teams"/><Field i={i} name="initiative_lead" label={isIdea?'Ответственный за анализ':'Ответственный за паспорт'} icon="passport" originName="initiative_lead">{person(i)}</Field><Field i={i} name="curator" label="Куратор команды" icon="shield"/><Field i={i} name="benefit_owner" label="Владелец эффекта" icon="target"/></div>
        <section className="pc-team-resources">
          <h2><Icon name="resources"/>Команда и трудозатраты</h2>
          <Field i={i} name="team" label="Команда и роли" icon="teams" empty="Требуется состав"/>
          {!historical&&<Field i={i} name="total_hours" label="Ресурсы ИТ 2027, ч" icon="clock" className="pc-resource-number"/>}
        </section>
        <section className="pc-economy">
          <h2><Icon name="money"/>Деньги проекта</h2>
          <Field i={i} name="approved_budget" label="Утверждённый бюджет проекта, млн руб" format={v=>fmt(v,2,'Требуется утверждение')} className="pc-budget"/>
          <div className="pc-payments"><Field i={i} name="one_off_2027" label="Платежи внедрения 2027, млн руб" format={v=>fmt(v)}/><Field i={i} name="run_2027" label="Платежи сопровождения 2027, млн руб" format={v=>fmt(v)}/></div>
          {!historical&&<Field i={i} name="priority_hour_rate" label="Начисленный фонд оплаты труда 2027, млн руб">{fmt(hours(i)!==null&&isNumber(i.priority_hour_rate)?hours(i)*i.priority_hour_rate/1e6:null,2,'Требуется оценка')}</Field>}
          <p className="pc-finance-status">Согласование финансов: <ProvenanceValue i={i} name="finance_status">{display(i.finance_status)||'Финансовые значения проходят согласование'}</ProvenanceValue></p>
        </section>
      </aside>
    </div>
  </article>;
}
