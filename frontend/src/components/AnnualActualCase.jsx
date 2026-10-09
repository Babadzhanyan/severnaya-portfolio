import React,{useEffect,useRef,useState} from 'react';
import FactorTree from './FactorTree.jsx';
import {sheetLink} from '../model/portfolio.js';
import './annual-actual.css';

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const periodKey=value=>String(value||'').replace(/\s+/g,'').replace(/[—-]/g,'–').toLocaleLowerCase('ru');
const number=(value,digits=2)=>finite(value)?new Intl.NumberFormat('ru-RU',{maximumFractionDigits:digits}).format(value):'Требуется значение';
const millionsWithUnit=value=>number(value/1e6)+' млн руб';
const million=value=>finite(value)?number(value/1e6):'Требуется расчёт';

export function normalizeAnnualInput(actualCase){
 if(actualCase?.sales)return {...actualCase,scenario:actualCase.scenario||{}};
 if(!actualCase?.['наблюдаемые_продажи'])return null;
 const sales=actualCase['наблюдаемые_продажи'],production=actualCase['производственный_управленческий_контур']||{};
 return {period:actualCase['период'],sales:{quantity_kg:sales['продажи_кг'],revenue:sales['выручка_продаж_руб'],price:sales['средняя_реализованная_цена_руб_кг'],cogs:sales['полная_себестоимость_по_исходным_ставкам_руб'],management_margin:sales['управленческая_маржа_отчёта_продаж_руб']},production:{quantity_kg:production['выпуск_кг'],revenue:production['выручка_на_выпуске_руб'],price:production['цена_выпуска_руб_кг'],cogs:production['полная_себестоимость_выпуска_руб'],logistics:production['логистика_руб'],management_margin:production['управленческая_маржа_руб']},scenario:{},sources:actualCase['источник'],financial_approval:false};
}
const currentScenario=(actualCase,scenario)=>({...normalizeAnnualInput(actualCase)?.scenario,...scenario});

export function annualPriceEstimate(actualCase,scenario={}){
 const source=normalizeAnnualInput(actualCase),sales=source?.sales,period=source?.period;scenario=currentScenario(actualCase,scenario);
 const percent=scenario.price_change_pct??scenario.price_change_percent??0,da=scenario.additional_depreciation??null,extra=scenario.additional_cash_expenses??0;
 if(!sales||!finite(sales.quantity_kg)||sales.quantity_kg<=0||!finite(sales.revenue))return {error:'Требуется годовой источник продаж'};
 if((scenario.unchanged_expenses!=null&&typeof scenario.unchanged_expenses!=='boolean')||(scenario.other_expenses_unchanged!=null&&typeof scenario.other_expenses_unchanged!=='boolean'))return {error:'Предпосылка сохранения расходов требует логическое значение'};
 if(!finite(percent)||percent<-100||percent>1000||!finite(extra)||da!==null&&!finite(da))return {error:'Сценарий требует конечные числовые значения'};
 const samePeriod=periodKey(scenario.depreciation_period||period)===periodKey(period);
 const revenueDelta=sales.revenue*percent/100;
 const estimateAllowed=(scenario.unchanged_expenses??scenario.other_expenses_unchanged)===true;
 const ebitda=estimateAllowed?revenueDelta-extra:null;
 const ebit=ebitda===null||da===null||!samePeriod?null:ebitda-da;
 return {period,months:12,baseline_sales_kg:sales.quantity_kg,baseline_revenue:sales.revenue,baseline_price:sales.revenue/sales.quantity_kg,target_price:sales.revenue/sales.quantity_kg*(1+percent/100),revenue_delta:revenueDelta,period_delta_ebitda:ebitda,period_delta_ebit:ebit,additional_depreciation:da,depreciation_period_comparable:samePeriod,absolute_baseline_ebitda:null,absolute_target_ebitda:null,approved_delta_ebitda:null,approved_delta_ebit:null,financial_approval:false,status:estimateAllowed?'Расчётная оценка':'Требуется состав расходов',ebit_status:da===null?'Требуется дополнительная амортизация':!samePeriod?'Требуется сопоставимый период':ebit===null?'Требуется расчёт EBITDA':'Расчётная оценка'};
}

