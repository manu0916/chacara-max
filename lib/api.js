import '../public/seed.js';
import '../public/contacts.js';

const seed = globalThis.CATALOG_SEED;
const MAX_IMAGE = 900000;
const SESSION_SECONDS = 8 * 60 * 60;
const encoder = new TextEncoder();
export class ApiError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
}
function text(value, max, label, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new ApiError(`${label}: valor inválido.`);
  return value.trim();
}
export function validImage(value) {
  const image = text(value, MAX_IMAGE, 'Foto');
  if (!image || /^assets\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/.test(image)) return image;
  if (/^\/api\/(photos\/[a-zA-Z0-9_-]+|hero-photo)(\?v=\d+)?$/.test(image)) return image;
  if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) return image;
  try { const url = new URL(image); if (url.protocol === 'https:' && !url.username && !url.password) return image; } catch {}
  throw new ApiError('Use uma foto JPG, PNG ou WebP, ou um endereço HTTPS.');
}
export function validateProduct(p) {
  if (!p || typeof p !== 'object') throw new ApiError('Produto inválido.');
  if (!Number.isSafeInteger(p.price_cents) || p.price_cents < 0 || p.price_cents > 9999999) throw new ApiError('Preço inválido.');
  const result = { name: text(p.name, 100, 'Nome', true), description: text(p.description, 1200, 'Descrição'), price_cents: p.price_cents, category: text(p.category, 60, 'Categoria', true), image: validImage(p.image || ''), badge: text(p.badge || '', 35, 'Etiqueta'), sort_order: Number.isSafeInteger(p.sort_order) ? p.sort_order : 0 };
  for (const key of ['featured', 'available', 'vegetarian']) {
    if (typeof p[key] !== 'boolean') throw new ApiError('Opção de produto inválida.');
    result[key] = p[key] ? 1 : 0;
  }
  if (result.sort_order < 0 || result.sort_order > 9999) throw new ApiError('Ordem inválida.');
  return result;
}
export function validateSettings(s) {
  const result = {};
  for (const [key, max] of Object.entries({restaurantName:80,tagline:80,heroTitle:120,heroDescription:600,storyTitle:150,storyText:1200,address:400,openingHours:400,phone:40,instagram:100})) result[key] = text(s[key] || '', max, key, key === 'restaurantName' || key === 'heroTitle');
  result.heroImage = validImage(s.heroImage || '');
  try {result.phone=globalThis.CONTACT_UTILS.normalizePhone(result.phone);}catch(error){throw new ApiError(error.message);}
  if (result.instagram && !/^@?[a-zA-Z0-9_.]+$/.test(result.instagram)) throw new ApiError('Instagram: use apenas o nome do perfil.');
  return result;
}
const toProduct = p => ({ ...p, image:p.image.startsWith('data:')?`/api/photos/${p.id}?v=${p.revision}`:p.image, featured: Boolean(p.featured), available: Boolean(p.available), vegetarian: Boolean(p.vegetarian) });
function imageResponse(value,privateImage=false) {
  const match=value?.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if(!match)return json({error:'Foto não encontrada.'},404);
  const raw=atob(match[2]);const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
  return new Response(bytes,{headers:{'Content-Type':`image/${match[1]}`,'Cache-Control':privateImage?'private, no-store':'public, max-age=3600','X-Content-Type-Options':'nosniff'}});
}
async function initialize(db) {
  const columns = ['id','name','description','price_cents','category','image','badge','featured','available','vegetarian','sort_order','revision'];
  const statements = seed.products.map(p => db.prepare(`INSERT OR IGNORE INTO products (${columns.join(',')}) SELECT ${columns.map(() => '?').join(',')} WHERE NOT EXISTS (SELECT 1 FROM settings WHERE id=1)`).bind(...columns.map(k => typeof p[k] === 'boolean' ? Number(p[k]) : p[k])));
  statements.push(db.prepare('INSERT OR IGNORE INTO settings (id,value,revision) VALUES (1,?,1)').bind(JSON.stringify(seed.settings)));
  await db.batch(statements);
}
async function hash(value) { return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))); }
async function equal(a,b) { const [x,y] = await Promise.all([hash(a),hash(b)]); let difference=0; for(let i=0;i<x.length;i++) difference |= x[i]^y[i]; return difference === 0; }
function base64url(bytes) { return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=',''); }
async function sign(value, env) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.SESSION_SECRET), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
}
function checkSecrets(env) { if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32) throw new ApiError('Configure ADMIN_PASSWORD e SESSION_SECRET no Cloudflare para ativar o painel.', 503); }
async function authenticated(request,env) {
  if (!env.SESSION_SECRET) return false;
  const cookie = request.headers.get('Cookie')?.match(/(?:^|;\s*)cm_session=([^;]+)/)?.[1];
  if (!cookie) return false;
  const [expiry,nonce,signature] = cookie.split('.');
  if (!expiry || !nonce || !signature || Number(expiry) <= Date.now() || Number(expiry) > Date.now()+SESSION_SECONDS*1000+10000) return false;
  return equal(signature, await sign(`${expiry}.${nonce}`,env));
}
function cookie(request, value, age=SESSION_SECONDS) { return `cm_session=${value}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`; }
async function body(request) {
  if (!request.headers.get('Content-Type')?.includes('application/json')) throw new ApiError('Envie dados JSON.');
  if (Number(request.headers.get('Content-Length')) > 1000000) throw new ApiError('A foto é muito grande.',413);
  const raw = await request.text(); if (raw.length > 1000000) throw new ApiError('A foto é muito grande.',413);
  try { return JSON.parse(raw); } catch { throw new ApiError('Dados JSON inválidos.'); }
}
function sameOrigin(request) {
  const origin=request.headers.get('Origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') throw new ApiError('Origem da solicitação inválida.',403);
}
export async function handle(request,env) {
  try {
    const path = new URL(request.url).pathname.replace(/^\/api\/?/,'').replace(/\/$/,'');
    const method = request.method;
    if (!env.DB) throw new ApiError('Banco de dados não configurado. Vincule um banco D1 com o nome DB.',503);
    if (!['GET','HEAD'].includes(method)) sameOrigin(request);
    if(path.startsWith('photos/') && method==='GET') {
      const photo=await env.DB.prepare('SELECT image,available FROM products WHERE id=?').bind(decodeURIComponent(path.slice(7))).first();
      if(!photo || (!photo.available && !await authenticated(request,env)))return json({error:'Foto não encontrada.'},404);
      return imageResponse(photo.image,!photo.available);
    }
    if(path==='hero-photo' && method==='GET') {
      const row=await env.DB.prepare('SELECT value FROM settings WHERE id=1').first();
      return imageResponse(row?JSON.parse(row.value).heroImage:'');
    }
    if (path === 'session' && method === 'GET') return json({authenticated:await authenticated(request,env)});
    if (path === 'session' && method === 'DELETE') return json({ok:true},200,{'Set-Cookie':cookie(request,'',0)});
    if (path === 'session' && method === 'POST') {
      checkSecrets(env);
      const data=await body(request);
      if (typeof data.password !== 'string' || data.password.length > 200) throw new ApiError('Senha inválida.',401);
      const ip=base64url(await hash(request.headers.get('CF-Connecting-IP') || 'local'));
      const now=Date.now();
      await env.DB.prepare('DELETE FROM login_attempts WHERE window_start < ?').bind(now-900000).run();
      await env.DB.prepare('INSERT INTO login_attempts (ip_key,attempts,window_start) VALUES (?,1,?) ON CONFLICT(ip_key) DO UPDATE SET attempts=attempts+1').bind(ip,now).run();
      const attempt=await env.DB.prepare('SELECT attempts FROM login_attempts WHERE ip_key=?').bind(ip).first();
      if (attempt.attempts > 5) return json({error:'Muitas tentativas. Aguarde 15 minutos.'},429,{'Retry-After':'900'});
      if (!await equal(data.password,env.ADMIN_PASSWORD)) throw new ApiError('Senha incorreta.',401);
      await env.DB.prepare('DELETE FROM login_attempts WHERE ip_key=?').bind(ip).run();
      const payload=`${Date.now()+SESSION_SECONDS*1000}.${crypto.randomUUID()}`;
      return json({authenticated:true},200,{'Set-Cookie':cookie(request,`${payload}.${await sign(payload,env)}`)});
    }
    if (path === 'catalog' && method === 'GET') {
      await initialize(env.DB);
      const owner=await authenticated(request,env);
      const products=await env.DB.prepare(`SELECT id,name,description,price_cents,category,CASE WHEN image LIKE 'data:%' THEN '/api/photos/' || id || '?v=' || revision ELSE image END AS image,badge,featured,available,vegetarian,sort_order,revision FROM products ${owner ? '' : 'WHERE available=1'} ORDER BY sort_order,name`).all();
      const settings=await env.DB.prepare('SELECT value,revision FROM settings WHERE id=1').first();
      const values=JSON.parse(settings.value);if(values.heroImage.startsWith('data:'))values.heroImage=`/api/hero-photo?v=${settings.revision}`;
      return json({products:products.results.map(toProduct),settings:{...values,revision:settings.revision}});
    }
    if (!await authenticated(request,env)) throw new ApiError('Entre no painel para realizar esta ação.',401);
    if (path === 'products' && method === 'POST') {
      const p=validateProduct(await body(request));
      if(p.image.startsWith('/api/'))throw new ApiError('Envie uma foto ou use um link HTTPS para o novo produto.');
      const count=await env.DB.prepare('SELECT COUNT(*) AS total FROM products').first();
      if (count.total >= 250) throw new ApiError('O catálogo permite até 250 produtos.');
      const id=crypto.randomUUID();
      const keys=Object.keys(p);
      await env.DB.prepare(`INSERT INTO products (id,${keys.join(',')}) VALUES (?,${keys.map(()=>'?').join(',')})`).bind(id,...Object.values(p)).run();
      return json({product:toProduct({...p,id,revision:1})},201);
    }
    if (path.startsWith('products/') && ['PUT','DELETE'].includes(method)) {
      const id=decodeURIComponent(path.slice(9));
      const data=await body(request);
      if (!Number.isSafeInteger(data.revision) || data.revision < 1) throw new ApiError('Recarregue o catálogo antes de salvar.',409);
      if (method==='DELETE') {
        const result=await env.DB.prepare('DELETE FROM products WHERE id=? AND revision=?').bind(id,data.revision).run();
        if (!result.meta.changes) throw new ApiError('Este produto foi alterado. Recarregue o catálogo.',409);
        return json({ok:true});
      }
      const p=validateProduct(data), keys=Object.keys(p);
      if(p.image.startsWith('/api/')) {
        if(p.image.split('?')[0]!==`/api/photos/${id}`)throw new ApiError('Referência de foto inválida.');
        const current=await env.DB.prepare('SELECT image FROM products WHERE id=?').bind(id).first();
        if(!current)throw new ApiError('O produto foi alterado. Recarregue o catálogo.',409);
        p.image=current.image;
      }
      const result=await env.DB.prepare(`UPDATE products SET ${keys.map(k=>`${k}=?`).join(',')},revision=revision+1 WHERE id=? AND revision=?`).bind(...Object.values(p),id,data.revision).run();
      if (!result.meta.changes) throw new ApiError('Este produto foi alterado em outra sessão. Recarregue o catálogo.',409);
      return json({product:toProduct({...p,id,revision:data.revision+1})});
    }
    if (path === 'settings' && method === 'PUT') {
      const data=await body(request), settings=validateSettings(data);
      if (!Number.isSafeInteger(data.revision)) throw new ApiError('Recarregue antes de salvar.',409);
      if(settings.heroImage.startsWith('/api/hero-photo')) {
        const current=await env.DB.prepare('SELECT value FROM settings WHERE id=1').first();
        settings.heroImage=JSON.parse(current.value).heroImage;
      }
      const result=await env.DB.prepare('UPDATE settings SET value=?,revision=revision+1 WHERE id=1 AND revision=?').bind(JSON.stringify(settings),data.revision).run();
      if (!result.meta.changes) throw new ApiError('Os dados foram alterados em outra sessão. Recarregue.',409);
      return json({settings:{...settings,heroImage:settings.heroImage.startsWith('data:')?`/api/hero-photo?v=${data.revision+1}`:settings.heroImage,revision:data.revision+1}});
    }
    return json({error:'Rota não encontrada.'},404);
  } catch(error) { return json({error:error instanceof ApiError ? error.message : 'Não foi possível concluir. Verifique o banco D1 e suas migrações.'},error instanceof ApiError ? error.status : 500); }
}
