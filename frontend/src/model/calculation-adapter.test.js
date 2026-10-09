import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCalculationInput} from '../data/calculation-adapter.js';
test('Пустые необязательные источники амортизации сохраняют физический расчёт',()=>{const original={depreciation_source:'',depreciation_period:'  ',additional_depreciation:null,depreciation_confirmed:false};const next=normalizeCalculationInput(original);assert.equal(next.depreciation_source,null);assert.equal(next.depreciation_period,null);assert.equal(next.additional_depreciation,null);assert.equal(next.depreciation_confirmed,false);assert.equal(original.depreciation_source,'');});
test('Явный ноль амортизации и заполненный источник сохраняются',()=>{const source={depreciation_source:'Регистр основных средств',depreciation_period:'Май2025–апрель2026',additional_depreciation:0};assert.deepEqual(normalizeCalculationInput(source),source);});