export default function AnnualActualCase({actualCase,scenario={},onScenarioChange}){
 const[editor,setEditor]=useState(''),[copied,setCopied]=useState(false),editorRef=useRef(null);useEffect(()=>{if(!editor)return;const previous=document.activeElement;requestAnimationFrame(()=>editorRef.current?.querySelector('input,button')?.focus());return()=>previous?.focus?.();},[editor]);
 const result=annualPriceEstimate(actualCase,scenario);
 if(result.error)return <section className="annual-actual"><h2>Годовой источник формирует ценовой сценарий</h2><p>{result.error}</p></section>;
 const source=normalizeAnnualInput(actualCase),sales=source.sales,production=source.production;scenario=currentScenario(actualCase,scenario);
 const change=patch=>onScenarioChange?.({...scenario,...patch});
 const percent=scenario.price_change_pct??scenario.price_change_percent??0;
 return <section className="annual-actual" aria-label="Годовой расчёт по фактическим продажам">
  <div className="annual-actual-heading"><h2>Годовые продажи задают базу ценового сценария</h2><p>{result.period} / весь завод / 12 месяцев</p></div>
  <div className="annual-actual-controls">
   <label className="calculator-number"><span>Изменение средней цены</span><div><input aria-label="Годовое изменение чистой цены, %" type="number" min="-100" max="1000" step="0.1" value={percent} onChange={e=>change({price_change_pct:e.target.value===''?0:Number(e.target.value)})}/><small>%</small></div><span>База {number(result.baseline_price)} руб / кг</span></label>
   <label className="calculator-number"><span>Дополнительные операционные расходы</span><div><input aria-label="Расходы годового ценового решения, млн руб" type="number" step="0.1" value={(scenario.additional_cash_expenses??0)/1e6} onChange={e=>change({additional_cash_expenses:e.target.value===''?0:Number(e.target.value)*1e6})}/><small>млн руб / год</small></div></label>
  </div>
  <label className="annual-actual-assumption-control"><input data-annual-expenses type="checkbox" checked={(scenario.unchanged_expenses??scenario.other_expenses_unchanged)===true} onChange={e=>change({unchanged_expenses:e.target.checked})}/>Объём, структура продукции и остальные расходы сохраняются</label>
  <div className="annual-actual-result" aria-live="polite"><div><span>Прирост операционной прибыли</span><strong>{million(result.period_delta_ebitda)} <small>млн руб / год</small></strong><span>Управленческая оценка / состав текущих расходов</span></div><div><span>Изменённые параметры</span><p>Цена {percent>0?'+':''}{number(percent)}% / расходы {million(scenario.additional_cash_expenses??0)} млн руб</p><button disabled={!finite(result.period_delta_ebitda)} onClick={async()=>{try{await navigator.clipboard.writeText(['Период: '+result.period,'Цена: '+number(percent)+'%','Расходы: '+million(scenario.additional_cash_expenses??0)+' млн руб','Прирост операционной прибыли: '+million(result.period_delta_ebitda)+' млн руб / год','Предварительная оценка / требуется согласование'].join('\n'));setCopied(true);setTimeout(()=>setCopied(false),2500);}catch{setCopied(false);}}}>{copied?'Результат скопирован':'Скопировать для паспорта'}</button></div></div>
  <div className="annual-baseline"><span>Продажи {million(sales.quantity_kg)} млн кг</span><span>Выручка {million(sales.revenue)} млн руб</span><span>Средняя цена {number(result.baseline_price)} руб / кг</span></div>
  <FactorTree customModel={{period:result.period,months:12,byId:Object.fromEntries([
   ['ebitda','Операционная прибыль','млн руб',null,null,result.period_delta_ebitda,'expenses','Прирост выручки − дополнительные операционные расходы'],
   ['revenue','Выручка продаж','млн руб',sales.revenue,sales.revenue+result.revenue_delta,result.revenue_delta,'price','Масса тех же продаж × чистая цена'],
   ['expenses','Расходы ценового решения','млн руб',0,scenario.additional_cash_expenses??0,scenario.additional_cash_expenses??0,'expenses','Дополнительные операционные расходы'],
   ['sales','Продажи','кг',sales.quantity_kg,sales.quantity_kg,0,'price','Наблюдаемый объём того же периода'],
   ['price','Средняя цена','руб / кг',result.baseline_price,result.target_price,result.target_price-result.baseline_price,'price','Выручка / масса тех же продаж']
  ].map(([id,title,unit,baseline,target,delta,editor,formula])=>[id,{id,title,unit,baseline,target,change:delta,editor,formula}]))}} title="Цена связывает продажи с приростом прибыли" onEditor={key=>setEditor(key)}/>

  {editor&&<div className="factor-editor" onClick={e=>{if(e.target===e.currentTarget)setEditor('');}}><section ref={editorRef} className="factor-editor-panel annual-factor-editor" role="dialog" aria-modal="true" aria-label="Параметры годового сценария" onKeyDown={e=>{if(e.key==='Escape')setEditor('');if(e.key==='Tab'){const controls=[...e.currentTarget.querySelectorAll('input,button,a[href]')].filter(x=>!x.disabled),first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}><div className="factor-editor-heading"><h2>Параметры годового сценария</h2><button aria-label="Закрыть параметры" onClick={()=>setEditor('')}>×</button></div><p className="caption">{result.period} / личный сценарий</p>
  {editor==='price'&&<label className="calculator-number"><span>Изменение чистой цены</span><div><input aria-label="Годовое изменение чистой цены, %" type="number" min="-100" max="1000" step="0.1" value={percent} onChange={e=>change({price_change_pct:e.target.value===''?0:Number(e.target.value)})}/><small>%</small></div></label>}
  {editor==='expenses'&&<label className="calculator-number"><span>Дополнительные операционные расходы за 12 месяцев</span><div><input aria-label="Расходы годового ценового решения, млн руб" type="number" step="0.1" value={(scenario.additional_cash_expenses??0)/1e6} onChange={e=>change({additional_cash_expenses:e.target.value===''?0:Number(e.target.value)*1e6})}/><small>млн руб</small></div></label>}
  <label className="annual-actual-assumption-control"><input data-annual-expenses type="checkbox" checked={(scenario.unchanged_expenses??scenario.other_expenses_unchanged)===true} onChange={e=>change({unchanged_expenses:e.target.checked})}/>Объём, структура продукции и остальные расходы сохраняются в личном сценарии</label><div className="factor-editor-results" aria-live="polite"><div><span>Прирост операционной прибыли</span><strong>{result.period_delta_ebitda==null?result.status:millionsWithUnit(result.period_delta_ebitda)}</strong></div></div><p className="caption">Владелец подтверждает финансовый эффект</p><a className="button-link" href={sheetLink(807030034,'E310:E315')} target="_blank" rel="noopener noreferrer">Открыть годовой сценарий в таблице</a><button className="factor-editor-close" onClick={()=>setEditor('')}>Вернуться к дереву</button></section></div>}
  <p className="annual-actual-confirmation">Требуется подтверждение: сбыт и финансовая служба проверяют цены и расходы выбранного решения</p>
 </section>;
}
