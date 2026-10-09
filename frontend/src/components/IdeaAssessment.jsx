import React from 'react';
import {fmt} from '../model/portfolio.js';
import './ideas-review.css';
const interval=(value,unit,pending)=>Array.isArray(value)&&value.length===2?`${fmt(value[0],2)}–${fmt(value[1],2)} ${unit}`:`Требуется подтверждение: ${pending}`;
export default function IdeaAssessment({i}){
 const proposal=i?.provenance?.assessment?.proposal;if(!proposal)return null;
 const ranges=proposal.preliminary_ranges||{},example=proposal.effect_example;
 return <section className="idea-assessment section-block" data-code={i.code}><details><summary>Источники подтверждают практику и условия анализа</summary><p className="caption">L0 / Предварительная оценка / Согласованный эффект: 0 млн руб / год / Исполнитель: требуется подтверждение</p><h3>Условия предварительной оценки</h3><p>{ranges.assumptions}</p><p>{proposal.distinct_result_check?.boundary}</p>{example&&<><h3>Условный пример раскрывает зависимость прибыли от входов</h3><p>{example.basis}</p><p>{example.indicator} / {interval(example.illustrative_range_mrub_year,'млн руб / год','входы примера')}</p><p>{example.interpretation}</p><p>{example.final_profit_formula}</p></>}{(proposal.effect_range_formula||proposal.financial_overlap_rule)&&<><h3>Финансы подтверждают расчёт и границы эффекта</h3><p>{proposal.effect_range_formula}</p><p>{proposal.effect_confirmation_required}</p><p>{proposal.financial_overlap_rule}</p></>}<h3>Проектные материалы</h3>{(proposal.project_evidence||[]).map((s,n)=><p key={n}>{s.file} / {s.section||s.claim}{s.page?` / стр. ${s.page}`:''}</p>)}<h3>Первичные практики</h3><ul>{(proposal.practice_sources||[]).map((s,n)=><li key={n}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>{s.date?` / ${s.date}`:''}<p>{s.claim}</p></li>)}</ul><h3>Правовой охват</h3><p>{proposal.legal_scope?.basis}</p><p>{proposal.legal_scope?.enterprise_mandatory}</p></details></section>;

}
