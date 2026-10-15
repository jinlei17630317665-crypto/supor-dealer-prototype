// The three clients share these rules. No network services are called here.
const MENUS=['dealers','agreement','organizations','members','logs','products','categories','prices','tiers','specials','decoration','orders','aftersales','payments','invoices','commissions','reconciliation','reports','tasks'];
const BUTTONS=[...MENUS.map(x=>x+'.write'),'orders.review','orders.ship','commissions.settle','tasks.retry'];
const PROFILE=['name','taxId','contact','tel','province','city','district','address','license'];
const SOURCE=['code','sku','name','model','spec','unit','volume','stock','stockStatus','stockTime','seedStock','referencePrice'];
const APPROVED=['awaitingPayment','paid','shipped','completed','returning','refunded'];
const RECEIVABLE=['awaitingPayment','paid','shipped','completed','returning'];
const PAID=['paid','shipped','completed','returning','refunded'];
const clone=x=>structuredClone(x);
const now=()=>new Date().toISOString();
const round=(v,d=2)=>Number(Number(v).toFixed(d));
const sum=(xs,key)=>round(xs.reduce((n,x)=>n+Number(x[key]||0),0));
const fail=message=>{throw new Error(message);};
const ensure=(ok,message)=>{if(!ok)fail(message);};
const str=v=>String(v??'').trim();
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function bool(v,fallback=true){if(v===undefined)return fallback;ensure([true,false,'true','false'].includes(v),'启停或选择状态必须为是或否');return v===true||v==='true';}
function number(v,label,min=0,max=Infinity){ensure(v!==null&&v!==undefined&&str(v)!==''&&Number.isFinite(Number(v)),label+'必须是有效数字');const n=Number(v);ensure(n>=min&&n<=max,label+'超出允许范围');return n;}
function qty(v){const n=number(v,'数量',1);ensure(Number.isSafeInteger(n),'数量必须为正整数');return n;}
function money(v){return round(number(v,'价格',0.01));}
function required(v,label){ensure(str(v),label+'不能为空');return str(v);}
function phone(v){const x=required(v,'手机号');ensure(/^1\d{10}$/.test(x),'手机号必须为11位有效号码');return x;}
function password(v){const x=required(v,'密码');ensure(x.length>=8&&x.length<=64&&/[A-Za-z]/.test(x)&&/\d/.test(x),'密码需为8至64位，且同时包含字母和数字');return x;}
function list(v,label,empty=true){ensure(Array.isArray(v),label+'必须为数组');ensure(empty||v.length,label+'不能为空');ensure(v.every(x=>typeof x==='string'&&str(x)),label+'包含无效编号');ensure(new Set(v).size===v.length,label+'存在重复编号');return [...v];}
function get(s,key,id,label){const x=s[key]?.find(x=>x.id===id);ensure(x,(label||key)+'不存在');return x;}
function id(s,prefix){let value;do{value=prefix+(s.seq=Number(s.seq||100)+1);}while(Object.values(s).some(a=>Array.isArray(a)&&a.some(x=>x?.id===value)));return value;}
function pick(p,keys){return Object.fromEntries(keys.filter(k=>own(p,k)&&p[k]!==undefined).map(k=>[k,clone(p[k])]));}
function save(s,key,old,data,prefix){if(old){Object.assign(old,data);return old;}const x={id:id(s,prefix),...data};s[key].push(x);return x;}
function ancestors(s,key,start){const out=[],seen=new Set();let current=start;while(current){ensure(!seen.has(current),'层级存在循环');seen.add(current);const x=get(s,key,current,key==='orgs'?'组织':'分类');out.push(x);current=x.parentId;}return out;}
function division(s,orgId){return ancestors(s,'orgs',orgId).find(x=>x.type==='division')||null;}
function actor(s,session){ensure(session?.userId,'请先登录');const u=get(s,'users',session.userId,'登录账号');ensure(u.enabled!==false,'账号已停用，请重新登录');const version=session.version??session.sessionVersion;if(version!==undefined)ensure(version===(u.sessionVersion??1),'登录已失效，请重新登录');ensure(['pc','mini','admin'].includes(session.port),'登录端口无效');if(u.kind==='admin'){ensure(session.port==='admin','后台账号请从管理端登录');ensure(ancestors(s,'orgs',u.orgId).every(x=>x.enabled!==false),'所属组织已停用');get(s,'roles',u.roleId,'角色');}else{ensure(u.kind==='dealer'&&session.port!=='admin','经销商账号无后台权限');const d=get(s,'dealers',u.dealerId,'企业');ensure(d.enabled!==false,'企业已停用');}return u;}
function role(s,u){return get(s,'roles',u.roleId,'角色');}
function permitted(s,u,permission){if(u.kind!=='admin')return false;const r=role(s,u),menu=permission.split('.')[0];return r.menus.includes(menu)&&(!permission.includes('.')||r.buttons.includes(permission));}
function admin(s,u,permission){ensure(u.kind==='admin'&&permitted(s,u,permission),'没有'+permission+'操作权限');}
function globalScope(s,u){ensure(role(s,u).scope==='all','没有全组织数据范围权限');}
function dealerAllowed(s,u,dealerId){if(u.kind==='dealer')return dealerId===u.dealerId;if(role(s,u).scope==='all')return true;return division(s,u.orgId)?.dealerIds.includes(dealerId)===true;}
function dealerScope(s,u,dealerId){ensure(dealerAllowed(s,u,dealerId),'企业不在当前账号权限或组织范围内');return get(s,'dealers',dealerId,'企业');}
function orgScope(s,u,orgId){get(s,'orgs',orgId,'组织');if(role(s,u).scope==='all')return;const div=division(s,u.orgId);ensure(div&&ancestors(s,'orgs',orgId).some(x=>x.id===div.id),'组织不在当前账号权限范围内');}
function categoryWithin(s,categoryId,roots){const chain=ancestors(s,'categories',categoryId);return chain.every(x=>x.enabled!==false)&&chain.some(x=>roots.includes(x.id));}
function categoryScope(s,u,categoryId){get(s,'categories',categoryId,'分类');if(role(s,u).scope==='all')return;ensure(categoryWithin(s,categoryId,division(s,u.orgId)?.categoryIds||[]),'分类不在当前组织权限范围内');}
function productScope(s,u,productId){const p=get(s,'products',productId,'商品');categoryScope(s,u,p.categoryId);return p;}
function grade(s,d){return get(s,'grades',d.gradeId,'经销商等级');}
function shopping(s,u,mainOnly=false){ensure(u.kind==='dealer','仅经销商账号可执行此操作');const d=get(s,'dealers',u.dealerId,'企业');ensure(d.enabled!==false,'企业已停用');ensure(d.status==='approved','企业尚未审核通过，不能订货');ensure(grade(s,d).enabled!==false,'经销商等级已停用');if(mainOnly)ensure(u.isMain,'仅企业主账号有此权限');return d;}
function mainDealer(s,u){ensure(u.kind==='dealer'&&u.isMain,'仅企业主账号有此权限');return get(s,'dealers',u.dealerId,'企业');}
function regionCovers(parent,region){return parent.some(x=>region===x||region.startsWith(x+'/'));}
function validateRegions(s,d,regions){list(regions,'授权区域');ensure(regions.every(x=>/^[^/]+(?:\/[^/]+)?$/.test(x)),'授权区域需为省或省/市');if(d.parentId){const parent=get(s,'dealers',d.parentId,'上级企业');ensure(regions.every(x=>regionCovers(parent.regions,x)),'二级区域不能超出上级一级授权');}for(const child of s.dealers.filter(x=>x.parentId===d.id))ensure(child.regions.every(x=>regionCovers(regions,x)),'缩减一级区域与现有下级二级授权冲突');}
function validateProducts(s,d,ids){list(ids,'商品授权');ids.forEach(x=>get(s,'products',x,'商品'));if(d.parentId){const parent=get(s,'dealers',d.parentId,'上级企业');ensure(ids.every(x=>parent.productIds.includes(x)),'二级商品不能超出上级一级授权');}for(const child of s.dealers.filter(x=>x.parentId===d.id))ensure(child.productIds.every(x=>ids.includes(x)),'缩减一级商品与现有下级二级授权冲突');}
function visible(s,d,p){if(!p.onSale||!p.images?.length||!d.productIds.includes(p.id))return false;if(d.parentId){const parent=s.dealers.find(x=>x.id===d.parentId);if(!parent||parent.enabled===false||parent.status!=='approved'||!parent.productIds.includes(p.id))return false;}const cats=s.orgs.filter(x=>x.type==='division'&&x.enabled!==false&&x.dealerIds.includes(d.id)&&ancestors(s,'orgs',x.id).every(y=>y.enabled!==false)).flatMap(x=>x.categoryIds);return categoryWithin(s,p.categoryId,cats);}
function effectiveTierSteps(tier,productId){
  if(!tier)return [];
  const steps=new Map(tier.steps.map(step=>[step.min,{...step}]));
  for(const [min,discount] of Object.entries(tier.skuOverrides?.[productId]||{}))if(steps.has(Number(min)))steps.set(Number(min),{min:Number(min),discount});
  return [...steps.values()];
}
function quote(s,d,productId,quantity){const p=get(s,'products',productId,'商品');ensure(visible(s,d,p),'商品已下架或不在有效授权权限范围');const n=qty(quantity);const plans=s.specialPrices.filter(x=>x.enabled&&x.productId===p.id&&x.dealerIds.includes(d.id));ensure(plans.length<=1,'客户专属价方案重叠，请联系运营处理');const g=grade(s,d);ensure(g.enabled!==false,'经销商等级已停用');let unitPrice,discount=1,priceSource,priceSnapshot;if(plans.length){const plan=plans[0];unitPrice=money(plan.price);priceSource='客户专属价';priceSnapshot={gradeId:g.id,specialPriceId:plan.id,specialPrice:unitPrice,discount:1};}else{const gradePrice=money(s.gradePrices[p.id]?.[g.id]);const tier=s.tiers.find(x=>x.id===p.tierId&&x.enabled&&x.productIds.includes(p.id));const step=effectiveTierSteps(tier,p.id).filter(x=>x.min<=n).sort((a,b)=>b.min-a.min)[0];discount=step?.discount??1;unitPrice=round(gradePrice*discount);priceSource=discount===1?'等级价':`等级价 + 数量阶梯${round(discount*100)}%`;priceSnapshot={gradeId:g.id,gradePrice,discount,tierId:tier?.id||'',min:step?.min||1};}ensure(unitPrice>0,'商品有效价格缺失');return {productId:p.id,qty:n,unitPrice,source:priceSource,priceSource,total:round(unitPrice*n),discount,priceSnapshot};}
function normalizedItems(items){ensure(Array.isArray(items)&&items.length,'请选择有效订货商品');const grouped=new Map();for(const x of items){ensure(x&&str(x.productId),'商品编号不能为空');grouped.set(x.productId,(grouped.get(x.productId)||0)+qty(x.qty));}return [...grouped].map(([productId,n])=>({productId,qty:qty(n)}));}
function checkedItems(s,d,items){return normalizedItems(items).map(x=>{const p=get(s,'products',x.productId,'商品'),q=quote(s,d,p.id,x.qty);ensure(p.stockStatus==='success'&&p.stock!==null&&Number.isFinite(Number(p.stock)),'商品库存同步异常，请重试库存同步');ensure(Number(p.stock)>=x.qty,'商品'+p.sku+'库存不足');ensure(p.volume!==null&&p.volume!==undefined&&Number.isFinite(Number(p.volume))&&Number(p.volume)>0,'商品'+p.sku+'单位体积缺失，不能分类');return {productId:p.id,sku:p.sku,name:p.name,spec:p.spec,image:p.images[0],qty:x.qty,unitPrice:q.unitPrice,lineTotal:q.total,unitVolume:Number(p.volume),priceSource:q.priceSource,priceSnapshot:q.priceSnapshot};});}
function validateAddress(a){for(const k of ['contact','province','city','district','detail'])required(a[k],{contact:'收货联系人',province:'省份',city:'城市',district:'区县',detail:'详细地址'}[k]);phone(a.phone);}
function delivery(s,d,addressId){ensure(addressId,'请选择收货地址');const a=get(s,'addresses',addressId,'收货地址');ensure(a.dealerId===d.id,'无权使用其他企业收货地址');validateAddress(a);const region=a.province+'/'+a.city;ensure(regionCovers(d.regions,region),'收货地址不在企业授权区域');if(d.parentId)ensure(regionCovers(get(s,'dealers',d.parentId,'上级企业').regions,region),'收货区域超出一级授权');return a;}
function orderAllowed(s,u,o){return dealerAllowed(s,u,o.dealerId)&&(u.kind==='admin'||u.isMain||o.accountId===u.id);}
function orderScope(s,u,orderId){const o=get(s,'orders',orderId,'订单');ensure(orderAllowed(s,u,o),'没有此订单的权限或不在组织范围内');return o;}
function history(o,u,action,detail){o.history??=[];o.history.push({time:now(),userId:u.id,userName:u.name,action,detail});}
function log(s,u,type,objectId,detail='',kind='operation'){s.logs.push({id:id(s,'LOG'),time:now(),userId:u.id,userName:u.name,kind,action:type,objectId:objectId||'',result:'success',detail});}
function snapshot(s,d,items,addressId,remark){const lines=checkedItems(s,d,items),a=delivery(s,d,addressId),total=sum(lines,'lineTotal'),volume=round(lines.reduce((n,x)=>n+x.qty*x.unitVolume,0),6);const t=pick(s.config,['amountThreshold','volumeThreshold']);number(t.amountThreshold,'金额阈值');number(t.volumeThreshold,'体积阈值');const parent=d.parentId?get(s,'dealers',d.parentId,'上级企业'):null;return {items:lines,total,volume,size:total>t.amountThreshold||volume>t.volumeThreshold?'large':'small',thresholdSnapshot:t,addressSnapshot:clone(a),dealerSnapshot:pick(d,['id',...PROFILE,'phone','smartCode','gradeId']),commissionSnapshot:{parentId:parent?.id||'',rate:parent?number(parent.commissionRate,'佣金比例',0,1):0},remark:str(remark)};}
// Review snapshots exclude only the version collection to avoid recursive copies.
function reviewSnapshot(order){const {versions,...data}=order;return clone(data);}
function reviewVersion(s,order){
  order.versions??=[];
  const version=Number(order.reviewVersion||1),existing=order.versions.find(v=>v.version===version);
  if(existing)return existing;
  const submission=[...(order.history||[])].reverse().find(h=>['提交订单','修改后重提'].includes(h.action));
  const review=order.status==='pendingReview'?null:[...(order.history||[])].reverse().find(h=>['审核通过','审核驳回'].includes(h.action));
  const account=s.users.find(user=>user.id===order.accountId);
  const entry={version,submittedAt:submission?.time||order.createdAt,submittedBy:{id:submission?.userId||order.accountId,name:submission?.userName||account?.name||''},status:order.status,reason:order.reason||'',reviewedAt:review?.time||'',reviewedBy:review?{id:review.userId||'',name:review.userName||''}:null,snapshot:reviewSnapshot(order)};
  order.versions.push(entry);
  return entry;
}
function orderChanges(before,after){
  const labels={items:'商品明细',addressSnapshot:'收货地址',total:'订单金额',volume:'总体积',size:'大小件分类',dealerSnapshot:'企业资料',thresholdSnapshot:'大小件判定规则',commissionSnapshot:'分佣规则',remark:'订单备注'};
  return Object.entries(labels).filter(([field])=>JSON.stringify(before[field])!==JSON.stringify(after[field])).map(([field,label])=>({field,label,before:clone(before[field]),after:clone(after[field])}));
}
function changeSummary(before,after,changes){
  const parts=[];
  if(before.reason)parts.push('原审核原因：'+before.reason);
  const oldItems=new Map(before.items.map(item=>[item.productId,item])),newItems=new Map(after.items.map(item=>[item.productId,item]));
  for(const productId of new Set([...oldItems.keys(),...newItems.keys()])){
    const old=oldItems.get(productId),next=newItems.get(productId),item=next||old,label=`${item.name}（${item.sku}）`;
    if(!old)parts.push(label+'新增数量 '+next.qty);
    else if(!next)parts.push(label+'移除数量 '+old.qty);
    else{if(old.qty!==next.qty)parts.push(`${label}数量 ${old.qty} → ${next.qty}`);if(old.unitPrice!==next.unitPrice)parts.push(`${label}单价 ${old.unitPrice.toFixed(2)} → ${next.unitPrice.toFixed(2)}`);}
  }
  const address=a=>[a.contact,a.phone,a.province,a.city,a.district,a.detail].filter(Boolean).join(' ');
  for(const change of changes){
    switch(change.field){
      case 'items':break;
      case 'addressSnapshot':parts.push(`收货地址 ${address(change.before)} → ${address(change.after)}`);break;
      case 'total':parts.push(`订单金额 ${change.before.toFixed(2)} → ${change.after.toFixed(2)}`);break;
      case 'volume':parts.push(`总体积 ${change.before} → ${change.after} m³`);break;
      case 'size':parts.push(`大小件分类 ${change.before==='large'?'大件':'小件'} → ${change.after==='large'?'大件':'小件'}`);break;
      case 'remark':parts.push(`订单备注 ${change.before||'无'} → ${change.after||'无'}`);break;
      default:parts.push(change.label+'已更新');
    }
  }
  if(!changes.length)parts.push('资料已核实');
  parts.push('等待重新审核');
  return parts.join('；');
}
function checkOrderCurrent(s,o){const d=get(s,'dealers',o.dealerId,'企业');ensure(d.enabled!==false&&d.status==='approved','企业已停用或未审核通过');ensure(grade(s,d).enabled!==false,'企业等级已停用');const lines=checkedItems(s,d,o.items);validateAddress(o.addressSnapshot);ensure(o.addressSnapshot.dealerId===d.id&&regionCovers(d.regions,o.addressSnapshot.province+'/'+o.addressSnapshot.city),'订单地址不在授权区域');if(d.parentId)ensure(regionCovers(get(s,'dealers',d.parentId,'上级企业').regions,o.addressSnapshot.province+'/'+o.addressSnapshot.city),'订单地址超出一级授权区域');for(const x of lines){const old=o.items.find(y=>y.productId===x.productId);ensure(old&&old.unitPrice===x.unitPrice&&old.lineTotal===x.lineTotal,'订单价格已变更，请驳回后修改重提');}ensure(sum(lines,'lineTotal')===o.total,'订单总价格不一致，请重新提交');}
function task(s,system,type,objectId,key,failed=false){let t=s.tasks.find(x=>x.idempotencyKey===key);if(t)return t;t={id:id(s,'TASK'),system,type,objectId,idempotencyKey:key,status:failed?'failed':'success',error:failed?'接口响应失败，请检查后重试':'',externalNo:'',retries:0,time:now(),history:[]};if(!failed)t.externalNo=`${system}-${type}-${t.id}`;t.history.push({time:t.time,status:t.status,error:t.error,externalNo:t.externalNo});s.tasks.push(t);return t;}
function invoiceProfile(s,dealerId,p){const data=pick(p,['title','taxId','address','phone','bank','bankAccount','email']);for(const k of Object.keys({title:1,taxId:1,address:1,phone:1,bank:1,bankAccount:1,email:1}))data[k]=required(data[k],{title:'开票抬头',taxId:'税号',address:'开票地址',phone:'开票电话',bank:'开户行',bankAccount:'银行账号',email:'邮箱'}[k]);ensure(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email),'开票邮箱格式无效');const old=s.invoiceProfiles.find(x=>x.dealerId===dealerId);return save(s,'invoiceProfiles',old,{dealerId,...data},'IP');}
function period(p){const parse=(value,end)=>{if(!value)return null;const x=str(value);ensure(/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(x)&&Number.isFinite(Date.parse(x)),'日期格式无效');return /^\d{4}-\d{2}-\d{2}$/.test(x)?Date.parse(x+(end?'T23:59:59.999+08:00':'T00:00:00+08:00')):Date.parse(x);};const from=parse(p.from,false),to=parse(p.to,true);ensure(from===null||to===null||from<=to,'开始日期不能晚于结束日期');return value=>{const t=Date.parse(value);return Number.isFinite(t)&&(from===null||t>=from)&&(to===null||t<=to);};}
function filteredOrders(s,u,p={}){const inside=period(p);if(p.dealerId)dealerScope(s,u,p.dealerId);if(p.divisionId){const div=get(s,'orgs',p.divisionId,'事业部');ensure(div.type==='division','筛选组织必须为事业部');if(u.kind==='admin')orgScope(s,u,div.id);else ensure(div.dealerIds.includes(u.dealerId),'事业部不在账号权限范围');}if(p.categoryId&&u.kind==='admin')categoryScope(s,u,p.categoryId);return s.orders.filter(o=>orderAllowed(s,u,o)&&(!p.dealerId||o.dealerId===p.dealerId)&&(!p.status||p.status==='all'||o.status===p.status)&&(!p.size||o.size===p.size)&&(!p.divisionId||get(s,'orgs',p.divisionId).dealerIds.includes(o.dealerId))&&(!p.categoryId||o.items.some(x=>categoryWithin(s,get(s,'products',x.productId).categoryId,[p.categoryId])))&&(!p.q||(o.no+' '+o.dealerSnapshot.name+' '+o.items.map(x=>x.sku+' '+x.name).join(' ')).toLowerCase().includes(str(p.q).toLowerCase()))&&inside(o.createdAt));}
function createdTime(order){const time=Date.parse(order.createdAt);return Number.isFinite(time)?time:-Infinity;}
function reconciliation(s,u,p){
  if(u.kind==='admin')admin(s,u,'reconciliation');else shopping(s,u);
  const dealerId=p.dealerId||(u.kind==='dealer'?u.dealerId:'');
  if(dealerId)dealerScope(s,u,dealerId);
  const inPeriod=period(p),eligible=s.orders.filter(o=>orderAllowed(s,u,o)&&(!dealerId||o.dealerId===dealerId)),allowed=new Set(eligible.map(x=>x.id));
  const orders=eligible.filter(x=>inPeriod(x.createdAt));
  const payments=s.payments.filter(x=>allowed.has(x.orderId)&&x.status==='success'&&inPeriod(x.time));
  const refunds=s.refunds.filter(x=>allowed.has(x.orderId)&&x.status==='success'&&inPeriod(x.time));
  const commissionSettled=s.commissions.filter(x=>x.status==='settled'&&dealerAllowed(s,u,x.dealerId)&&(u.kind!=='admin'||dealerAllowed(s,u,x.childDealerId))&&(!dealerId||x.dealerId===dealerId)&&inPeriod(s.settlements.find(b=>b.id===x.batchId)?.time||x.time));
  const receivable=sum(orders.filter(x=>RECEIVABLE.includes(x.status)),'total'),totalPaid=sum(payments,'amount'),totalRefunded=sum(refunds,'amount');
  return {dealerId,from:p.from||'',to:p.to||'',orders,payments,refunds,commissionSettled,receivable,totalPaid,totalRefunded,totalCommissionSettled:sum(commissionSettled,'amount'),balance:round(receivable-totalPaid+totalRefunded)};
}

