import React,{useRef,useState} from 'react';
import FactorTree from './FactorTree.jsx';
import {sheetLink,initiativeTitle} from '../model/portfolio.js';
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
 const percent=scenario.price_change_pct!==undefined?scenario.price_change_pct:scenario.price_change_percent!==undefined?scenario.price_change_percent:0,da=scenario.additional_depreciation??null,extra=scenario.additional_cash_expenses===undefined?0:scenario.additional_cash_expenses;
 if(!sales||!finite(sales.quantity_kg)||sales.quantity_kg<=0||!finite(sales.revenue))return {error:'Требуется годовой источник продаж'};
 const percentReady=finite(percent)&&percent>=-100&&percent<=1000;
 const error=(scenario.unchanged_expenses!=null&&typeof scenario.unchanged_expenses!=='boolean')||(scenario.other_expenses_unchanged!=null&&typeof scenario.other_expenses_unchanged!=='boolean')?'Предпосылка сохранения расходов требует логическое значение':!percentReady||extra!==null&&!finite(extra)||da!==null&&!finite(da)?'Сценарий требует конечные числовые значения':'';
 const samePeriod=periodKey(scenario.depreciation_period||period)===periodKey(period);
 const revenueDelta=percentReady?sales.revenue*percent/100:null;
 const estimateAllowed=(scenario.unchanged_expenses??scenario.other_expenses_unchanged)===true;
 const ebitda=!error&&estimateAllowed&&finite(extra)?revenueDelta-extra:null;
 const ebit=ebitda===null||da===null||!samePeriod?null:ebitda-da;
 return {period,months:12,error,baseline_sales_kg:sales.quantity_kg,baseline_revenue:sales.revenue,baseline_price:sales.revenue/sales.quantity_kg,target_price:percentReady?sales.revenue/sales.quantity_kg*(1+percent/100):null,revenue_delta:revenueDelta,period_delta_ebitda:ebitda,period_delta_ebit:ebit,additional_depreciation:da,depreciation_period_comparable:samePeriod,absolute_baseline_ebitda:null,absolute_target_ebitda:null,approved_delta_ebitda:null,approved_delta_ebit:null,financial_approval:false,status:error?'Требуется исправление параметров':extra===null?'Требуются дополнительные расходы':estimateAllowed?'Расчётная оценка':'Требуется состав расходов',ebit_status:da===null?'Требуется дополнительная амортизация':!samePeriod?'Требуется сопоставимый период':ebit===null?'Требуется расчёт EBITDA':'Расчётная оценка'};
}

export function annualResultText(result,scenario,initiative){
 if(!finite(result?.period_delta_ebitda))return null;
 const percent=scenario.price_change_pct??scenario.price_change_percent??0;
 return [initiative?initiative.code+' / '+initiativeTitle(initiative):'Личный сценарий','Период: '+result.period,'Цена: '+number(percent)+'%','Расходы: '+million(scenario.additional_cash_expenses??0)+' млн руб','Прирост операционной прибыли: '+million(result.period_delta_ebitda)+' млн руб / год','Предварительная оценка / требуется согласование'].join('\n');
}

