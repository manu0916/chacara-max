import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fixture } from './helpers/api-fixture.js';

// Execute the shipped frontend with a small DOM adapter and the real API/SQLite.
// This verifies event handling and persistence, without a browser dependency.
const source=name=>readFileSync(new URL(`../public/${name}`,import.meta.url),'utf8');
const decode=s=>String(s).replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
async function page(f,session='',path='/') {
  const nodes=new Map(),intervals=[],listeners=new Map();
  class Element {
    constructor(id){this.id=id;this.value='';this.textContent='';this.hidden=false;this.open=false;this.attributes={};this.listeners=new Map();this.fields=[];this.classList={toggle(){}};}
    addEventListener(type,handler){this.listeners.set(type,handler);}
    setAttribute(key,value){this.attributes[key]=value;}
    focus(){} scrollIntoView(){} close(){this.open=false;} showModal(){this.open=true;}
    set innerHTML(value){this.html=value;if(this.id!=='settings-form')return;this.fields=[];for(const match of value.matchAll(/<(input|textarea|button|p)\b([^>]*\bid="([^"]+)"[^>]*)>(?:([^<]*)<\/textarea>)?/g)){
      const node=new Element(match[3]);node.value=decode(match[1]==='textarea'?match[4]||'':match[2].match(/\bvalue="([^"]*)"/)?.[1]||'');node.name=match[2].match(/\bname="([^"]*)"/)?.[1];nodes.set(node.id,node);if(node.name)this.fields.push(node);
    }}
    get innerHTML(){return this.html||'';}
  }
  for(const match of source('index.html').matchAll(/\bid="([^"]+)"/g))nodes.set(match[1],new Element(match[1]));
  nodes.get('settings-panel').hidden=true;
  const queryAll=selector=>selector==='dialog'?['detail-dialog','product-dialog','delete-dialog'].map(id=>nodes.get(id)):selector.startsWith('#')?selector.split(',').map(s=>nodes.get(s.slice(1))):[];
  const document={hidden:false,querySelector:selector=>nodes.get(selector.slice(1)),querySelectorAll:queryAll,addEventListener:(type,handler)=>listeners.set(type,handler)};
  const window={scrollTo(){},addEventListener:(type,handler)=>listeners.set(type,handler)};
  const context={document,window,location:{protocol:'https:',hostname:'example.com',pathname:path,hash:''},history:{pushState(){}},structuredClone,TextEncoder,crypto,URL,Blob,Intl,setTimeout(){return 1;},clearTimeout(){},setInterval(handler){intervals.push(handler);},FormData:class{constructor(form){this.fields=form.fields.map(n=>[n.name,n.value]);}*[Symbol.iterator](){yield* this.fields;}},fetch:(url,options)=>f.call(url.replace('/api/',''),options.method,options.body?JSON.parse(options.body):undefined,session)};
  for(const name of ['seed.js','contacts.js','app.js'])runInNewContext(source(name),context);
  const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setTimeout(resolve,5));};
  await settle();
  if(path==='/admin'){assert.ok(nodes.has('address'),'O painel autenticado deve carregar o formulário.');nodes.get('settings-tab').listeners.get('click')();}
  return {nodes,intervals,async event(id,type){const target=nodes.get(id);await target.listeners.get(type)?.({target,preventDefault(){}});await settle();},async refresh(){listeners.get('focus')?.();await settle();},settle};
}

test('endereço e telefone salvos no painel chegam ao cliente e ao WhatsApp',async()=>{
  const f=fixture();const session=await f.login();const admin=await page(f,session,'/admin');
  admin.nodes.get('address').value='Estrada da Chácara, 123\nBairro Centro';admin.nodes.get('phone').value='(11) 99999-9999';
  await admin.event('settings-form','input');await admin.event('products-tab','click');await admin.event('settings-tab','click');assert.equal(admin.nodes.get('address').value,'Estrada da Chácara, 123\nBairro Centro');assert.match(admin.nodes.get('settings-status').textContent,/pendentes/);
  await admin.event('settings-form','submit');assert.equal(admin.nodes.get('settings-error').textContent,'');assert.match(admin.nodes.get('settings-status').textContent,/salvos e publicados/);
  const visitor=await page(f);assert.equal(visitor.nodes.get('visit-address').textContent,'Estrada da Chácara, 123\nBairro Centro');assert.equal(visitor.nodes.get('visit-phone').textContent,'+55 (11) 99999-9999');assert.equal(visitor.nodes.get('visit-phone').href,'tel:+5511999999999');assert.equal(visitor.nodes.get('contact-button').href,'https://wa.me/5511999999999');assert.equal(visitor.nodes.get('visit-phone-row').hidden,false);
  f.sqlite.close();
});

test('cliente já aberto recebe contatos novos na atualização automática',async()=>{
  const f=fixture();const visitor=await page(f);assert.equal(visitor.nodes.get('visit-phone-row').hidden,true);
  const initial=await (await f.call('catalog')).json();const session=await f.login();
  assert.equal((await f.call('settings','PUT',{...initial.settings,address:'Endereço atualizado',phone:'+55 (21) 98888-7777'},session)).status,200);
  visitor.intervals[0]();await visitor.settle();assert.equal(visitor.nodes.get('visit-address').textContent,'Endereço atualizado');assert.equal(visitor.nodes.get('contact-button').href,'https://wa.me/5521988887777');
  f.sqlite.close();
});

test('mudanças em outra sessão não são sobrescritas por formulário antigo',async()=>{
  const f=fixture();const session=await f.login();const admin=await page(f,session,'/admin');const initial=await (await f.call('catalog')).json();
  admin.nodes.get('address').value='Rascunho nesta aba';
  assert.equal((await f.call('settings','PUT',{...initial.settings,address:'Salvo em outra sessão'},session)).status,200);
  await admin.refresh();await admin.event('settings-form','submit');
  assert.match(admin.nodes.get('settings-status').textContent,/não salvas/);assert.match(admin.nodes.get('settings-error').innerHTML,/Recarregar dados salvos/);assert.equal(admin.nodes.get('address').value,'Rascunho nesta aba');
  assert.equal((await (await f.call('catalog')).json()).settings.address,'Salvo em outra sessão');
  f.sqlite.close();
});

test('telefone inválido mostra erro e não publica endereço parcial',async()=>{
  const f=fixture();const session=await f.login();const admin=await page(f,session,'/admin');
  admin.nodes.get('address').value='Alteração ainda não salva';admin.nodes.get('phone').value='123';await admin.event('settings-form','submit');
  assert.match(admin.nodes.get('settings-error').textContent,/DDD/);assert.match(admin.nodes.get('settings-status').textContent,/não salvas/);assert.equal((await (await f.call('catalog')).json()).settings.address,'');
  f.sqlite.close();
});