export function query(state,session,type,p={}){
  if(type==='agreement')return clone(state.config.agreement);
  if(type==='can'){try{const u=actor(state,session);return permitted(state,u,required(p.permission,'权限名称'));}catch{return false;}}
  const u=actor(state,session);let result;
  switch(type){
    case 'dealers':{
      ensure(u.kind==='admin'&&(permitted(state,u,'dealers')||permitted(state,u,'specials')),'没有经销商候选列表读取权限');
      let rows=state.dealers.filter(dealer=>dealerAllowed(state,u,dealer.id));
      if(p.id)rows=rows.filter(dealer=>dealer.id===p.id);
      if(p.q){const search=str(p.q).toLowerCase();rows=rows.filter(dealer=>[dealer.name,dealer.phone,dealer.smartCode,dealer.taxId].join(' ').toLowerCase().includes(search));}
      if(p.status&&p.status!=='all')rows=rows.filter(dealer=>dealer.status===p.status);
      if(p.gradeId)rows=rows.filter(dealer=>dealer.gradeId===p.gradeId);
      if(p.enabled!==undefined)rows=rows.filter(dealer=>dealer.enabled===bool(p.enabled));
      result=rows;break;
    }
    case 'products':{let rows;if(u.kind==='admin'){ensure(permitted(state,u,'products')||permitted(state,u,'specials'),'没有商品候选列表读取权限');rows=state.products.filter(x=>role(state,u).scope==='all'||categoryWithin(state,x.categoryId,division(state,u.orgId)?.categoryIds||[]));}else{const d=shopping(state,u);rows=state.products.filter(x=>visible(state,d,x));}if(p.categoryId){get(state,'categories',p.categoryId,'分类');rows=rows.filter(x=>categoryWithin(state,x.categoryId,[p.categoryId]));}if(p.q){const q=str(p.q).toLowerCase();rows=rows.filter(x=>(x.sku+' '+x.name+' '+x.model+' '+x.spec).toLowerCase().includes(q));}if(p.onSale!==undefined)rows=rows.filter(x=>x.onSale===bool(p.onSale));result=rows;break;}
    case 'quote':result=quote(state,shopping(state,u),p.productId,p.qty??1);break;
    case 'orders':if(u.kind==='admin')admin(state,u,'orders');else shopping(state,u);result=filteredOrders(state,u,p).reverse().sort((a,b)=>createdTime(b)-createdTime(a)||0);break;
    case 'order':if(u.kind==='admin')admin(state,u,'orders');else shopping(state,u);result=orderScope(state,u,p.id);break;
    case 'commissions':{if(u.kind==='admin')admin(state,u,'commissions');else{const d=shopping(state,u,true);ensure(grade(state,d).level===1,'仅一级经销商主账号有佣金权限');}if(p.dealerId)dealerScope(state,u,p.dealerId);const inside=period(p);result=state.commissions.filter(x=>dealerAllowed(state,u,x.dealerId)&&(u.kind==='dealer'||dealerAllowed(state,u,x.childDealerId))&&(!p.dealerId||x.dealerId===p.dealerId)&&(!p.status||x.status===p.status)&&inside(x.time));break;}
    case 'reconciliation':result=reconciliation(state,u,p);break;
    case 'report':{admin(state,u,'reports');ensure(['sales','shipments'].includes(p.kind||'sales'),'报表类型无效');const orders=filteredOrders(state,u,{...p,from:undefined,to:undefined}),inside=period(p),ids=new Set(orders.map(x=>x.id));const payments=state.payments.filter(x=>ids.has(x.orderId)&&x.status==='success'&&inside(x.time)),refunds=state.refunds.filter(x=>ids.has(x.orderId)&&x.status==='success'&&inside(x.time));let rows;
      if(p.kind==='shipments')rows=state.shipments.filter(x=>ids.has(x.orderId)&&inside(x.time)).flatMap(ship=>{const o=orders.find(x=>x.id===ship.orderId);return o.items.filter(x=>!p.categoryId||categoryWithin(state,get(state,'products',x.productId).categoryId,[p.categoryId])).map(x=>({...ship,shipmentId:ship.id,orderId:o.id,no:o.no,orderNo:o.no,dealerId:o.dealerId,dealerName:o.dealerSnapshot.name,status:o.status,size:o.size,productId:x.productId,sku:x.sku,name:x.name,qty:x.qty,unitPrice:x.unitPrice,total:x.lineTotal,amount:x.lineTotal}));});
      else rows=orders.filter(x=>inside(x.createdAt)).map(o=>({orderId:o.id,id:o.id,no:o.no,orderNo:o.no,dealerId:o.dealerId,dealerName:o.dealerSnapshot.name,createdAt:o.createdAt,time:o.createdAt,status:o.status,size:o.size,total:o.total,amount:o.total,qty:o.items.reduce((n,x)=>n+x.qty,0),approvedAmount:RECEIVABLE.includes(o.status)?o.total:0,paidAmount:sum(payments.filter(x=>x.orderId===o.id),'amount'),refundAmount:sum(refunds.filter(x=>x.orderId===o.id),'amount'),completedAmount:o.status==='completed'?o.total:0}));
      result={rows,total:sum(rows,'total'),approvedAmount:sum(orders.filter(x=>inside(x.createdAt)&&RECEIVABLE.includes(x.status)),'total'),paidAmount:sum(payments,'amount'),refundAmount:sum(refunds,'amount'),completedAmount:sum(orders.filter(x=>inside(x.createdAt)&&x.status==='completed'),'total'),quantity:sum(rows,'qty')};break;}
    default:fail('未知业务查询：'+type);
  }
  return clone(result);
}

