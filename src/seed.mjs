export const menuIds=['dealers','agreement','organizations','members','logs','products','categories','prices','tiers','specials','decoration','orders','aftersales','payments','invoices','commissions','reconciliation','reports','tasks'];
const fixedTime='2026-10-14T09:00:00+08:00';
export function seed(){
  const products=[
    ['P1','SF40HC42','本釜IH电饭煲','4L / 香槟金',0.032,288,396,'sf40hc42.png','IH电磁加热'],
    ['P2','SF50HC750','IH球釜电饭煲','5L / 深空灰',0.038,420,328,'sf50hc750.jpg','IH电磁加热'],
    ['P3','SF40HC88','远红外本釜电饭煲','4L / 曜石黑',0.033,165,568,'sf40hc88.jpg','远红外加热'],
    ['P4','SF40HC86','远红外本釜电饭煲','4L / 极光银',0.033,216,498,'sf40hc86.jpg','远红外加热'],
    ['P5','SF40HC81','远红外本釜电饭煲','4L / 海盐白',0.031,340,458,'sf40hc81.jpg','远红外加热']
  ].map(([id,sku,name,spec,volume,stock,price,image,heat])=>({id,code:'SMART-'+sku,sku,model:sku,name,spec,unit:'台',volume,stock,seedStock:stock,stockStatus:'success',stockTime:fixedTime,onSale:true,categoryId:'CAT3',images:['assets/'+image],attrs:{容量:spec.split(' / ')[0],加热方式:heat,包装:'6台 / 箱',内胆:'本釜内胆',额定电压:'220V',建议订货倍数:'6'},tierId:'TIER1',referencePrice:price}));
  const grades=[{id:'G1',name:'一级经销商',level:1,enabled:true},{id:'G2',name:'二级经销商',level:2,enabled:true}];
  const dealer=(id,name,phone,level,extra={})=>({id,name,phone,taxId:'91330106MA27K12345',contact:'周经理',tel:phone,province:'浙江省',city:'杭州市',district:'西湖区',address:'文三路168号电器商贸中心',license:'assets/logo.png',smartCode:'SC00'+id.slice(1),gradeId:level===1?'G1':'G2',parentId:level===1?'':'D1',regions:['浙江省/杭州市'],productIds:products.map(x=>x.id),commissionRate:level===1?0.05:0,status:'approved',reason:'',enabled:true,pendingProfile:null,history:[],agreementVersion:1,agreementTime:fixedTime,...extra});
  const dealers=[dealer('D1','浙江诚远家电有限公司','13900000001',1,{regions:['浙江省/杭州市','浙江省/宁波市']}),dealer('D2','杭州华明电器有限公司','13900000002',2),dealer('D3','宁波锦辰商贸有限公司','13900000004',2,{regions:['浙江省/宁波市']}),dealer('D4','杭州启航电器有限公司','13900000005',2,{status:'pending',smartCode:''}),dealer('D5','杭州安和商贸有限公司','13900000006',2,{status:'rejected',reason:'营业执照信息不清晰，请重新上传。'})];
  const users=[
    {id:'UADMIN',kind:'admin',phone:'admin',name:'系统管理员',orgId:'ORG1',roleId:'ROLEADMIN'},
    {id:'UOPS',kind:'admin',phone:'operations',name:'订单运营',orgId:'ORG3',roleId:'ROLEOPS'},
    {id:'UFINANCE',kind:'admin',phone:'finance',name:'财务经理',orgId:'ORG1',roleId:'ROLEFINANCE'},
    {id:'UAUDIT',kind:'admin',phone:'auditor',name:'审计人员',orgId:'ORG1',roleId:'ROLEAUDIT'},
    {id:'UPRIMARY',kind:'dealer',phone:'13900000001',name:'诚远主账号',dealerId:'D1',isMain:true},
    {id:'USECOND',kind:'dealer',phone:'13900000002',name:'华明主账号',dealerId:'D2',isMain:true},
    {id:'USUB',kind:'dealer',phone:'13900000003',name:'采购助理',dealerId:'D2',isMain:false},
    {id:'UNINGBO',kind:'dealer',phone:'13900000004',name:'锦辰主账号',dealerId:'D3',isMain:true},
    {id:'UPENDING',kind:'dealer',phone:'13900000005',name:'启航主账号',dealerId:'D4',isMain:true},
    {id:'UREJECTED',kind:'dealer',phone:'13900000006',name:'安和主账号',dealerId:'D5',isMain:true}
  ].map(x=>({...x,password:'Supor123',enabled:true,sessionVersion:1}));
  const roles=[
    {id:'ROLEADMIN',name:'系统管理员',menus:[...menuIds],buttons:[...menuIds.map(x=>x+'.write'),'orders.review','orders.ship','commissions.settle','tasks.retry'],scope:'all'},
    {id:'ROLEOPS',name:'订单运营',menus:['dealers','orders','aftersales','reports','tasks'],buttons:['dealers.write','orders.write','orders.review','orders.ship','aftersales.write','tasks.retry'],scope:'org'},
    {id:'ROLEFINANCE',name:'财务人员',menus:['payments','invoices','commissions','reconciliation','reports','tasks','orders'],buttons:['invoices.write','commissions.settle','reconciliation.write','aftersales.write','tasks.retry'],scope:'all'},
    {id:'ROLEAUDIT',name:'只读审计',menus:['logs','orders','payments','reports'],buttons:[],scope:'all'}
  ];
  const orgs=[{id:'ORG1',name:'苏泊尔集团',type:'group',parentId:'',enabled:true,categoryIds:[],dealerIds:[]},{id:'ORG2',name:'生活电器事业部',type:'division',parentId:'ORG1',enabled:true,categoryIds:['CAT1'],dealerIds:['D1','D2','D4','D5']},{id:'ORG3',name:'浙江销售部',type:'department',parentId:'ORG2',enabled:true,categoryIds:[],dealerIds:[]},{id:'ORG4',name:'华东渠道事业部',type:'division',parentId:'ORG1',enabled:true,categoryIds:['CAT1'],dealerIds:['D3']}];
  const categories=[{id:'CAT1',name:'厨房小家电',parentId:'',sort:1,enabled:true},{id:'CAT2',name:'电饭煲',parentId:'CAT1',sort:1,enabled:true},{id:'CAT3',name:'IH智能电饭煲',parentId:'CAT2',sort:1,enabled:true}];
  const layout={title:'好产品，让生意更从容。',subtitle:'本釜系列 · 专业渠道订货',bannerImage:'assets/sf40hc42.png',bannerProductId:'P1',footer:'苏泊尔经销商订货中心 · 渠道服务热线 400-8899-717',blocks:[{id:'BLOCK1',type:'products',title:'当季热销',content:'',image:'',productIds:['P1','P2','P3','P4'],visible:true},{id:'BLOCK2',type:'text',title:'渠道订货服务',content:'审核通过后付款，物流进度在线查看。',image:'',productIds:[],visible:true}]};
  const state={schema:1,revision:0,seq:100,products,dealers,users,grades,orgs,roles,categories,attributes:[{id:'ATTR1',name:'容量',categoryIds:['CAT2'],source:'SMART',enabled:true},{id:'ATTR2',name:'加热方式',categoryIds:['CAT2'],source:'SMART',enabled:true},{id:'ATTR3',name:'包装',categoryIds:['CAT2'],source:'local',enabled:true}],smartArchives:dealers.map((d,i)=>({code:'SC00'+(i+1),name:d.name,taxId:d.taxId,province:d.province,city:d.city})),gradePrices:Object.fromEntries(products.map(p=>[p.id,{G1:Math.round(p.referencePrice*.9*100)/100,G2:p.referencePrice}])),tiers:[{id:'TIER1',name:'渠道批量订货折扣',steps:[{min:1,discount:1},{min:12,discount:0.95},{min:48,discount:0.9}],productIds:products.map(x=>x.id),enabled:true}],specialPrices:[],config:{amountThreshold:20000,volumeThreshold:1,agreement:{version:1,title:'经销商入驻协议',content:'欢迎使用苏泊尔经销商订货中心。企业应提交真实有效的营业执照及联系资料，经审核与档案关联后开通订货资格。经销商在授权商品与区域范围内订货，订单审核通过后付款，按实际物流进度完成收货。',updatedAt:fixedTime}},decoration:{pc:{draft:structuredClone(layout),published:structuredClone(layout)},mini:{draft:structuredClone(layout),published:structuredClone(layout)}},carts:{USECOND:[{productId:'P2',qty:6,selected:true}]},addresses:[{id:'ADR1',dealerId:'D1',contact:'张经理',phone:'13900000001',province:'浙江省',city:'杭州市',district:'余杭区',detail:'仓前街道家电物流园1号库',isDefault:true},{id:'ADR2',dealerId:'D2',contact:'周经理',phone:'13900000002',province:'浙江省',city:'杭州市',district:'西湖区',detail:'文三路168号电器商贸中心2层',isDefault:true},{id:'ADR3',dealerId:'D3',contact:'林经理',phone:'13900000004',province:'浙江省',city:'宁波市',district:'鄞州区',detail:'宁南北路12号',isDefault:true}],orders:[],payments:[],shipments:[],returns:[],refunds:[],invoiceProfiles:[{id:'IP1',dealerId:'D2',title:dealers[1].name,taxId:dealers[1].taxId,address:dealers[1].address,phone:'057188800001',bank:'中国银行杭州文三路支行',bankAccount:'6222000000000001',email:'accounts@example.com'}],invoices:[],commissions:[],settlements:[],tasks:[],logs:[],statements:[],priceHistory:[]};
  // Fixtures are clearly demonstration data; each has a complete upstream chain.
  for(let i=0;i<9;i++){
    const d=i===8?dealers[2]:dealers[1],p=products[i%products.length],qty=i===7?60:6,unitPrice=qty>=48?+(p.referencePrice*.9).toFixed(2):p.referencePrice,total=+(unitPrice*qty).toFixed(2),volume=+(qty*p.volume).toFixed(6),size=total>20000||volume>1?'large':'small';
    const statuses=['pendingReview','awaitingPayment','paid','shipped','completed','rejected','cancelled','shipped','pendingReview'];
    const id='ORDER'+(i+1),date=`2026-10-${String(5+i).padStart(2,'0')}T10:20:00+08:00`,a=state.addresses.find(x=>x.dealerId===d.id);
    const o={id,no:'SO202610'+String(5001+i),dealerId:d.id,accountId:i===6?'USUB':(d.id==='D3'?'UNINGBO':'USECOND'),source:i%2?'mini':'pc',items:[{productId:p.id,sku:p.sku,name:p.name,spec:p.spec,image:p.images[0],qty,unitPrice,lineTotal:total,unitVolume:p.volume,priceSource:qty>=48?'等级价 + 数量阶梯90%':'等级价',priceSnapshot:{gradeId:'G2',gradePrice:p.referencePrice,discount:qty>=48?.9:1}}],total,volume,size,system:null,thresholdSnapshot:{amountThreshold:20000,volumeThreshold:1},addressSnapshot:structuredClone(a),dealerSnapshot:{id:d.id,name:d.name,taxId:d.taxId,smartCode:d.smartCode},commissionSnapshot:{parentId:d.parentId,rate:0.05},remark:'请工作日送达，送货前电话联系。',status:statuses[i],reason:i===5?'请确认收货联系人电话。':'',createdAt:date,reviewVersion:1,history:[{time:date,userName:'周经理',action:'提交订单',detail:'已提交，等待审核'}]};
    if(['paid','shipped','completed'].includes(o.status)){const payment={id:'PAY'+(i+1),orderId:id,channel:i%2?'wechat':'alipay',amount:total,status:'success',transactionNo:'TRX202610'+(5000+i),time:date};state.payments.push(payment);o.paymentId=payment.id;o.system=size==='large'?'SMART':'OMS';state.tasks.push({id:'TASK'+(i+1),system:o.system,type:'fulfillment',objectId:id,idempotencyKey:`fulfillment:${id}`,status:i===2?'failed':'success',error:i===2?'接口响应超时，等待重试':'',externalNo:i===2?'':o.system+'2026'+(5000+i),retries:0,time:date,history:[]});}
    if(['shipped','completed'].includes(o.status)){o.carrier='顺丰速运';o.tracking='SF202610'+(59000+i);state.shipments.push({id:'SHIP'+(i+1),orderId:id,system:o.system,carrier:o.carrier,tracking:o.tracking,qty,time:date});}
    if(o.status==='completed'){state.commissions.push({id:'COMM'+(i+1),orderId:id,dealerId:'D1',childDealerId:d.id,base:total,rate:.05,amount:+(total*.05).toFixed(2),status:'unsettled',batchId:'',time:date});}
    state.orders.push(o);
  }
  state.logs.push({id:'LOG1',time:fixedTime,userId:'UADMIN',userName:'系统管理员',kind:'login',action:'后台登录',objectId:'UADMIN',result:'success',detail:'登录成功'});
  return state;
}
