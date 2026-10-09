import React from 'react';
import Icon from './Icon.jsx';
import '../passport-ui.css';

const illustrationBase = import.meta.env.BASE_URL + 'assets/production-ai/';

// Стадии: [{code, label, date}]; даты и значения вызывающая сторона форматирует текущей моделью
export function PassportStagePath({stages, currentStage, nextAction, actionDue, compact=false}) {
  const current = stages.find(stage => stage.code === currentStage);
  return <section className="passport-visual passport-stage-path" aria-label="Стадии инициативы">
    {!compact && <header className="passport-visual-heading">
      <h2>Стадии ведут инициативу к подтверждению эффекта</h2>
      <p className="passport-current-stage"><Icon name="gantt"/><span>{current ? `${current.code} / ${current.label}` : 'Требуется стадия'}</span></p>
    </header>}
    <ol className="passport-stage-route">
      {stages.map(stage => <li key={stage.code} aria-current={stage.code === currentStage ? 'step' : undefined}>
        <span className="passport-stage-code">{stage.code}</span>
        <strong>{stage.label}</strong>
        {stage.date && <span className="passport-stage-date">{stage.date}</span>}
        
      </li>)}
    </ol>
    {!compact && <div className="passport-next-action"><div><span>Ближайшее действие</span><strong>{nextAction || 'Требуется действие'}</strong></div><time>{actionDue || 'Требуется срок'}</time></div>}
  </section>;
}

// Роли и решение: строки из customer, initiative_lead, curator, benefit_owner, decision
export function PassportResponsibility({customer, lead, curator, benefitOwner, decision}) {
  const roles = [
    {label: 'Заказчик / инициатор', value: customer, icon: 'teams'},
    {label: 'Ответственный за паспорт', value: lead, icon: 'passport'},
    {label: 'Владелец эффекта', value: benefitOwner, icon: 'target'}
  ];
  return <section className="passport-visual passport-responsibility" aria-label="Ответственность за инициативу">
    <h2>Владельцы связывают задачу, решение и эффект</h2>
    <div className="passport-responsibility-content">
      <img className="passport-subject-image" src={illustrationBase + 'personnel.webp'} width="640" height="640" alt="" loading="eager" decoding="async"/>
      <div className="passport-owner-diagram">
        <div className="passport-governance"><div><Icon name="shield"/><span>Куратор направления</span><strong>{curator || 'Требуется назначение'}</strong></div><div><span>Решение</span><strong>{decision || 'Требуется решение'}</strong></div></div>
        <ol className="passport-owner-route">
          {roles.map(role => <li key={role.label}><Icon name={role.icon}/><span>{role.label}</span><strong>{role.value || 'Требуется назначение'}</strong></li>)}
        </ol>
      </div>
    </div>
  </section>;
}

// Показатели и деньги: готовые строки текущей модели; формула выводится буквально
export function PassportEffectFlow({metric, baseline, target, unit, effectFormula, annualEffect, cashEffect, financeStatus}) {
  return <section className="passport-visual passport-effect-flow" aria-label="Связь показателя с финансовым эффектом">
    <header className="passport-visual-heading"><h2>Показатель связывает изменение с финансовым результатом</h2>{financeStatus && <p className="passport-finance-status">{financeStatus}</p>}</header>
    <div className="passport-effect-diagram">
      <div className="passport-indicator"><Icon name="target"/><h3>{metric || 'Требуется показатель'}</h3><dl className="passport-base-target"><div><dt>База</dt><dd>{baseline ?? 'Требуется база'}</dd></div><div><dt>Цель</dt><dd>{target ?? 'Требуется цель'}</dd></div></dl>{unit && <p className="passport-unit">{unit}</p>}</div>
      <div className="passport-effect-mechanism"><div><h3>Механизм эффекта</h3><p>{effectFormula || 'Требуется связь показателя с финансовым эффектом'}</p></div></div>
      <div className="passport-effect-result"><img className="passport-subject-image" src={illustrationBase + 'finance.webp'} width="640" height="640" alt="" loading="eager" decoding="async"/><dl><div><dt>Годовой потенциал до затрат ИТ, млн руб</dt><dd>{annualEffect ?? 'Требуется расчёт'}</dd></div><div><dt>Деньги 2027 до налога, млн руб</dt><dd>{cashEffect ?? 'Требуется расчёт'}</dd></div></dl></div>
    </div>
  </section>;
}