export function perform(original,session,type,p={}){
  const s=clone(original);let u,result;
  if(type==='login'){
    ensure(['admin','dealer'].includes(p.kind),'账号类型无效');const found=s.users.find(x=>x.kind===p.kind&&x.phone===str(p.phone));ensure(found&&found.password===p.password,'账号或密码错误');const port=p.kind==='admin'?'admin':(p.port||session?.port||'pc');u=actor(s,{userId:found.id,port});result={userId:u.id,port,version:u.sessionVersion??1};log(s,u,'登录',u.id,'登录成功','login');
  }else if(type==='register'){
    ensure(p.agreed===true,'请阅读并同意入驻协议');const data=companyFields(p);const mobile=phone(p.phone);password(p.password);let d=p.id?get(s,'dealers',p.id,'企业'):null;
    if(d){ensure(d.status==='rejected','仅被驳回注册可修改重提');const account=s.users.find(x=>x.dealerId===d.id&&x.isMain);ensure(account&&account.phone===mobile&&account.password===p.password,'重提注册账号或密码错误');ensure(!s.users.some(x=>x.id!==account.id&&x.phone===mobile),'手机号已存在');uniqueCompany(s,data,d.id);Object.assign(d,data,{status:'pending',reason:'',agreementVersion:s.config.agreement.version,agreementTime:now()});history(d,account,'注册重提','驳回后修改企业资料并重新提交');result={dealer:d,userId:account.id};
    }else{ensure(!s.users.some(x=>x.phone===mobile),'手机号已存在，请登录后处理');uniqueCompany(s,data);d=createDealer(s,{...data,phone:mobile},p.password);result={dealer:d,userId:s.users.find(x=>x.dealerId===d.id&&x.isMain).id};}
  }else{
    u=actor(s,session);
    result=mutate(s,u,session,type,p);
    log(s,u,type,result?.id||p.id||p.objectId||u.id,'业务操作已完成');
  }
  s.revision=Number(s.revision||0)+1;
  return {state:s,result:clone(result)};
}

