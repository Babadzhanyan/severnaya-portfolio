import schema from './schema.js';
import config from './live-config.js';
import {dateText,dateTimeText,display} from '../model/portfolio.js';
import {normalizeExecutionFact} from '../model/execution.js';
export function decodeValue(cell){
 if(!cell||cell.v===null||cell.v===undefined)return null;
 const value=cell.v;if(typeof value!=='string')throw new Error('Google Sheets передаёт ячейку для повторной проверки');
 const prefix=value.slice(0,2),body=value.slice(2);
 if(prefix==='z:')return null;if(prefix==='s:')return body;
 if(prefix==='n:'){const normalized=body.replace(/[\s\u00a0]/g,'').replace(',','.');if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized)||!Number.isFinite(Number(normalized)))throw new Error('Google Sheets передаёт число для повторной проверки');return Number(normalized);}
 if(prefix==='b:'&&['0','1'].includes(body))return body==='1';
 throw new Error(prefix==='e:'?'Google Sheets сообщает об ошибке исходной ячейки':'Google Sheets передаёт ячейку для повторной проверки');
}
export function projectResponse(response,receivedAt=new Date().toISOString()){
 if(response.status!=='ok'||!Array.isArray(response.table?.rows))throw new Error('Google Sheets ожидает доступ по ссылке и исправные формулы');
 const rows=response.table.rows;if(rows.length!==config.blocks.at(-1).feedLast||response.table.cols?.length!==config.transportColumns)throw new Error('Требуется полный состав данных Google Sheets');
 const grids=new Map([...new Set(config.blocks.map(b=>b.sheet))].map(v=>[v,new Map()]));
 for(const b of config.blocks)for(let r=0;r<=b.feedLast-b.feedFirst;r++)for(let c=0;c<b.columns;c++){const value=decodeValue(rows[b.feedFirst-1+r]?.c?.[c]);if(value!==null)grids.get(b.sheet).set(`${b.firstSourceRow+r}:${b.firstSourceColumn+c}`,value);}
 const get=(r,c,s='Реестр инициатив')=>grids.get(s).get(`${r}:${c}`)??null;
 const colNo=s=>[...s].reduce((a,c)=>a*26+c.charCodeAt(0)-64,0);
 const table=(key,keys,dates=[],keep=(x)=>!!x[keys[0]])=>{const b=config.blocks.find(x=>x.key===key);return Array.from({length:b.feedLast-b.feedFirst+1},(_,r)=>Object.fromEntries([['_row',b.firstSourceRow+r],...keys.map((key,c)=>[key,dates.includes(key)?dateText(get(b.firstSourceRow+r,b.firstSourceColumn+c,b.sheet)):get(b.firstSourceRow+r,b.firstSourceColumn+c,b.sheet)])])).filter(keep);};
 const initiatives=[];const unique=new Set();
 for(let r=7;r<=226;r++){const code=get(r,1);if(!code)continue;if(!/^ИТ-\d{3}$/.test(code)||unique.has(code))throw new Error('Реестр требует уникальные коды ИТ-001');unique.add(code);
  const i={_row:r,_source_row:r-4};for(const f of schema.columns){const value=get(r,colNo(f.column));i[f.key]=f.type==='datetime'?dateTimeText(value):f.type==='date'?dateText(value):value;}
  if(i.digital_layer!==null&&i.digital_layer!==''&&!schema.lists.digital_layer.includes(i.digital_layer))throw new Error('Уровень трансформации требует значение из справочника');
  const raw=String(i.sources||'');const meta=raw.match(/Паспортные метаданные: (\{[^\n]+\})/);let p={};if(meta){try{p=JSON.parse(meta[1]);}catch{throw new Error('Требуется проверка происхождения '+code);}}
  let configuredLocation=config.recordLocations?.[String(r)];
  if(config.sourcePartitionPolicy==='ranges'){
   const main=config.actualBlocks?.initiatives,idea=config.actualBlocks?.ideas,block=config.blocks.find(b=>b.key==='initiatives');
   const last=Number(String(main?.sourceRange||'').match(/:[A-Z]+(\d+)$/)?.[1]),mainCount=last-Number(main?.firstDataRow)+1;
   if(!Number.isSafeInteger(mainCount)||mainCount<1||mainCount>220||!idea||!block)throw new Error('Диапазоны реестра требуют проверку состава');
   const boundary=block.firstSourceRow+mainCount;
   configuredLocation=r>=boundary?{sheetId:idea.sheetId,sheetName:idea.sheetName,row:idea.firstDataRow+r-boundary}:undefined;
  }
  if(configuredLocation&&p.primary)throw new Error('Первичная инициатива '+code+' требует строку основного реестра');const sourceLocation=config.recordLocations!==undefined?configuredLocation?{sheet_id:configuredLocation.sheetId,sheet:configuredLocation.sheetName,row:configuredLocation.row}:{sheet_id:config.masterSheetId,sheet:schema.sheet,row:r-4}:p.source_location; if(sourceLocation!==undefined){if(!sourceLocation||typeof sourceLocation!=='object'||Array.isArray(sourceLocation)||!Number.isSafeInteger(sourceLocation.row)||sourceLocation.row<3||!Number.isSafeInteger(sourceLocation.sheet_id)||sourceLocation.sheet_id<0)throw new Error('Источник '+code+' требует проверенный лист и строку');i._source_row=sourceLocation.row;i._source_sheet_id=sourceLocation.sheet_id;i._source_sheet=String(sourceLocation.sheet||'');}else{i._source_sheet_id=config.masterSheetId;i._source_sheet=schema.sheet;}
  if(config.ideasSheetId!==undefined)i.collection=i._source_sheet_id===config.ideasSheetId?'ideas':'projects';
  i.provenance={assessment:p.assessment||null,legal_obligations:Array.isArray(p.legal_obligations)?p.legal_obligations:[],legal_review:p.legal_review||null,calendar_alignment:p.calendar_alignment||null,origin:p.primary?'primary':'addition',original_title:p.original_title,original_code:p.original_code,code_is_primary:p.code_is_primary,sources:p.primary_occurrences||[],retired_aliases:p.retired_aliases||p.consolidated_aliases||p.aliases||[],merged_titles:p.merged_titles||[],fields:Object.fromEntries(Object.entries(p.fields||{}).map(([k,v])=>[k,{origin:v.kind==='Расчёт'?'formula':['Первичный источник','Три первичных файла'].includes(v.kind)?'primary':'addition',category:v.kind,source:v.reason}]))};
  i.execution_fact=normalizeExecutionFact(p.execution_fact);
  i.candidate_employee=display(i.initiative_lead||'Требуется назначение');i.business_stage=String(i.process||'Требуется привязка').split(' / ')[0];i.additional_business_stages=(raw.match(/Дополнительные участки: ([^\n]+)/)?.[1]||'').split(', ').filter(v=>v&&v!=='Связи уточняет владелец');initiatives.push(i);
 }
 if(!initiatives.length)throw new Error('Источник передаёт заполненный реестр инициатив');const aliases=initiatives.flatMap(i=>i.provenance.retired_aliases);if(new Set(aliases).size!==aliases.length||aliases.some(code=>unique.has(code)))throw new Error('Прежние коды требуют единственную связь с текущим паспортом');
 const staff=table('staff',['employee','it_group','role','curator','assignment_status','assigned_count','in_work_count','historical_count','source']);
 const params=table('parameters',['code','process','name','unit','value','period','source','approved_by','approved_at','readiness','applicability'],['approved_at']);
 const details={};
 for(const[key,keys,dates]of[
 ['plan',['code','result','start','end','owner','predecessor','readiness'],['start','end']],
 ['resources',['code','it_group','total_hours','q1','q2','q3','q4','confirmed_by','confirmed_at','readiness','decision','capacity_status'],['confirmed_at']],
 ['decisions',['code','type','date','approved_by','document','conditions','readiness'],['date']],
 ['actuals',['code','date','actual_cost','forecast_cost','actual_hours','forecast_hours','actual_metric','actual_effect','forecast_finish','source','readiness'],['date','forecast_finish']],
 ['capacity',['it_group','q1','q2','q3','q4','remaining_q1','remaining_q2','remaining_q3','remaining_q4','confirmed_by','confirmed_at'],['confirmed_at']],
 ['levers',['code','method','quantity_parameter','price_parameter','baseline','target','metric','annual_ebitda','ebitda_2027','cash_2027','readiness','year_fraction','coverage','ramp','cash_realization','labor_monetization','one_off_ebitda_cost','running_ebitda_cost','quantity','price','unit','source','risk_expected','physical_hours','gross_ebitda_2027','mechanism','effect_group','decision','effect_role','effect_start','cash_cost_ratio','cash_per_hour'],['effect_start']],
 ['ledger',['code','title','it_group','lead','stage','decision','effect_group','effect_role','confirmation','annual_potential','ebitda_2027','cash_2027','hours'],[]],
 ['previousSnapshot',['code','stage','decision','effect_group','effect_role','annual_potential','ebitda_2027','cash_2027','hours','confirmation','year','method'],[]],
 ['tracker',['stage','count','count_delta','confirmed_count','annual_potential','ebitda_2027','ebitda_delta','cash_2027','hours','hours_estimates','action','codes'],[]]
 ])details[key]=table(key,keys,dates);
 for(const i of initiatives){const member=staff.find(s=>s.employee===i.candidate_employee);i.staff_department=member?.it_group??null;i.staff_curator=member?.curator??null;const deliveryGroup=String(i.it_group??'').trim();const coordinator=deliveryGroup?staff.find(s=>s.it_group===deliveryGroup):member;if(!deliveryGroup&&member)i.it_group=member.it_group;i.curator=display(coordinator?.curator||'Требуется куратор');}
 const history=table('annualHistory',['name','_1','_2','_3','value','_5','unit','period','_8','source','_10']).map(({name,value,unit,period,source})=>({name,value,unit,period,source}));
 const scenario=config.blocks.find(b=>b.key==='productionScenario'||b.key==='productionInput'||b.key==='productionInputJSON');let productionInput=null;if(scenario){const raw=get(scenario.firstSourceRow,scenario.firstSourceColumn,scenario.sheet);if(raw){try{productionInput=typeof raw==='string'?JSON.parse(raw):raw;}catch{throw new Error('Лист «Калькулятор EBITDA» требует проверку структуры расчёта');}}}
 const annualBlock=config.blocks.find(b=>b.key==='annualActualInputJSON');let annualActualInput=null;if(annualBlock){const raw=get(annualBlock.firstSourceRow,annualBlock.firstSourceColumn,annualBlock.sheet);if(raw){try{annualActualInput=typeof raw==='string'?JSON.parse(raw):raw;}catch{throw new Error('Годовой расчёт требует проверку исходных данных');}}}
 const modelTables=Object.fromEntries(config.blocks.filter(b=>!['snapshot','initiatives','stageDeadlines','plan','resources','decisions','actuals','capacity','levers','ledger','previous_meta','previousSnapshot','parameters','staff','annualHistory','tracker','productionInputJSON','productionScenario','productionInput'].includes(b.key)).map(b=>[b.key,{values:Array.from({length:b.feedLast-b.feedFirst+1},(_,r)=>Array.from({length:b.columns},(_,c)=>get(b.firstSourceRow+r,b.firstSourceColumn+c,b.sheet))),sourceSheet:config.actualBlocks?.[b.key]?.sheetName,sourceRange:config.actualBlocks?.[b.key]?.sourceRange}]));
 return {schemaVersion:config.schemaVersion,modelTables,productionInput,annualActualInput,retiredAliasCount:aliases.length,originalRecordCount:initiatives.length+aliases.length,sourceMode:'google',sourceUrl:`https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit#gid=${config.masterSheetId}`,receivedAt,asOf:dateText(get(1,10)),previousAsOf:dateText(get(2325,3)),snapshotMethod:get(2325,7),pmoCurator:get(2325,9),portfolioCurator:get(2325,9),director:staff.find(s=>/^(?:Руководитель (?:отдела|департамента) ИТ|Директор)/i.test(String(s.role)))?.employee||'Сергей Белов',fileName:'Google Sheets / Портфель инициатив ИТ 2027',cacheReady:true,dirty:false,initiatives,staff,parameters:params,annualHistory:history,...details,schema,provenance:Object.fromEntries(initiatives.map(i=>[i.code,i.provenance]))};
}
