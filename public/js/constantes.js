export const TIPOS = ['normal','fuego','agua','planta','eléctrico','hielo',
  'lucha','veneno','tierra','volador','psíquico','bicho',
  'roca','fantasma','dragón','siniestro','acero','hada']

export const TIPO_EN = {
  normal:'normal',fuego:'fire',agua:'water',planta:'grass','eléctrico':'electric',
  hielo:'ice',lucha:'fighting',veneno:'poison',tierra:'ground',volador:'flying',
  'psíquico':'psychic',bicho:'bug',roca:'rock',fantasma:'ghost','dragón':'dragon',
  siniestro:'dark',acero:'steel',hada:'fairy'
}

export const TIPO_COLOR = {
  normal:'#A8A878',fuego:'#F08030',agua:'#6890F0',planta:'#78C850',
  'eléctrico':'#F8D030',hielo:'#98D8D8',lucha:'#C03028',veneno:'#A040A0',
  tierra:'#E0C068',volador:'#A890F0','psíquico':'#F85888',bicho:'#A8B820',
  roca:'#B8A038',fantasma:'#705898','dragón':'#7038F8',siniestro:'#705848',
  acero:'#B8B8D0',hada:'#EE99AC'
}

export const RANGOS = {
  todas:[1,1025],kanto:[1,151],johto:[152,251],hoenn:[252,386],sinnoh:[387,493],
  unova:[494,649],kalos:[650,721],alola:[722,809],galar:[810,905],paldea:[906,1025]
}

export const FORMAS_REGIONALES = {
  kanto:[10033,10034,10035,10036,10037,10038,10039,10040],johto:[],
  hoenn:[10033,10034,10035,10036,10037,10038,10039,10040,10041,10042,
         10043,10044,10045,10046,10047,10048,10049,10050,10051,10052,
         10053,10054,10055,10056,10057,10058,10059,10060,10061,10062,10063,10064,10065],
  sinnoh:[],unova:[],kalos:[],
  alola:[10091,10092,10093,10094,10095,10096,10097,10098,10099,10100,
         10101,10102,10103,10104,10105,10106,10107,10108,10109,10110,
         10111,10112,10113,10114,10115,10116,10117,10118],
  galar:[10158,10159,10160,10161,10162,10163,10164,10165,10166,10167,
         10168,10169,10170,10171,10172,10173,10174,10175,10176,10177,
         10178,10179,10180,10181,10182,10183,10184,10185],
  hisui:[10186,10187,10188,10189,10190,10191,10192,10193,10194,10195,
         10196,10197,10198,10199,10200,10201,10202,10203,10204],
  paldea:[10250,10251,10252],todas:[],
}

export const LEGENDARIOS = new Set([
  144,145,146,150,151,243,244,245,249,250,251,377,378,379,380,381,382,383,384,385,386,
  480,481,482,483,484,485,486,487,488,489,490,491,492,493,494,638,639,640,641,642,643,
  644,645,646,647,648,649,716,717,718,719,720,721,772,773,785,786,787,788,789,790,791,
  792,800,801,802,888,889,890,891,892,893,894,895,896,897,898,
  905,1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1017,1020,1024,1025
])

export const TIMER_SEG = 10