function companyFields(p,old={}){const data={...pick(old,PROFILE),...pick(p,PROFILE)};for(const k of PROFILE)data[k]=required(data[k],{name:'企业名称',taxId:'企业税号',contact:'联系人',tel:'联系电话',province:'省份',city:'城市',district:'区县',address:'企业地址',license:'营业执照资料'}[k]);return data;}
function uniqueCompany(s,p,except){const current=s.dealers.find(x=>x.id===except);ensure(!s.dealers.some(x=>x.id!==except&&((p.name!==current?.name&&x.name===p.name)||(p.taxId!==current?.taxId&&x.taxId===p.taxId))),'企业名称或税号重复，企业已存在');}
function createDealer(s,p,pwd='Supor123'){const d={id:id(s,'D'),...p,smartCode:'',gradeId:'',parentId:'',regions:[],productIds:[],commissionRate:0,status:'pending',reason:'',enabled:true,pendingProfile:null,history:[],agreementVersion:s.config.agreement.version,agreementTime:now()};const matches=s.smartArchives.filter(x=>x.name===p.name&&x.taxId===p.taxId);if(matches.length===1)d.smartCode=matches[0].code;s.dealers.push(d);s.users.push({id:id(s,'U'),kind:'dealer',dealerId:d.id,isMain:true,phone:p.phone,password:pwd,name:p.contact,enabled:true,sessionVersion:1});return d;}

function hierarchyDealers(s,d){if(!d.gradeId)return;const g=grade(s,d);if(g.level===1)ensure(!d.parentId,'一级经销商不能绑定上级');if(d.parentId){const parent=get(s,'dealers',d.parentId,'一级企业');ensure(parent.id!==d.id&&grade(s,parent).level===1&&g.level===2,'归属必须为一级绑定二级，不能循环');ensure(parent.enabled!==false,'上级企业已停用');}for(const child of s.dealers.filter(x=>x.parentId===d.id))ensure(g.level===1&&grade(s,child).level===2,'存在下级关联，不能改为二级');validateRegions(s,d,d.regions);validateProducts(s,d,d.productIds);}
function shelf(s,p){ensure(p.images?.length&&p.images.every(x=>str(x)),'上架商品必须有图片');ensure(ancestors(s,'categories',p.categoryId).every(x=>x.enabled!==false),'商品分类已停用');ensure(Object.values(s.gradePrices[p.id]||{}).some(x=>Number(x)>0),'上架商品缺少有效等级价格');}
function tierFields(s,p,old={}){const name=required(p.name??old.name,'阶梯名称'),enabled=bool(p.enabled,old.enabled??true),steps=clone(p.steps??old.steps);ensure(Array.isArray(steps)&&steps.length,'阶梯规则不能为空');const normalized=steps.map(x=>({min:qty(x.min),discount:number(x.discount,'阶梯折扣',0.000001,1)})).sort((a,b)=>a.min-b.min);ensure(normalized[0].min===1,'阶梯第一档数量必须从1开始');ensure(new Set(normalized.map(x=>x.min)).size===normalized.length,'阶梯数量存在重复区间');const productIds=list(p.productIds??old.productIds??[],'阶梯商品');productIds.forEach(x=>get(s,'products',x,'商品'));return {name,enabled,steps:normalized,productIds};}
function applyTier(s,u,p){admin(s,u,'tiers.write');const old=p.id?get(s,'tiers',p.id,'阶梯'):null,data=tierFields(s,p,old||{});[...new Set([...(old?.productIds||[]),...data.productIds])].forEach(x=>productScope(s,u,x));ensure(!s.tiers.some(x=>x.id!==old?.id&&x.name===data.name),'阶梯名称重复');const t=save(s,'tiers',old,data,'TIER');
  if(t.skuOverrides){const mins=new Set(t.steps.map(step=>step.min));for(const [productId,overrides] of Object.entries(t.skuOverrides)){const valid=Object.fromEntries(Object.entries(overrides).filter(([min])=>mins.has(Number(min))).map(([min,discount])=>[Number(min),discount]));if(t.productIds.includes(productId)&&Object.keys(valid).length)t.skuOverrides[productId]=valid;else delete t.skuOverrides[productId];}}
  for(const product of s.products){if(product.tierId===t.id&&!data.productIds.includes(product.id))product.tierId='';if(data.productIds.includes(product.id)){for(const other of s.tiers)if(other.id!==t.id)other.productIds=other.productIds.filter(x=>x!==product.id);product.tierId=t.id;}}return t;}
function applySpecial(s,u,p){admin(s,u,'specials.write');const old=p.id?get(s,'specialPrices',p.id,'专属价方案'):null;const data={name:required(p.name??old?.name,'专属价名称'),productId:p.productId??old?.productId,price:money(p.price??old?.price),dealerIds:list(p.dealerIds??old?.dealerIds??[],'专属价企业'),enabled:bool(p.enabled,old?.enabled??true)};productScope(s,u,data.productId);if(old){productScope(s,u,old.productId);old.dealerIds.forEach(x=>dealerScope(s,u,x));}data.dealerIds.forEach(x=>dealerScope(s,u,x));ensure(!s.specialPrices.some(x=>x.id!==old?.id&&x.name===data.name),'专属价方案名称重复');if(data.enabled)ensure(!s.specialPrices.some(x=>x.id!==old?.id&&x.enabled&&x.productId===data.productId&&x.dealerIds.some(y=>data.dealerIds.includes(y))),'客户专属价授权重叠，请先移出原方案');return save(s,'specialPrices',old,data,'SP');}
function applyGradePrices(s,u,rows){admin(s,u,'prices.write');ensure(Array.isArray(rows)&&rows.length,'价格行不能为空');const seen=new Set(),values=rows.map((r,i)=>{try{productScope(s,u,r.productId);const g=get(s,'grades',r.gradeId,'经销商等级');ensure(g.enabled!==false,'经销商等级已停用');const key=r.productId+':'+r.gradeId;ensure(!seen.has(key),'等级价格存在重复行');seen.add(key);return {productId:r.productId,gradeId:r.gradeId,price:money(r.price)};}catch(e){fail(`第${i+1}行：${e.message}`);}});s.priceHistory??=[];for(const r of values){s.gradePrices[r.productId]??={};const oldPrice=s.gradePrices[r.productId][r.gradeId];s.gradePrices[r.productId][r.gradeId]=r.price;s.priceHistory.push({id:id(s,'PRICE'),...r,oldPrice:oldPrice??null,time:now(),userId:u.id});}return {count:values.length,rows:values};}
function layoutFields(s,u,layout){ensure(layout&&typeof layout==='object'&&!Array.isArray(layout),'装修布局无效');const x=pick(layout,['title','subtitle','bannerImage','bannerProductId','footer','blocks']);required(x.title,'首页标题');ensure(Array.isArray(x.blocks),'装修组件必须为数组');const ids=new Set();for(const b of x.blocks){required(b.id,'组件编号');ensure(!ids.has(b.id),'装修组件编号重复');ids.add(b.id);ensure(['banner','products','text','category'].includes(b.type),'装修组件类型无效');b.visible=bool(b.visible,true);b.productIds=list(b.productIds||[],'关联商品');b.productIds.forEach(y=>productScope(s,u,y));if(b.type==='banner'&&b.visible)required(b.image,'轮播图片');if(b.type==='text'&&b.visible)required(b.content,'文本组件内容');}if(x.bannerProductId)productScope(s,u,x.bannerProductId);return x;}
function scopedTask(s,u,t){if(t.type==='sync'){globalScope(s,u);return;}if(t.system==='SAP'){sapRecord(s,u,t.type,t.objectId);return;}if(t.type==='fulfillment')orderScope(s,u,t.objectId);else if(t.type==='return')orderScope(s,u,get(s,'returns',t.objectId,'退货单').orderId);else if(t.type==='invoice')orderScope(s,u,get(s,'invoices',t.objectId,'发票申请').orderId);else fail('未知接口任务类型，不能重试');}
function sapRecord(s,u,type,objectId){const keys={order:'orders',payment:'payments',return:'returns',refund:'refunds',invoice:'invoices',settlement:'settlements'};ensure(keys[type],'SAP单据类型无效');const x=get(s,keys[type],objectId,'来源业务单据');if(type==='settlement'){ensure(x.commissionIds?.length,'结算单无有效佣金');for(const cid of x.commissionIds){const c=get(s,'commissions',cid,'佣金');dealerScope(s,u,c.dealerId);dealerScope(s,u,c.childDealerId);ensure(c.status==='settled'&&c.batchId===x.id,'佣金结算状态无效');}}else{const o=orderScope(s,u,type==='order'?x.id:x.orderId);if(type==='order')ensure(APPROVED.includes(o.status),'订单未审核通过或状态不允许推送SAP');if(type==='payment'||type==='refund')ensure(x.status==='success','仅成功资金流水可推送SAP');if(type==='invoice')ensure(x.status==='issued'&&x.invoiceNo,'发票尚未开具，不能推送SAP');if(type==='return')ensure(['requested','received','refundFailed','refunded'].includes(x.status),'退货单状态无效');}return x;}

