/* City Edition 4.0 — shared, dependency-free world data. */
(function(root){'use strict';
const locations=[
{name:'Дом у пекарни',x:-65,z:-36},{name:'Мятный дом',x:-24,z:-37},{name:'Терракотовый двор',x:24,z:-37},{name:'Книжная лавка',x:-65,z:12},{name:'Квартира у парка',x:24,z:12},{name:'Лавандовый дом',x:-66,z:60},{name:'Дом с оранжереей',x:-24,z:60},{name:'Солнечные апартаменты',x:24,z:60},{name:'Речной коттедж',x:91,z:0},
{name:'Дом у цветочного рынка',x:-79,z:-34},{name:'Студия у фонтана',x:-12,z:24},{name:'Мастерская на углу',x:37,z:10},{name:'Дом у детской площадки',x:-68,z:40},{name:'Садовый дом',x:10,z:63},{name:'Пентхаус с балконом',x:38,z:61},{name:'Коттедж у моста',x:57,z:-35},{name:'Лофт на набережной',x:103,z:24},{name:'Домик лодочника',x:103,z:-46},{name:'Квартира у кофейни',x:-54,z:-3},{name:'Дом художника',x:40,z:34},{name:'Семейный двор',x:-40,z:42},
{name:'Северный вокзал',x:-120,z:-108},{name:'Дом у стадиона',x:-72,z:-108},{name:'Полярная студия',x:-24,z:-108},{name:'Кленовый двор',x:24,z:-108},{name:'Речной маяк',x:118,z:-108},{name:'Западная ферма',x:-120,z:-60},{name:'Дом у скейт-парка',x:-120,z:60},{name:'Апартаменты у причала',x:118,z:60},{name:'Садовый квартал',x:-120,z:108},{name:'Дом у ярмарки',x:-72,z:108},{name:'Северная оранжерея',x:-24,z:176},{name:'Дом с башенкой',x:24,z:108},{name:'Восточная вилла',x:118,z:108}
],pickupPoints={depot:{name:'Склад мебели',x:-24,z:-9},cafe:{name:'Кафе «Тёплый хлеб»',x:-62,z:-3},post:{name:'Городская почта',x:23,z:4},station:{name:'Северный вокзал',x:-120,z:-108}};
const districts=[
{id:'center',name:'Центр и парк',icon:'🌳',x:-24,z:12,desc:'Фонтан, мастерские и тихие дворы.'},
{id:'color',name:'Цветной квартал',icon:'🏘️',x:-68,z:-46,desc:'Пекарни, цветы и старые дома.'},
{id:'gardens',name:'Солнечные сады',icon:'🌻',x:-22,z:67,desc:'Зелёные улицы и просторные дворы.'},
{id:'river',name:'Набережная',icon:'🌊',x:108,z:0,desc:'Мосты, лодки, причалы и дома у воды.'},
{id:'north',name:'Северный район',icon:'🚉',x:-24,z:-118,desc:'Вокзал, стадион и широкие проспекты.'},
{id:'west',name:'Западные поля',icon:'🌾',x:-118,z:0,desc:'Фермы, скейт-парк и тихие окраины.'},
{id:'heights',name:'Верхние сады',icon:'🌲',x:-24,z:118,desc:'Ярмарка, оранжереи и большие дома.'},
{id:'east',name:'Восточный берег',icon:'⛵',x:118,z:88,desc:'Новый район за рекой и прогулочная набережная.'}
];
const vehicles=[{id:'scooter',name:'Самокат «Ветер»',icon:'🛴',price:0,speed:12,cap:1,desc:'Лёгкий старт. Матрасы, кресла и коробки.',color:'#e9ae51'},{id:'electric',name:'Электро «Искра»',icon:'⚡',price:650,speed:18,cap:1,desc:'Быстрый самокат для коротких доставок.',color:'#83bbb3'},{id:'cargo',name:'Карго-самокат',icon:'🛵',price:1200,speed:15,cap:2,desc:'Усиленная тележка. Влезет даже диван!',color:'#d8886b'},{id:'van',name:'Фургон «Булочка»',icon:'🚐',price:2100,speed:18,cap:3,desc:'Уютный фургон для любой мебели.',color:'#edc67a'},{id:'truck',name:'Грузовичок «Атлант»',icon:'🚚',price:3800,speed:22,cap:3,desc:'Большой кузов, быстрая езда, +15% к оплате.',color:'#82afb0'}];
const properties=[{id:'cafe',name:'Кофейня грузчиков',icon:'☕',price:900,income:80,desc:'+80 ₽ за каждую доставку. Кофе команде!',x:-65,z:-15},{id:'gym',name:'Спортзал «Мускулы»',icon:'💪',price:1500,income:130,desc:'+130 ₽ за заказ и ещё немного скорости.',x:-24,z:79},{id:'depot',name:'Большой склад',icon:'🏠',price:2600,income:220,desc:'+220 ₽ за каждый выполненный заказ.',x:-24,z:-24}];
const cargoes=[
{name:'Мягкое кресло',short:'КРЕСЛО',cap:1,pay:270,kind:'chair',type:'move',pickup:'depot'},{name:'Пружинный матрас',short:'МАТРАС',cap:1,pay:300,kind:'mattress',type:'move',pickup:'depot'},{name:'Коробки с книгами',short:'КОРОБКИ',cap:1,pay:250,kind:'boxes',type:'move',pickup:'depot'},{name:'Диван «Облачко»',short:'ДИВАН',cap:2,pay:450,kind:'sofa',type:'move',pickup:'depot'},{name:'Большой шкаф',short:'ШКАФ',cap:3,pay:620,kind:'wardrobe',type:'move',pickup:'depot'},{name:'Семейный переезд',short:'КОМПЛЕКТ',cap:3,pay:720,kind:'set',type:'move',pickup:'depot'},
{name:'Обеденный стол',short:'СТОЛ',cap:2,pay:410,kind:'table',type:'move',pickup:'depot'},{name:'Двуспальная кровать',short:'КРОВАТЬ',cap:3,pay:680,kind:'bed',type:'move',pickup:'depot'},{name:'Письменный стол',short:'СТОЛ',cap:2,pay:430,kind:'desk',type:'move',pickup:'depot'},{name:'Книжный шкаф',short:'СТЕЛЛАЖ',cap:2,pay:470,kind:'bookshelf',type:'move',pickup:'depot'},{name:'Холодильник',short:'ТЕХНИКА',cap:3,pay:650,kind:'fridge',type:'move',pickup:'depot'},{name:'Большая пальма',short:'РАСТЕНИЕ',cap:1,pay:320,kind:'plant',type:'move',pickup:'depot'},
{name:'Горячая пицца',short:'ЕДА',cap:1,pay:240,kind:'pizza',type:'food',pickup:'cafe'},{name:'Пакеты с продуктами',short:'ПРОДУКТЫ',cap:1,pay:280,kind:'groceries',type:'food',pickup:'cafe'},{name:'Праздничный торт',short:'ТОРТ',cap:1,pay:340,kind:'cake',type:'food',pickup:'cafe'},{name:'Заказ из кафе',short:'ОБЕД',cap:1,pay:260,kind:'meal',type:'food',pickup:'cafe'},
{name:'Срочные документы',short:'ПОЧТА',cap:1,pay:300,kind:'documents',type:'post',pickup:'post'},{name:'Посылка',short:'ПОСЫЛКА',cap:1,pay:330,kind:'parcel',type:'post',pickup:'post'},{name:'Букет для клиента',short:'БУКЕТ',cap:1,pay:360,kind:'flowers',type:'post',pickup:'post'},
{name:'Большой аквариум',short:'АКВАРИУМ',cap:2,pay:590,kind:'aquarium',type:'move',pickup:'depot'},{name:'Старое пианино',short:'ПИАНИНО',cap:3,pay:880,kind:'piano',type:'move',pickup:'depot'},
{name:'Турист с чемоданом',short:'ПАССАЖИР',cap:3,pay:460,kind:'tourist',type:'taxi',pickup:'station'},{name:'Музыкант с гитарой',short:'ПАССАЖИР',cap:3,pay:520,kind:'musician',type:'taxi',pickup:'station'},{name:'Семья с вокзала',short:'ПАССАЖИРЫ',cap:3,pay:610,kind:'family',type:'taxi',pickup:'station'}
];
const jobTypeInfo={move:{label:'ПЕРЕЕЗД',icon:'🚚',pickupText:'Забрать на складе',deliverText:'Отвезти клиенту'},food:{label:'ЕДА',icon:'🍕',pickupText:'Забрать в кафе',deliverText:'Доставить заказ'},post:{label:'КУРЬЕР',icon:'📮',pickupText:'Забрать на почте',deliverText:'Отвезти адресату'},taxi:{label:'ПАССАЖИР',icon:'🚕',pickupText:'Забрать на вокзале',deliverText:'Довезти пассажира'}};
const souvenirs=[
{id:'station',name:'Билет первого рейса',x:-126,z:-111,reward:90},{id:'stadium',name:'Шарф местной команды',x:-72,z:-103,reward:90},{id:'farm',name:'Красное яблоко',x:-126,z:-58,reward:90},{id:'skate',name:'Стикер скейт-парка',x:-116,z:56,reward:90},{id:'market',name:'Лента с ярмарки',x:-72,z:103,reward:90},{id:'greenhouse',name:'Редкое семечко',x:-30,z:111,reward:90},{id:'park',name:'Монетка из фонтана',x:-18,z:27,reward:90},{id:'bakery',name:'Значок пекаря',x:-53,z:-7,reward:90},{id:'bridge',name:'Миниатюрный мост',x:61,z:-48,reward:90},{id:'harbor',name:'Речная ракушка',x:104,z:58,reward:90},{id:'lighthouse',name:'Брелок маяка',x:118,z:-103,reward:90},{id:'east',name:'Открытка восточного берега',x:121,z:103,reward:90}
];
const questDefs=[
{id:'first5',title:'Уверенный старт',desc:'Выполнить 5 доставок.',goal:5,reward:500,value:s=>s.delivered},
{id:'foodie',title:'Любимец кафе',desc:'Доставить 3 заказа еды.',goal:3,reward:450,value:s=>s.jobStats.food||0},
{id:'postman',title:'Надёжный курьер',desc:'Доставить 3 почтовых заказа.',goal:3,reward:500,value:s=>s.jobStats.post||0},
{id:'mover',title:'Мастер переездов',desc:'Выполнить 5 переездов.',goal:5,reward:700,value:s=>s.jobStats.move||0},
{id:'collector',title:'Знаток города',desc:'Найти 6 скрытых сувениров.',goal:6,reward:750,value:s=>s.souvenirs.length},
{id:'driver',title:'Городской водитель',desc:'Довезти 2 пассажиров.',goal:2,reward:650,value:s=>s.jobStats.taxi||0},
{id:'fleet',title:'Свой автопарк',desc:'Купить 4 вида транспорта.',goal:4,reward:900,value:s=>s.owned.length},
{id:'legend',title:'Легенда городка',desc:'Выполнить 25 заказов.',goal:25,reward:1800,value:s=>s.delivered}
];
const stories=[
{id:'concert',title:'Переезд музыканта',desc:'Нужно срочно отвезти старое пианино к дому у стадиона.',unlock:3,cargoKind:'piano',dest:22,pay:1250,rep:80,icon:'🎹'},
{id:'festival',title:'Торт на ярмарку',desc:'Главный торт праздника ждут в доме у ярмарки.',unlock:5,cargoKind:'cake',dest:30,pay:850,rep:65,icon:'🎂'},
{id:'lighthouse',title:'Посылка смотрителю',desc:'Редкая посылка должна попасть к речному маяку.',unlock:8,cargoKind:'parcel',dest:25,pay:980,rep:75,icon:'🗼'},
{id:'greenhouse',title:'Большая пальма',desc:'Оранжерея заказала огромную пальму на север.',unlock:10,cargoKind:'plant',dest:31,pay:1050,rep:80,icon:'🪴'},
{id:'vip',title:'Гость с вокзала',desc:'Особый пассажир просит довезти его на восточный берег.',unlock:12,cargoKind:'tourist',dest:33,pay:1350,rep:100,icon:'🚕'}
];


const WORLD_LIMIT=220;
const ROAD_GRID=[-192,-144,-96,-48,0,48,96,144,192];
const BRIDGES=[...ROAD_GRID];
pickupPoints.farm={name:'Фермерский кооператив',x:-168,z:-8};
pickupPoints.workshop={name:'Городская мастерская',x:-168,z:40};
pickupPoints.clinic={name:'Аптека у больницы',x:168,z:-8};
pickupPoints.eco={name:'Экоцентр',x:168,z:88};
locations.push(
 {name:'Кофейня у озера',x:-168,z:-156},{name:'Кампус университета',x:-120,z:-156},
 {name:'Музей переездов',x:-72,z:-156},{name:'Обсерватория',x:-24,z:-156},
 {name:'Дом у соснового леса',x:24,z:-156},{name:'Северный причал',x:120,z:-156},
 {name:'Мастерская керамиста',x:168,z:-108},{name:'Морской вокзал',x:168,z:-60},
 {name:'Городская больница',x:168,z:-8},{name:'Рыночная площадь',x:168,z:40},
 {name:'Экоцентр',x:168,z:88},{name:'Пляжный клуб',x:168,z:136},
 {name:'Павильон фестиваля',x:120,z:176},{name:'Дом с ветряком',x:24,z:176},
 {name:'Дом в яблоневом саду',x:-72,z:176},{name:'Кемпинг',x:-120,z:176},
 {name:'Фермерская лавка',x:-168,z:-8},{name:'Веломастерская',x:-168,z:40},
 {name:'Станция сортировки',x:-168,z:88},{name:'Лесное кафе',x:-168,z:136}
);
// District arrivals always lie on a clear pavement or street.
districts.forEach(d=>{if(d.id==='heights')d.z=96;if(d.id==='north')d.z=-96;});
districts.push(
 {id:'campus',name:'Университетский',icon:'🎓',x:-120,z:-144,desc:'Кампус, обсерватория и городской музей.'},
 {id:'forest',name:'Сосновый бор',icon:'🌲',x:-168,z:-144,desc:'Лесные дорожки и тихое кафе у пруда.'},
 {id:'port',name:'Портовый',icon:'⚓',x:168,z:-48,desc:'Парусники, склады и морской вокзал.'},
 {id:'eco',name:'Экорайон',icon:'♻',x:168,z:96,desc:'Больница, мастерские и центр переработки.'},
 {id:'festival',name:'Фестивальный',icon:'🎡',x:120,z:192,desc:'Колесо обозрения, сцена и прогулочный пляж.'}
);
Object.assign(jobTypeInfo,{
 farm:{label:'ФЕРМА',icon:'🍎',pickupText:'Забрать урожай',deliverText:'Привезти продукты'},
 service:{label:'МАСТЕР',icon:'🔧',pickupText:'Забрать инструменты',deliverText:'Обслужить точку'},
 medical:{label:'АПТЕКА',icon:'✚',pickupText:'Забрать лекарства',deliverText:'Передать заказ'},
 recycle:{label:'ЭКО',icon:'♻',pickupText:'Забрать контейнеры',deliverText:'Пройти маршрут'}
});
cargoes.push(
 {name:'Яблоки из сада',short:'УРОЖАЙ',cap:1,pay:310,kind:'apples',type:'farm',pickup:'farm'},
 {name:'Овощи для кафе',short:'ОВОЩИ',cap:2,pay:450,kind:'vegetables',type:'farm',pickup:'farm'},
 {name:'Цветочная рассада',short:'РАССАДА',cap:1,pay:330,kind:'seedlings',type:'farm',pickup:'farm'},
 {name:'Мастер на районе',short:'РЕМОНТ',cap:1,pay:620,kind:'tools',type:'service',pickup:'workshop',stops:3},
 {name:'Лекарства на дом',short:'АПТЕКА',cap:1,pay:350,kind:'medicine',type:'medical',pickup:'clinic'},
 {name:'Оснащение клиники',short:'ОБОРУДОВАНИЕ',cap:3,pay:740,kind:'medicalbox',type:'medical',pickup:'clinic'},
 {name:'Зелёный маршрут',short:'ПЕРЕРАБОТКА',cap:2,pay:780,kind:'recycling',type:'recycle',pickup:'eco',stops:3}
);
vehicles.push({id:'ebike',name:'Велокарго «Лист»',icon:'🚲',price:1650,speed:20,cap:2,desc:'Манёвренный карго для фермы и экомаршрутов.',color:'#76b6a3'});
questDefs.push(
 {id:'handyman',title:'Золотые руки',desc:'Завершить 3 маршрута мастера.',goal:3,reward:800,value:s=>s.jobStats.service||0},
 {id:'care',title:'С заботой о городе',desc:'Выполнить 3 аптечных заказа.',goal:3,reward:650,value:s=>s.jobStats.medical||0},
 {id:'explorer',title:'Весь город как на ладони',desc:'Открыть все 13 районов.',goal:13,reward:1200,value:s=>s.discovered.length}
);
souvenirs.push(
 {id:'campus',name:'Значок выпускника',x:-120,z:-153,reward:150},
 {id:'observatory',name:'Карта созвездий',x:-16,z:-158,reward:150},
 {id:'forest',name:'Сосновая шишка',x:-176,z:-156,reward:150},
 {id:'port',name:'Морской компас',x:176,z:-58,reward:150},
 {id:'eco',name:'Зелёный значок',x:175,z:90,reward:150},
 {id:'festival',name:'Билет на колесо',x:128,z:178,reward:150}
);
souvenirs.find(s=>s.id==='greenhouse').z=177;
souvenirs.find(s=>s.id==='station').z=-106;
stories.push(
 {id:'opening',title:'Открытие музея',desc:'Соберите экспозицию нового музея: доставьте коробки с книгами.',unlock:2,cargoKind:'boxes',dest:36,pay:900,rep:70,icon:'🏛'},
 {id:'harvest',title:'Праздник урожая',desc:'Свежие яблоки ждут на фестивальной площади.',unlock:4,cargoKind:'apples',dest:46,pay:1100,rep:80,icon:'🍎'},
 {id:'careday',title:'День добрых дел',desc:'Помогите жителям нового квартала получить аптечный заказ.',unlock:6,cargoKind:'medicine',dest:48,pay:1200,rep:90,icon:'✚'}
);
const races=[
 {id:'park',name:'Кольцо у парка',icon:'🏁',desc:'Короткий круг по центральным улицам.',par:80,reward:450,
 points:[[-48,0],[-48,48],[0,48],[0,0],[-48,0]]},
 {id:'river',name:'Два берега',icon:'🌉',desc:'Два моста, набережная и длинная прямая.',par:150,reward:700,
 points:[[48,0],[96,0],[96,96],[48,96],[48,0]]}
];
const landmarks=[
 {id:'fountain',name:'Сердце города',desc:'Фонтан, с которого всё начинается.',x:-24,z:32},
 {id:'lighthouse',name:'Смотритель реки',desc:'Маяк на тихой набережной.',x:120,z:-108},
 {id:'observatory',name:'Ближе к звёздам',desc:'Старая обсерватория над кампусом.',x:-24,z:-156},
 {id:'wheel',name:'Весь город под ногами',desc:'Колесо на фестивальной площади.',x:120,z:176},
 {id:'forest',name:'Место для тишины',desc:'Деревянный мостик у лесного пруда.',x:-176,z:-156},
 {id:'greenhouse',name:'Сад круглый год',desc:'Новая просторная оранжерея.',x:-24,z:176}
];
const D={WORLD_LIMIT,ROAD_GRID,BRIDGES,locations,pickupPoints,districts,vehicles,properties,cargoes,jobTypeInfo,souvenirs,questDefs,stories,races,landmarks};
root.GameData=D;if(typeof module!=='undefined')module.exports=D;
})(typeof window!=='undefined'?window:globalThis);
