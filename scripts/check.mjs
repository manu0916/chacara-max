import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Script } from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const required=['public/index.html','public/styles.css','public/password-field.css','public/password-field.js','public/app.js','public/seed.js','public/_redirects','public/_routes.json','functions/api/[[path]].js','lib/api.js','migrations/0001_catalog.sql','wrangler.toml'];
for(const path of required)if(!existsSync(resolve(root,path)))throw new Error(`Arquivo ausente: ${path}`);
function files(directory){return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(resolve(directory,entry.name)):[resolve(directory,entry.name)]);}
for(const path of ['public','lib','functions','tests','scripts'].flatMap(p=>files(resolve(root,p))).filter(p=>/\.(js|mjs)$/.test(p))){const result=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});if(result.status!==0)throw new Error(result.stderr);}
for(const path of ['public/index.html','public/seed.js','public/app.js']){
  const contents=readFileSync(resolve(root,path),'utf8');
  for(const match of contents.matchAll(/assets\/[A-Za-z0-9_-]+\.(?:svg|webp|png|jpe?g)/g))if(!existsSync(resolve(root,'public',match[0])))throw new Error(`Imagem ausente: ${match[0]}`);
}
const html=readFileSync(resolve(root,'public/index.html'),'utf8');
for(const match of html.matchAll(/(?:src|href)="([^"?#]+)(?:\?[^"]*)?"/g)){const path=match[1];if(/^(?:https?:|data:|#)/.test(path))continue;if(!existsSync(resolve(root,'public',path)))throw new Error(`Recurso HTML ausente: ${path}`);}
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
if(ids.length!==new Set(ids).size)throw new Error('IDs HTML duplicados.');
for(const match of html.matchAll(/href="#([^"]+)"/g))if(!ids.includes(match[1]))throw new Error(`Âncora ausente: ${match[1]}`);
if(!html.includes('site demonstrativo')||!html.includes('criado por:CogDev'))throw new Error('Rodapé solicitado ausente.');
const css=readFileSync(resolve(root,'public/styles.css'),'utf8');
if((css.match(/{/g)||[]).length!==(css.match(/}/g)||[]).length)throw new Error('Chaves CSS desbalanceadas.');
JSON.parse(readFileSync(resolve(root,'public/_routes.json'),'utf8'));
if(existsSync(resolve(root,'PREVIA.html'))){const preview=readFileSync(resolve(root,'PREVIA.html'),'utf8');for(const match of preview.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new Script(match[1]);if(/(?:src|href)="assets\//.test(preview))throw new Error('A prévia tem assets externos ao arquivo.');}
console.log('Verificação aprovada: JavaScript, estrutura HTML, CSS, imagens e rotas.');
