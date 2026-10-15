import { seed } from './seed.mjs';
import { perform, query } from './domain.mjs';
const KEY='supor.prototype.v1.state', SESSION='supor.prototype.v1.session.';
export function createStore(adapter){
  let current;const listeners=new Set();
  const emit=()=>listeners.forEach(fn=>fn());
  function read(){try{const raw=adapter.getItem(KEY);const loaded=raw?JSON.parse(raw):null;if(loaded?.schema===1&&Array.isArray(loaded.products)&&Array.isArray(loaded.orders))return loaded;}catch{}return seed();}
  current=read();
  function save(state){try{adapter.setItem(KEY,JSON.stringify(state));}catch{throw new Error('浏览器保存空间不足。请减少上传图片大小，当前操作没有保存。');}current=state;}
  const api={
    getState(){current=read();return current;},
    async execute(session,type,payload={}){
      const operation=()=>{const result=perform(read(),session,type,payload);save(result.state);emit();return result.result;};
      if(globalThis.navigator?.locks)return navigator.locks.request('supor-prototype-mutation',operation);
      return operation();
    },
    query(session,type,payload={}){return query(read(),session,type,payload);},
    getSession(port){try{const value=JSON.parse(adapter.getItem(SESSION+port)||'null');if(!value)return null;const state=read(),user=state.users.find(x=>x.id===value.userId);if(!user?.enabled||value.version&&value.version!==user.sessionVersion)return null;return value;}catch{return null;}},
    setSession(port,value){if(value)adapter.setItem(SESSION+port,JSON.stringify({...value,port}));else adapter.removeItem(SESSION+port);},
    subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
    reset(){save(seed());for(const port of ['pc','mini','admin'])adapter.removeItem(SESSION+port);emit();},
    onExternalChange(){current=read();emit();}
  };
  if(!adapter.getItem(KEY))save(current);
  return api;
}
