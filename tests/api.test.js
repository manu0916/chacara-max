import test from 'node:test';
import assert from 'node:assert/strict';
import { handle, validateProduct, validImage } from '../lib/api.js';
import { fixture } from './helpers/api-fixture.js';

const product={name:'Pizza de teste',description:'Tomate e queijo.',price_cents:3890,category:'Especiais',image:'data:image/jpeg;base64,aGVsbG8=',badge:'Novidade',featured:true,available:true,vegetarian:true,sort_order:7};

test('login por senha, cookie protegido, sessão e logout',async()=>{
  const f=fixture();
  assert.equal((await f.call('session','POST',{password:'errada'})).status,401);
  const response=await f.call('session','POST',{password:'test-only-admin-password'});
  const cookie=response.headers.get('Set-Cookie');
  assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);assert.match(cookie,/Secure/);
  const session=cookie.split(';')[0];
  assert.deepEqual(await (await f.call('session','GET',undefined,session)).json(),{authenticated:true});
  assert.deepEqual(await (await f.call('session','GET',undefined,session+'forged')).json(),{authenticated:false});
  const out=await f.call('session','DELETE',undefined,session);assert.match(out.headers.get('Set-Cookie'),/Max-Age=0/);
  f.sqlite.close();
});
test('controle de tentativas e bloqueio de origem cruzada',async()=>{
  const f=fixture();for(let i=0;i<5;i++)assert.equal((await f.call('session','POST',{password:'errada'})).status,401);
  assert.equal((await f.call('session','POST',{password:'test-only-admin-password'})).status,429);
  assert.equal((await f.call('session','POST',{password:'test-only-admin-password'},'',{Origin:'https://evil.example'})).status,403);
  f.sqlite.close();
});
test('cadastro, foto, edição completa, revisão e exclusão persistente',async()=>{
  const f=fixture();
  const original=await (await f.call('catalog')).json();assert.equal(original.products.length,5);
  assert.equal((await f.call('products','POST',product)).status,401);
  const session=await f.login();
  const created=await f.call('products','POST',product,session);assert.equal(created.status,201);
  let {product:stored}=await created.json();assert.match(stored.image,/^\/api\/photos\//);
  const photo=await f.call(`photos/${stored.id}`);assert.equal(photo.headers.get('Content-Type'),'image/jpeg');assert.equal(await photo.text(),'hello');
  const keepPhoto=await f.call(`products/${stored.id}`,'PUT',stored,session);assert.equal(keepPhoto.status,200);stored=(await keepPhoto.json()).product;assert.equal(await (await f.call(`photos/${stored.id}`)).text(),'hello');
  const updates={...stored,name:'Novo nome',description:'Nova descrição',price_cents:6750,category:'Pizzas novas',image:'data:image/png;base64,d29ybGQ=',badge:'Novo',featured:false,available:false,vegetarian:false,sort_order:0};
  const edited=await f.call(`products/${stored.id}`,'PUT',updates,session);assert.equal(edited.status,200);stored=(await edited.json()).product;
  assert.equal(stored.name,'Novo nome');assert.equal(stored.price_cents,6750);assert.equal(stored.revision,3);
  assert.equal((await f.call(`photos/${stored.id}`)).status,404);assert.equal(await (await f.call(`photos/${stored.id}`,'GET',undefined,session)).text(),'world');
  assert.equal((await f.call(`products/${stored.id}`,'PUT',updates,session)).status,409);
  const visitor=await (await f.call('catalog')).json();assert.equal(visitor.products.find(p=>p.id===stored.id),undefined);
  const owner=await (await f.call('catalog','GET',undefined,session)).json();assert.equal(owner.products.find(p=>p.id===stored.id).available,false);
  assert.equal((await f.call(`products/${stored.id}`,'DELETE',{revision:3},session)).status,200);
  const first=original.products[0];assert.equal((await f.call(`products/${first.id}`,'DELETE',{revision:first.revision},session)).status,200);
  const reloaded=await (await f.call('catalog')).json();assert.equal(reloaded.products.length,4);assert.equal(reloaded.products.find(p=>p.id===first.id),undefined);
  f.sqlite.close();
});
test('settings editáveis com conflito de sessão e manutenção do catálogo vazio',async()=>{
  const f=fixture();const initial=await (await f.call('catalog')).json();const session=await f.login();
  const settings={...initial.settings,restaurantName:'Outra Casa',phone:'(11) 99999-9999',instagram:'outracasa',address:'Rua Exemplo',openingHours:'Terça a domingo',heroImage:'assets/tiramisu.webp'};
  assert.equal((await f.call('settings','PUT',settings)).status,401);
  assert.equal((await f.call('settings','PUT',settings,session)).status,200);
  assert.equal((await f.call('settings','PUT',settings,session)).status,409);
  for(const p of initial.products)assert.equal((await f.call(`products/${p.id}`,'DELETE',{revision:p.revision},session)).status,200);
  const catalog=await (await f.call('catalog')).json();assert.equal(catalog.products.length,0);assert.equal(catalog.settings.restaurantName,'Outra Casa');assert.equal(catalog.settings.address,'Rua Exemplo');assert.equal(catalog.settings.phone,'5511999999999');assert.equal(catalog.settings.openingHours,'Terça a domingo');
  f.sqlite.close();
});
test('validação de preço, imagens, corpo e configuração',async()=>{
  assert.throws(()=>validateProduct({...product,price_cents:-1}));assert.throws(()=>validateProduct({...product,price_cents:1.5}));assert.throws(()=>validateProduct({...product,name:' '}));
  assert.throws(()=>validImage('javascript:alert(1)'));assert.throws(()=>validImage('data:image/svg+xml;base64,aGVsbG8='));assert.throws(()=>validImage('https://user:pass@example.com/image.jpg'));
  const f=fixture();const session=await f.login();await f.call('catalog');
  assert.equal((await f.call('products','POST',{...product,price_cents:-1},session)).status,400);
  delete f.env.ADMIN_PASSWORD;assert.equal((await f.call('session','POST',{password:'test-only-admin-password'})).status,503);
  const noDB=await handle(new Request('https://example.com/api/catalog'),{});assert.equal(noDB.status,503);
  const invalid=await handle(new Request('https://example.com/api/products',{method:'POST',headers:{Cookie:session,'Content-Type':'application/json'},body:'broken-json'}),f.env);assert.equal(invalid.status,400);
  f.sqlite.close();
});
test('foto principal persistente e catálogo leve, sem fotos embutidas no JSON público',async()=>{
  const f=fixture();const initial=await (await f.call('catalog')).json();const session=await f.login();
  const settings={...initial.settings,heroImage:'data:image/webp;base64,aGVyby1pbWFnZQ=='};
  const result=await f.call('settings','PUT',settings,session);assert.equal(result.status,200);
  const saved=(await result.json()).settings;assert.match(saved.heroImage,/^\/api\/hero-photo/);
  const hero=await f.call('hero-photo');assert.equal(hero.headers.get('Content-Type'),'image/webp');assert.equal(await hero.text(),'hero-image');
  assert.equal((await f.call('settings','PUT',{...saved,heroDescription:'Novo texto mantendo a foto.'},session)).status,200);
  assert.equal(await (await f.call('hero-photo')).text(),'hero-image');
  await f.call('products','POST',product,session);
  const publicResponse=await f.call('catalog');const raw=await publicResponse.text();assert.ok(!raw.includes('base64,'));assert.ok(raw.includes('/api/photos/'));assert.ok(raw.includes('/api/hero-photo'));
  f.sqlite.close();
});
