import { describe, expect, it } from 'vitest';
import type { Db } from '../config/prisma.js';
import type { TrainingSnapshot } from '../services/progress.service.js';
import { certificationRequirements } from '../services/certification.service.js';
const db = {userActivityProgress:{findMany:async()=>[{activityId:'office'},{activityId:'exam'}]}} as unknown as Db;
function snapshot(): TrainingSnapshot {
  return {
    modules:[
      {id:'certificate',slug:'certificado',prerequisites:[{prerequisite:{id:'m1',name:'Ofimática'}},{prerequisite:{id:'m5',name:'Examen general'}}]},
      {id:'m1',slug:'ofimatica-mecanografia',name:'Ofimática',activities:[{id:'office',status:'ACTIVE',isRequired:true}]},
      {id:'m5',slug:'examen-general',name:'Examen general',activities:[{id:'exam',title:'Examen general',status:'ACTIVE',isRequired:true}]},
    ],
    views:[{moduleId:'m1',hasSeal:true},{moduleId:'m5',hasSeal:true}],
    availability:new Map([['exam',{passed:true}]]),
  } as unknown as TrainingSnapshot;
}
describe('evidencia necesaria para certificar automáticamente',()=>{
  it('acepta todos los sellos, actividades y un intento real aprobado del examen',async()=>{
    expect(await certificationRequirements(db,'advisor',snapshot())).toEqual({met:true,missing:[]});
  });
  it('un progreso marcado aprobado no sustituye el intento real del examen',async()=>{
    const s=snapshot(); s.availability.delete('exam');
    expect(await certificationRequirements(db,'advisor',s)).toMatchObject({met:false,missing:['Examen general: Examen general']});
  });
  it('exige el sello de cada módulo anterior',async()=>{
    const s=snapshot(); s.views[0]!.hasSeal=false;
    expect((await certificationRequirements(db,'advisor',s)).met).toBe(false);
  });
  it('no omite un prerrequisito que falta en el catálogo',async()=>{
    const s=snapshot(); s.modules=s.modules.filter(m=>m.id!=='m1');
    expect((await certificationRequirements(db,'advisor',s)).met).toBe(false);
  });
});