export default function AnnualActualCase({actualCase,scenario={},onScenarioChange,initiative,embedded=false,compact=false}){
 const[copied,setCopied]=useState(false),[copyError,setCopyError]=useState(''),sectionRef=useRef(null);
 const result=annualPriceEstimate(actualCase,scenario);
 if(!finite(result.baseline_sales_kg))return <section className="annual-actual"><h2>Годовой источник формирует ценовой сценарий</h2><p>{result.error}</p></section>;
 const source=normalizeAnnualInput(actualCase),sales=source.sales;scenario=currentScenario(actualCase,scenario);
 const change=patch=>onScenarioChange?.({...scenario,...patch});
 const percent=scenario.price_change_pct!==undefined?scenario.price_change_pct:scenario.price_change_percent!==undefined?scenario.price_change_percent:0,extra=scenario.additional_cash_expenses===undefined?0:scenario.additional_cash_expenses;
 return <section ref={sectionRef} className={'annual-actual'+(compact?' compact':'')} aria-label="Годовой расчёт по фактическим продажам">
  <div className="annual-actual-heading"><h2>{embedded?'Измените среднюю цену':'Годовые продажи задают базу ценового сценария'}</h2><p>{result.period} / весь завод / 12 месяцев</p></div>
  <div className="annual-actual-controls">
   <label className="calculator-number"><span>Изменение средней цены</span><div><input data-calculator-control="annual_price" aria-label="Годовое изменение чистой цены, %" type="number" min="-100" max="1000" step="0.1" value={finite(percent)?percent:''} onChange={e=>change({price_change_pct:e.target.value===''?null:Number(e.target.value)})}/><small>%</small></div><span>База {number(result.baseline_price)} руб / кг</span></label>
   <label className="calculator-number"><span>Дополнительные операционные расходы</span><div><input data-calculator-control="annual_expenses" aria-label="Расходы годового ценового решения, млн руб" type="number" step="0.1" value={finite(extra)?extra/1e6:''} onChange={e=>change({additional_cash_expenses:e.target.value===''?null:Number(e.target.value)*1e6})}/><small>млн руб / год</small></div></label>
  </div>
  {(result.error||extra===null)&&<p className="notice" role="alert">{result.error||result.status}</p>}
  <label className="annual-actual-assumption-control"><input data-annual-expenses type="checkbox" checked={(scenario.unchanged_expenses??scenario.other_expenses_unchanged)===true} onChange={e=>change({unchanged_expenses:e.target.checked})}/>Объём, структура продукции и остальные расходы сохраняются</label>
  {!embedded&&<div className="annual-actual-result" aria-live="polite"><div>{initiative?.code&&<span>{initiative.code}</span>}<span>Прирост операционной прибыли</span><strong>{million(result.period_delta_ebitda)} <small>млн руб / год</small></strong><span>Управленческая оценка / состав текущих расходов</span></div><div><span>Изменённые параметры</span><p>Цена {percent>0?'+':''}{number(percent)}% / расходы {million(extra)} млн руб</p><button disabled={!finite(result.period_delta_ebitda)} onClick={async()=>{const text=annualResultText(result,scenario,initiative);if(text===null)return;setCopyError('');try{await navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),2500);}catch{setCopied(false);setCopyError('Скопируйте код инициативы, параметры и результат из карточки');}}}>{copied?'Результат скопирован':'Скопировать для паспорта'}</button>{copyError&&<p role="alert">{copyError}</p>}</div></div>}
  <div className="annual-baseline"><span>Продажи {million(sales.quantity_kg)} млн кг</span><span>Выручка {million(sales.revenue)} млн руб</span><span>Средняя цена {number(result.baseline_price)} руб / кг</span></div>
  <FactorTree customModel={{period:result.period,months:12,byId:Object.fromEntries([
   ['ebitda','Операционная прибыль','млн руб',null,null,result.period_delta_ebitda,'expenses','Прирост выручки − дополнительные операционные расходы'],
   ['revenue','Выручка продаж','млн руб',sales.revenue,finite(result.revenue_delta)?sales.revenue+result.revenue_delta:null,result.revenue_delta,'price','Масса тех же продаж × чистая цена'],
   ['expenses','Расходы ценового решения','млн руб',0,finite(extra)?extra:null,finite(extra)?extra:null,'expenses','Дополнительные операционные расходы'],
   ['sales','Продажи','кг',sales.quantity_kg,sales.quantity_kg,0,'price','Наблюдаемый объём того же периода'],
   ['price','Средняя цена','руб / кг',result.baseline_price,result.target_price,finite(result.target_price)?result.target_price-result.baseline_price:null,'price','Выручка / масса тех же продаж']
  ].map(([id,title,unit,baseline,target,delta,editor,formula])=>[id,{id,title,unit,baseline,target,change:delta,editor,formula}]))}} title="Цена связывает продажи с приростом прибыли" onEditor={key=>{const field=sectionRef.current?.querySelector('[data-calculator-control="'+(key==='price'?'annual_price':'annual_expenses')+'"]');field?.focus();field?.scrollIntoView({behavior:'smooth',block:'center'});}}/>

  {!embedded&&<p className="annual-actual-confirmation">Требуется подтверждение: сбыт и финансовая служба проверяют цены и расходы выбранного решения</p>}
 </section>;
}
