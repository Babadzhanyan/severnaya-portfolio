const finite=value=>typeof value==='number'&&Number.isFinite(value);

export function deferProductionOpex(result){
 if(result==null)return result;
 const pending=structuredClone(result);
 pending.target={...pending.target,ebitda:null,extra_opex_delta:null};
 for(const key of ['period_delta_ebitda','period_delta_ebit','annual_run_rate_delta','annual_run_rate_delta_ebit','approved_delta_ebitda','approved_delta_ebit','approved_annual_run_rate_delta','approved_annual_run_rate_delta_ebit','bridge_sum','bridge_residual'])pending[key]=null;
 pending.status='Требуются дополнительные расходы';
 pending.estimate_status='Требуется расчёт';
 pending.ebit_status='Требуется расчёт';
 pending.financial_approval=false;
 pending.absolute_ebitda_complete=false;
 pending.confirmation_fields=[...new Set([...(pending.confirmation_fields||[]),'Дополнительные операционные расходы'])];
 pending.ebit_confirmation_fields=[...new Set([...(pending.ebit_confirmation_fields||[]),'Финансовое согласование дополнительных расходов'])];
 return pending;
}

export function applyProductionOpex(result,{otherMillion=0,itMillion=0}={}){
 if(!finite(otherMillion)||!finite(itMillion)||itMillion<0)throw new Error('Дополнительные расходы требуют заполненные конечные числа; сопровождение ИТ – от нуля');
 const extra=(otherMillion+itMillion)*1e6;
 if(!finite(extra))throw new Error('Дополнительные расходы превышают допустимый числовой диапазон');
 if(result==null)return result;
 const next=structuredClone(result),changed=otherMillion!==0||itMillion!==0;
 next.extra_opex_delta=extra;
 next.extra_opex_inputs={otherMillion,itMillion};
 if(next.target)next.target.extra_opex_delta=extra;
 if(!changed)return next;
 if(!Number.isInteger(next.months)||next.months<1||next.months>12)throw new Error('Период дополнительных расходов требует от 1 до 12 месяцев');
 const subtract=(value,amount=extra)=>{if(!finite(value))return null;const shifted=value-amount;if(!finite(shifted))throw new Error('Результат расходов превышает допустимый числовой диапазон');return shifted;},annualExtra=extra*12/next.months;
 if(!finite(annualExtra))throw new Error('Годовой темп расходов превышает допустимый числовой диапазон');
 next.period_delta_ebitda=subtract(next.period_delta_ebitda);
 next.period_delta_ebit=subtract(next.period_delta_ebit);
 for(const key of ['annual_run_rate_delta','annual_run_rate_delta_ebit'])next[key]=subtract(next[key],annualExtra);
 // Поправка содержит переменные и постоянные статьи, поэтому сохраняет отдельную составляющую расходов
 if(next.target)next.target.ebitda=subtract(next.target.ebitda);
 next.bridge=[...(next.bridge||[]),{code:'extra_opex',name:'Дополнительные операционные расходы',rub:extra===0?0:-extra}];
 next.bridge_sum=next.bridge.every(row=>finite(row.rub))?next.bridge.reduce((sum,row)=>sum+row.rub,0):null;
 next.bridge_residual=finite(next.period_delta_ebitda)&&finite(next.bridge_sum)?next.period_delta_ebitda-next.bridge_sum:null;
 if(finite(next.period_delta_ebitda))next.estimate_basis=(next.estimate_basis||'base_result')+'_plus_additional_opex';
 for(const key of ['approved_delta_ebitda','approved_annual_run_rate_delta','approved_delta_ebit','approved_annual_run_rate_delta_ebit'])next[key]=null;
 next.financial_approval=false;
 next.status='На согласовании';
 next.confirmation_fields=[...new Set([...(next.confirmation_fields||[]),'Дополнительные операционные расходы'])];
 next.ebit_confirmation_fields=[...new Set([...(next.ebit_confirmation_fields||[]),'Финансовое согласование дополнительных расходов'])];
 if(finite(next.period_delta_ebit))next.ebit_status='Оценка рассчитана';
 return next;
}
