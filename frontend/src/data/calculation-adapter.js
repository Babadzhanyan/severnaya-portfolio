export function normalizeCalculationInput(input){
 if(!input||typeof input!=='object')return input;
 const result=structuredClone(input);
 for(const key of ['depreciation_source','depreciation_period'])if(typeof result[key]==='string'&&!result[key].trim())result[key]=null;
 return result;
}
