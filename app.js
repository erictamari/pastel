(() => {
'use strict';
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const money = n => (Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const escapeHtml = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORE_KEY = 'pdvPastelLanche_v1';
const DEFAULT_MASTER = '1234';

// Hash determinístico simples (deterrente local; suficiente para PDV em rede doméstica)
function hashPassword(pw){
  const s = String(pw); let h1 = 0x811c9dc5, h2 = 0xdeadbeef;
  for (let i = 0; i < s.length; i++){
    h1 ^= s.charCodeAt(i); h1 = Math.imul(h1, 0x01000193);
    h2 ^= s.charCodeAt(i+1) || 0; h2 = Math.imul(h2, 0x85ebca6b);
  }
  return ((h1>>>0).toString(16).padStart(8,'0')) + ((h2>>>0).toString(16).padStart(8,'0'));
}

const seed = () => ({
  groups:[{id:'g-pastel',name:'Pastel',active:true},{id:'g-lanche',name:'Lanche',active:true},{id:'g-bebida',name:'Bebidas',active:true},{id:'g-porcao',name:'Porções',active:true}],
  products:[
    {id:'p-pastel-1',name:'Pastel de carne',price:12,groupId:'g-pastel',active:true},{id:'p-pastel-2',name:'Pastel de queijo',price:12,groupId:'g-pastel',active:true},{id:'p-pastel-3',name:'Pastel de frango',price:13,groupId:'g-pastel',active:true},
    {id:'p-lanche-1',name:'X-Burger',price:18,groupId:'g-lanche',active:true},{id:'p-lanche-2',name:'X-Salada',price:21,groupId:'g-lanche',active:true},{id:'p-lanche-3',name:'Lanche de frango',price:22,groupId:'g-lanche',active:true},
    {id:'p-bebida-1',name:'Refrigerante lata',price:6,groupId:'g-bebida',active:true},{id:'p-bebida-2',name:'Água',price:3.5,groupId:'g-bebida',active:true},{id:'p-bebida-3',name:'Suco',price:7,groupId:'g-bebida',active:true},
    {id:'p-porcao-1',name:'Batata frita',price:15,groupId:'g-porcao',active:true}
  ],
  sales:[],
  settings:{storeName:'Pastel & Lanche',primary:'#ef7d22',groupColor:'#283746',buttonText:'#ffffff',font:'system',buttonSize:'comfortable',masterHash:null},
  cashSession:null,
  cashSessions:[]
});

function migrate(d){
  d.sales = d.sales || [];
  d.groups = d.groups || [];
  d.products = d.products || [];
  d.settings = d.settings || {};
  d.cashSessions = d.cashSessions || [];
  d.cashSession = d.cashSession || null;
  if (!d.settings.masterHash) d.settings.masterHash = hashPassword(DEFAULT_MASTER);
  d.sales.forEach(s => {
    if (s.senha == null) s.senha = Math.floor(Math.random()*900)+100;
    if (!s.status) s.status = 'received';
    if (!('sessionId' in s)) s.sessionId = null;
    if (!s.paymentMethod) s.paymentMethod = 'Dinheiro';
    if (!Array.isArray(s.cancelledItems)) s.cancelledItems = [];
  });
  return d;
}

let db;
try {
  const saved = localStorage.getItem(STORE_KEY);
  db = saved ? migrate(JSON.parse(saved)) : seed();
} catch(e){ db = seed(); }

let cart = [], currentGroup = null, discount = 0, discountType = 'money';
let activeManageTab = 'products', editing = null, lastSale = null, toastTimer;
let activeOrdersTab = 'pending', activeReportsTab = 'revenue';
let passwordResolve = null;

function persist(){ try{ localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch(e){ notify('Não foi possível salvar.'); } }
function notify(msg){ const el=$('#toast'); el.textContent=msg; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2600); }

function applySettings(){
  const s = db.settings;
  document.documentElement.style.setProperty('--primary', s.primary||'#ef7d22');
  document.documentElement.style.setProperty('--group-color', s.groupColor||'#283746');
  document.documentElement.style.setProperty('--button-text', s.buttonText||'#fff');
  document.documentElement.style.setProperty('--font', s.font==='system'?'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif':s.font);
  document.body.classList.remove('button-size-large','button-size-compact');
  if (s.buttonSize==='large') document.body.classList.add('button-size-large');
  if (s.buttonSize==='compact') document.body.classList.add('button-size-compact');
  $('#storeTitle').textContent = s.storeName||'Pastel & Lanche';
  document.title = `PDV | ${s.storeName||'Pastel & Lanche'}`;
}

// ============ Grupos e Produtos ============
function renderGroups(){
  const active = db.groups.filter(g=>g.active);
  if (!currentGroup || !active.some(g=>g.id===currentGroup)) currentGroup = active[0]?.id||null;
  $('#groupTabs').innerHTML = active.map(g=>`<button class="group-btn ${g.id===currentGroup?'active':''}" data-group="${g.id}">${escapeHtml(g.name)}</button>`).join('') || '<div class="empty-products">Cadastre um grupo.</div>';
  $('#groupTabs').querySelectorAll('[data-group]').forEach(b=>b.addEventListener('click',()=>{currentGroup=b.dataset.group;renderGroups();renderProducts();}));
}
function renderProducts(){
  const products = db.products.filter(p=>p.active&&p.groupId===currentGroup);
  $('#productGrid').innerHTML = products.map(p=>`<button class="product-btn" data-product="${p.id}"><strong>${escapeHtml(p.name)}</strong><span>${money(p.price)}</span></button>`).join('') || '<div class="empty-products">Nenhum produto ativo.<br>Abra Cadastros para adicionar.</div>';
  $('#productGrid').querySelectorAll('[data-product]').forEach(b=>b.addEventListener('click',()=>addProduct(b.dataset.product)));
}
function addProduct(id){
  const p = db.products.find(x=>x.id===id&&x.active); if(!p) return;
  const line = cart.find(x=>x.productId===id);
  if (line) line.qty++; else cart.push({lineId:uid(),productId:p.id,name:p.name,price:Number(p.price),qty:1,note:''});
  renderCart();
}

// ============ Carrinho ============
function subtotal(){ return cart.reduce((s,x)=>s+x.price*x.qty,0); }
function discountAmount(){ const sub=subtotal(); return Math.min(sub, Math.max(0, discountType==='percent'?sub*Math.min(100,discount)/100:discount)); }

function renderCart(){
  const el = $('#cartItems');
  if (!cart.length) el.innerHTML = '<div class="empty-state">Seu pedido está vazio.<br>Toque nos produtos para começar.</div>';
  else el.innerHTML = cart.map(x=>`<div class="cart-row"><div><div class="cart-name">${escapeHtml(x.name)}</div><div class="cart-price">${money(x.price)} un.</div><button class="remove-line" data-remove="${x.lineId}">Remover</button></div><div class="qty-control"><button data-minus="${x.lineId}" aria-label="Diminuir">−</button><span>${x.qty}</span><button data-plus="${x.lineId}" aria-label="Aumentar">+</button></div><div class="cart-line-total">${money(x.price*x.qty)}</div></div>`).join('');
  el.querySelectorAll('[data-plus]').forEach(b=>b.addEventListener('click',()=>{const x=cart.find(i=>i.lineId===b.dataset.plus);if(x)x.qty++;renderCart();}));
  el.querySelectorAll('[data-minus]').forEach(b=>b.addEventListener('click',()=>{const x=cart.find(i=>i.lineId===b.dataset.minus);if(x){x.qty--;if(x.qty<=0)cart=cart.filter(i=>i.lineId!==x.lineId);}renderCart();}));
  el.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>{cart=cart.filter(i=>i.lineId!==b.dataset.remove);renderCart();}));
  const sub=subtotal(), disc=discountAmount();
  $('#subtotal').textContent = money(sub);
  $('#discountTotal').textContent = '− '+money(disc);
  $('#grandTotal').textContent = money(sub-disc);
  $('#finishBtn').disabled = !cart.length;
  $('#finishBtn').style.opacity = cart.length?'1':'.55';
  $('#discountHint').textContent = discountType==='percent'?'Desconto em porcentagem (máx 100%).':'Desconto em reais.';
  $('#cartCount').textContent = cart.reduce((a,x)=>a+x.qty,0)+' item(ns)';
}

function resetOrder(){
  cart=[]; discount=0; discountType='money';
  $('#discountValue').value='0';
  $('#discountType').value='money';
  $('#orderNote').value='';
  renderCart();
}
function applyDiscount(){
  let val = Number($('#discountValue').value);
  if (!Number.isFinite(val)||val<0) val=0;
  discountType = $('#discountType').value;
  discount = discountType==='percent'?Math.min(100,val):Math.min(subtotal(),val);
  $('#discountValue').value = discount;
  renderCart(); notify('Desconto aplicado.');
}

// ============ Senha master ============
function requestPassword(message){
  $('#passwordPrompt').textContent = message || 'Digite a senha master para continuar.';
  $('#passwordInput').value = '';
  $('#passwordModal').classList.remove('hidden');
  setTimeout(()=>$('#passwordInput').focus(), 60);
  return new Promise(resolve=>{ passwordResolve = resolve; });
}
async function confirmPassword(){
  const pw = $('#passwordInput').value;
  if (!pw){ notify('Digite a senha.'); return; }
  if (hashPassword(pw) !== db.settings.masterHash){ notify('Senha incorreta.'); $('#passwordInput').value=''; $('#passwordInput').focus(); return; }
  $('#passwordModal').classList.add('hidden');
  if (passwordResolve){ const r = passwordResolve; passwordResolve = null; r(true); }
}

// ============ Caixa ============
function updateCashStatus(){
  const btn = $('#cashBtn');
  const label = btn.querySelector('.btn-label');
  if (db.cashSession){
    btn.classList.add('cash-open');
    if (label) label.textContent = 'Caixa aberto';
  } else {
    btn.classList.remove('cash-open');
    if (label) label.textContent = 'Abrir caixa';
  }
}

function openCashModal(){
  if (!db.cashSession){
    $('#cashModalTitle').textContent = 'Abrir caixa';
    $('#cashModalContent').innerHTML = `
      <p class="modal-hint">Informe o valor inicial (fundo de troco) para abrir o caixa.</p>
      <label class="field-label">Valor inicial (R$)</label>
      <input class="text-input" type="number" min="0" step="0.01" id="cashInitial" value="0">
      <div class="modal-actions">
        <button class="btn outline" data-close="cashModal">Cancelar</button>
        <button class="btn primary" id="openCashBtn">Abrir caixa</button>
      </div>`;
    $('#openCashBtn').onclick = openCash;
  } else {
    $('#cashModalTitle').textContent = 'Fechar caixa';
    renderCashSummary();
  }
  $('#cashModal').classList.remove('hidden');
}

function openCash(){
  const initial = Math.max(0, Number($('#cashInitial').value)||0);
  db.cashSession = { id: uid(), openedAt: new Date().toISOString(), initialAmount: initial };
  persist();
  updateCashStatus();
  $('#cashModal').classList.add('hidden');
  notify('Caixa aberto.');
}

function sessionSummary(session){
  const sales = db.sales.filter(s=>s.sessionId===session.id);
  const received = sales.filter(s=>s.status==='received');
  const pending = sales.filter(s=>s.status==='pending');
  const cancelled = sales.filter(s=>s.status==='cancelled');
  const totalReceived = received.reduce((a,s)=>a+s.total,0);
  const totalPending = pending.reduce((a,s)=>a+s.total,0);
  const totalCancelled = cancelled.reduce((a,s)=>a+s.total,0);
  const byMethod = {};
  received.forEach(s=>{ byMethod[s.paymentMethod] = (byMethod[s.paymentMethod]||0)+s.total; });
  const cashIn = byMethod['Dinheiro']||0;
  const expectedCash = (session.initialAmount||0) + cashIn;
  return { received, pending, cancelled, totalReceived, totalPending, totalCancelled, byMethod, expectedCash };
}

function renderCashSummary(){
  const s = db.cashSession;
  const sum = sessionSummary(s);
  $('#cashModalContent').innerHTML = `
    <div class="cash-block">
      <div class="cash-row"><span>Aberto em</span><strong>${fmtDate(s.openedAt)}</strong></div>
      <div class="cash-row"><span>Valor inicial</span><strong>${money(s.initialAmount)}</strong></div>
    </div>
    <h3 class="cash-sub">Vendas recebidas</h3>
    <div class="cash-row"><span>Dinheiro</span><strong>${money(sum.byMethod['Dinheiro']||0)}</strong></div>
    <div class="cash-row"><span>Débito</span><strong>${money(sum.byMethod['Débito']||0)}</strong></div>
    <div class="cash-row"><span>Crédito</span><strong>${money(sum.byMethod['Crédito']||0)}</strong></div>
    <div class="cash-row"><span>Pix</span><strong>${money(sum.byMethod['Pix']||0)}</strong></div>
    <div class="cash-row total"><span>Total recebido (${sum.received.length})</span><strong>${money(sum.totalReceived)}</strong></div>
    ${sum.pending.length?`<div class="cash-row muted"><span>A receber (${sum.pending.length})</span><strong>${money(sum.totalPending)}</strong></div>`:''}
    ${sum.cancelled.length?`<div class="cash-row muted"><span>Cancelados (${sum.cancelled.length})</span><strong>− ${money(sum.totalCancelled)}</strong></div>`:''}
    <h3 class="cash-sub">Fechamento</h3>
    <div class="cash-row"><span>Dinheiro esperado na gaveta</span><strong>${money(sum.expectedCash)}</strong></div>
    <label class="field-label">Valor contado na gaveta (R$)</label>
    <input class="text-input" type="number" min="0" step="0.01" id="cashCounted" value="${sum.expectedCash.toFixed(2)}">
    <div class="modal-actions">
      <button class="btn outline" data-close="cashModal">Continuar vendendo</button>
      <button class="btn primary" id="closeCashBtn">Fechar caixa e imprimir</button>
    </div>`;
  $('#closeCashBtn').onclick = closeCash;
}

function closeCash(){
  const session = db.cashSession;
  if (!session) return;
  const counted = Math.max(0, Number($('#cashCounted').value)||0);
  const sum = sessionSummary(session);
  const closed = {
    ...session,
    closedAt: new Date().toISOString(),
    countedAmount: counted,
    expectedCash: sum.expectedCash,
    difference: counted - sum.expectedCash,
    totalReceived: sum.totalReceived,
    byMethod: sum.byMethod,
    receivedCount: sum.received.length,
    pendingCount: sum.pending.length,
    cancelledCount: sum.cancelled.length
  };
  db.cashSessions.unshift(closed);
  db.cashSession = null;
  persist();
  updateCashStatus();
  $('#cashModal').classList.add('hidden');
  printCashReport(closed);
  notify('Caixa fechado.');
}

function aggregateProducts(sales){
  const map = new Map();
  sales.forEach(s=>s.items.forEach(i=>{
    const k = i.productId||i.name;
    if (!map.has(k)) map.set(k,{name:i.name,qty:0,revenue:0});
    const o = map.get(k);
    o.qty += i.qty;
    o.revenue += i.price*i.qty;
  }));
  return [...map.values()].sort((a,b)=>b.qty-a.qty);
}

function cashReportHtml(closed){
  const products = aggregateProducts(db.sales.filter(s=>s.sessionId===closed.id&&s.status==='received'));
  return `<article class="receipt">
    <h2>${escapeHtml(db.settings.storeName)}</h2>
    <div class="center">FECHAMENTO DE CAIXA</div>
    <div class="center small">Aberto: ${fmtDate(closed.openedAt)}<br>Fechado: ${fmtDate(closed.closedAt)}</div>
    <div class="rule"></div>
    <table>
      <tr><td>Valor inicial</td><td class="right">${money(closed.initialAmount)}</td></tr>
      <tr><td>Pedidos recebidos</td><td class="right">${closed.receivedCount}</td></tr>
      <tr><td>Pedidos pendentes</td><td class="right">${closed.pendingCount}</td></tr>
      <tr><td>Pedidos cancelados</td><td class="right">${closed.cancelledCount}</td></tr>
    </table>
    <div class="rule"></div>
    <table>
      ${Object.entries(closed.byMethod).map(([k,v])=>`<tr><td>${escapeHtml(k)}</td><td class="right">${money(v)}</td></tr>`).join('')}
      <tr><td class="big">TOTAL RECEBIDO</td><td class="right big">${money(closed.totalReceived)}</td></tr>
    </table>
    <div class="rule"></div>
    <table>
      <tr><td>Dinheiro esperado</td><td class="right">${money(closed.expectedCash)}</td></tr>
      <tr><td>Contado</td><td class="right">${money(closed.countedAmount)}</td></tr>
      <tr><td class="big">Diferença</td><td class="right big">${money(closed.difference)}</td></tr>
    </table>
    ${products.length?`
    <div class="rule"></div>
    <div class="center small"><strong>PRODUTOS VENDIDOS</strong></div>
    <table>
      ${products.map(p=>`<tr><td>${p.qty}x ${escapeHtml(p.name)}</td><td class="right">${money(p.revenue)}</td></tr>`).join('')}
    </table>`:''}
    <div class="rule"></div>
    <div class="center small">${fmtDate(new Date().toISOString())}</div>
  </article>`;
}

function printCashReport(closed){
  $('#printArea').innerHTML = cashReportHtml(closed);
  document.body.classList.add('printing');
  setTimeout(()=>{ window.print(); document.body.classList.remove('printing'); }, 80);
}

// ============ Venda ============
function generateSenha(){
  const used = new Set(db.sales.filter(s=>s.status!=='cancelled').map(s=>s.senha));
  let n, tries = 0;
  do { n = Math.floor(Math.random()*900)+100; tries++; } while (used.has(n) && tries<1000);
  return n;
}

function finishOrder(){
  if (!db.cashSession){ notify('Abra o caixa antes de concluir vendas.'); openCashModal(); return; }
  if (!cart.length){ notify('Adicione pelo menos um item.'); return; }
  const sub = subtotal(), disc = discountAmount();
  const sale = {
    id: uid(),
    senha: generateSenha(),
    createdAt: new Date().toISOString(),
    items: cart.map(x=>({...x})),
    note: $('#orderNote').value.trim(),
    subtotal: sub,
    discount: disc,
    total: Math.max(0, sub - disc),
    discountType,
    discountValue: discount,
    paymentMethod: $('#paymentMethod').value,
    status: 'pending',
    sessionId: db.cashSession.id,
    cancelledItems: []
  };
  db.sales.unshift(sale);
  persist();
  lastSale = sale;
  resetOrder();
  renderCart();
  renderOrders();
  updateCashStatus();
  $('#receiptModal').classList.remove('hidden');
  printReceipt('all', sale);
}

// ============ Cupom ============
function fmtDate(iso){ return new Date(iso).toLocaleString('pt-BR'); }

function receiptHtml(type, sale){
  const kitchen = type==='kitchen', customer = type==='customer';
  const heading = kitchen?'VIA DA COZINHA':customer?'VIA DO CLIENTE':'CUPOM COMPLETO';
  const cancelled = sale.status==='cancelled';
  const rows = sale.items.map(i=>`<tr><td>${i.qty}x ${escapeHtml(i.name)}${i.note?`<br><span class="small">${escapeHtml(i.note)}</span>`:''}</td>${kitchen?'<td></td>':`<td class="right">${money(i.price*i.qty)}</td>`}</tr>`).join('');
  return `<article class="receipt${cancelled?' cancelled':''}">
    ${cancelled?'<div class="stamp">CANCELADO</div>':''}
    <h2>${escapeHtml(db.settings.storeName||'Pastel & Lanche')}</h2>
    <div class="center">${heading}</div>
    <div class="senha-box">
      <div class="senha-label">SENHA</div>
      <div class="senha-num">${String(sale.senha).padStart(3,'0')}</div>
    </div>
    <div class="center small">${fmtDate(sale.createdAt)}</div>
    <div class="rule"></div>
    <table>${rows}</table>
    ${sale.note?`<div class="rule"></div><strong>Observação:</strong><br>${escapeHtml(sale.note)}`:''}
    ${!kitchen?`<div class="rule"></div><table>
      <tr><td>Subtotal</td><td class="right">${money(sale.subtotal)}</td></tr>
      <tr><td>Desconto</td><td class="right">− ${money(sale.discount)}</td></tr>
      <tr><td class="big">TOTAL</td><td class="right big">${money(sale.total)}</td></tr>
      <tr><td>Pagamento</td><td class="right">${escapeHtml(sale.paymentMethod||'')}</td></tr>
    </table>`:''}
    <div class="rule"></div>
    <div class="center small">Obrigado pela preferência!</div>
  </article>`;
}

function printReceipt(type, sale=lastSale){
  if (!sale){ notify('Nenhuma venda para imprimir.'); return; }
  $('#printArea').innerHTML = type==='all'
    ? receiptHtml('kitchen',sale)+receiptHtml('customer',sale)+receiptHtml('full',sale)
    : receiptHtml(type,sale);
  document.body.classList.add('printing');
  setTimeout(()=>{ window.print(); document.body.classList.remove('printing'); }, 80);
}

// ============ Pedidos ============
function openOrders(){
  $('#ordersModal').classList.remove('hidden');
  renderOrders();
}

function renderOrders(){
  const countBy = s => db.sales.filter(x=>x.status===s).length;
  $$('.manage-tab[data-otab]').forEach(b=>{
    const k = b.dataset.otab;
    const label = k==='pending'?'Pendentes':k==='received'?'Recebidos':'Cancelados';
    b.textContent = `${label} (${countBy(k)})`;
    b.classList.toggle('active', b.dataset.otab===activeOrdersTab);
  });
  const list = db.sales.filter(s=>s.status===activeOrdersTab)
    .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  if (!list.length){
    $('#ordersContent').innerHTML = `<div class="empty-state">Nenhum pedido nesta categoria.</div>`;
    return;
  }
  $('#ordersContent').innerHTML = list.map(sale=>{
    const items = sale.items.map(i=>`
      <div class="order-item">
        <span class="order-item-qty">${i.qty}x</span>
        <span class="order-item-name">${escapeHtml(i.name)}</span>
        <span class="order-item-price">${money(i.price*i.qty)}</span>
        <button class="small-btn danger" data-cancel-item="${sale.id}|${i.lineId}">✕</button>
      </div>`).join('');
    const time = new Date(sale.createdAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    return `<div class="order-card ${sale.status}">
      <div class="order-card-head">
        <div class="order-senha">${String(sale.senha).padStart(3,'0')}</div>
        <div class="order-meta">
          <div>${time}</div>
          <div class="muted">${escapeHtml(sale.paymentMethod||'')}</div>
        </div>
        <div class="order-total">${money(sale.total)}</div>
      </div>
      <details class="order-items-wrap" open>
        <summary>${sale.items.reduce((a,i)=>a+i.qty,0)} item(ns)</summary>
        <div class="order-items">${items||'<em>Sem itens</em>'}</div>
      </details>
      <div class="order-actions">
        ${sale.status==='pending'?`<button class="btn primary small" data-receive="${sale.id}">✓ Receber</button>`:''}
        ${sale.status!=='cancelled'?`<button class="btn secondary small" data-cancel-order="${sale.id}">Cancelar pedido</button>`:''}
        <button class="btn outline small" data-print-order="${sale.id}">🖨 Imprimir</button>
      </div>
    </div>`;
  }).join('');
  $$('[data-receive]').forEach(b=>b.onclick=()=>receiveOrder(b.dataset.receive));
  $$('[data-cancel-order]').forEach(b=>b.onclick=()=>cancelOrder(b.dataset.cancelOrder));
  $$('[data-cancel-item]').forEach(b=>b.onclick=()=>{
    const [sid,lid] = b.dataset.cancelItem.split('|');
    cancelOrderItem(sid,lid);
  });
  $$('[data-print-order]').forEach(b=>b.onclick=()=>{
    const sale = db.sales.find(s=>s.id===b.dataset.printOrder);
    lastSale = sale;
    printReceipt('all',sale);
  });
}

function receiveOrder(id){
  const sale = db.sales.find(s=>s.id===id);
  if (!sale||sale.status!=='pending') return;
  sale.status = 'received';
  sale.receivedAt = new Date().toISOString();
  persist(); renderOrders(); updateCashStatus(); notify('Pedido recebido.');
}

function recalcSale(sale){
  const sub = sale.items.reduce((a,i)=>a+i.price*i.qty,0);
  let disc = 0;
  if (sale.discountType==='percent') disc = sub*Math.min(100,sale.discountValue)/100;
  else disc = Math.min(sub, sale.discountValue||0);
  sale.subtotal = sub;
  sale.discount = disc;
  sale.total = Math.max(0, sub - disc);
}

async function cancelOrder(id){
  const sale = db.sales.find(s=>s.id===id);
  if (!sale||sale.status==='cancelled') return;
  const ok = await requestPassword('Senha master para cancelar o pedido #'+String(sale.senha).padStart(3,'0'));
  if (!ok) return;
  sale.status = 'cancelled';
  sale.cancelledAt = new Date().toISOString();
  persist(); renderOrders(); updateCashStatus(); notify('Pedido cancelado.');
}

async function cancelOrderItem(saleId, lineId){
  const sale = db.sales.find(s=>s.id===saleId);
  if (!sale||sale.status==='cancelled') return;
  const item = sale.items.find(i=>i.lineId===lineId);
  if (!item) return;
  const ok = await requestPassword('Senha master para cancelar o item "'+item.name+'"');
  if (!ok) return;
  sale.cancelledItems.push({...item, cancelledAt: new Date().toISOString()});
  sale.items = sale.items.filter(i=>i.lineId!==lineId);
  if (!sale.items.length){
    sale.status = 'cancelled';
    sale.cancelledAt = new Date().toISOString();
  } else {
    recalcSale(sale);
  }
  persist(); renderOrders(); updateCashStatus(); notify('Item cancelado.');
}

// ============ Cadastros ============
function openManage(tab='products'){
  activeManageTab = tab;
  $('#manageModal').classList.remove('hidden');
  renderManage();
}

function renderManage(){
  $$('.manage-tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===activeManageTab));
  const root = $('#manageContent');
  if (activeManageTab==='products'){
    root.innerHTML = `<div class="manage-toolbar"><h3>Produtos (${db.products.length})</h3><button class="btn primary" id="addProductBtn">＋ Novo produto</button></div>
    <div class="table-scroll"><table class="data-table"><thead><tr><th>Produto</th><th>Grupo</th><th>Preço</th><th>Status</th><th>Ações</th></tr></thead><tbody>
    ${db.products.map(p=>`<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(db.groups.find(g=>g.id===p.groupId)?.name||'—')}</td><td>${money(p.price)}</td><td>${p.active?'Ativo':'Inativo'}</td><td><div class="table-actions"><button class="small-btn" data-edit-product="${p.id}">Editar</button><button class="small-btn" data-toggle-product="${p.id}">${p.active?'Desativar':'Ativar'}</button><button class="small-btn danger" data-delete-product="${p.id}">Excluir</button></div></td></tr>`).join('')}
    </tbody></table></div>`;
    $('#addProductBtn').onclick = ()=>openEditor('product');
    $$('[data-edit-product]').forEach(b=>b.onclick=()=>openEditor('product',b.dataset.editProduct));
    $$('[data-toggle-product]').forEach(b=>b.onclick=()=>{const p=db.products.find(x=>x.id===b.dataset.toggleProduct);p.active=!p.active;persist();renderManage();renderProducts();});
    $$('[data-delete-product]').forEach(b=>b.onclick=()=>{const p=db.products.find(x=>x.id===b.dataset.deleteProduct);if(!p)return;if(!confirm(`Excluir "${p.name}"?`))return;db.products=db.products.filter(x=>x.id!==p.id);persist();renderManage();renderProducts();notify('Produto excluído.');});
  } else {
    root.innerHTML = `<div class="manage-toolbar"><h3>Grupos (${db.groups.length})</h3><button class="btn primary" id="addGroupBtn">＋ Novo grupo</button></div>
    <div class="table-scroll"><table class="data-table"><thead><tr><th>Nome</th><th>Produtos</th><th>Status</th><th>Ações</th></tr></thead><tbody>
    ${db.groups.map(g=>`<tr><td>${escapeHtml(g.name)}</td><td>${db.products.filter(p=>p.groupId===g.id).length}</td><td>${g.active?'Ativo':'Inativo'}</td><td><div class="table-actions"><button class="small-btn" data-edit-group="${g.id}">Editar</button><button class="small-btn" data-toggle-group="${g.id}">${g.active?'Desativar':'Ativar'}</button><button class="small-btn danger" data-delete-group="${g.id}">Excluir</button></div></td></tr>`).join('')}
    </tbody></table></div>`;
    $('#addGroupBtn').onclick = ()=>openEditor('group');
    $$('[data-edit-group]').forEach(b=>b.onclick=()=>openEditor('group',b.dataset.editGroup));
    $$('[data-toggle-group]').forEach(b=>b.onclick=()=>{const g=db.groups.find(x=>x.id===b.dataset.toggleGroup);g.active=!g.active;persist();renderManage();renderGroups();renderProducts();});
    $$('[data-delete-group]').forEach(b=>b.onclick=()=>{const g=db.groups.find(x=>x.id===b.dataset.deleteGroup);if(!g)return;if(db.products.some(p=>p.groupId===g.id)){notify('Mova/exclua os produtos deste grupo primeiro.');return;}if(!confirm(`Excluir "${g.name}"?`))return;db.groups=db.groups.filter(x=>x.id!==g.id);persist();renderManage();renderGroups();renderProducts();notify('Grupo excluído.');});
  }
}

function openEditor(type, id=null){
  editing = {type,id};
  const obj = id?(type==='product'?db.products:db.groups).find(x=>x.id===id):null;
  $('#editTitle').textContent = (obj?'Editar ':'Novo ')+(type==='product'?'produto':'grupo');
  const fields = $('#editFields');
  if (type==='product'){
    if (!db.groups.length){ notify('Cadastre um grupo antes.'); return; }
    fields.innerHTML = `<div class="form-grid">
      <div class="span-2"><label class="field-label">Nome *</label><input class="text-input" name="name" required maxlength="80" value="${escapeHtml(obj?.name||'')}"></div>
      <div><label class="field-label">Preço (R$) *</label><input class="text-input" name="price" type="number" min="0" step="0.01" required value="${obj?Number(obj.price):''}"></div>
      <div><label class="field-label">Grupo *</label><select class="text-input" name="groupId" required>${db.groups.map(g=>`<option value="${g.id}" ${obj?.groupId===g.id?'selected':''}>${escapeHtml(g.name)}</option>`).join('')}</select></div>
      <div class="span-2"><label><input type="checkbox" name="active" ${obj?.active!==false?'checked':''}> Produto ativo no caixa</label></div>
    </div>`;
  } else {
    fields.innerHTML = `<label class="field-label">Nome do grupo *</label><input class="text-input" name="name" required maxlength="50" value="${escapeHtml(obj?.name||'')}"><p><label><input type="checkbox" name="active" ${obj?.active!==false?'checked':''}> Grupo ativo no caixa</label></p>`;
  }
  $('#editModal').classList.remove('hidden');
}

$('#editForm').addEventListener('submit', e=>{
  e.preventDefault();
  const fd = new FormData(e.currentTarget), type = editing.type;
  const obj = editing.id?(type==='product'?db.products:db.groups).find(x=>x.id===editing.id):null;
  const name = String(fd.get('name')||'').trim();
  if (!name) return;
  if (type==='product'){
    const price = Number(fd.get('price'));
    if (!Number.isFinite(price)||price<0){ notify('Preço inválido.'); return; }
    const data = {name, price, groupId:fd.get('groupId'), active:fd.has('active')};
    if (obj) Object.assign(obj, data);
    else db.products.push({id:uid(),...data});
  } else {
    if (db.groups.some(g=>g.name.toLowerCase()===name.toLowerCase()&&g.id!==editing.id)){ notify('Já existe um grupo com esse nome.'); return; }
    if (obj){ obj.name = name; obj.active = fd.has('active'); }
    else db.groups.push({id:uid(),name,active:fd.has('active')});
  }
  persist();
  $('#editModal').classList.add('hidden');
  renderManage(); renderGroups(); renderProducts();
  notify('Cadastro salvo.');
});

// ============ Aparência ============
function openSettings(){
  const f = $('#settingsForm'), s = db.settings;
  f.elements.storeName.value = s.storeName||'';
  f.elements.primary.value = s.primary||'#ef7d22';
  f.elements.groupColor.value = s.groupColor||'#283746';
  f.elements.buttonText.value = s.buttonText||'#ffffff';
  f.elements.font.value = s.font||'system';
  f.elements.buttonSize.value = s.buttonSize||'comfortable';
  f.elements.masterPassword.value = '';
  $('#settingsModal').classList.remove('hidden');
}

$('#settingsForm').addEventListener('submit', e=>{
  e.preventDefault();
  const f = e.currentTarget;
  const newPw = f.elements.masterPassword.value;
  if (newPw){
    if (newPw.length < 4){ notify('Senha deve ter ao menos 4 caracteres.'); return; }
    db.settings.masterHash = hashPassword(newPw);
  }
  db.settings.storeName = f.elements.storeName.value.trim()||'Pastel & Lanche';
  db.settings.primary = f.elements.primary.value;
  db.settings.groupColor = f.elements.groupColor.value;
  db.settings.buttonText = f.elements.buttonText.value;
  db.settings.font = f.elements.font.value;
  db.settings.buttonSize = f.elements.buttonSize.value;
  persist(); applySettings();
  $('#settingsModal').classList.add('hidden');
  notify('Aparência salva.');
});

// ============ Relatórios ============
function todayStr(d=new Date()){
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function daysAgoStr(n){
  const d = new Date(); d.setDate(d.getDate()-n); return todayStr(d);
}
function inDateRange(iso, start, end){
  const ds = todayStr(new Date(iso));
  if (start && ds < start) return false;
  if (end && ds > end) return false;
  return true;
}

function openReports(){
  $('#reportsModal').classList.remove('hidden');
  if (!$('#reportStart').value){ $('#reportStart').value = daysAgoStr(30); }
  if (!$('#reportEnd').value){ $('#reportEnd').value = todayStr(); }
  renderReports();
}

function renderReports(){
  $$('.manage-tab[data-rtab]').forEach(b=>b.classList.toggle('active', b.dataset.rtab===activeReportsTab));
  const start = $('#reportStart').value, end = $('#reportEnd').value;
  const root = $('#reportContent');
  if (activeReportsTab==='revenue') root.innerHTML = renderRevenueReport(start,end);
  else if (activeReportsTab==='products') root.innerHTML = renderProductsReport(start,end);
  else if (activeReportsTab==='daily') root.innerHTML = renderDailyReport(start,end);
  else if (activeReportsTab==='finance') root.innerHTML = renderFinanceReport(start,end);
  const csvBtn = $('#reportCsvBtn');
  if (csvBtn) csvBtn.onclick = ()=>exportCsv(start,end);
}

function renderRevenueReport(start,end){
  const received = db.sales.filter(s=>s.status==='received'&&inDateRange(s.createdAt,start,end));
  const pending = db.sales.filter(s=>s.status==='pending'&&inDateRange(s.createdAt,start,end));
  const cancelled = db.sales.filter(s=>s.status==='cancelled'&&inDateRange(s.createdAt,start,end));
  const total = received.reduce((a,s)=>a+s.total,0);
  const items = received.reduce((a,s)=>a+s.items.reduce((x,i)=>x+i.qty,0),0);
  const discounts = received.reduce((a,s)=>a+s.discount,0);
  const avg = received.length?total/received.length:0;
  const totalPending = pending.reduce((a,s)=>a+s.total,0);
  const totalCancelled = cancelled.reduce((a,s)=>a+s.total,0);
  return `<div class="report-summary">
    <div class="report-card"><small>Faturamento</small><strong>${money(total)}</strong></div>
    <div class="report-card"><small>Pedidos recebidos</small><strong>${received.length}</strong></div>
    <div class="report-card"><small>Ticket médio</small><strong>${money(avg)}</strong></div>
    <div class="report-card"><small>Itens vendidos</small><strong>${items}</strong></div>
    <div class="report-card"><small>Descontos</small><strong>${money(discounts)}</strong></div>
    <div class="report-card"><small>A receber (${pending.length})</small><strong>${money(totalPending)}</strong></div>
    <div class="report-card danger"><small>Cancelados (${cancelled.length})</small><strong>${money(totalCancelled)}</strong></div>
  </div>
  <h3 class="report-sub">Formas de pagamento (recebidos)</h3>
  ${renderPaymentBreakdown(received)}`;
}

function renderPaymentBreakdown(sales){
  const byMethod = {};
  sales.forEach(s=>{ byMethod[s.paymentMethod] = (byMethod[s.paymentMethod]||0)+s.total; });
  if (!Object.keys(byMethod).length) return '<p class="muted">Sem dados.</p>';
  const total = Object.values(byMethod).reduce((a,b)=>a+b,0);
  return `<table class="data-table"><thead><tr><th>Forma</th><th>Total</th><th>%</th></tr></thead><tbody>
    ${Object.entries(byMethod).map(([k,v])=>`<tr><td>${escapeHtml(k)}</td><td>${money(v)}</td><td>${total?((v/total)*100).toFixed(1):0}%</td></tr>`).join('')}
    <tr class="total-row"><td><strong>Total</strong></td><td><strong>${money(total)}</strong></td><td>100%</td></tr>
  </tbody></table>`;
}

function renderProductsReport(start,end){
  const received = db.sales.filter(s=>s.status==='received'&&inDateRange(s.createdAt,start,end));
  const products = aggregateProducts(received);
  if (!products.length) return '<p class="muted" style="padding:20px 0;">Nenhum produto vendido no período.</p>';
  const totalRev = products.reduce((a,p)=>a+p.revenue,0);
  return `<table class="data-table"><thead><tr><th>#</th><th>Produto</th><th>Qtd vendida</th><th>Faturamento</th><th>%</th></tr></thead><tbody>
    ${products.map((p,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(p.name)}</td><td>${p.qty}</td><td>${money(p.revenue)}</td><td>${totalRev?((p.revenue/totalRev)*100).toFixed(1):0}%</td></tr>`).join('')}
    <tr class="total-row"><td></td><td><strong>Total</strong></td><td><strong>${products.reduce((a,p)=>a+p.qty,0)}</strong></td><td><strong>${money(totalRev)}</strong></td><td>100%</td></tr>
  </tbody></table>`;
}

function renderDailyReport(start,end){
  const received = db.sales.filter(s=>s.status==='received'&&inDateRange(s.createdAt,start,end));
  const map = {};
  received.forEach(s=>{
    const d = todayStr(new Date(s.createdAt));
    if (!map[d]) map[d] = {count:0, items:0, revenue:0};
    map[d].count++;
    map[d].items += s.items.reduce((a,i)=>a+i.qty,0);
    map[d].revenue += s.total;
  });
  const rows = Object.entries(map).sort((a,b)=>b[0].localeCompare(a[0]));
  if (!rows.length) return '<p class="muted" style="padding:20px 0;">Sem vendas no período.</p>';
  const totalRev = rows.reduce((a,[,v])=>a+v.revenue,0);
  const totalCount = rows.reduce((a,[,v])=>a+v.count,0);
  const totalItems = rows.reduce((a,[,v])=>a+v.items,0);
  return `<table class="data-table"><thead><tr><th>Data</th><th>Pedidos</th><th>Itens</th><th>Faturamento</th></tr></thead><tbody>
    ${rows.map(([d,v])=>`<tr><td>${new Date(d+'T00:00:00').toLocaleDateString('pt-BR')}</td><td>${v.count}</td><td>${v.items}</td><td>${money(v.revenue)}</td></tr>`).join('')}
    <tr class="total-row"><td><strong>Total</strong></td><td><strong>${totalCount}</strong></td><td><strong>${totalItems}</strong></td><td><strong>${money(totalRev)}</strong></td></tr>
  </tbody></table>`;
}

function renderFinanceReport(start,end){
  const sessions = db.cashSessions.filter(s=>inDateRange(s.closedAt||s.openedAt,start,end));
  const cancelled = db.sales.filter(s=>s.status==='cancelled'&&inDateRange(s.createdAt,start,end));
  const totalCancelled = cancelled.reduce((a,s)=>a+s.total,0);
  const totalReceived = sessions.reduce((a,s)=>a+s.totalReceived,0);
  const totalDiff = sessions.reduce((a,s)=>a+(s.difference||0),0);
  return `<div class="report-summary">
    <div class="report-card"><small>Sessões fechadas</small><strong>${sessions.length}</strong></div>
    <div class="report-card"><small>Faturamento (recebido)</small><strong>${money(totalReceived)}</strong></div>
    <div class="report-card"><small>Diferença de caixa</small><strong>${money(totalDiff)}</strong></div>
    <div class="report-card danger"><small>Cancelados</small><strong>${money(totalCancelled)}</strong></div>
  </div>
  <h3 class="report-sub">Sessões de caixa fechadas</h3>
  ${sessions.length?`<table class="data-table"><thead><tr><th>Aberto</th><th>Fechado</th><th>Recebido</th><th>Esperado</th><th>Contado</th><th>Dif.</th></tr></thead><tbody>
    ${sessions.map(s=>`<tr><td>${fmtDate(s.openedAt)}</td><td>${fmtDate(s.closedAt)}</td><td>${money(s.totalReceived)}</td><td>${money(s.expectedCash)}</td><td>${money(s.countedAmount)}</td><td class="${s.difference<0?'text-danger':''}">${money(s.difference)}</td></tr>`).join('')}
  </tbody></table>`:'<p class="muted">Nenhuma sessão fechada no período.</p>'}`;
}

function exportCsv(start,end){
  const rows = [['Senha','Data','Status','Pagamento','Itens','Subtotal','Desconto','Total']];
  const sales = db.sales.filter(s=>inDateRange(s.createdAt,start,end)).sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
  sales.forEach(s=>{
    rows.push([String(s.senha).padStart(3,'0'), fmtDate(s.createdAt), s.status, s.paymentMethod||'', s.items.reduce((a,i)=>a+i.qty,0), s.subtotal.toFixed(2), s.discount.toFixed(2), s.total.toFixed(2)]);
  });
  const csv = '\ufeff'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  const a = document.createElement('a');
  a.href = url; a.download = `vendas-${start}-a-${end}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function printCurrentReport(){
  const start = $('#reportStart').value, end = $('#reportEnd').value;
  let body = '';
  if (activeReportsTab==='revenue') body = renderRevenueReport(start,end);
  else if (activeReportsTab==='products') body = renderProductsReport(start,end);
  else if (activeReportsTab==='daily') body = renderDailyReport(start,end);
  else body = renderFinanceReport(start,end);
  const titleMap = {revenue:'FATURAMENTO POR PERÍODO', products:'PRODUTOS VENDIDOS', daily:'VENDAS POR DIA', finance:'FINANCEIRO'};
  $('#printArea').innerHTML = `<article class="receipt report-print">
    <h2>${escapeHtml(db.settings.storeName)}</h2>
    <div class="center">${titleMap[activeReportsTab]}</div>
    <div class="center small">Período: ${start||'início'} até ${end||'hoje'}</div>
    <div class="rule"></div>
    ${body}
    <div class="rule"></div>
    <div class="center small">${fmtDate(new Date().toISOString())}</div>
  </article>`;
  document.body.classList.add('printing');
  setTimeout(()=>{ window.print(); document.body.classList.remove('printing'); }, 80);
}

// ============ Init e listeners ============
$('#applyDiscountBtn').addEventListener('click', applyDiscount);
$('#discountType').addEventListener('change', ()=>{ discountType=$('#discountType').value; renderCart(); });
$('#finishBtn').addEventListener('click', finishOrder);
$('#newOrderBtn').addEventListener('click', ()=>{ if(cart.length&&!confirm('Iniciar novo pedido? O atual será descartado.'))return; resetOrder(); notify('Novo pedido iniciado.'); });
$('#clearOrderBtn').addEventListener('click', ()=>{ if(!cart.length)return; if(confirm('Remover todos os itens?'))resetOrder(); });
$('#cancelOrderBtn').addEventListener('click', ()=>{ if(!cart.length){notify('Sem pedido.');return;} if(confirm('Cancelar este pedido?')){resetOrder();notify('Pedido cancelado.');} });
$('#manageBtn').addEventListener('click', ()=>openManage());
$('#settingsBtn').addEventListener('click', openSettings);
$('#cashBtn').addEventListener('click', openCashModal);
$('#ordersBtn').addEventListener('click', openOrders);
$('#reportsBtn').addEventListener('click', openReports);

$$('[data-close]').forEach(b=>b.addEventListener('click', ()=>{
  const m = $('#'+b.dataset.close);
  m.classList.add('hidden');
  if (b.dataset.close==='passwordModal' && passwordResolve){ const r=passwordResolve; passwordResolve=null; r(false); }
}));
$$('.modal-backdrop').forEach(m=>m.addEventListener('click', e=>{
  if (e.target===m){
    m.classList.add('hidden');
    if (m.id==='passwordModal' && passwordResolve){ const r=passwordResolve; passwordResolve=null; r(false); }
  }
}));
$$('.manage-tab[data-tab]').forEach(b=>b.addEventListener('click', ()=>{ activeManageTab=b.dataset.tab; renderManage(); }));
$$('.manage-tab[data-otab]').forEach(b=>b.addEventListener('click', ()=>{ activeOrdersTab=b.dataset.otab; renderOrders(); }));
$$('.manage-tab[data-rtab]').forEach(b=>b.addEventListener('click', ()=>{ activeReportsTab=b.dataset.rtab; renderReports(); }));
$('#reportStart').addEventListener('change', renderReports);
$('#reportEnd').addEventListener('change', renderReports);
$('#reportPrintBtn').onclick = printCurrentReport;
$('#reportCsvBtn').onclick = ()=>exportCsv($('#reportStart').value, $('#reportEnd').value);
$('#printKitchenBtn').onclick = ()=>printReceipt('kitchen');
$('#printCustomerBtn').onclick = ()=>printReceipt('customer');
$('#printFullBtn').onclick = ()=>printReceipt('full');
$('#passwordConfirmBtn').onclick = confirmPassword;
$('#passwordInput').addEventListener('keydown', e=>{ if (e.key==='Enter'){ e.preventDefault(); confirmPassword(); } });

function tick(){
  const d = new Date();
  $('#clock').textContent = d.toLocaleDateString('pt-BR')+' · '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
}
setInterval(tick, 1000);

applySettings();
renderGroups();
renderProducts();
renderCart();
updateCashStatus();
tick();
})();
