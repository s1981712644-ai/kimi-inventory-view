(function(root){
  'use strict';
  const encoder=new TextEncoder(),decoder=new TextDecoder();
  const aad=encoder.encode('kimi-readonly-snapshot:v1');
  const b64=bytes=>{let result='';for(const byte of bytes)result+=String.fromCharCode(byte);return btoa(result);};
  const bytes=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
  async function key(password,salt,iterations,crypto){
    const material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  async function seal(value,password,crypto){
    const salt=crypto.getRandomValues(new Uint8Array(32)),iv=crypto.getRandomValues(new Uint8Array(12)),iterations=600000;
    const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},await key(password,salt,iterations,crypto),encoder.encode(JSON.stringify(value)));
    return {format:'kimi-encrypted-v1',iterations,salt:b64(salt),iv:b64(iv),ciphertext:b64(new Uint8Array(ciphertext))};
  }
  async function open(envelope,password,crypto){
    if(envelope.format!=='kimi-encrypted-v1'||envelope.iterations!==600000)throw Error('不支持的数据格式');
    const salt=bytes(envelope.salt),iv=bytes(envelope.iv);
    if(salt.length!==32||iv.length!==12)throw Error('数据格式异常');
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad},await key(password,salt,envelope.iterations,crypto),bytes(envelope.ciphertext));
    return JSON.parse(decoder.decode(plain));
  }
  const api={seal,open};if(typeof module!=='undefined')module.exports=api;else root.SnapshotCrypto=api;
})(typeof window==='undefined'?globalThis:window);
