(function(){
  'use strict';
  const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  let state=null;
  const children=(node,tag)=>Array.from(node.getElementsByTagNameNS(NS,tag));
  const direct=(node,tag)=>Array.from(node.children).find(x=>x.localName===tag);
  const xml=(text)=>{const d=new DOMParser().parseFromString(text,'application/xml');if(d.getElementsByTagName('parsererror').length)throw new Error('Файл содержит повреждённую таблицу XML');return d;};
  const serialize=d=>new XMLSerializer().serializeToString(d);
  const normalized=p=>{const out=[];for(const x of p.split('/')){if(x==='..')out.pop();else if(x&&x!=='.')out.push(x);}return out.join('/');};
  const resolve=(base,target)=>target.startsWith('/')?target.slice(1):normalized(base.slice(0,base.lastIndexOf('/')+1)+target);
  const colNo=c=>Array.from(c).reduce((a,x)=>a*26+x.charCodeAt(0)-64,0);
  const colText=n=>{let c='';for(;n;n=Math.floor((n-1)/26))c=String.fromCharCode(65+(n-1)%26)+c;return c;};
  const dateText=n=>typeof n==='number'?new Date(Math.round((n-25569)*86400000)).toISOString().slice(0,10):n||null;
  const dateSerial=s=>Math.round(Date.parse(s+'T00:00:00Z')/86400000)+25569;
  const isNumber=v=>typeof v==='number'&&Number.isFinite(v);

  const shiftRef=(ref,origin,sign=1)=>ref.replace(/([A-Z]+)(\d+)/g,(_,c,r)=>colText(colNo(c)+sign*(origin?.column||0))+(Number(r)+sign*(origin?.row||0)));
  const logicalRef=(ref,sheet)=>shiftRef(ref,sheet?.origin,-1);
  const physicalRef=(ref,sheet)=>shiftRef(ref,sheet?.origin,1);
  const cellMap=sheet=>new Map(children(sheet.doc,'c').map(c=>[logicalRef(c.getAttribute('r'),sheet),c]));
  function inferOrigin(names,key,expectedRow){const ref=names.get(key)||'',m=ref.match(/!\$?([A-Z]+)\$?(\d+)/);return m?{column:colNo(m[1])-1,row:Number(m[2])-expectedRow}:{column:0,row:0};}

  const rowNo=r=>Number(r.match(/\d+$/)[0]);
  const scanRef=ref=>{const m=ref.replace(/\$/g,'').match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);if(!m)return null;return{first:Number(m[2]),last:Number(m[4]),startCol:colNo(m[1]),endCol:colNo(m[3]),header:Number(m[2])};};
  const value=(cell,strings)=>{
    if(!cell)return null;const t=cell.getAttribute('t'),v=direct(cell,'v');
    if(t==='inlineStr')return children(cell,'t').map(x=>x.textContent).join('');
    if(!v)return null;
    if(t==='s')return strings[Number(v.textContent)]??'';
    if(t==='str')return v.textContent||null;
    if(t==='e')throw new Error('Файл содержит ошибку '+v.textContent+' в ячейке '+cell.getAttribute('r'));
    if(t==='b')return v.textContent==='1';
    return v.textContent===''?null:Number(v.textContent);
  };

  const viewSheet=name=>(state.viewSheets||state.sheets).get(name);
  function locationOf(raw){if(!raw||!raw.includes('!'))return null;const k=raw.lastIndexOf('!'),name=raw.slice(0,k).replace(/^'|'$/g,'').replace(/''/g,"'"),ref=raw.slice(k+1).replace(/\$/g,''),m=ref.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);return m?{sheet:name,firstColumn:colNo(m[1]),firstRow:Number(m[2]),lastColumn:colNo(m[3]||m[1]),lastRow:Number(m[4]||m[2])}:null;}
  function makePartitionedView(next,rawNames){
    const mainName=window.PMOSchema.sheet,modelName='Модель эффекта';next.viewSheets=new Map();next.logicalMappings=new Map();next.layoutLocations={};next.partitioned=true;
    for(const name of [mainName,modelName]){const doc=xml('<worksheet xmlns="'+NS+'"><sheetData/></worksheet>');next.viewSheets.set(name,{name,doc,cells:new Map(),tables:new Map(),origin:{row:0,column:0},virtual:true});}
    const blocks=[
      ['initiatives','PMO_Initiatives2027',mainName,6,226,46,'Initiatives2027'],
      ['plan','PMO_Plan2027',mainName,260,1100,7,'Plan2027'],
      ['resources','PMO_Resource2027',mainName,1120,1420,12,'Resource2027'],
      ['decisions','PMO_Decisions2027',mainName,1440,1740,7,'Decisions2027'],
      ['actuals','PMO_Actual2027',mainName,1770,1970,11,'Actual2027'],
      ['capacity','PMO_Capacity2027',mainName,1991,1999,11,'Capacity2027'],
      ['tracker','PMO_Tracker2027',mainName,2035,2043,12,'Tracker2027'],
      ['ledger','PMO_PortfolioLedger',mainName,2090,2310,13,'PortfolioLedger'],
      ['previousSnapshot','PMO_PreviousSnapshot',mainName,2329,2549,12,'PreviousSnapshot'],
      ['parameters','PMO_Parameters2027',modelName,19,100,11,'Parameters2027'],
      ['levers','PMO_Levers2027',modelName,110,430,32,'Levers2027'],
      ['staff','PMO_Team2027',modelName,463,506,9,'Team2027'],
      ['annualHistory','PMO_AnnualHistory2027',modelName,644,666,11,'AnnualHistory2027']
    ];
    for(const [key,named,viewName,header,last,width,table]of blocks){
      const loc=locationOf(rawNames.get(named));if(!loc||!next.sheets.has(loc.sheet))throw new Error('Рабочая книга содержит именованный диапазон '+named);
      if(loc.firstRow!==2||loc.firstColumn!==2)throw new Error('Таблица '+loc.sheet+' начинается с B2');
      if(loc.lastColumn-loc.firstColumn+1<width&&!(key==='annualHistory'&&loc.lastColumn-loc.firstColumn+1===5))throw new Error('Таблица '+loc.sheet+' содержит полный состав полей');
      next.layoutLocations[key]={...loc,headerRow:2,firstDataRow:3};
      const virtual=next.viewSheets.get(viewName),real=next.sheets.get(loc.sheet);virtual.tables.set(table,'A'+header+':'+colText(width)+last);next.names.set(named,"'"+viewName+"'!A"+header+':'+colText(width)+last);
      for(let row=header+1;row<=last;row++)for(let col=1;col<=width;col++){
        const compactHistory=key==='annualHistory'&&loc.lastColumn-loc.firstColumn+1===5,historyCol={1:0,5:1,7:2,8:3,10:4};if(compactHistory&&historyCol[col]===undefined)continue;const logical=colText(col)+row,actual=colText(loc.firstColumn+(compactHistory?historyCol[col]:col-1))+(loc.firstRow+row-header);
        next.logicalMappings.set(viewName+'!'+logical,{sheet:loc.sheet,ref:actual});
        const cell=real.cells.get(actual);if(cell)virtual.cells.set(logical,cell);
      }
    }
    for(const [named,virtualRef]of [['PMO_SnapshotDate','J1'],['PMO_PreviousSnapshotDate','C2325'],['PMO_SnapshotMethod','G2325'],['PMO_PortfolioCurator','I2325']]){
      const loc=locationOf(rawNames.get(named));if(!loc||!next.sheets.has(loc.sheet))throw new Error('Настройки книги содержат именованный параметр '+named);
      const actual=colText(loc.firstColumn)+loc.firstRow,cell=next.sheets.get(loc.sheet).cells.get(actual);next.logicalMappings.set(mainName+'!'+virtualRef,{sheet:loc.sheet,ref:actual});if(cell)next.viewSheets.get(mainName).cells.set(virtualRef,cell);next.names.set(named,"'"+mainName+"'!"+virtualRef);
    }
  }

  const read=(sheet,ref)=>value(sheet.cells.get(ref),state.strings);
  const tableRange=(sheet,name,fallback)=>{
    const native=sheet.tables.get(name);if(native)return scanRef(native);
    const named=state.names.get('PMO_'+name);if(named){const ref=named.slice(named.lastIndexOf('!')+1);const found=scanRef(ref);if(found)return found;}
    return fallback;
  };
  const tableRows=(sheet,range,keys,dateKeys=[])=>{
    const rows=[];if(!range)return rows;
    for(let r=range.header+1;r<=range.last;r++){
      const out={_row:r,_sheet:sheet.name};
      keys.forEach((key,i)=>{let v=read(sheet,colText(range.startCol+i)+r);if(dateKeys.includes(key))v=dateText(v);out[key]=v;});
      if(out[keys[0]]!==null&&out[keys[0]]!=='')rows.push(out);
    }
    return rows;
  };
  function refresh(){
    const schema=window.PMOSchema,main=viewSheet(schema.sheet),model=viewSheet('Модель эффекта');
    if(!main||!model)throw new Error('Реестр должен содержать листы «Реестр инициатив» и «Модель эффекта»');
    const master=tableRange(main,'Initiatives2027',{header:6,last:226,startCol:1,endCol:46});
    state.masterRange=master;const seen=new Set();
    const initiatives=[];
    for(let r=master.header+1;r<=master.last;r++){
      const code=read(main,'A'+r);if(code===null||code==='')continue;
      if(seen.has(String(code)))throw new Error('Код '+code+' встречается в реестре повторно');seen.add(String(code));
      const record={_row:r,_sheet:main.name};
      for(const item of schema.columns){let v=read(main,item.column+r);if(item.type==='date')v=dateText(v);record[item.key]=v;}
      record.business_stage=String(record.process||'Требуется привязка').split(' / ')[0];
      record.candidate_employee=String(record.initiative_lead||'Требуется назначение').replace(/^Гипотеза:\s*/,'');
      const archive=String(record.sources||'');const related=archive.match(/Дополнительные участки: ([^\n]+)/);
      record.additional_business_stages=related?related[1].split(', ').filter(v=>v!=='Связи уточняет владелец'):[];
      record.assignment_status=String(record.initiative_lead||'').startsWith('Гипотеза:')?'Гипотеза':record.updated_by&&record.updated_at&&!/Гипотеза|Уточнить|Требуется/i.test(record.updated_by)?'Подтверждено владельцем':'Требуется подтверждение назначения';
      const metadata=archive.match(/Паспортные метаданные: (\{[^\n]+\})/);
      if(metadata){try{const p=JSON.parse(metadata[1]);record.provenance={origin:p.primary?'primary':'addition',code_is_primary:p.code_is_primary,original_title:p.original_title,original_code:p.original_code,original_code_is_primary:p.original_code_is_primary,sources:p.primary_occurrences||[],fields:Object.fromEntries(Object.entries(p.fields||{}).map(([key,v])=>[key,{origin:v.kind==='Расчёт'?'formula':['Первичный источник','Три первичных файла'].includes(v.kind)?'primary':'addition',category:v.kind,source:v.reason}]))};}catch(e){record.provenance={origin:'addition',fields:{},confirmation:'Требуется сверка маркировки'};}}
      for(const change of state.changes.values())if(change.kind==='master'&&change.id===record.code){record.provenance=record.provenance||{origin:'addition',fields:{}};record.provenance.fields[change.key]={origin:'addition',category:'Дополнение',source:'Правка пользователя в текущем файле'};}
      initiatives.push(record);
    }
    const detailKeys={plan:['code','result','start','end','owner','predecessor','readiness'],resources:['code','it_group','total_hours','q1','q2','q3','q4','confirmed_by','confirmed_at','readiness','decision','capacity_status'],decisions:['code','type','date','approved_by','document','conditions','readiness'],actuals:['code','date','actual_cost','forecast_cost','actual_hours','forecast_hours','actual_metric','actual_effect','forecast_finish','source','readiness'],capacity:['it_group','q1','q2','q3','q4','remaining_q1','remaining_q2','remaining_q3','remaining_q4','confirmed_by','confirmed_at']};
    const details={};
    for(const [name,s]of Object.entries(schema.detail_tables))details[name]=tableRows(main,tableRange(main,s.name,{header:s.header,last:s.last,startCol:1,endCol:s.columns}),detailKeys[name],['start','end','date','confirmed_at','forecast_finish']);
    const staff=tableRows(model,tableRange(model,'Team2027',{header:463,last:506,startCol:1,endCol:9}),['employee','it_group','role','curator','assignment_status','assigned_count','in_work_count','historical_count','source']);
    const parameters=tableRows(model,tableRange(model,'Parameters2027',{header:19,last:100,startCol:1,endCol:11}),['code','process','name','unit','value','period','source','approved_by','approved_at','readiness','applicability'],['approved_at']);
    const leverKeys=['code','method','quantity_parameter','price_parameter','baseline','target','metric','annual_ebitda','ebitda_2027','cash_2027','readiness','year_fraction','coverage','ramp','cash_realization','labor_monetization','one_off_ebitda_cost','running_ebitda_cost','quantity','price','unit','source','risk_expected','physical_hours','gross_ebitda_2027','mechanism','effect_group','decision','effect_role','effect_start','cash_cost_ratio','cash_per_hour'];
    const levers=tableRows(model,tableRange(model,'Levers2027',{header:110,last:430,startCol:1,endCol:32}),leverKeys,['effect_start']);
    const ledgerRange=tableRange(main,'PortfolioLedger',{header:2090,last:2310,startCol:1,endCol:13});
    const ledger=tableRows(main,ledgerRange,['code','title','it_group','lead','stage','decision','effect_group','effect_role','confirmation','annual_potential','ebitda_2027','cash_2027','hours']);
    const previousSnapshot=tableRows(main,tableRange(main,'PreviousSnapshot',{header:2329,last:2549,startCol:1,endCol:12}),['code','stage','decision','effect_group','effect_role','annual_potential','ebitda_2027','cash_2027','hours','confirmation','year','method']);
    const annualHistory=[];for(let r=645;r<=666;r++){const name=read(model,'A'+r);if(name)annualHistory.push({name,value:read(model,'E'+r),unit:read(model,'G'+r),period:read(model,'H'+r),source:read(model,'J'+r)});}
    const currentDateRef=state.names.get('PMO_SnapshotDate')?.split('!').pop().replace(/\$/g,'')||'J1';
    const priorDateRef=state.names.get('PMO_PreviousSnapshotDate')?.split('!').pop().replace(/\$/g,'')||'C2325';
    const cacheReady=state.mode==='google'||Array.from(main.cells.values()).filter(c=>direct(c,'f')).some(c=>direct(c,'v'));
    const snapshotMethod=read(main,'G2325');const directorName=state.names.get('PMO_PortfolioCurator')||'';const director=directorName.includes('!')?read(main,directorName.split('!').pop().replace(/\$/g,'')):directorName.replace(/^"|"$/g,'');
    const tracker=tableRows(main,{header:2035,last:2043,startCol:1,endCol:12},['stage','count','count_delta','confirmed_count','annual_potential','ebitda_2027','ebitda_delta','cash_2027','hours','hours_estimates','action','codes']);
    const data={schemaVersion:9,layoutLocations:state.layoutLocations||null,sourceMode:state.mode||'local',sourceOrigin:state.sourceOrigin||viewSheet(schema.sheet)?.origin||{row:0,column:0},sourceUrl:state.sourceUrl||null,receivedAt:state.receivedAt||null,snapshotMethod,tracker,pmoCurator:director,portfolioCurator:director,director:staff.find(s=>/^(?:Руководитель (?:отдела|департамента) ИТ|Директор)/i.test(String(s.role||'')))?.employee||'Руководитель ИТ',fileName:state.fileName,fileHash:state.hash,asOf:dateText(read(main,currentDateRef)),previousAsOf:dateText(read(main,priorDateRef)),dirty:state.changes.size>0,cacheReady,initiatives,...details,staff,parameters,levers,annualHistory,ledger,previousSnapshot,schema,provenance:Object.fromEntries(initiatives.map(i=>[i.code,i.provenance||{origin:'addition',fields:{}}]))};
    const curator=new Map(staff.map(s=>[s.employee,s.curator]));for(const i of initiatives)i.curator=curator.get(i.candidate_employee)||'Требуется назначение';
    if(data.dirty){for(const i of initiatives){for(const field of schema.columns.filter(x=>x.type==='formula'))i[field.key]=null;i.admission='Требуется пересчёт в Excel';}for(const row of ledger){row.confirmation='Требуется пересчёт в Excel';for(const k of ['annual_potential','ebitda_2027','cash_2027','hours'])row[k]=null;}}
    for(const i of initiatives){const employee=staff.find(s=>s.employee===i.candidate_employee);if(employee)i.it_group=employee.it_group;}
    state.data=data;window.PMOData=data;window.dispatchEvent(new CustomEvent('pmo-data',{detail:data}));return data;
  }
  const sha=async buffer=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))).map(b=>b.toString(16).padStart(2,'0')).join('');
  async function importFile(file){
    if(!/\.xlsx$/i.test(file.name))throw new Error('Выберите файл реестра в формате XLSX');
    if(file.size>50*1024*1024)throw new Error('Реестр должен занимать до 50 МБ');
    const buffer=await file.arrayBuffer(),zip=await JSZip.loadAsync(buffer);
    const parse=async path=>{const f=zip.file(path);if(!f)throw new Error('Книга содержит повреждённую ссылку на '+path);return xml(await f.async('string'));};
    const workbook=await parse('xl/workbook.xml'),rels=await parse('xl/_rels/workbook.xml.rels');
    const mappings=new Map(Array.from(rels.documentElement.children).map(x=>[x.getAttribute('Id'),resolve('xl/workbook.xml',x.getAttribute('Target'))]));
    const strings=zip.file('xl/sharedStrings.xml')?children(await parse('xl/sharedStrings.xml'),'si').map(si=>children(si,'t').map(t=>t.textContent).join('')):[];
    const rawNames=new Map(children(workbook,'definedName').map(n=>[n.getAttribute('name'),n.textContent]));const partitioned=locationOf(rawNames.get('PMO_Initiatives2027'))?.firstRow===2;
    const origins=new Map([[window.PMOSchema.sheet,inferOrigin(new Map(children(workbook,'definedName').map(n=>[n.getAttribute('name'),n.textContent])),'PMO_Initiatives2027',6)],['Модель эффекта',inferOrigin(new Map(children(workbook,'definedName').map(n=>[n.getAttribute('name'),n.textContent])),'PMO_Parameters2027',19)]]);
    if(partitioned)for(const key of origins.keys())origins.set(key,{row:0,column:0});
    for(const origin of origins.values())if(![0,1].includes(origin.column)||![0,1].includes(origin.row))throw new Error('Рабочая книга использует начало A1 или B2');
    const next={zip,workbook,strings,styles:await parse('xl/styles.xml'),purpleStyles:new Map(),sheets:new Map(),names:new Map(),changes:new Map(),fileName:file.name,hash:await sha(buffer)};
    for(const n of children(workbook,'definedName')){const raw=n.textContent,bang=raw.indexOf('!');if(bang<0)next.names.set(n.getAttribute('name'),raw);else{const name=raw.slice(0,bang).replace(/^'|'$/g,'').replace(/''/g,"'"),origin=origins.get(name);next.names.set(n.getAttribute('name'),raw.slice(0,bang+1)+shiftRef(raw.slice(bang+1).replace(/\$/g,''),origin,-1));}}
    for(const s of children(workbook,'sheet')){
      const name=s.getAttribute('name'),path=mappings.get(s.getAttributeNS(REL,'id'));if(!path)throw new Error('Книга содержит повреждённый лист '+name);
      const doc=await parse(path),sheet={name,path,doc,origin:origins.get(name)||{row:0,column:0},cells:null,tables:new Map()};sheet.cells=cellMap(sheet);
      const relPath=path.slice(0,path.lastIndexOf('/')+1)+'_rels/'+path.slice(path.lastIndexOf('/')+1)+'.rels';
      if(zip.file(relPath)){const sr=await parse(relPath),tm=new Map(Array.from(sr.documentElement.children).map(x=>[x.getAttribute('Id'),resolve(path,x.getAttribute('Target'))]));
        for(const t of children(doc,'tablePart')){const td=await parse(tm.get(t.getAttributeNS(REL,'id')));sheet.tables.set(td.documentElement.getAttribute('name'),logicalRef(td.documentElement.getAttribute('ref'),sheet));}}
      for(const c of sheet.cells.values())value(c,strings);
      next.sheets.set(name,sheet);
    }
    if(partitioned)makePartitionedView(next,rawNames);
    const previous=state;state=next;try{return refresh();}catch(e){state=previous;throw e;}
  }
  function markAddition(cell){
    const key=cell.getAttribute('s')||'0';let id=state.purpleStyles.get(key);
    if(id===undefined){const fills=children(state.styles,'fills')[0],xfs=children(state.styles,'cellXfs')[0];let fillId=Array.from(fills.children).findIndex(f=>children(f,'fgColor').some(c=>c.getAttribute('rgb')==='FFF3ECFA'));
      if(fillId<0){fillId=fills.children.length;const f=state.styles.createElementNS(NS,'fill'),p=state.styles.createElementNS(NS,'patternFill'),c=state.styles.createElementNS(NS,'fgColor');p.setAttribute('patternType','solid');c.setAttribute('rgb','FFF3ECFA');p.append(c);f.append(p);fills.append(f);fills.setAttribute('count',String(fills.children.length));}
      const xf=xfs.children[Number(key)].cloneNode(true);xf.setAttribute('fillId',String(fillId));xf.setAttribute('applyFill','1');id=xfs.children.length;xfs.append(xf);xfs.setAttribute('count',String(xfs.children.length));state.purpleStyles.set(key,id);}
    cell.setAttribute('s',String(id));
  }
  function put(sheet,ref,val,kind){
    if(sheet.virtual){const target=state.logicalMappings.get(sheet.name+'!'+ref);if(!target)throw new Error('Поле соответствует именованному диапазону рабочей книги');const real=state.sheets.get(target.sheet);put(real,target.ref,val,kind);sheet.cells.set(ref,real.cells.get(target.ref));return;}
    let c=sheet.cells.get(ref);
    if(!c){const realRef=physicalRef(ref,sheet),rn=rowNo(realRef),sd=children(sheet.doc,'sheetData')[0];let row=Array.from(sd.children).find(r=>Number(r.getAttribute('r'))===rn);
      if(!row){row=sheet.doc.createElementNS(NS,'row');row.setAttribute('r',rn);sd.append(row);}c=sheet.doc.createElementNS(NS,'c');c.setAttribute('r',realRef);row.append(c);sheet.cells.set(ref,c);}
    if(direct(c,'f'))throw new Error('Расчётное поле обновляется формулой Excel');
    markAddition(c);
    c.replaceChildren();c.removeAttribute('t');
    if(val!==null&&val!==''&&val!==undefined){
      if(kind==='date')val=dateSerial(val);
      if(typeof val==='string'){c.setAttribute('t','inlineStr');const is=sheet.doc.createElementNS(NS,'is'),t=sheet.doc.createElementNS(NS,'t');t.textContent=val;t.setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');is.append(t);c.append(is);}
      else{const v=sheet.doc.createElementNS(NS,'v');v.textContent=typeof val==='boolean'?(val?'1':'0'):String(val);if(typeof val==='boolean')c.setAttribute('t','b');c.append(v);}
    }
    const row=c.parentElement;Array.from(row.children).sort((a,b)=>colNo(a.getAttribute('r').match(/^[A-Z]+/)[0])-colNo(b.getAttribute('r').match(/^[A-Z]+/)[0])).forEach(e=>row.append(e));
  }
  function normalize(v,type){
    if(v===null||v===''||v===undefined)return null;
    if(type==='date'){if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||v<'1900-01-01'||v>'2100-12-31'||dateText(dateSerial(v))!==v)throw new Error('Дата должна содержать действительный день, месяц и год');return v;}
    if(type==='number'||type==='integer'){const n=Number(String(v).replace(/[\s\u00a0]/g,'').replace(',','.'));if(!Number.isFinite(n)||(type==='integer'&&!Number.isInteger(n)))throw new Error('Поле должно содержать число');return n;}
    const text=String(v);if(text.length>30000)throw new Error('Текст поля должен содержать до 30 000 знаков');return text;
  }
  function changed(kind,id,key,val,previous){
    const changeKey=kind+'/'+id+'/'+key,old=state.changes.get(changeKey);
    const original=old?old.previous:previous;
    if(JSON.stringify(original)===JSON.stringify(val)){state.changes.delete(changeKey);return;}
    state.changes.set(changeKey,{kind,id,key,previous:original,value:val});
  }
  function editMaster(code,key,val){
    if(state?.readOnly)throw new Error('Живая книга обновляется в Google Sheets');
    if(!state)throw new Error('Сначала загрузите реестр Excel');const field=window.PMOSchema.columns.find(x=>x.key===key),item=state.data.initiatives.find(x=>x.code===code);
    if(!field||field.type==='formula'||['code','sources'].includes(key))throw new Error('Поле сохраняет исходный код, архив или расчёт');
    if(!item)throw new Error('Код инициативы требуется найти в загруженном реестре');
    val=normalize(val,field.type);if(['one_off_2027','run_2027','approved_budget','priority'].includes(key)&&isNumber(val)&&val<0)throw new Error('Платежи, бюджет и приоритет принимают положительные значения');
    changed('master',code,key,val,item[key]);put(viewSheet(item._sheet),field.column+item._row,val,field.type);return state.holdRefresh?state.data:refresh();
  }
  function editPlan(row,key,val){
    if(state?.readOnly)throw new Error('Живой план обновляется в Google Sheets');
    if(!state)throw new Error('Сначала загрузите реестр Excel');const item=state.data.plan.find(x=>x._row===Number(row)),fields={result:['B','text'],start:['C','date'],end:['D','date'],owner:['E','text'],predecessor:['F','text']};
    if(!item||!fields[key])throw new Error('Строка плана требуется найти в загруженном реестре');const [col,type]=fields[key];val=normalize(val,type);
    const currentStart=dateText(read(viewSheet(item._sheet),'C'+row)),currentEnd=dateText(read(viewSheet(item._sheet),'D'+row));
    if(key==='start'&&val&&currentEnd&&val>currentEnd||key==='end'&&val&&currentStart&&val<currentStart)throw new Error('План должен завершаться в день начала или позже');
    changed('plan',String(row),key,val,item[key]);const change=state.changes.get('plan/'+row+'/'+key);if(change)change.code=item.code;put(viewSheet(item._sheet),col+row,val,type);return state.holdRefresh?state.data:refresh();
  }
  function setAsOf(val){if(state?.readOnly)throw new Error('Дата живого среза обновляется в Google Sheets');val=normalize(val,'date');if(!val)throw new Error('Дата среза требуется для сравнения портфеля');const ref=state.names.get('PMO_SnapshotDate')?.split('!').pop().replace(/\$/g,'')||'J1';changed('meta','portfolio','asOf',val,state.data.asOf);put(viewSheet(window.PMOSchema.sheet),ref,val,'date');return state.holdRefresh?state.data:refresh();}
  function addDecision(code,fields){
    if(state?.readOnly)throw new Error('Решение владельца записывается в Google Sheets');
    if(!state||!state.data.initiatives.some(i=>i.code===code))throw new Error('Выберите инициативу загруженного реестра');
    const keys=['type','date','approved_by','document','conditions'],v=Object.fromEntries(keys.map(k=>[k,normalize(fields[k],k==='date'?'date':'text')]));
    const main=viewSheet(window.PMOSchema.sheet),spec=window.PMOSchema.detail_tables.decisions,range=tableRange(main,spec.name,{header:spec.header,last:spec.last,startCol:1,endCol:7}),dateRef=state.names.get('PMO_SnapshotDate')?.split('!').pop().replace(/\$/g,'')||'J1';
    if(!['Состав','Расчёт эффекта','Выбор портфеля','Запуск','Приёмка','Эффект'].includes(v.type)||!v.date||v.date>dateText(read(main,dateRef))||String(v.approved_by||'').length<5||String(v.document||'').length<8||/Гипотеза|Требуется|Уточнить|Пример/i.test(v.approved_by+' '+v.document))throw new Error('Решение требует типа, даты в пределах среза, автора и конкретного основания');
    if(tableRows(main,range,['code',...keys,'readiness'],['date']).some(r=>r.code===code&&r.type===v.type&&r.date===v.date))throw new Error('Решение этого типа за выбранную дату уже содержит запись');
    let row=range.header+1;
    while(row<=range.last&&read(main,'A'+row))row++;if(row>range.last)throw new Error('Таблица решений требует добавления строк в Excel');
    ['code',...keys].forEach((k,i)=>put(main,colText(i+1)+row,k==='code'?code:v[k],k==='date'?'date':'text'));
    changed('decision',code+'/'+v.type+'/'+v.date,'record',{code,...v},null);return state.holdRefresh?state.data:refresh();
  }
  function exportPatch(){
    if(state?.readOnly)throw new Error('Пакет локальных правок создаётся в режиме Excel');if(!state)throw new Error('Сначала загрузите реестр Excel');return new Blob([JSON.stringify({format:'pmo-patch',version:1,sourceName:state.fileName,sourceHash:state.hash,asOf:state.data.asOf,changes:Array.from(state.changes.values())},null,2)],{type:'application/json'});}
  async function importPatch(file){
    if(state?.readOnly)throw new Error('Пакет локальных правок применяется в режиме Excel');
    if(!state)throw new Error('Сначала загрузите реестр Excel');const doc=JSON.parse(await file.text());if(doc.format!=='pmo-patch'||doc.version!==1||!Array.isArray(doc.changes)||doc.changes.length>20000)throw new Error('Файл правок должен содержать пакет портфеля версии 1');
    const conflicts=[];const unique=new Set();for(const c of doc.changes){const key=c.kind+'/'+c.id+'/'+c.key;if(unique.has(key))throw new Error('Пакет содержит повторную правку поля');unique.add(key);let previous;if(c.kind==='master')previous=state.data.initiatives.find(x=>x.code===c.id)?.[c.key];else if(c.kind==='plan'){previous=state.data.plan.find(x=>x._row===Number(c.id))?.[c.key];if(doc.sourceHash!==state.hash){conflicts.push({code:c.id,key:c.key,reason:'План требует сверки с обновлённым файлом',current:previous,proposed:c.value});continue;}}else if(c.kind==='decision'&&c.key==='record'&&c.value&&typeof c.value.code==='string'){const old=state.data.decisions.find(r=>r.code===c.value.code&&r.type===c.value.type&&r.date===c.value.date);previous=old?Object.fromEntries(['code','type','date','approved_by','document','conditions'].map(k=>[k,old[k]])):null;}else if(c.kind==='meta'&&c.key==='asOf')previous=state.data.asOf;else throw new Error('Пакет содержит неизвестное поле');if(JSON.stringify(previous??null)!==JSON.stringify(c.previous??null)&&JSON.stringify(previous??null)!==JSON.stringify(c.value??null))conflicts.push({code:c.id,key:c.key,current:previous,expected:c.previous,proposed:c.value});}
    if(conflicts.length)return{applied:0,conflicts};
    const before=new Map(Array.from(state.sheets).map(([name,s])=>[name,s.doc.cloneNode(true)])),priorChanges=new Map(state.changes),priorStyles=state.styles.cloneNode(true),priorPurple=new Map(state.purpleStyles);state.holdRefresh=true;
    try{for(const c of doc.changes){if(c.kind==='master')editMaster(c.id,c.key,c.value);else if(c.kind==='plan')editPlan(c.id,c.key,c.value);else if(c.kind==='decision'){if(!state.data.decisions.some(r=>r.code===c.value.code&&r.type===c.value.type&&r.date===c.value.date))addDecision(c.value.code,c.value);}else setAsOf(c.value);}}
    catch(e){for(const [name,doc]of before){const sheet=state.sheets.get(name);sheet.doc=doc;sheet.cells=cellMap(sheet);}state.styles=priorStyles;state.purpleStyles=priorPurple;state.changes=priorChanges;state.holdRefresh=false;if(state.partitioned)makePartitionedView(state,new Map(children(state.workbook,'definedName').map(n=>[n.getAttribute('name'),n.textContent])));refresh();throw e;}
    state.holdRefresh=false;refresh();return{applied:doc.changes.length,conflicts:[]};
  }
  async function exportXlsx(){
    if(state?.readOnly)throw new Error('Google Sheets создаёт актуальную копию через меню «Файл / Скачать»');
    if(!state)throw new Error('Сначала загрузите реестр Excel');
    for(const sheet of state.sheets.values()){
      const copy=sheet.doc.cloneNode(true);
      if(sheet.name===(state.partitioned?state.layoutLocations.initiatives.sheet:window.PMOSchema.sheet)){
        const copiedCells=new Map(children(copy,'c').map(c=>[logicalRef(c.getAttribute('r'),sheet),c]));
        const byCode=new Map();for(const change of state.changes.values())if(change.kind==='master'){if(!byCode.has(change.id))byCode.set(change.id,[]);byCode.get(change.id).push(change);}
        for(const [code,changes] of byCode){const item=state.data.initiatives.find(i=>i.code===code);if(!item)continue;const sourceRef=state.partitioned?state.logicalMappings.get(window.PMOSchema.sheet+'!AS'+item._row)?.ref:'AS'+item._row;const cell=copiedCells.get(sourceRef);if(!cell)continue;let archive=String(value(cell,state.strings)||'');const m=archive.match(/Паспортные метаданные: (\{[^\n]+\})/);if(!m)continue;const metadata=JSON.parse(m[1]);metadata.fields=metadata.fields||{};for(const c of changes)metadata.fields[c.key]={kind:'Дополнение',reason:'Правка пользователя в текущем файле'};archive=archive.replace(m[0],'Паспортные метаданные: '+JSON.stringify(metadata));if(archive.length>32767)throw new Error('Архив проекта требует сокращения до 32 767 знаков');cell.replaceChildren();cell.setAttribute('t','inlineStr');const is=copy.createElementNS(NS,'is'),text=copy.createElementNS(NS,'t');text.textContent=archive;text.setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');is.append(text);cell.append(is);}
      }
      if(state.changes.size)for(const c of children(copy,'c'))if(direct(c,'f')){direct(c,'v')?.remove();c.removeAttribute('t');}
      state.zip.file(sheet.path,serialize(copy));
    }
    const book=state.workbook.cloneNode(true);let calc=children(book,'calcPr')[0];if(!calc){calc=book.createElementNS(NS,'calcPr');book.documentElement.append(calc);}for(const [key,val]of Object.entries({calcMode:'auto',calcOnSave:'1',fullCalcOnLoad:'1',forceFullCalc:'1'}))calc.setAttribute(key,val);state.zip.file('xl/workbook.xml',serialize(book));
    state.zip.file('xl/styles.xml',serialize(state.styles));
    state.zip.remove('xl/calcChain.xml');
    for(const path of ['xl/_rels/workbook.xml.rels','[Content_Types].xml']){const file=state.zip.file(path);if(!file)continue;const d=xml(await file.async('string'));for(const n of Array.from(d.documentElement.children))if(Array.from(n.attributes).some(a=>a.value.includes('calcChain')))n.remove();state.zip.file(path,serialize(d));}
    return state.zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
  }
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

  function importGrid(grids,options={}){
    if(!Array.isArray(grids)||grids.length<2)throw new Error('Живой источник передаёт оба рабочих листа');
    const next={mode:'google',readOnly:true,zip:null,workbook:null,strings:[],styles:null,purpleStyles:new Map(),sheets:new Map(),names:new Map(),changes:new Map(),fileName:'Google Sheets / Портфель инициатив ИТ 2027',hash:options.signature||'',sourceUrl:options.sourceUrl||'',sourceOrigin:options.sourceOrigin||{row:0,column:0},receivedAt:options.receivedAt||new Date().toISOString()};
    for(const grid of grids){
      if(!['Реестр инициатив','Модель эффекта'].includes(grid.sheet))throw new Error('Живой источник содержит неизвестный рабочий лист');
      let sheet=next.sheets.get(grid.sheet);
      if(!sheet){const doc=xml('<worksheet xmlns="'+NS+'"><sheetData/></worksheet>');sheet={name:grid.sheet,path:'',doc,cells:new Map(),tables:new Map()};next.sheets.set(grid.sheet,sheet);}
      for(let r=0;r<grid.values.length;r++)for(let c=0;c<grid.values[r].length;c++){
        const val=grid.values[r][c];if(val===null||val===undefined||val==='')continue;
        const ref=colText(grid.firstColumn+c)+(grid.firstRow+r);
        if(sheet.cells.has(ref))throw new Error('Живой источник повторяет координату '+ref);
        const cell=sheet.doc.createElementNS(NS,'c');cell.setAttribute('r',ref);
        if(typeof val==='string'){cell.setAttribute('t','inlineStr');const is=sheet.doc.createElementNS(NS,'is'),t=sheet.doc.createElementNS(NS,'t');t.textContent=val;is.append(t);cell.append(is);}
        else{const v=sheet.doc.createElementNS(NS,'v');if(typeof val==='boolean'){cell.setAttribute('t','b');v.textContent=val?'1':'0';}else{if(!Number.isFinite(val))throw new Error('Живой источник передаёт конечное число');v.textContent=String(val);}cell.append(v);}
        sheet.cells.set(ref,cell);
      }
    }
    next.names.set('PMO_Initiatives2027',"'Реестр инициатив'!$A$6:$"+colText(window.PMOSchema.columns.length)+"$226");
    next.names.set('PMO_SnapshotDate',"'Реестр инициатив'!$J$1");
    next.names.set('PMO_PreviousSnapshotDate',"'Реестр инициатив'!$C$2325");
    next.names.set('PMO_PortfolioCurator',"'Реестр инициатив'!$I$2325");
    const main=next.sheets.get('Реестр инициатив'),codes=[];
    for(let r=7;r<=226;r++){const code=value(main?.cells.get('A'+r),[]);if(code){if(!/^ИТ-\d{3}$/.test(String(code)))throw new Error('Код живого источника требует формат ИТ-001');codes.push(code);}}
    if(!codes.length||new Set(codes).size!==codes.length)throw new Error('Живой реестр содержит уникальные заполненные коды инициатив');
    const phases=new Map();for(let r=261;r<=1100;r++){const code=value(main?.cells.get('A'+r),[]);if(code)phases.set(code,(phases.get(code)||0)+1);}
    if([...phases.values()].some(count=>count>4))throw new Error('Подробный план содержит до четырёх фаз на инициативу');
    const previous=state;state=next;try{return refresh();}catch(e){state=previous;throw e;}
  }

  window.PMOWorkbook={importFile,importGrid,editMaster,editPlan,setAsOf,addDecision,exportXlsx,exportPatch,importPatch,download,getData:()=>state?.data||null};
})();
