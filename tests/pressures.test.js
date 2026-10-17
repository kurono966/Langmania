import test from 'node:test';
import assert from 'node:assert/strict';
import '../data.js';
import '../phonology.js';
import '../lexicon.js';
import '../grammar.js';
import '../cycles.js';
import '../grammar-cycles.js';
import '../pressures.js';
import '../simulation.js';
const Q=DriftPressures,P=DriftPhonology;
function homophony(){const sim=new Drift.Simulation('chain'),r=sim.regions[0];sim.year=100;for(const id of ['loss','simplify']){sim.startRule(r,P.rules.find(x=>x.id===id));const s=r.rules.at(-1);s.adoption=.99;s.cohorts=[.99,.99,.99];}sim.refresh(r);const m=Q.measure(sim,r);r.pressures={...m.targets};r.pressureEvidence=m.evidence;return {sim,r};}
test('five bounded, evidence-based pressures are initialized and sampled every five years',()=>{
 const sim=new Drift.Simulation('pressure');assert.equal(Q.definitions.length,5);for(const r of sim.regions){assert.equal(Object.keys(r.pressures).length,5);for(const v of Object.values(r.pressures))assert.ok(v>=0&&v<=1);}
 sim.advance(100);for(const r of sim.regions){assert.equal(r.pressureHistory.length,21);assert.equal(r.systemHistory.length,5);assert.deepEqual(r.systemHistory.at(-1).pressures,Q.value(r));}
});
test('inherited Japanese homophones do not count as newly caused collisions',()=>{
 const sim=new Drift.Simulation('origin');assert.equal(Q.measure(sim,sim.regions[0]).evidence.collisionPairs.length,0);assert.equal(sim.regions[0].words[0].phonemes.join(''),sim.regions[0].words[16].phonemes.join(''));
});
test('sound loss causes new collisions, which cause a traceable lexical repair',()=>{
 const {sim,r}=homophony();assert.equal(r.words[22].phonemes.join(''),'ha');assert.equal(r.words[14].phonemes.join(''),'ha');assert.ok(r.pressureEvidence.collisionPairs.some(pair=>pair.includes(22)&&pair.includes(14)));
 const beforeClarity=r.pressures.clarity;r.pressureState.repairBudget=2;Q.respond(sim,r);const w=r.words[14];assert.ok(w.disambiguator);assert.ok(w.renewal.components.some(c=>c.meaning==='木'));
 const trigger=sim.events.find(e=>e.type==='cascade'&&e.rule==='clarity'),repair=sim.events.find(e=>e.rule==='clarity-compound');assert.ok(trigger.causes.some(id=>sim.events[id].type==='word'));assert.ok(repair.causes.includes(trigger.id));assert.ok(sim.trace(0,w.id).events.includes(repair));
 // Once the new compound is conventional, clarity improves; extra material creates effort again.
 w.disambiguator.share=1;sim.refresh(r);const after=Q.measure(sim,r);assert.ok(after.targets.clarity<beforeClarity);assert.ok(!after.evidence.collisionPairs.some(pair=>pair.includes(14)&&pair.includes(22)));
 assert.ok(after.evidence.lengthRatio>r.pressureEvidence.lengthRatio);
});
test('an in-flight collision repair is allowed to diffuse before adding another',()=>{
 const {sim,r}=homophony();r.pressureState.repairBudget=2;Q.respond(sim,r);const count=r.words.filter(w=>w.disambiguator).length;sim.year+=25;r.pressureState.repairBudget=2;Q.respond(sim,r);assert.equal(r.words.filter(w=>w.disambiguator).length,count);
});
test('ambiguity induces fixed grammar and then decreases without losing role distinctions',()=>{
 const sim=new Drift.Simulation('grammar-feedback',{cycles:false}),r=sim.regions[0],g=r.grammar;g.particle='';g.stage=1;g.constructions.forEach(c=>c.stage=1);const before=Q.measure(sim,r);r.pressures={...before.targets};r.pressureEvidence=before.evidence;r.pressureState.grammarBudget=2;Q.respond(sim,r);assert.equal(g.strictOrder,true);assert.equal(g.object,'を');assert.ok(Q.measure(sim,r).targets.ambiguity<before.targets.ambiguity);assert.ok(sim.events.some(e=>e.rule==='ambiguity-repair'&&e.causes.length));
});
test('grammaticalization creates a related sense which reinforces later construction use',()=>{
 const sim=new Drift.Simulation('bridge'),r=sim.regions[0],c=r.grammar.constructions[0],go=r.words.find(w=>w.meaning==='行く');c.uses=139;sim.year=125;DriftGrammar.evolve(sim,r);assert.equal(c.stage,1);assert.ok(go.senses.some(s=>s.meaning==='予定される'));
 const senseEvent=sim.events.find(e=>e.title==='文法化から語彙の意味拡張へ');assert.ok(senseEvent.causes.some(id=>sim.events[id].type==='grammaticalization'));
 const without=structuredClone(r);without.words.find(w=>w.meaning==='行く').senses=[{meaning:'行く',share:1}];const withUses=c.uses,withoutUses=without.grammar.constructions[0].uses;DriftGrammar.evolve(sim,r);DriftGrammar.evolve(sim,without);assert.ok(c.uses-withUses>without.grammar.constructions[0].uses-withoutUses);
});
test('standardization and clarity oppose effort instead of boosting all change rates',()=>{
 const a=new Drift.Simulation('constraints'),b=new Drift.Simulation('constraints');for(const sim of [a,b]){const r=sim.regions[0];r.pressures={effort:.7,clarity:.05,ambiguity:0,standardization:0,contact:0};}b.regions[0].pressures.standardization=1;b.regions[0].pressures.clarity=.8;
 for(let i=0;i<10;i++){a.year=b.year=i*5;Q.respond(a,a.regions[0]);Q.respond(b,b.regions[0]);}assert.ok(a.regions[0].rules.length>0);assert.equal(b.regions[0].rules.length,0);
});
test('closing links zeros contact pressure and prevents cross-region feedback',()=>{
 const sim=new Drift.Simulation('closed'),r=sim.regions[2];assert.ok(r.pressures.contact>0);sim.links[2]=[0,0,0];Q.update(sim,r);assert.equal(r.pressures.contact,0);assert.ok(r.pressureEvidence.contactChannels.every(x=>x===0));
});
test('500-year feedback yields causal chains and coherent, finite pressures',()=>{
 const sim=new Drift.Simulation('DRIFT-2026'),control=new Drift.Simulation('DRIFT-2026',{pressures:false});sim.advance(500);control.advance(500);assert.ok(sim.events.some(e=>e.type==='cascade'));assert.ok(sim.metrics().changed>control.metrics().changed);assert.ok(sim.metrics().grammarChanged>control.metrics().grammarChanged);assert.ok(!control.events.some(e=>e.type==='cascade'));
 for(const e of sim.events)for(const id of e.causes){assert.ok(Number.isInteger(id)&&id>=0&&id<e.id);assert.equal(sim.events[id].region,e.region);}
 for(const r of sim.regions){assert.equal(r.pressureHistory.length,101);for(const snapshot of r.pressureHistory)for(const d of Q.definitions)assert.ok(Number.isFinite(snapshot[d.id])&&snapshot[d.id]>=0&&snapshot[d.id]<=1);}
});
