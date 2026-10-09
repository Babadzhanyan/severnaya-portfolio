// Оценка одного рычага сохраняет денежную пользу, мощность, капитал и риск отдельно
export const mechanismKinds=['resource','yield','quality','budget','working_capital','hours','risk'];
const numeric=(v,name,min=0)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min)throw new Error(`Поле «${name}» требует конечное число от ${min}`);return v;};
const optional=(v,name,min=0)=>v==null?null:numeric(v,name,min);
const periodKey=v=>String(v||'').replace(/\s+/g,'').replace(/[—-]/g,'–').toLocaleLowerCase('ru');

export function mechanismCase(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||!mechanismKinds.includes(input.kind))throw new Error('Расчёт требует предусмотренный способ');
 const {kind}=input,quantity=numeric(input.quantity,'Объём'),baseline=numeric(input.baseline,'База'),target=numeric(input.target,'Цель');
 const rate=optional(input.rate,'Удельный вклад / цена ресурса'),extra=optional(input.additional_opex,'Дополнительные операционные расходы',-Infinity),da=optional(input.additional_depreciation,'Дополнительная амортизация',-Infinity);
 const defaultUnits={resource:'per_unit',yield:'percent',quality:'percent',budget:'percent',working_capital:'days',hours:'minutes',risk:'percent'};
 const aliases={'%':'percent','п.п.':'percent','доля':'fraction','мин/операцию':'minutes','ч/операцию':'hours','дни':'days'};
 const unit=aliases[input.metricUnit]||input.metricUnit||defaultUnits[kind];
 const allowed={resource:['per_unit'],yield:['percent','fraction'],quality:['percent','fraction'],budget:['percent','fraction'],working_capital:['days'],hours:['minutes','hours'],risk:['percent','fraction']};
 if(!allowed[kind].includes(unit))throw new Error('Показатель требует единицу своего способа расчёта');
 if(['percent','fraction'].includes(unit)&&Math.max(baseline,target)>(unit==='percent'?100:1))throw new Error('Показатель требует долю от 0 до 100%');
 const months=input.months??null;
 if(months!==null&&(!Number.isInteger(months)||months<1||months>12))throw new Error('Период требует от 1 до 12 месяцев');
 if(input.period!=null&&typeof input.period!=='string')throw new Error('Период требует текстовую подпись');
 const period=input.period?.trim()||'Выбранный период';
 const monetization=optional(input.monetization,'Доля монетизации');
 if(monetization!==null&&monetization>1)throw new Error('Монетизация требует долю от 0 до 1');
 const delta=target-baseline,scale=unit==='percent'?100:1;
 let gross=null,hours=null,cash=null,risk=null,physical=null;
 if(kind==='resource'){physical=quantity*(baseline-target);gross=rate===null?null:physical*rate;}
 if(['yield','quality'].includes(kind)){physical=quantity*delta/scale;gross=rate===null?null:physical*rate;}
 if(kind==='budget')gross=quantity*(baseline-target)/scale;
 if(kind==='working_capital')cash=quantity*(baseline-target);
 if(kind==='hours'){hours=quantity*(baseline-target)/(unit==='minutes'?60:1);gross=monetization===0?0:rate===null||monetization===null?null:hours*rate*monetization;}
 if(kind==='risk')risk=quantity*(baseline-target)/scale;
 const ebitda=gross===null||extra===null?null:gross-extra;
 const comparable=!input.depreciation_period||periodKey(input.depreciation_period)===periodKey(period);
 const ebit=ebitda===null||da===null||!comparable?null:ebitda-da;
 const requirements=[];
 if(['resource','yield','quality'].includes(kind)&&rate===null)requirements.push('Удельный вклад / цена ресурса');
 if(kind==='hours'&&monetization===null)requirements.push('Доля монетизации часов');
 if(kind==='hours'&&monetization!==0&&rate===null)requirements.push('Избегаемая стоимость часа');
 if(!['working_capital','risk'].includes(kind)&&extra===null)requirements.push('Дополнительные операционные расходы');
 return {kind,period,months,metric_unit:unit,scope:'Оценка одного рычага',physical_change:physical,hours_released:hours,
  period_gross_benefit:gross,period_delta_ebitda:ebitda,period_delta_ebit:ebit,
  annual_gross_benefit:gross===null||months===null?null:gross*12/months,
  annual_delta_ebitda:ebitda===null||months===null?null:ebitda*12/months,
  annual_delta_ebit:ebit===null||months===null?null:ebit*12/months,
  one_off_cash_release:cash,expected_risk_reduction:risk,
  additional_opex:extra,additional_depreciation:da,depreciation_period_comparable:comparable,
  approved_delta_ebitda:null,financial_approval:false,
  status:requirements.length?'Требуются параметры':'Оценка рассчитана',requirements};
}