function importRows(s,u,p){
  ensure(['gradePrices','tiers','specials','division','order'].includes(p.type),'Excel导入类型无效');ensure(Array.isArray(p.rows)&&p.rows.length,'Excel没有可导入的数据行');
  if(p.type==='order')shopping(s,u);else admin(s,u,{gradePrices:'prices.write',tiers:'tiers.write',specials:'specials.write',division:'organizations.write'}[p.type]);
  const items=[],priceRows=[],dealerIds=[],seen=new Set(),tierRows=[];
  for(let i=0;i<p.rows.length;i++){
    try{const r=p.rows[i];ensure(r&&typeof r==='object'&&!Array.isArray(r),'Excel行格式无效');
      if(['specials','division'].includes(p.type)){const name=required(r.企业名称??r.name,'企业名称'),matches=s.dealers.filter(x=>x.name===name);ensure(matches.length===1,'企业名称必须唯一匹配已注册企业');const d=dealerScope(s,u,matches[0].id);ensure(!seen.has(d.id),'企业名称重复');seen.add(d.id);dealerIds.push(d.id);continue;}
      const sku=required(r.SKU??r.sku,'SKU'),matches=s.products.filter(x=>x.sku===sku);ensure(matches.length===1,'SKU '+sku+' 不存在或不能唯一匹配');const product=matches[0];
      if(p.type==='order'){const quantity=r.订货数量??r.数量??r.qty;if(str(quantity)===''||(['number','string'].includes(typeof quantity)&&Number(quantity)===0))continue;items.push({productId:product.id,qty:qty(quantity)});continue;}
      productScope(s,u,product.id);ensure(!seen.has(product.id),'SKU重复');seen.add(product.id);
      if(p.type==='gradePrices'){
        let n=0;if(own(r,'gradeId')){get(s,'grades',r.gradeId,'等级');priceRows.push({productId:product.id,gradeId:r.gradeId,price:money(r.price)});n++;}
        else for(const [header,value] of Object.entries(r)){if(['SKU','sku','商品名称','规格','型号'].includes(header)||str(value)==='')continue;const gs=s.grades.filter(x=>x.name===header);ensure(gs.length===1,'未知或重复的等级表头：'+header);priceRows.push({productId:product.id,gradeId:gs[0].id,price:money(value)});n++;}
      }else{
        if(p.planId&&(r.min!==undefined||r.数量!==undefined||r.折扣!==undefined||r.discount!==undefined)){tierRows.push({productId:product.id,planId:p.planId,min:qty(r.min??r.数量??r.qty),discount:number(r.discount??r.折扣,'阶梯折扣',0.000001,1)});}
        else{let n=0;for(const [header,value] of Object.entries(r)){if(['SKU','sku','商品名称','规格','型号'].includes(header)||str(value)==='')continue;const plans=s.tiers.filter(x=>x.name===header);ensure(plans.length===1,'未知或重复的阶梯标准表头：'+header);tierRows.push({productId:product.id,planId:plans[0].id,discount:number(value,'阶梯折扣',0.000001,1)});n++;}ensure(n<=1,'每个SKU仅可填写一个阶梯标准，不能叠加');}
      }
    }catch(e){fail(`Excel第${i+2}行：${e.message}`);}
  }
  if(p.type==='order'){const normalized=normalizedItems(items);checkedItems(s,shopping(s,u),normalized);return {items:normalized};}
  if(p.type==='gradePrices')return applyGradePrices(s,u,priceRows);
  if(p.type==='specials'){const plan=get(s,'specialPrices',p.planId,'专属价方案');return applySpecial(s,u,{...plan,dealerIds:[...new Set([...plan.dealerIds,...dealerIds])]});}
  if(p.type==='division'){const div=get(s,'orgs',p.divisionId,'事业部');return mutate(s,u,null,'bindDivision',{id:div.id,categoryIds:div.categoryIds,dealerIds:[...new Set([...div.dealerIds,...dealerIds])]});}
  ensure(tierRows.length,'Excel未填写任何阶梯折扣');
  for(const row of tierRows){
    const tier=get(s,'tiers',row.planId,'阶梯标准'),product=productScope(s,u,row.productId);
    ensure(tier.enabled!==false,'阶梯标准已停用，请选择有效标准');
    const min=row.min??[...tier.steps].sort((a,b)=>a.min-b.min).at(-1)?.min;
    qty(min);
    ensure(tier.steps.some(step=>step.min===min),'阶梯数量档未定义，请先维护标准');
    // A workbook cell overrides this SKU only; the named standard remains intact.
    tier.skuOverrides??={};
    tier.skuOverrides[product.id]??={};
    tier.skuOverrides[product.id][min]=row.discount;
    if(!tier.productIds.includes(product.id))tier.productIds.push(product.id);
    for(const other of s.tiers)if(other.id!==tier.id){
      other.productIds=other.productIds.filter(productId=>productId!==product.id);
      if(other.skuOverrides)delete other.skuOverrides[product.id];
    }
    product.tierId=tier.id;
  }
  return {count:p.rows.length};
}

