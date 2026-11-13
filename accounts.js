(function(root){
  'use strict';
  const directionNames={income:'收入',cost:'成本',none:'未记金额'};
  const yuan=cents=>cents===null||cents===undefined?'未填写':'¥'+(cents/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
  function cents(value){
    const text=String(value).trim();
    if(!/^\d{1,7}(?:\.\d{1,2})?$/.test(text))return null;
    const [whole,fraction='']=text.split('.');
    return Number(whole)*100+Number(fraction.padEnd(2,'0'));
  }
  function totals(orders){
    const income=orders.filter(o=>o.direction==='income').reduce((s,o)=>s+(o.amountCents||0),0);
    const cost=orders.filter(o=>o.direction==='cost').reduce((s,o)=>s+(o.amountCents||0),0);
    const freight=orders.reduce((s,o)=>s+o.freightCents,0);
    return {qty:orders.reduce((s,o)=>s+o.qty,0),shipments:orders.length,income,cost,freight,net:income-cost-freight};
  }
  const api={directionNames,yuan,cents,totals};
  if(typeof module!=='undefined')module.exports=api;
  else root.ProjectAccounts=api;
})(typeof window!=='undefined'?window:globalThis);
