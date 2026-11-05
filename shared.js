'use strict';
const $=id=>document.getElementById(id),h=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const products={soft:'软盘会员卡',cd:'音乐光碟'},statuses={pending:'待入库',stock:'在库',out:'已出库'};
let snapshot=null,password='',view='cards',page=1;
const stamp=value=>value?new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'未填写';
const b=id=>snapshot.batches.find(row=>row.id===id);
const cardUrl=serial=>'#/cards/'+encodeURIComponent(serial);
const facts=c=>[['单卡 ID',c.serial],...(c.originalSerial?[['原始登记条码',c.originalSerial]]:[]),['权益 SKU',c.sku||'未识别规范'],['条码交付日期',c.deliveryDate||'未识别规范'],['地区',{domestic:'国内',overseas:'海外'}[c.region]||'未识别规范'],['会员周期',{month:'月卡',year:'年卡'}[c.membershipCycle]||'未识别规范'],['会员档位',c.membershipTier||'未识别规范'],['尾号',c.unitNumber||'未识别规范'],['所属实物产品',products[b(c.batchId)?.product]||'未知'],['所属批次',b(c.batchId)?.batchNo],['批次用途',b(c.batchId)?.purpose],['状态',statuses[c.status]],['入库时间',stamp(c.receivedAt)],['出库时间',stamp(c.shippedAt)],['单卡备注',c.note||'未填写']];
async function load(){
  let source='snapshot.enc.json';
  if(!['localhost','127.0.0.1'].includes(location.hostname)){
    const config=await fetch('source.json',{cache:'no-store'});if(!config.ok)throw Error('线上数据源未配置');
    source=(await config.json()).snapshotUrl;
    const url=new URL(source);
    if(url.protocol!=='https:'||url.hostname!=='raw.githubusercontent.com'||url.search||url.hash)throw Error('线上数据源地址异常');
  }
  const response=await fetch(source,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok)throw Error('线上副本尚未发布，请联系管理员');
  const result=await SnapshotCrypto.open(await response.json(),password,crypto);
  if(result.schemaVersion!==2||!Array.isArray(result.cards)||!Array.isArray(result.auditEvents))throw Error('库存数据格式异常');
  snapshot=result;
}
function message(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error);}
function render(){
  if(!snapshot)return;
  const age=Date.now()-Date.parse(snapshot.generatedAt),stale=age>24*3600000;
  $('syncInfo').textContent=`快照生成时间：${stamp(snapshot.generatedAt)}（上海时间）${stale?' · 已超过 24 小时，请向管理员核对最新库存':''}`;
  $('syncInfo').classList.toggle('stale',stale);
  $('metrics').innerHTML=[['当前在库',snapshot.cards.filter(c=>c.status==='stock').length],['已出库',snapshot.cards.filter(c=>c.status==='out').length],['单卡总数',snapshot.cards.length],['到货批次',snapshot.batches.length]].map(([name,count])=>`<div class="metric"><span>${h(name)}</span><strong>${count}</strong></div>`).join('');
  $('status').hidden=view!=='cards';$('product').hidden=view==='logs';$('exportLogs').hidden=view!=='logs';
  document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('selected',el.dataset.view===view));
  const match=location.hash.match(/^#\/cards\/(.+)$/);
  if(match){let id;try{id=decodeURIComponent(match[1]);}catch{id='';}const c=snapshot.cards.find(c=>c.serial===id||c.originalSerial===id);
    $('results').innerHTML=c?`<article class="detail"><a href="#/">← 返回列表</a><h2>${h(c.serial)}</h2><dl>${facts(c).map(([label,value])=>`<div><dt>${h(label)}</dt><dd>${h(value)}</dd></div>`).join('')}</dl><p class="note">条码交付日期为标签编码信息。包装内兑换码与此编号未绑定，无法核验激活情况。</p><h3>此卡操作日志</h3>${eventsHtml(snapshot.auditEvents.filter(e=>((e.serials||[]).includes(c.serial)||(c.originalSerial&&(e.serials||[]).includes(c.originalSerial)))))}</article>`:'<p class="empty">未找到该单卡</p>';
    $('pageInfo').textContent='单卡详情';$('previous').disabled=$('next').disabled=true;return;
  }
  const q=$('search').value.trim().toLowerCase(),product=$('product').value,status=$('status').value;
  let rows=view==='cards'?snapshot.cards.filter(c=>(status==='all'||c.status===status)&&(product==='all'||b(c.batchId)?.product===product)&&(!q||JSON.stringify([c,b(c.batchId),...facts(c).flat()]).toLowerCase().includes(q))):view==='batches'?snapshot.batches.filter(row=>(product==='all'||row.product===product)&&(!q||JSON.stringify(row).toLowerCase().includes(q))):snapshot.auditEvents.filter(row=>!q||JSON.stringify(row).toLowerCase().includes(q));
  const pages=Math.max(1,Math.ceil(rows.length/50));page=Math.min(page,pages);const slice=rows.slice((page-1)*50,page*50);
  const table=(headers,body)=>`<table><thead><tr>${headers.map(head=>`<th>${head}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
  $('results').innerHTML=!rows.length?'<div class="empty">没有符合条件的记录</div>':view==='cards'?table(['单卡 ID / 条码','权益 SKU','实物产品 / 批次','状态','条码交付日期','入库 / 出库时间'],slice.map(c=>`<tr><td><a href="${cardUrl(c.serial)}">${h(c.serial)}</a></td><td>${h(c.sku||'未识别规范')}<small>${h(c.unitNumber||'')}</small></td><td>${h(products[b(c.batchId)?.product])}<small><a href="#/" data-batch="${h(b(c.batchId)?.batchNo)}">${h(b(c.batchId)?.batchNo)}</a></small></td><td><span class="status ${h(c.status)}">${h(statuses[c.status])}</span></td><td>${h(c.deliveryDate||'未识别规范')}</td><td>${h(stamp(c.receivedAt))}<small>${h(stamp(c.shippedAt))}</small></td></tr>`).join('')):view==='batches'?table(['批次号','产品','到货日期','用途 / 内容','在库 / 待入 / 已出'],slice.map(row=>{const cards=snapshot.cards.filter(c=>c.batchId===row.id);return `<tr><td><a href="#/" data-batch="${h(row.batchNo)}">${h(row.batchNo)}</a></td><td>${h(products[row.product])}</td><td>${h(row.arrivalDate)}</td><td>${h(row.purpose)}<small>${h(row.content)}</small></td><td>${cards.filter(c=>c.status==='stock').length} / ${cards.filter(c=>c.status==='pending').length} / ${cards.filter(c=>c.status==='out').length}</td></tr>`;}).join('')):eventsHtml(slice);
  $('pageInfo').textContent=`共 ${rows.length} 条 · 第 ${page} / ${pages} 页`;$('previous').disabled=page===1;$('next').disabled=page===pages;
}
function eventsHtml(events){return events.map(e=>`<article class="event"><strong>${h(e.actionName||e.action)}</strong><small>${h(stamp(e.createdAt))} · ${h(e.operator)}</small><p>${h(e.summary)}</p><p>原因 / 备注：${h(e.reason)}</p>${(e.barcodes||[]).map(info=>`<p>${h(info.serial)} · ${h(info.deliveryDate)} · ${h(info.sku)} · 尾号 ${h(info.unitNumber)}</p>`).join('')}${e.changes?.length?`<details><summary>查看修改前后（${e.changes.length} 项）</summary><table><thead><tr><th>对象</th><th>字段</th><th>修改前</th><th>修改后</th></tr></thead><tbody>${e.changes.map(c=>`<tr><td>${h(c.label)}</td><td>${h(c.fieldName)}</td><td>${h(c.beforeText)}</td><td>${h(c.afterText)}</td></tr>`).join('')}</tbody></table></details>`:''}<small>日志编号 ${h(e.id)}</small></article>`).join('')||'<p class="empty">没有操作日志</p>';}
$('unlockForm').addEventListener('submit',async event=>{event.preventDefault();$('unlockButton').disabled=true;password=$('password').value;message('正在解密库存副本…');try{await load();$('password').value='';$('unlock').hidden=true;$('content').hidden=false;$('lock').hidden=false;render();}catch(error){password='';snapshot=null;message(error.name==='OperationError'?'查看密码不正确或数据校验失败':error.message,true);}finally{$('unlockButton').disabled=false;}});
$('lock').addEventListener('click',()=>{password='';snapshot=null;$('results').replaceChildren();$('metrics').replaceChildren();$('syncInfo').textContent='';$('search').value='';$('status').value=$('product').value='all';$('password').value='';$('unlock').hidden=false;$('content').hidden=true;$('lock').hidden=true;message('已锁定，重新输入密码后可查看。');});
$('refresh').addEventListener('click',async()=>{const button=$('refresh');button.disabled=true;try{await load();render();}catch{const info=$('syncInfo');info.textContent+=' · 刷新失败，当前仍为此前加载的副本';info.classList.add('stale');}finally{button.disabled=false;}});
document.querySelectorAll('[data-view]').forEach(el=>el.addEventListener('click',()=>{view=el.dataset.view;page=1;location.hash='#/';render();}));
['search','status','product'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',()=>{page=1;render();}));
$('previous').addEventListener('click',()=>{page=Math.max(1,page-1);render();});$('next').addEventListener('click',()=>{page++;render();});
document.addEventListener('click',event=>{const link=event.target.closest('[data-batch]');if(link){view='cards';page=1;$('search').value=link.dataset.batch;$('status').value=$('product').value='all';render();}});
window.addEventListener('hashchange',render);
$('exportLogs').addEventListener('click',()=>{const q=$('search').value.trim().toLowerCase();const text=snapshot.auditEvents.filter(e=>!q||JSON.stringify(e).toLowerCase().includes(q)).map(e=>[`${stamp(e.createdAt)} | ${e.actionName||e.action} | ${e.operator}`,e.summary,'原因 / 备注：'+e.reason,...(e.barcodes||[]).map(c=>`${c.serial} | ${c.deliveryDate} | ${c.sku} | 尾号 ${c.unitNumber}`),...(e.changes||[]).map(c=>`${c.label} · ${c.fieldName}：${c.beforeText} → ${c.afterText}`),'日志编号：'+e.id].join('\n')).join('\n\n');const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='Kimi-只读副本日志.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