function mutate(s,u,session,type,p){
  switch(type){
    case 'saveDealer':{
      admin(s,u,'dealers.write');ensure(!own(p,'smartCode'),'SMART编码为只读，请使用档案关联');let d=p.id?dealerScope(s,u,p.id):null;const fields=companyFields(p,d||{});uniqueCompany(s,fields,d?.id);const mobile=phone(p.phone??d?.phone);const account=d?s.users.find(x=>x.dealerId===d.id&&x.isMain):null;ensure(!s.users.some(x=>x.id!==account?.id&&x.phone===mobile),'手机号重复，账号已存在');
      if(!d){d=createDealer(s,{...fields,phone:mobile},p.password?password(p.password):'Supor123');if(role(s,u).scope==='org'){const div=division(s,u.orgId);ensure(div,'当前组织未归属事业部，不能创建企业');div.dealerIds.push(d.id);}}else{
        if(d.status==='approved'&&PROFILE.some(k=>fields[k]!==d[k])){d.pendingProfile={...fields,submittedAt:now(),submittedBy:u.id};history(d,u,'资料变更申请','后台企业核心资料变更，原审核版本保留');}else Object.assign(d,fields);
        if(account&&account.phone!==mobile){account.phone=mobile;account.sessionVersion=(account.sessionVersion||1)+1;}d.phone=mobile;
      }
      if(own(p,'parentId')){if(d.parentId)dealerScope(s,u,d.parentId);if(p.parentId)dealerScope(s,u,p.parentId);}
      for(const k of ['gradeId','parentId'])if(own(p,k))d[k]=str(p[k]);if(own(p,'enabled'))d.enabled=bool(p.enabled);if(own(p,'regions'))d.regions=list(p.regions,'授权区域');if(own(p,'productIds')){const productIds=list(p.productIds,'商品授权');productIds.forEach(x=>productScope(s,u,x));d.productIds=productIds;}if(own(p,'commissionRate'))d.commissionRate=number(p.commissionRate,'佣金比例',0,1);hierarchyDealers(s,d);return d;
    }
    case 'reviewDealer':{
      admin(s,u,'dealers.write');const d=dealerScope(s,u,p.id);ensure(['pending','rejected'].includes(d.status),'企业不在待审核状态');const approved=bool(p.approved);if(approved){ensure(d.smartCode&&s.smartArchives.some(x=>x.code===d.smartCode),'请先关联有效SMART企业档案');const g=get(s,'grades',p.gradeId,'经销商等级');ensure(g.enabled!==false,'等级已停用');d.gradeId=g.id;hierarchyDealers(s,d);d.status='approved';d.reason='';}else{d.reason=required(p.reason,'驳回原因');d.status='rejected';}history(d,u,approved?'入驻审核通过':'入驻审核驳回',d.reason||'审核通过');return d;
    }
    case 'matchArchive':{admin(s,u,'dealers.write');const d=dealerScope(s,u,p.id),a=s.smartArchives.find(x=>x.code===p.smartCode);ensure(a,'SMART档案不存在');ensure(!s.dealers.some(x=>x.id!==d.id&&x.smartCode===a.code),'SMART档案已关联其他企业');ensure(a.name===d.name&&a.taxId===d.taxId,'SMART档案企业名称或税号不一致');d.smartCode=a.code;history(d,u,'关联SMART档案',a.code);return d;}
    case 'syncMaster':{
      ensure(['products','stock','dealers'].includes(p.kind),'SMART同步类型无效');admin(s,u,p.kind==='dealers'?'dealers.write':'products.write');globalScope(s,u);const failed=bool(p.fail,false);if(p.kind==='stock')for(const product of s.products){product.stockStatus=failed?'failed':'success';product.stockTime=now();}
      if(p.kind==='dealers'&&!failed)for(const d of s.dealers.filter(x=>!x.smartCode)){const matches=s.smartArchives.filter(x=>x.name===d.name&&x.taxId===d.taxId&&!s.dealers.some(y=>y.smartCode===x.code));if(matches.length===1)d.smartCode=matches[0].code;}
      const t=task(s,'SMART','sync',p.kind,`sync:${p.kind}:${id(s,'SYNC')}`,failed);t.detail=failed?'SMART同步未完成，等待重试':'SMART同步已完成';return t;
    }
    case 'saveGrade':{
      admin(s,u,'dealers.write');globalScope(s,u);const old=p.id?get(s,'grades',p.id,'等级'):null,name=required(p.name??old?.name,'等级名称'),level=number(p.level??old?.level,'经销商等级',1,2),enabled=bool(p.enabled,old?.enabled??true);ensure(Number.isInteger(level),'等级仅支持一级或二级');ensure(!s.grades.some(x=>x.id!==old?.id&&x.name===name),'等级名称重复');if(old&&(!enabled||level!==old.level))ensure(!s.dealers.some(x=>x.gradeId===old.id),'等级已被经销商引用，不能停用或更改层级');return save(s,'grades',old,{name,level,enabled},'G');
    }
    case 'bindDealers':{
      admin(s,u,'dealers.write');const parent=dealerScope(s,u,p.parentId),ids=list(p.dealerIds,'绑定企业');ensure(grade(s,parent).level===1,'上级必须为一级经销商');ensure(parent.enabled!==false&&parent.status==='approved','一级企业必须已审核且启用');for(const childId of ids){const d=dealerScope(s,u,childId);if(d.parentId)dealerScope(s,u,d.parentId);ensure(grade(s,d).level===2&&d.id!==parent.id,'绑定企业必须为二级，不能循环');d.parentId=parent.id;hierarchyDealers(s,d);}return parent;
    }
    case 'setRegions':{admin(s,u,'dealers.write');const d=dealerScope(s,u,p.id),regions=list(p.regions,'授权区域');validateRegions(s,d,regions);d.regions=regions;return d;}
    case 'setProductAuthorization':{admin(s,u,'dealers.write');const d=dealerScope(s,u,p.id),ids=list(p.productIds,'商品授权');ids.forEach(x=>productScope(s,u,x));validateProducts(s,d,ids);d.productIds=ids;return d;}
    case 'setCommissionRate':{admin(s,u,'dealers.write');const d=dealerScope(s,u,p.id);ensure(grade(s,d).level===1,'仅一级经销商可设置分佣比例');d.commissionRate=number(p.rate,'佣金比例',0,1);return d;}
    case 'saveOrg':{
      admin(s,u,'organizations.write');const old=p.id?get(s,'orgs',p.id,'组织'):null;if(old)orgScope(s,u,old.id);const data={name:required(p.name??old?.name,'组织名称'),type:p.type??old?.type,parentId:str(p.parentId??old?.parentId),enabled:bool(p.enabled,old?.enabled??true)};ensure(['group','division','department'].includes(data.type),'组织类型无效');if(data.type==='group'){globalScope(s,u);ensure(!data.parentId,'集团不能设置上级，防止层级循环');ensure(!s.orgs.some(x=>x.type==='group'&&x.id!==old?.id),'仅支持一个集团经营主体');}else{required(data.parentId,'上级组织');orgScope(s,u,data.parentId);const parent=get(s,'orgs',data.parentId);ensure(parent.enabled!==false,'上级组织已停用');ensure(data.type==='division'?parent.type==='group':['division','department'].includes(parent.type),'组织层级不正确');}
      ensure(!s.orgs.some(x=>x.id!==old?.id&&x.parentId===data.parentId&&x.name===data.name),'同层组织名称重复');if(old&&!data.enabled)ensure(!s.orgs.some(x=>x.parentId===old.id&&x.enabled!==false)&&!s.users.some(x=>x.orgId===old.id)&&!old.dealerIds.length&&!old.categoryIds.length,'组织被成员、绑定或下级引用，不能停用');const x=save(s,'orgs',old,{...data,categoryIds:old?.categoryIds||[],dealerIds:old?.dealerIds||[]},'ORG');for(const o of s.orgs){const chain=ancestors(s,'orgs',o.id);if(o.type==='division')ensure(chain[1]?.type==='group','事业部上级必须为集团');if(o.type==='department')ensure(['division','department'].includes(chain[1]?.type),'部门上级必须为事业部或部门');}return x;
    }
    case 'bindDivision':{
      admin(s,u,'organizations.write');const x=get(s,'orgs',p.id,'事业部');orgScope(s,u,x.id);ensure(x.type==='division'&&x.enabled!==false,'仅启用的事业部可绑定');const cats=list(p.categoryIds,'事业部分类'),ds=list(p.dealerIds,'事业部企业');cats.forEach(y=>categoryScope(s,u,y));for(const d of [...new Set([...x.dealerIds,...ds])])dealerScope(s,u,d);x.categoryIds=cats;x.dealerIds=ds;return x;
    }
    case 'saveMember':{
      admin(s,u,'members.write');const old=p.id?get(s,'users',p.id,'后台成员'):null;if(old){ensure(old.kind==='admin','此处只能维护后台成员');orgScope(s,u,old.orgId);}const orgId=p.orgId??old?.orgId,r=get(s,'roles',p.roleId??old?.roleId,'角色');orgScope(s,u,orgId);ensure(ancestors(s,'orgs',orgId).every(x=>x.enabled!==false),'所属组织已停用');if(role(s,u).scope!=='all'){ensure(r.scope==='org'&&r.menus.every(x=>role(s,u).menus.includes(x))&&r.buttons.every(x=>role(s,u).buttons.includes(x)),'不能分配超出本人权限的角色');}const loginName=str(p.phone??old?.phone),mobile=old&&loginName===old.phone?loginName:phone(loginName);ensure(!s.users.some(x=>x.id!==old?.id&&x.phone===mobile),'成员手机号重复，账号已存在');const data={kind:'admin',name:required(p.name??old?.name,'成员姓名'),phone:mobile,password:p.password?password(p.password):(old?.password||'Supor123'),orgId,roleId:r.id,enabled:bool(p.enabled,old?.enabled??true),sessionVersion:old?.sessionVersion??1};if(old&&['phone','password','orgId','roleId','enabled'].some(k=>data[k]!==old[k]))data.sessionVersion++;ensure(!(old?.id===u.id&&!data.enabled),'不能停用当前登录成员');return save(s,'users',old,data,'U');
    }
    case 'saveRole':{
      admin(s,u,'members.write');globalScope(s,u);const old=p.id?get(s,'roles',p.id,'角色'):null,data={name:required(p.name??old?.name,'角色名称'),menus:list(p.menus??old?.menus??[],'菜单权限'),buttons:list(p.buttons??old?.buttons??[],'按钮权限'),scope:p.scope??old?.scope??'org'};ensure(['all','org'].includes(data.scope),'角色数据范围无效');ensure(data.menus.every(x=>MENUS.includes(x))&&data.buttons.every(x=>BUTTONS.includes(x)),'菜单或按钮权限名称无效');ensure(data.buttons.every(x=>data.menus.includes(x.split('.')[0])),'按钮权限必须同时具有对应菜单权限');ensure(!s.roles.some(x=>x.id!==old?.id&&x.name===data.name),'角色名称重复');const r=save(s,'roles',old,data,'ROLE');for(const member of s.users.filter(x=>x.kind==='admin'&&x.roleId===r.id))member.sessionVersion=(member.sessionVersion||1)+1;return r;
    }
    case 'saveCategory':{
      admin(s,u,'categories.write');const old=p.id?get(s,'categories',p.id,'分类'):null;if(old)categoryScope(s,u,old.id);const data={name:required(p.name??old?.name,'分类名称'),parentId:str(p.parentId??old?.parentId),sort:number(p.sort??old?.sort??0,'排序',0),enabled:bool(p.enabled,old?.enabled??true)};if(data.parentId){categoryScope(s,u,data.parentId);ensure(get(s,'categories',data.parentId).enabled!==false,'上级分类已停用');}else globalScope(s,u);ensure(!s.categories.some(x=>x.id!==old?.id&&x.parentId===data.parentId&&x.name===data.name),'同层分类名称重复');if(old&&!data.enabled)ensure(!s.products.some(x=>x.categoryId===old.id)&&!s.categories.some(x=>x.parentId===old.id)&&!s.orgs.some(x=>x.categoryIds.includes(old.id))&&!s.attributes.some(x=>x.categoryIds.includes(old.id)),'分类被商品、组织或下级引用，不能停用');const c=save(s,'categories',old,data,'CAT');for(const x of s.categories)ensure(ancestors(s,'categories',x.id).length<=3,'商品分类最多支持三级');return c;
    }
    case 'saveAttribute':{
      admin(s,u,'categories.write');const old=p.id?get(s,'attributes',p.id,'属性'):null;const data={name:required(p.name??old?.name,'属性名称'),categoryIds:list(p.categoryIds??old?.categoryIds??[],'属性分类'),source:p.source??old?.source??'local',enabled:bool(p.enabled,old?.enabled??true)};[...new Set([...(old?.categoryIds||[]),...data.categoryIds])].forEach(x=>categoryScope(s,u,x));ensure(['local','SMART'].includes(data.source),'属性来源无效');if(old?.source==='SMART')ensure(data.name===old.name&&data.source===old.source,'SMART来源属性名称及来源只读');ensure(!s.attributes.some(x=>x.id!==old?.id&&x.name===data.name),'属性同名或来源冲突');return save(s,'attributes',old,data,'ATTR');
    }
    case 'saveProduct':{
      admin(s,u,'products.write');const product=productScope(s,u,p.id);ensure(!SOURCE.some(k=>own(p,k)),'SMART商品来源字段只读，不能本地修改');if(own(p,'categoryId')){categoryScope(s,u,p.categoryId);product.categoryId=p.categoryId;}if(own(p,'onSale'))product.onSale=bool(p.onSale);if(own(p,'images')){ensure(Array.isArray(p.images)&&p.images.every(x=>typeof x==='string'&&str(x)),'商品图片列表无效');product.images=clone(p.images);}if(own(p,'attrs')){ensure(p.attrs&&typeof p.attrs==='object'&&!Array.isArray(p.attrs),'商品属性格式无效');for(const [name,value] of Object.entries(p.attrs)){const def=s.attributes.find(x=>x.name===name);if(def?.source==='SMART')ensure(value===product.attrs[name],'SMART来源属性只读：'+name);if(def)ensure(def.categoryIds.some(x=>ancestors(s,'categories',product.categoryId).some(y=>y.id===x)),'属性不适用于当前分类');ensure(['string','number','boolean'].includes(typeof value),'属性值格式无效');}product.attrs={...product.attrs,...clone(p.attrs)};}if(own(p,'tierId')){if(p.tierId){const t=get(s,'tiers',p.tierId,'阶梯');ensure(t.enabled!==false,'阶梯已停用');for(const other of s.tiers)other.productIds=other.productIds.filter(x=>x!==product.id);t.productIds.push(product.id);}else for(const t of s.tiers)t.productIds=t.productIds.filter(x=>x!==product.id);product.tierId=str(p.tierId);}if(product.onSale)shelf(s,product);return product;
    }
    case 'bulkShelf':{admin(s,u,'products.write');const ids=list(p.ids,'商品选择',false),onSale=bool(p.onSale);const products=ids.map(x=>productScope(s,u,x));if(onSale)products.forEach(x=>shelf(s,x));products.forEach(x=>x.onSale=onSale);return {count:products.length,ids};}
    case 'saveGradePrices':return applyGradePrices(s,u,p.rows);
    case 'saveTier':return applyTier(s,u,p);
    case 'saveSpecialPrice':return applySpecial(s,u,p);
    case 'importRows':return importRows(s,u,p);
    case 'saveAgreement':{admin(s,u,'agreement.write');globalScope(s,u);s.config.agreement={version:Number(s.config.agreement.version)+1,title:required(p.title,'协议标题'),content:required(p.content,'协议正文'),updatedAt:now()};return s.config.agreement;}
    case 'saveDecoration':{admin(s,u,'decoration.write');globalScope(s,u);ensure(['pc','mini'].includes(p.port),'装修端口无效');s.decoration[p.port].draft=layoutFields(s,u,p.layout);return s.decoration[p.port].draft;}
    case 'publishDecoration':{admin(s,u,'decoration.write');globalScope(s,u);ensure(['pc','mini'].includes(p.port),'装修端口无效');const layout=layoutFields(s,u,s.decoration[p.port].draft);s.decoration[p.port].published=clone(layout);return s.decoration[p.port].published;}
    case 'saveThresholds':{admin(s,u,'orders.write');globalScope(s,u);s.config.amountThreshold=number(p.amountThreshold,'金额阈值',0);s.config.volumeThreshold=number(p.volumeThreshold,'体积阈值',0);return pick(s.config,['amountThreshold','volumeThreshold']);}
    case 'cartAdd':{const d=shopping(s,u),n=qty(p.qty),cart=s.carts[u.id]??=[];const line=cart.find(x=>x.productId===p.productId),quantity=(line?.qty||0)+n;checkedItems(s,d,[{productId:p.productId,qty:quantity}]);if(line)line.qty=quantity;else cart.push({productId:p.productId,qty:n,selected:true});return cart;}
    case 'cartUpdate':{const d=shopping(s,u),cart=s.carts[u.id]||[],line=cart.find(x=>x.productId===p.productId);ensure(line,'购物车商品不存在');if(own(p,'qty')){checkedItems(s,d,[{productId:line.productId,qty:p.qty}]);line.qty=qty(p.qty);}if(own(p,'selected'))line.selected=bool(p.selected);return line;}
    case 'cartRemove':{shopping(s,u);const ids=list(p.ids,'购物车商品',false),cart=s.carts[u.id]||[];ensure(ids.every(x=>cart.some(y=>y.productId===x)),'购物车商品不存在');s.carts[u.id]=cart.filter(x=>!ids.includes(x.productId));return s.carts[u.id];}
    case 'cartSelect':{const d=shopping(s,u),ids=list(p.ids,'购物车商品'),cart=s.carts[u.id]||[],selected=bool(p.selected);ensure(ids.every(x=>cart.some(y=>y.productId===x)),'购物车商品不存在');if(selected)for(const x of cart.filter(x=>ids.includes(x.productId)))checkedItems(s,d,[x]);for(const x of cart)if(ids.includes(x.productId))x.selected=selected;return cart;}
    case 'saveAddress':{const d=shopping(s,u),old=p.id?get(s,'addresses',p.id,'收货地址'):null;ensure(!old||old.dealerId===d.id,'没有此地址的权限');const data={...pick(old||{},['contact','phone','province','city','district','detail']),...pick(p,['contact','phone','province','city','district','detail']),dealerId:d.id,isDefault:bool(p.isDefault,old?.isDefault??!s.addresses.some(x=>x.dealerId===d.id))};validateAddress(data);const a=save(s,'addresses',old,data,'ADR');if(a.isDefault)for(const x of s.addresses.filter(x=>x.dealerId===d.id&&x.id!==a.id))x.isDefault=false;return a;}
    case 'deleteAddress':{const d=shopping(s,u),a=get(s,'addresses',p.id,'收货地址');ensure(a.dealerId===d.id,'没有此地址的权限');s.addresses=s.addresses.filter(x=>x.id!==a.id);if(a.isDefault){const other=s.addresses.find(x=>x.dealerId===d.id);if(other)other.isDefault=true;}return a;}
    case 'submitOrder':{
      const d=shopping(s,u);if(p.idempotencyKey){const prior=s.orders.find(x=>x.accountId===u.id&&x.idempotencyKey===str(p.idempotencyKey));if(prior)return prior;}
      const data=snapshot(s,d,p.items,p.addressId,p.remark);const orderId=id(s,'ORDER');const o={id:orderId,no:'SO'+now().slice(0,10).replaceAll('-','')+orderId.slice(5),dealerId:d.id,accountId:u.id,source:p.source||session.port,...data,system:null,status:'pendingReview',createdAt:now(),history:[],reason:'',reviewVersion:1,tracking:'',carrier:'',paymentId:''};if(p.idempotencyKey)o.idempotencyKey=str(p.idempotencyKey);
      if(p.fromCart===true||p.source==='cart'){const cart=s.carts[u.id]||[];for(const x of data.items)ensure(cart.some(y=>y.productId===x.productId&&y.qty===x.qty&&y.selected),'结算商品与所选购物车数量不一致');s.carts[u.id]=cart.filter(x=>!data.items.some(y=>y.productId===x.productId));}
      history(o,u,'提交订单','已提交，等待审核');reviewVersion(s,o);s.orders.push(o);return o;
    }
    case 'reviewOrder':{
      admin(s,u,'orders.review');const o=orderScope(s,u,p.id);ensure(o.status==='pendingReview','仅待审核订单可审核');const approved=bool(p.approved),version=reviewVersion(s,o);
      if(approved){checkOrderCurrent(s,o);o.status='awaitingPayment';o.reason='';history(o,u,'审核通过','审核通过，等待支付');}
      else{o.reason=required(p.reason,'驳回原因');o.status='rejected';history(o,u,'审核驳回',o.reason);}
      Object.assign(version,{status:o.status,reason:o.reason,reviewedAt:o.history.at(-1).time,reviewedBy:{id:u.id,name:u.name},snapshot:reviewSnapshot(o)});
      return o;
    }
    case 'resubmitOrder':{
      const d=shopping(s,u),o=orderScope(s,u,p.id);ensure(o.status==='rejected','仅被驳回订单可修改重提');ensure(o.accountId===u.id,'没有修改权限，仅原提交账号本人可重提');
      const next=snapshot(s,d,p.items,p.addressId,p.remark),before=reviewSnapshot(o),fromVersion=Number(o.reviewVersion||1);
      reviewVersion(s,o);
      Object.assign(o,next,{status:'pendingReview',reason:'',reviewVersion:fromVersion+1});
      const changes=orderChanges(before,o);
      o.history.push({time:now(),userId:u.id,userName:u.name,action:'修改后重提',detail:changeSummary(before,o,changes),fromVersion,toVersion:o.reviewVersion,changes});
      reviewVersion(s,o);
      return o;
    }
    case 'cancelOrder':{if(u.kind==='admin')admin(s,u,'orders.write');else shopping(s,u);const o=orderScope(s,u,p.id);ensure(['pendingReview','rejected','awaitingPayment'].includes(o.status),'仅未付款订单可取消');ensure(!s.payments.some(x=>x.orderId===o.id&&x.status==='success'),'已支付订单不能取消');o.status='cancelled';history(o,u,'取消订单','未付款订单已取消');return o;}
    case 'payOrder':{
      shopping(s,u);const o=orderScope(s,u,p.id);ensure(['wechat','alipay','unionpay'].includes(p.channel),'支付渠道无效');ensure(session.port!=='mini'||p.channel==='wechat','小程序仅支持微信支付');const success=bool(p.success);const payment=s.payments.find(x=>x.orderId===o.id&&x.status==='success');
      if(payment){ensure(success&&p.notifyKey&&payment.notifyKey===p.notifyKey&&payment.channel===p.channel,'订单已支付，不能重复发起支付');return o;}
      ensure(o.status==='awaitingPayment','订单未审核通过或不是待支付状态');if(p.notifyKey)ensure(!s.payments.some(x=>x.notifyKey===p.notifyKey),'支付通知编号已被其他订单使用');if(!success){history(o,u,'支付失败','支付未完成，可重新支付');return o;}
      ensure(!s.tasks.some(x=>x.type==='fulfillment'&&x.objectId===o.id),'已有履约任务，不能重复支付');const paidAt=now(),pay={id:id(s,'PAY'),orderId:o.id,channel:p.channel,amount:o.total,status:'success',transactionNo:'TRX'+paidAt.slice(0,10).replaceAll('-','')+id(s,'TRX').slice(3),time:paidAt};if(p.notifyKey)pay.notifyKey=str(p.notifyKey);s.payments.push(pay);o.paymentId=pay.id;o.status='paid';o.system=o.size==='large'?'SMART':'OMS';task(s,o.system,'fulfillment',o.id,'fulfillment:'+o.id);history(o,u,'支付成功','支付成功，等待'+o.system+'发货');return o;
    }
    case 'shipOrder':{admin(s,u,'orders.ship');const o=orderScope(s,u,p.id);ensure(o.status==='paid','仅已付款待发货订单可发货');const system=o.size==='large'?'SMART':'OMS';ensure(p.system===system&&o.system===system,'履约系统不匹配：该订单仅由'+system+'发货');const pay=get(s,'payments',o.paymentId,'支付流水');ensure(pay.status==='success'&&pay.orderId===o.id,'订单缺少成功支付流水');const t=s.tasks.find(x=>x.type==='fulfillment'&&x.objectId===o.id);ensure(t&&t.system===system&&t.status==='success','履约推送失败，请先重试接口任务');ensure(!s.tasks.some(x=>x.type==='fulfillment'&&x.objectId===o.id&&x.system!==system),'订单存在互斥履约系统冲突');const ship={id:id(s,'SHIP'),orderId:o.id,system,carrier:required(p.carrier,'承运商'),tracking:required(p.tracking,'物流单号'),qty:o.items.reduce((n,x)=>n+x.qty,0),time:now()};ensure(!s.shipments.some(x=>x.orderId===o.id),'订单已有发货回传');s.shipments.push(ship);o.carrier=ship.carrier;o.tracking=ship.tracking;o.status='shipped';history(o,u,'发货回传',system+'发货，物流单号 '+ship.tracking);return o;}
    case 'receiveOrder':{
      shopping(s,u);const o=orderScope(s,u,p.id);if(o.status==='completed')return o;ensure(o.status==='shipped','订单尚未发货或不在待收货状态');ensure(s.shipments.some(x=>x.orderId===o.id),'缺少发货记录，不能确认收货');o.status='completed';history(o,u,'确认收货','已完成收货');const snap=o.commissionSnapshot;if(snap?.parentId&&!s.commissions.some(x=>x.orderId===o.id)){get(s,'dealers',snap.parentId,'下单时一级企业');const rate=number(snap.rate,'快照佣金比例',0,1);s.commissions.push({id:id(s,'COMM'),orderId:o.id,dealerId:snap.parentId,childDealerId:o.dealerId,base:o.total,rate,amount:round(o.total*rate),status:'unsettled',batchId:'',time:now()});}return o;
    }
    case 'refuseOrder':{shopping(s,u);const o=orderScope(s,u,p.id);ensure(o.size==='small','仅小件订单允许整单拒收');ensure(o.status==='shipped'&&o.system==='OMS','仅OMS已发货待收货订单可拒收');ensure(!s.returns.some(x=>x.orderId===o.id),'订单已发起拒收');const r={id:id(s,'RET'),orderId:o.id,reason:required(p.reason,'拒收原因'),status:'requested',time:now(),refundId:''};s.returns.push(r);o.status='returning';task(s,'OMS','return',r.id,'return:'+r.id);history(o,u,'整单拒收',r.reason+'，等待OMS退回收货');return r;}
    case 'returnReceived':{admin(s,u,'aftersales.write');const r=get(s,'returns',p.id,'退货单'),o=orderScope(s,u,r.orderId);ensure(o.size==='small'&&o.system==='OMS','仅OMS小件退货可接收');if(['received','refundFailed','refunded'].includes(r.status))return r;ensure(r.status==='requested'&&o.status==='returning','退货单当前状态不允许收货');const t=s.tasks.find(x=>x.type==='return'&&x.objectId===r.id);ensure(t?.status==='success','OMS退货推送失败，请先重试');r.status='received';history(o,u,'OMS退回收货','OMS已确认整单退回收货，可原路退款');return r;}
    case 'refundReturn':{
      admin(s,u,'aftersales.write');const r=get(s,'returns',p.id,'退货单'),o=orderScope(s,u,r.orderId);ensure(['received','refundFailed','refunded'].includes(r.status),'OMS尚未确认退回收货，不能退款');const payment=get(s,'payments',o.paymentId,'原支付流水');ensure(payment.orderId===o.id&&payment.status==='success','原支付流水无效');const success=bool(p.success),prior=s.refunds.find(x=>x.returnId===r.id&&x.status==='success');if(prior){ensure(success,'退款已成功，不能覆盖为失败');return prior;}ensure(o.status==='returning'&&o.size==='small'&&o.system==='OMS','退货业务状态无效');const refund={id:id(s,'REF'),returnId:r.id,orderId:o.id,paymentId:payment.id,channel:payment.channel,amount:payment.amount,status:success?'success':'failed',time:now()};s.refunds.push(refund);r.refundId=refund.id;r.status=success?'refunded':'refundFailed';if(success)o.status='refunded';history(o,u,success?'原路退款成功':'原路退款失败',success?'退款成功，原支付渠道：'+payment.channel:'退款未完成，可重试，原支付渠道不变');return refund;
    }
    case 'saveInvoiceProfile':{const d=shopping(s,u);return invoiceProfile(s,d.id,p);}
    case 'requestInvoice':{const d=shopping(s,u),o=orderScope(s,u,p.id);ensure(o.status==='completed','请确认收货完成后再申请发票');const prior=s.invoices.find(x=>x.orderId===o.id);if(prior)return prior;const profile=p.profile?invoiceProfile(s,d.id,p.profile):s.invoiceProfiles.find(x=>x.dealerId===d.id);ensure(profile,'请填写开票资料，可在申请页直接创建');const i={id:id(s,'INV'),orderId:o.id,dealerId:d.id,status:'pending',profileSnapshot:clone(profile),invoiceNo:'',time:now()};s.invoices.push(i);task(s,'INVOICE','invoice',i.id,'invoice:'+o.id);history(o,u,'申请发票','已提交开票资料快照，等待开票结果');return i;}
    case 'issueInvoice':{
      admin(s,u,'invoices.write');const i=get(s,'invoices',p.id,'发票申请'),o=orderScope(s,u,i.orderId);ensure(o.status==='completed','只有已收货完成订单可开票');const success=bool(p.success);if(i.status==='issued'){ensure(success,'已开具发票不能改为失败');return i;}ensure(['pending','failed'].includes(i.status),'发票状态无效');i.status=success?'issued':'failed';if(success)i.invoiceNo=id(s,'FP');let t=s.tasks.find(x=>x.type==='invoice'&&x.objectId===i.id);if(!t)t=task(s,'INVOICE','invoice',i.id,'invoice:'+o.id);t.status=success?'success':'failed';t.error=success?'':'开票失败，请核对资料后重试';if(success&&!t.externalNo)t.externalNo='INVOICE-'+i.invoiceNo;t.time=now();t.history.push({time:t.time,status:t.status,error:t.error,externalNo:t.externalNo});history(o,u,success?'发票已开具':'开票失败',success?'发票号码 '+i.invoiceNo:'开票失败，可重试');return i;
    }
    case 'settleCommissions':{admin(s,u,'commissions.settle');ensure(p.confirmed===true,'请核对本次条数与总额并二次确认');const ids=list(p.ids,'佣金选择',false),commissions=ids.map(x=>get(s,'commissions',x,'佣金'));for(const c of commissions){dealerScope(s,u,c.dealerId);dealerScope(s,u,c.childDealerId);ensure(c.status==='unsettled','佣金已结算，不能重复结算');const o=orderScope(s,u,c.orderId);ensure(o.status==='completed','仅已完成订单佣金可结算');}const b={id:id(s,'BATCH'),commissionIds:ids,count:ids.length,total:sum(commissions,'amount'),time:now()};s.settlements.push(b);for(const c of commissions){c.status='settled';c.batchId=b.id;}return b;}
    case 'changeProfile':{const d=mainDealer(s,u);ensure(d.status==='approved','未审核企业请使用注册修改重提');const fields=companyFields(p,d);uniqueCompany(s,fields,d.id);ensure(PROFILE.some(k=>fields[k]!==d[k]),'企业资料没有变化');d.pendingProfile={...fields,submittedAt:now(),submittedBy:u.id};history(d,u,'企业资料复审申请','提交核心资料变更，审核前保留原版本');return d;}
    case 'reviewProfile':{admin(s,u,'dealers.write');const d=dealerScope(s,u,p.id);ensure(d.pendingProfile,'没有待复审的企业资料');const approved=bool(p.approved),reason=approved?str(p.reason):required(p.reason,'驳回原因');const old=pick(d,PROFILE),next=companyFields(d.pendingProfile);if(approved){uniqueCompany(s,next,d.id);Object.assign(d,next);}d.history.push({time:now(),userId:u.id,userName:u.name,action:approved?'企业资料复审通过':'企业资料复审驳回',detail:reason||'已更新当前企业资料版本',reason,approved,before:clone(old),after:clone(next),oldProfile:old,newProfile:next});d.pendingProfile=null;return d;}
    case 'saveSubAccount':{const d=shopping(s,u,true),old=p.id?get(s,'users',p.id,'子账号'):null;ensure(!old||(old.kind==='dealer'&&old.dealerId===d.id&&!old.isMain),'没有其他企业账号权限，不能修改主账号');const mobile=phone(p.phone??old?.phone);ensure(!s.users.some(x=>x.id!==old?.id&&x.phone===mobile),'手机号重复，账号已存在');const data={kind:'dealer',dealerId:d.id,isMain:false,name:required(p.name??old?.name,'子账号姓名'),phone:mobile,password:p.password?password(p.password):(old?.password||'Supor123'),enabled:bool(p.enabled,old?.enabled??true),sessionVersion:old?.sessionVersion??1};if(old&&['phone','password','enabled'].some(k=>data[k]!==old[k]))data.sessionVersion++;return save(s,'users',old,data,'U');}
    case 'changePassword':{ensure(p.oldPassword===u.password,'原密码错误');const pwd=password(p.newPassword);ensure(pwd===p.confirmation,'新密码与确认密码不一致');ensure(pwd!==u.password,'新密码不能与原密码相同');u.password=pwd;u.sessionVersion=(u.sessionVersion||1)+1;return {userId:u.id,changed:true,version:u.sessionVersion};}
    case 'retryTask':{
      admin(s,u,'tasks.retry');const t=get(s,'tasks',p.id,'接口任务');scopedTask(s,u,t);
      if(t.type==='fulfillment'){const o=orderScope(s,u,t.objectId);ensure(PAID.includes(o.status)&&o.paymentId,'订单尚未付款或业务状态不允许重试');ensure(o.system===t.system&&t.system===(o.size==='large'?'SMART':'OMS'),'订单履约系统冲突');ensure(!s.tasks.some(x=>x.id!==t.id&&x.type==='fulfillment'&&x.objectId===o.id),'订单存在重复履约任务');}
      if(t.type==='return'){const r=get(s,'returns',t.objectId,'退货单'),o=orderScope(s,u,r.orderId);ensure(o.size==='small'&&o.system==='OMS'&&['returning','refunded'].includes(o.status),'退货业务状态不允许重试');}
      if(t.type==='invoice'){const i=get(s,'invoices',t.objectId,'发票申请');ensure(orderScope(s,u,i.orderId).status==='completed','订单尚未收货，不能重试开票');}
      if(t.status==='success')return t;t.retries=(t.retries||0)+1;t.time=now();const failed=bool(p.fail,false);t.status=failed?'failed':'success';t.error=failed?'接口重试失败，请再次检查业务条件':'';if(!failed&&!t.externalNo)t.externalNo=`${t.system}-${t.type}-${t.id}`;
      if(t.type==='sync'&&t.objectId==='stock')for(const product of s.products){product.stockStatus=failed?'failed':'success';product.stockTime=t.time;}
      if(t.type==='invoice'&&!failed){const i=get(s,'invoices',t.objectId);if(i.status!=='issued'){i.status='issued';i.invoiceNo=id(s,'FP');}}
      t.history.push({time:t.time,status:t.status,error:t.error,externalNo:t.externalNo});return t;
    }
    case 'pushSAP':{admin(s,u,'tasks.retry');sapRecord(s,u,p.type,p.objectId);return task(s,'SAP',p.type,p.objectId,'SAP:'+p.type+':'+p.objectId);}
    case 'generateReconciliation':{admin(s,u,'reconciliation.write');required(p.dealerId,'经销商');const rec=reconciliation(s,u,p),statement={id:id(s,'STMT'),...rec,time:now()};s.statements.push(statement);return statement;}
    default:fail('未知业务操作：'+type);
  }
}
