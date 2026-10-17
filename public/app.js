(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const all = selector => [...document.querySelectorAll(selector)];
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = cents => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
  const normalize = str => String(str).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const placeholder = 'assets/placeholder.svg';
  const STORE_KEY = 'chacara-max-catalog-v1';
  const SESSION_KEY = 'chacara-max-demo-session';
  const DEMO_HASH = 'ab732a91bb1e466a94fdbd68f319540c6ff61ac467c5e5ed12784f9e6b374850';
  let catalog = structuredClone(globalThis.CATALOG_SEED);
  let mode = 'loading', owner = false, category = 'Todas', editing = null, deleting = null, photoValue = '', photoBusy = false;
  let toastTimer;
  let settingsRevision, settingsSaving=false, refreshPending=false, settingsDirty=false;
  function toast(message,error=false) { const node=$('#toast');node.textContent=message;node.classList.toggle('error',error);node.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.hidden=true,4500); }
  async function api(path,method='GET',data) {
    const response=await fetch(`/api/${path}`,{method,credentials:'same-origin',cache:'no-store',headers:data ? {'Content-Type':'application/json'} : {},body:data ? JSON.stringify(data) : undefined});
    let result;try{result=await response.json();}catch{const error=new Error('A API do catálogo não foi encontrada. Consulte LEIA-ME.md para publicar o projeto completo.');error.status=response.status;throw error;}
    if(!response.ok){const error=new Error(result.error || 'Não foi possível concluir a ação.');error.status=response.status;throw error;}
    return result;
  }
  function readLocal() { try{const saved=localStorage.getItem(STORE_KEY);if(saved){const parsed=JSON.parse(saved);if(parsed.products && parsed.settings)return parsed;}}catch{}return structuredClone(globalThis.CATALOG_SEED); }
  function saveLocal(next) { try{localStorage.setItem(STORE_KEY,JSON.stringify(next));}catch{throw new Error('Não há espaço para salvar neste navegador. Use uma foto menor ou publique com o banco D1.');} catalog=next; }
  function localSession() { try{return Number(sessionStorage.getItem(SESSION_KEY))>Date.now();}catch{return false;} }
  async function loadCatalog() {
    if(globalThis.PREVIEW_ONLY || location.protocol==='file:'){mode='demo';catalog=readLocal();owner=localSession();return;}
    try{catalog=await api('catalog');mode='server';const session=await api('session');owner=session.authenticated;}
    catch(error){if(['localhost','127.0.0.1','[::1]'].includes(location.hostname) && (error.status===404 || !error.status)){mode='demo';catalog=readLocal();owner=localSession();}else{mode='unconfigured';owner=false;}}
  }
  function imageMarkup(src,alt,className='',loading='lazy') { return `<img src="${escape(src||placeholder)}" alt="${escape(alt)}" class="${className}" loading="${loading}">`; }
  document.addEventListener('error',event=>{if(event.target.tagName==='IMG' && !event.target.src.endsWith('/placeholder.svg'))event.target.src=placeholder;},true);
  function updateBrand() {
    const s=catalog.settings;
    all('[data-brand]').forEach(n=>n.textContent=s.restaurantName);all('[data-tagline]').forEach(n=>n.textContent=s.tagline);
    all('.brand, [data-chalk-brand]').forEach(n=>n.classList.toggle('is-max',normalize(s.restaurantName).trim()==='chacara max'));
    all('.brand').forEach(n=>n.setAttribute('aria-label',`${s.restaurantName}, início`));
    document.title=`${s.restaurantName} · ${s.tagline}`;
    $('#hero-title').textContent=s.heroTitle;$('#hero-description').textContent=s.heroDescription;
    $('#hero-photo').src=s.heroImage||placeholder;$('#hero-photo').alt=`Foto de destaque de ${s.restaurantName}`;
    $('#story-title').textContent=s.storyTitle;$('#story-text').textContent=s.storyText;
    $('#visit-address').textContent=s.address||'Endereço a definir';$('#visit-hours').textContent=s.openingHours||'Horários a definir';
    $('#visit-phone-row').hidden=!s.phone;$('#visit-phone').textContent=globalThis.CONTACT_UTILS.formatPhone(s.phone);$('#visit-phone').href=s.phone?`tel:+${s.phone}`:'';
    const contact=$('#contact-button');contact.hidden=!s.phone;if(s.phone)contact.href=`https://wa.me/${s.phone}`;
    const instagram=$('#instagram-link');instagram.hidden=!s.instagram;if(s.instagram)instagram.href=`https://www.instagram.com/${encodeURIComponent(s.instagram.replace(/^@/,''))}/`;
  }
  function orderedProducts() { return [...catalog.products].sort((a,b)=>a.sort_order-b.sort_order||a.name.localeCompare(b.name,'pt-BR')); }
  function renderCategories() {
    const categories=['Todas',...new Set(orderedProducts().filter(p=>p.available).map(p=>p.category))];
    if(!categories.includes(category))category='Todas';
    $('#categories').innerHTML=categories.map(c=>`<button class="${c===category?'active':''}" data-category="${escape(c)}" aria-pressed="${c===category}">${escape(c)}</button>`).join('');
  }
  function renderMenu() {
    const query=normalize($('#menu-search').value);
    const products=orderedProducts().filter(p=>p.available && (category==='Todas'||p.category===category) && normalize(`${p.name} ${p.category} ${p.description}`).includes(query));
    $('#menu-count').textContent=`${products.length} ${products.length===1?'sabor para descobrir':'sabores para descobrir'}`;
    $('#menu-grid').innerHTML=products.length ? products.map(p=>`<article class="product-card"><button class="product-photo" data-detail="${escape(p.id)}" aria-label="Ver detalhes de ${escape(p.name)}">${imageMarkup(p.image,p.name)}${p.badge||p.featured?`<span class="product-badge">${escape(p.badge||'Destaque')}</span>`:''}${p.vegetarian?`<span class="vegetarian-mark" title="Vegetariano">${icon('leaf')}</span>`:''}</button><div class="product-copy"><p class="product-category">${escape(p.category)}</p><h3>${escape(p.name)}</h3><p>${escape(p.description)}</p><div class="product-bottom"><span class="price">${money(p.price_cents)}</span><button class="detail-link" data-detail="${escape(p.id)}">Ver detalhes ${icon('arrow')}</button></div></div></article>`).join('') : '<div class="empty-state"><h3>Um novo sabor vem aí.</h3><p>Nenhum produto encontrado. Experimente outra categoria ou busca.</p></div>';
  }
  function renderAdmin() {
    const products=catalog.products;
    $('#admin-stats').innerHTML=[['Produtos no catálogo',products.length,'Seu quadro'],['Disponíveis',products.filter(p=>p.available).length,'Na mesa!'],['Categorias',new Set(products.map(p=>p.category)).size,'Sabores']].map(([label,count,note])=>`<div class="stat"><div><p>${label}</p><strong>${count}</strong></div><span>${note}</span></div>`).join('');
    const banner=$('#admin-mode');banner.className=`status-banner ${mode==='demo'?'demo':mode==='unconfigured'?'error':''}`;
    banner.innerHTML=icon(mode==='server'?'check':'lock')+`<span>${mode==='server'?'Catálogo conectado. As alterações salvas aparecem para todos os visitantes.':mode==='demo'?'Demonstração local: as alterações ficam neste navegador. Publique com o banco D1 para compartilhar o catálogo com seus clientes.':'Painel aguardando configuração. Siga o guia LEIA-ME.md para ativar a API e o banco D1.'}</span>`;
    const query=normalize($('#admin-search').value);
    const filtered=orderedProducts().filter(p=>normalize(`${p.name} ${p.category}`).includes(query));
    $('#admin-product-list').innerHTML=filtered.length ? filtered.map(p=>`<article class="admin-row">${imageMarkup(p.image,p.name,'admin-thumb')}<div><h3>${escape(p.name)}</h3><p>${escape(p.category)}${p.featured?' · Destaque':''}</p></div><span class="row-price">${money(p.price_cents)}</span><span class="row-status ${p.available?'':'off'}">${p.available?'Disponível':'Indisponível'}</span><div class="row-actions"><button class="icon-button" data-edit="${escape(p.id)}" aria-label="Editar ${escape(p.name)}">${icon('edit')}</button><button class="icon-button danger" data-delete="${escape(p.id)}" aria-label="Excluir ${escape(p.name)}">${icon('trash')}</button></div></article>`).join('') : '<div class="empty-state"><h3>Vamos preparar algo novo?</h3><p>Adicione seu primeiro produto ou ajuste a busca.</p></div>';
  }
  function renderAll(){updateBrand();renderCategories();renderMenu();renderAdmin();}
  function show(view) { all('#site-view,#login-view,#admin-view').forEach(node=>node.hidden=node.id!==`${view}-view`);window.scrollTo(0,0); }
  function updateRoute(admin) { if(location.protocol!=='file:' && !globalThis.PREVIEW_ONLY) history.pushState({},'',admin?'/admin':'/');else location.hash=admin?'admin':''; }
  function showSite() {show('site');updateRoute(false);renderAll();refresh(true);}
  async function openAdmin(update=true) {
    if(mode==='loading')await ready;
    if(mode==='server'){try{owner=(await api('session')).authenticated;}catch{owner=false;}}
    if(mode==='demo')owner=localSession();
    if(update)updateRoute(true);show(owner?'admin':'login');
    $('#login-error').textContent='';$('#password').value='';
    $('#login-mode').textContent=mode==='demo'?'Prévia local. Os dados serão salvos apenas neste navegador.':mode==='unconfigured'?'O painel precisa da API e do banco D1. O guia de publicação acompanha o projeto.':'Acesso por senha. Sem cadastro e sem e-mail.';
    if(owner){renderAdmin();renderSettings();}else $('#password').focus();
  }
  function detail(id) {
    const p=catalog.products.find(p=>p.id===id);if(!p)return;
    const s=catalog.settings;
    $('#detail-content').innerHTML=`${imageMarkup(p.image,p.name,'detail-photo','eager')}<div class="detail-copy"><p class="eyebrow dark">${escape(p.category)}${p.badge?' · '+escape(p.badge):''}</p><h2>${escape(p.name)}</h2><p>${escape(p.description)}</p>${p.vegetarian?`<span class="veggie-label">${icon('leaf')}Opção vegetariana</span>`:''}<strong class="price">${money(p.price_cents)}</strong>${s.phone?`<a class="button button-green full" target="_blank" rel="noopener noreferrer" href="https://wa.me/${escape(s.phone)}?text=${encodeURIComponent(`Olá! Gostaria de saber mais sobre ${p.name}.`)}">Falar com a casa ${icon('arrow')}</a>`:''}<p class="field-hint">Produto do catálogo demonstrativo. Consulte a casa sobre ingredientes e disponibilidade.</p></div>`;
    $('#detail-dialog').showModal();
  }
  const field=(key,label,value,options={})=>`<div class="field ${options.full?'full-span':''}"><label for="${key}">${label}</label>${options.area?`<textarea id="${key}" name="${key}" maxlength="${options.max||1200}" ${options.required?'required':''}>${escape(value)}</textarea>`:`<input id="${key}" name="${key}" value="${escape(value)}" type="${options.type||'text'}" maxlength="${options.max||100}" ${options.required?'required':''} ${options.extra||''}>`}${options.hint?`<small>${options.hint}</small>`:''}</div>`;
  function editor(id) {
    if(!owner){openAdmin();return;}
    editing=id?structuredClone(catalog.products.find(p=>p.id===id)):null;
    const p=editing||{name:'',description:'',price_cents:0,category:'Pizzas',image:'',badge:'',featured:false,available:true,vegetarian:false,sort_order:catalog.products.length};
    photoValue=p.image;photoBusy=false;
    $('#editor-title').textContent=id?'Editar produto':'Novo produto';
    const categories=[...new Set(catalog.products.map(p=>p.category))];
    $('#product-form').innerHTML=`<div class="photo-editor"><img id="photo-preview" src="${escape(p.image||placeholder)}" alt="Prévia da foto do produto"><div class="photo-actions"><label class="upload-button" for="photo-upload">${icon('upload')}Enviar uma foto</label><input id="photo-upload" type="file" accept="image/jpeg,image/png,image/webp" hidden><p>JPG, PNG ou WebP · até 8 MB<br>A imagem será otimizada automaticamente.</p><button id="clear-photo" type="button" class="text-button">Remover foto</button><div class="photo-url"><input id="photo-url" type="url" placeholder="Ou cole o endereço HTTPS da foto" value="${escape(p.image?.startsWith('https:')?p.image:'')}" aria-label="Endereço da foto"><button id="use-photo-url" type="button">Usar link</button></div></div></div><div class="form-grid">${field('product-name','Nome do produto',p.name,{required:true,full:true})}${field('product-price','Preço (R$)',(p.price_cents/100).toFixed(2).replace('.',','),{required:true,max:12,extra:'inputmode="decimal"',hint:'Exemplo: 49,90'})}${field('product-category','Categoria',p.category,{required:true,max:60,extra:'list="category-options"',hint:'Escolha ou crie uma categoria.'})}<datalist id="category-options">${categories.map(c=>`<option value="${escape(c)}"></option>`).join('')}</datalist>${field('product-description','Descrição',p.description,{full:true,area:true})}${field('product-badge','Etiqueta (opcional)',p.badge,{max:35,hint:'Ex.: Da casa, Novidade, Picante'})}${field('product-order','Ordem no cardápio',p.sort_order,{type:'number',extra:'min="0" max="9999" step="1"',hint:'Números menores aparecem primeiro.'})}</div><div class="check-group">${[['available','Disponível no cardápio'],['featured','Destaque'],['vegetarian','Vegetariano']].map(([key,label])=>`<label class="checkbox-field"><input type="checkbox" name="${key}" ${p[key]?'checked':''}>${label}</label>`).join('')}</div><p id="product-error" class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" class="button button-outline" data-close-dialog>Cancelar</button><button type="submit" class="button button-red" id="save-product">${icon('check')}Salvar produto</button></div>`;
    $('#product-dialog').showModal();
  }
  function parsePrice(value) {
    const clean=String(value).trim();
    if(!/^\d{1,5}([,.]\d{1,2})?$/.test(clean))throw new Error('Digite um preço válido, por exemplo 49,90.');
    const cents=Math.round(Number(clean.replace(',','.'))*100);
    if(!Number.isSafeInteger(cents)||cents<0||cents>9999999)throw new Error('Preço inválido.');return cents;
  }
  function validateImage(src) {
    if(!src || /^assets\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/.test(src))return src;
    if(/^\/api\/(photos\/[a-zA-Z0-9_-]+|hero-photo)(\?v=\d+)?$/.test(src))return src;
    if(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(src) && src.length<=900000)return src;
    try{const url=new URL(src);if(url.protocol==='https:'&&!url.username&&!url.password)return url.href;}catch{}
    throw new Error('Use uma foto JPG, PNG ou WebP, ou um endereço HTTPS válido.');
  }
  async function optimizePhoto(file) {
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Escolha uma foto JPG, PNG ou WebP.');
    if(file.size>8*1024*1024)throw new Error('A foto deve ter até 8 MB.');
    const url=URL.createObjectURL(file);
    try{
      const img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Não foi possível abrir esta foto.'));im.src=url;});
      if(img.width*img.height>50000000)throw new Error('Escolha uma foto com resolução menor.');
      const scale=Math.min(1,1200/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));const context=canvas.getContext('2d');context.fillStyle='#f3f0e7';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(img,0,0,canvas.width,canvas.height);
      let quality=.86,result=canvas.toDataURL('image/jpeg',quality);while(result.length>900000 && quality>.4){quality-=.1;result=canvas.toDataURL('image/jpeg',quality);}if(result.length>900000)throw new Error('A foto ainda está muito grande. Escolha uma imagem menor.');return result;
    }finally{URL.revokeObjectURL(url);}
  }
  async function saveProduct(event) {
    event.preventDefault();if(photoBusy)return;const button=$('#save-product');button.disabled=true;$('#product-error').textContent='';
    try{
      const form=new FormData(event.target);
      const url=$('#photo-url').value.trim();
      if(url)photoValue=validateImage(url);
      const p={name:form.get('product-name').trim(),description:form.get('product-description').trim(),price_cents:parsePrice(form.get('product-price')),category:form.get('product-category').trim(),image:validateImage(photoValue),badge:form.get('product-badge').trim(),sort_order:Number(form.get('product-order')),featured:form.has('featured'),available:form.has('available'),vegetarian:form.has('vegetarian')};
      if(!p.name||!p.category)throw new Error('Preencha o nome e a categoria.');
      if(!Number.isSafeInteger(p.sort_order)||p.sort_order<0||p.sort_order>9999)throw new Error('A ordem deve ser um número inteiro entre 0 e 9999.');
      if(mode==='server'){const data=await api(editing?`products/${encodeURIComponent(editing.id)}`:'products',editing?'PUT':'POST',editing?{...p,revision:editing.revision}:p);if(editing)catalog.products=catalog.products.map(item=>item.id===editing.id?data.product:item);else catalog.products.push(data.product);}
      else if(mode==='demo' && owner){const next=readLocal();if(editing){const latest=next.products.find(item=>item.id===editing.id);if(!latest||latest.revision!==editing.revision)throw new Error('O produto foi alterado em outra aba. Feche o editor e abra novamente.');next.products=next.products.map(item=>item.id===editing.id?{...p,id:editing.id,revision:editing.revision+1}:item);}else{if(next.products.length>=250)throw new Error('O catálogo permite até 250 produtos.');next.products.push({...p,id:crypto.randomUUID(),revision:1});}saveLocal(next);}
      else throw new Error('Entre novamente no painel.');
      $('#product-dialog').close();renderAll();toast(editing?'Produto atualizado.':'Novo produto no cardápio!');
    }catch(error){$('#product-error').textContent=error.message;if(error.status===401){owner=false;$('#product-dialog').close();openAdmin();toast('Sua sessão terminou. Entre novamente.',true);}if(error.status===409){await refresh();}}
    finally{button.disabled=false;}
  }
  function confirmDelete(id) {deleting=structuredClone(catalog.products.find(p=>p.id===id));if(!deleting)return;$('#delete-description').textContent=`“${deleting.name}” será excluído. Você pode cadastrá-lo novamente quando quiser.`;$('#delete-dialog').showModal();}
  async function removeProduct() {
    if(!deleting||!owner)return;const button=$('#confirm-delete');button.disabled=true;
    try{
      if(mode==='server'){await api(`products/${encodeURIComponent(deleting.id)}`,'DELETE',{revision:deleting.revision});catalog.products=catalog.products.filter(p=>p.id!==deleting.id);}
      else if(mode==='demo'){const next=readLocal();const latest=next.products.find(p=>p.id===deleting.id);if(!latest||latest.revision!==deleting.revision)throw new Error('Este produto foi alterado em outra aba. Abra a confirmação novamente.');next.products=next.products.filter(p=>p.id!==deleting.id);saveLocal(next);}
      else throw new Error('Configure o catálogo antes de editar.');
      $('#delete-dialog').close();renderAll();toast('Produto excluído.');
    }catch(error){$('#delete-dialog').close();toast(error.message,true);if(error.status===409)await refresh();if(error.status===401){owner=false;openAdmin();}}
    finally{button.disabled=false;deleting=null;}
  }
  function renderSettings() {
    const s=catalog.settings;
    settingsRevision=s.revision;settingsDirty=false;
    $('#settings-form').innerHTML=`<h2>Os detalhes fazem a casa.</h2><p>Atualize os dados e clique em Salvar dados da casa para publicar.</p><div class="settings-actions"><button class="button button-green" id="save-settings" type="submit">${icon('check')}Salvar dados da casa</button><p id="settings-status" class="settings-status" role="status" aria-live="polite">Dados carregados. Nenhuma alteração pendente.</p><p id="settings-error" class="form-error" role="alert"></p></div><div class="form-grid"><div class="form-section-title">Como encontrar você</div>${field('address','Endereço',s.address,{area:true,max:400,full:true})}${field('openingHours','Dias e horários',s.openingHours,{area:true,max:400,full:true})}${field('phone','WhatsApp',s.phone,{max:40,extra:'inputmode="tel" autocomplete="tel"',hint:'Informe o DDD. Ex.: (11) 99999-9999. O código +55 é incluído para números brasileiros.'})}${field('instagram','Instagram',s.instagram,{max:100,hint:'Nome do perfil, sem link. Ex.: chacaramax'})}<div class="form-section-title">Apresentação da casa</div>${field('restaurantName','Nome do restaurante',s.restaurantName,{required:true,max:80})}${field('tagline','Subtítulo da marca',s.tagline,{max:80})}${field('heroTitle','Título principal',s.heroTitle,{area:true,max:120,required:true,full:true,hint:'Use uma quebra de linha para dividir o título.'})}${field('heroDescription','Apresentação',s.heroDescription,{area:true,max:600,full:true})}<div class="field full-span"><label for="heroImage">Foto principal (endereço ou arquivo)</label><input id="heroImage" name="heroImage" value="${escape(s.heroImage)}" type="text"><label class="upload-button" for="hero-upload">${icon('upload')}Enviar foto principal</label><input id="hero-upload" type="file" accept="image/jpeg,image/png,image/webp" hidden><small id="hero-upload-status">Você pode usar um link HTTPS ou enviar uma foto de até 8 MB.</small></div><div class="form-section-title">A história da casa</div>${field('storyTitle','Título da seção A casa',s.storyTitle,{area:true,max:150,full:true})}${field('storyText','Texto da seção A casa',s.storyText,{area:true,max:1200,full:true})}</div>`;
  }
  async function saveSettings(event) {
    event.preventDefault();if(settingsSaving||photoBusy)return;settingsSaving=true;const button=$('#save-settings');button.disabled=true;$('#settings-error').textContent='';$('#settings-status').textContent='Salvando…';
    try{
      const data=Object.fromEntries(new FormData(event.target));data.revision=settingsRevision;data.heroImage=validateImage(data.heroImage.trim());
      data.phone=globalThis.CONTACT_UTILS.normalizePhone(data.phone);
      data.instagram=data.instagram.trim().replace(/^@/,'');if(data.instagram&&!/^[a-zA-Z0-9_.]+$/.test(data.instagram))throw new Error('Digite apenas o nome do perfil do Instagram.');
      if(mode==='server'){catalog.settings=(await api('settings','PUT',data)).settings;}
      else if(mode==='demo'&&owner){const next=readLocal();if(next.settings.revision!==data.revision)throw new Error('Os dados mudaram em outra aba. Reabra esta seção para atualizar.');next.settings={...data,revision:data.revision+1};saveLocal(next);}
      else throw new Error('Entre novamente no painel.');
      settingsRevision=catalog.settings.revision;settingsDirty=false;$('#phone').value=catalog.settings.phone;$('#heroImage').value=catalog.settings.heroImage;
      renderAll();$('#settings-status').textContent=mode==='server'?'Dados salvos e publicados no site.':'Dados salvos nesta prévia local.';toast(mode==='server'?'Dados salvos e publicados no site.':'Dados salvos nesta prévia local.');
    }catch(error){$('#settings-status').textContent='Alterações não salvas.';const node=$('#settings-error');node.textContent=error.message;node.scrollIntoView({block:'center',behavior:'smooth'});if(error.status===401){owner=false;openAdmin();}if(error.status===409){await refresh(true);node.innerHTML=`${escape(error.message)} <button type="button" class="text-button" data-reload-settings>Recarregar dados salvos</button>`;}}
    finally{button.disabled=false;settingsSaving=false;}
  }
  async function refresh(reportError=false) {
    if(mode!=='server'||refreshPending)return;
    refreshPending=true;
    try{const before=JSON.stringify(catalog);const latest=await api('catalog');if(!settingsSaving && JSON.stringify(catalog)===before && JSON.stringify(latest)!==before){catalog=latest;renderAll();}}
    catch(error){if(reportError)toast(error.message,true);}
    finally{refreshPending=false;}
  }
  document.addEventListener('click',event=>{
    const target=event.target.closest('button,a');if(!target)return;
    if(target.hasAttribute('data-open-admin')){event.preventDefault();openAdmin();}
    else if(target.hasAttribute('data-show-site')){event.preventDefault();showSite();}
    else if(target.hasAttribute('data-reload-settings')){event.preventDefault();reloadSettings();}
    else if(target.hasAttribute('data-close-dialog')){event.preventDefault();target.closest('dialog')?.close();}
    else if(target.dataset.category){category=target.dataset.category;renderCategories();renderMenu();}
    else if(target.dataset.detail)detail(target.dataset.detail);
    else if(target.dataset.edit)editor(target.dataset.edit);
    else if(target.dataset.delete)confirmDelete(target.dataset.delete);
    else if(target.id==='clear-photo'){photoValue='';$('#photo-preview').src=placeholder;$('#photo-url').value='';$('#photo-upload').value='';}
    else if(target.id==='use-photo-url'){try{photoValue=validateImage($('#photo-url').value.trim());$('#photo-preview').src=photoValue||placeholder;$('#product-error').textContent='';}catch(error){$('#product-error').textContent=error.message;}}
  });
  all('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}}));
  $('#menu-search').addEventListener('input',renderMenu);$('#admin-search').addEventListener('input',renderAdmin);
  $('#settings-form').addEventListener('input',()=>{if(!settingsSaving){settingsDirty=true;$('#settings-status').textContent='Há alterações pendentes. Clique em Salvar dados da casa.';}});
  $('#add-product').addEventListener('click',()=>editor());$('#product-form').addEventListener('submit',saveProduct);$('#settings-form').addEventListener('submit',saveSettings);$('#confirm-delete').addEventListener('click',removeProduct);
  document.addEventListener('change',async event=>{
    if(!['photo-upload','hero-upload'].includes(event.target.id)||!event.target.files[0])return;
    const hero=event.target.id==='hero-upload';const errorNode=$(hero?'#settings-error':'#product-error');const button=$(hero?'#save-settings':'#save-product');photoBusy=true;button.disabled=true;errorNode.textContent='Otimizando a foto…';
    try{const photo=await optimizePhoto(event.target.files[0]);if(hero){$('#heroImage').value=photo;$('#hero-upload-status').textContent='Foto pronta. Clique em Salvar dados da casa para aplicar.';}else{photoValue=photo;$('#photo-preview').src=photo;$('#photo-url').value='';}errorNode.textContent='';}
    catch(error){errorNode.textContent=error.message;}finally{button.disabled=false;photoBusy=false;}
  });
  $('#login-form').addEventListener('submit',async event=>{
    event.preventDefault();const button=$('#login-submit');button.disabled=true;$('#login-error').textContent='';
    try{
      if(mode==='demo'){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode($('#password').value));const hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');if(hash!==DEMO_HASH)throw new Error('Senha incorreta.');sessionStorage.setItem(SESSION_KEY,String(Date.now()+8*60*60*1000));owner=true;}
      else if(mode==='server'){await api('session','POST',{password:$('#password').value});owner=true;catalog=await api('catalog');}
      else throw new Error('Publique o projeto completo com a API, o banco D1 e os segredos do painel. Veja o guia LEIA-ME.md.');
      $('#password').value='';show('admin');renderAll();renderSettings();
    }catch(error){$('#login-error').textContent=error.message;}
    finally{button.disabled=false;}
  });
  $('#logout').addEventListener('click',async()=>{try{if(mode==='server')await api('session','DELETE');if(mode==='demo')sessionStorage.removeItem(SESSION_KEY);owner=false;show('login');$('#password').value='';if(mode==='server')catalog=await api('catalog');renderAll();toast('Você saiu do painel.');}catch(error){toast(error.message,true);}});
  function adminTab(settings){const opening=settings&&$('#settings-panel').hidden;$('#products-panel').hidden=settings;$('#settings-panel').hidden=!settings;$('#add-product').hidden=settings;for(const [id,selected] of [['settings-tab',settings],['products-tab',!settings]]){$('#'+id).classList.toggle('active',selected);$('#'+id).setAttribute('aria-selected',String(selected));}if(opening&&!settingsDirty)renderSettings();}
  async function reloadSettings(){await refresh(true);renderSettings();}
  $('#products-tab').addEventListener('click',()=>adminTab(false));$('#settings-tab').addEventListener('click',()=>adminTab(true));
  $('#export-backup').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),...catalog},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='chacara-max-catalogo.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Catálogo exportado.');});
  window.addEventListener('storage',event=>{if(mode==='demo'&&event.key===STORE_KEY){catalog=readLocal();renderAll();}});
  window.addEventListener('popstate',()=>{if(location.pathname.startsWith('/admin')||location.hash==='#admin')openAdmin(false);else show('site');});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden && mode==='server' && !all('dialog').some(d=>d.open))refresh();});
  window.addEventListener('focus',()=>{if(!document.hidden && !all('dialog').some(d=>d.open))refresh();});
  setInterval(()=>{if(!document.hidden && !$('#site-view').hidden && !all('dialog').some(d=>d.open))refresh();},30000);
  renderAll();
  const ready=loadCatalog().then(()=>{renderAll();if(location.pathname.startsWith('/admin')||location.hash==='#admin')openAdmin(false);}).catch(()=>{mode='unconfigured';renderAll();});
})();
