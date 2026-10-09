export const productionNodes = [
  {id:'procurement',name:'Закупка сырья',asset:'procurement',x:45,y:40,terms:['закуп','сырь'],titleTerms:['закупка зерна','закупок сырья','закупки сырья','закупка сырья','сдиз','фгис «зерно»']},
  {id:'feed',name:'Комбикормовый завод',asset:'feed',x:265,y:40,terms:['корм'],titleTerms:['кормоцех','кормопроизв','комбикорм']},
  {id:'parents',name:'Родительское стадо',asset:'parent',x:485,y:40,terms:['родитель'],titleTerms:['родительск']},
  {id:'hatch',name:'Инкубаторий',asset:'hatchery',x:705,y:40,terms:['инкуба'],titleTerms:['инкубатор','инкубац']},
  {id:'grow',name:'Выращивание бройлера',asset:'broiler',x:925,y:40,terms:['бройлер','выращив'],titleTerms:['бройлер']},
  {id:'kill',name:'Убой и потрошение',asset:'processing',x:1145,y:40,terms:['убой'],titleTerms:['убой','убоя']},
  {id:'chilling',name:'Охлаждение и сортировка',asset:'chilling',x:1145,y:380,terms:['охлажд','сортиров'],titleTerms:['охладител','охлажд','сортиров']},
  {id:'cut',name:'Разделка и обвалка',asset:'cutting',x:925,y:380,terms:['разделк','обвалк'],titleTerms:['разделк','обвалка']},
  {id:'deep',name:'Глубокая переработка',asset:'deep',x:705,y:380,terms:['глубок','полуфабр'],titleTerms:['полуфабрикат','глубокой перераб','глубокая перераб']},
  {id:'other',name:'Субпродукты и механическая обвалка',asset:'byproducts',x:925,y:720,terms:['субпрод','механическ','ммо'],titleTerms:['субпродукт','механической обвал']},
  {id:'pack',name:'Упаковка и маркировка',asset:'packing',x:485,y:380,terms:['упаков','маркиров'],titleTerms:['упаков','маркиров','паллет']},
  {id:'stock',name:'Заморозка и склад',asset:'coldstore',x:265,y:380,terms:['склад','логист','замороз','холод'],titleTerms:['холодильн','склад','замороз','адресное хранение']},
  {id:'sell',name:'Продажи и отгрузка',asset:'sales',x:45,y:380,terms:['сбыт','продаж','коммерч','достав'],titleTerms:['продаж','онлайн-проек','онлайн-магаз','курьер','оптового','сбыт']}
];
export const productionLinks = [
  ['procurement','feed','M225 110H265'],
  ['feed','parents','M445 110H485'],
  ['feed','grow','M355 40V14H1015V40'],
  ['parents','hatch','M665 110H705'],
  ['hatch','grow','M885 110H925'],
  ['grow','kill','M1105 110H1145'],
  ['kill','chilling','M1235 280V380'],
  ['kill','other','M1325 110H1360V790H1105'],
  ['chilling','pack','M1235 380V330H545V380'],
  ['chilling','cut','M1145 450H1105'],
  ['cut','pack','M1015 380V350H605V380'],
  ['cut','deep','M925 450H885'],
  ['cut','other','M1015 620V720'],
  ['deep','pack','M705 450H665'],
  ['other','pack','M925 790H905V680H465V475H485'],
  ['pack','stock','M485 450H445'],
  ['stock','sell','M265 450H225']
];
export const parentMeatLink='M575 280V305H1125V130H1145';
export const mainStages = [
  {id:'procurement',name:'Закупка сырья',asset:'procurement',children:['procurement'],output:'Зерно и сырьё'},
  {id:'feed',name:'Комбикормовый завод',asset:'feed',children:['feed'],output:'Готовый корм'},
  {id:'parents',name:'Родительское стадо',asset:'parent',children:['parents'],output:'Инкубационное яйцо'},
  {id:'hatch',name:'Инкубаторий',asset:'hatchery',children:['hatch'],output:'Суточный цыплёнок'},
  {id:'grow',name:'Выращивание бройлеров',asset:'broiler',children:['grow'],output:'Живая птица'},
  {id:'processing',name:'Убой и переработка',asset:'processing',children:['kill','chilling','cut','deep','other','pack'],output:'Готовая продукция'},
  {id:'logistics',name:'Продажи и отгрузка',asset:'sales',children:['stock','sell'],output:'Продукция клиенту'}
];
export const supportFunctions = [
  {id:'personnel',name:'Управление персоналом',asset:'personnel',terms:['персонал','кадр'],titleTerms:['кадр','табел','зарплат','рабочего времен','персонала','персоналом','подбор сотруд','hr']},
  {id:'finance',name:'Финансы',asset:'finance',terms:['финанс','казнач','бюджет'],titleTerms:['финанс','казнач','бюджет','себестоим','денежн']},
  {id:'accounting',name:'Бухгалтерский учёт',asset:'accounting',terms:['бухгал','бухуч'],titleTerms:['бухгал','мсфо','налогов','счёт-фактур','счет-фактур','упд']},
  {id:'veterinary',name:'Ветеринария',asset:'veterinary',terms:['ветерин','ветслуж'],titleTerms:['ветерин','меркурий','ветпрепарат','вакцин']},
  {id:'vet-lab',name:'Ветеринарная лаборатория',asset:'vet-lab',terms:['лаборатор','ветлаб'],titleTerms:['лаборатор','ветлаб','микробиолог','отбор проб']},
  {id:'fleet',name:'Автопарк',asset:'fleet',terms:['автопарк','транспорт','перевоз','отлов'],titleTerms:['автопарк','путев','перевоз','транспорт','отлов','глонасс']},
  {id:'repair',name:'Ремонт',asset:'repair',terms:['ремонт','обслуживание оборуд'],titleTerms:['ремонт оборуд','заявки на ремонт','техническое обслуживан','тоир','ремонтами','ремонтных окон']},
  {id:'boiler',name:'Котельная',asset:'boiler',terms:['котель','теплоснаб','пароснаб'],titleTerms:['котель','теплоснаб','пароснаб','котл','котел','котёл']},
  {id:'warehouse',name:'Склад',asset:'warehouse',terms:['склад','хранен'],titleTerms:['склад','хранен','стеллаж','инвентаризац']},
  {id:'environment',name:'Экология',asset:'environment',terms:['эколог','окружающ'],titleTerms:['эколог','окружающ','выброс','отход','утилиз']},
  {id:'safety',name:'Охрана труда',asset:'safety',terms:['охрана труда','промышленная безопас','техника безопас'],titleTerms:['охрана труда','промышленная безопас','техника безопас','инструктаж']},
  {id:'wastewater',name:'Очистные сооружения',asset:'wastewater',terms:['очистн','сточн','водоотвед'],titleTerms:['очистн','сточн','водоотвед']},
  {id:'extrusion',name:'Экструзия',asset:'extrusion',terms:['экстру','экструд'],titleTerms:['экстру','экструд']},
  {id:'electric',name:'Электроснабжение',asset:'electric',terms:['электроснаб','энергоснаб'],titleTerms:['электроснаб','электроэнерг','электросет','энергоснаб','электроцех']},
  {id:'other-services',name:'Другие службы',asset:'other-services',terms:['хозяйствен','административ'],titleTerms:['хозяйствен','административ','столов','уборка']}
];
export const allPlantNodes = [...productionNodes,...supportFunctions];
const wordStart=(text,term)=>new RegExp('(?:^|[^\\p{L}\\p{N}])'+term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'u').test(text);
const titleSubjects=[
  ['other',/субпродукт|механическ[а-яё ]*обвал|(?:^|[^\p{L}\p{N}])ммо(?:$|[^\p{L}\p{N}])/u],
  ['procurement',/сдиз|фгис[^.]*зерно|закуп[а-яё ]*(?:зерн|сырь)/],
  ['accounting',/книг[а-яё ]*покупок и продаж|отч[её]тност[а-яё ]*по ндс/],
  ['vet-lab',/ветеринарн[а-яё ]*лаборатор|ветлаб|микробиолог|отбор проб/],
  ['boiler',/котель|пароснаб|теплоснаб|(?:^|[^а-яё])кот(?:ел|ёл|л)/],
  ['electric',/электроснаб|электроэнерг|электросет|энергоснаб|электроцех/],
  ['wastewater',/(?:^|[^а-яё])(?:сточн|очистн|водоотвед)|(?:^|[^\p{L}\p{N}])кос(?:$|[^\p{L}\p{N}])/u],
  ['extrusion',/экстру|экструд/],
  ['personnel',/подбор[а-яё ]*(?:сотруд|персонал)|адаптац[а-яё ]*персонал|табел|зарплат|уч[её]т рабочего времени|(?:^|[^\p{L}\p{N}])кэдо(?:$|[^\p{L}\p{N}])/u],
  ['grow',/конверсия корма|epef|(?:^|[^а-яё])fcr(?:$|[^a-z])/],
  ['chilling',/водян[а-яё ]*охладител|дефект[а-яё ]*сортиров/],
  ['pack',/сборк[а-яё ]*паллет|выпуск паллет|робот[а-яё ]*станц[а-яё ]*паллет|честный знак/],
  ['kill',/поступлен[а-яё ]*живой|систем[а-яё ]*от [«"]?живых[а-яё»" ]*до [«"]?упаков/]
];
const primaryCache=new WeakMap();
export function primaryPlantNode(i){
  if(primaryCache.has(i))return primaryCache.get(i);
  const title=String(i.title||'').toLocaleLowerCase('ru');let primary=null;
  // Основной предмет названия сохраняет один узел; широкие смежные переделы остаются в паспорте
  const commonSystem=/ресторан|сипифудз|5 star|хранени[а-яё ]*(?:больших )?данных|хранилищ[а-яё ]*данных|информационн[а-яё ]*(?:инфраструктур|безопас)|^ai трек$/.test(title);
  if(!commonSystem){
    const explicit=titleSubjects.find(([,expression])=>expression.test(title));
    if(explicit)primary=explicit[0];
    else{
      let candidates=allPlantNodes.filter(n=>(n.titleTerms||[]).some(term=>wordStart(title,term)));
      if(candidates.some(n=>n.id==='stock')&&candidates.some(n=>n.id==='warehouse')){
        const keep=/замороз|холодильн|склад[а-яё ]*готовой продук/.test(title)?'stock':'warehouse';
        candidates=candidates.filter(n=>!['stock','warehouse'].includes(n.id)||n.id===keep);
      }
      const commonErp=/erp|(?:^|[^а-яё])ерп/.test(title)&&/производств/.test(title)&&/склад/.test(title);
      if(!commonErp&&candidates.length===1)primary=candidates[0].id;
      else if(!commonErp&&candidates.length===0){
        const process=String(i.process||'').split(' / ')[0].toLocaleLowerCase('ru');
        const scoped=allPlantNodes.filter(n=>n.terms.some(term=>wordStart(process,term)));
        if(scoped.length===1)primary=scoped[0].id;
      }
    }
  }
  primaryCache.set(i,primary);return primary;
}
export function matches(node,list){return list.filter(i=>{const primary=primaryPlantNode(i);return node.children?node.children.includes(primary):node.id===primary;});}
export function plantCoverage(list){const linked=list.filter(i=>primaryPlantNode(i)!==null);return {linked:linked.length,unassigned:list.filter(i=>primaryPlantNode(i)===null)};}
