
/* Small original WebGL renderer. No CDN, engine download, or build step required. */
(function(root){'use strict';
root.createTownRenderer=function(canvas){
const D=root.GameData,{WORLD_LIMIT,ROAD_GRID,BRIDGES,locations,properties,cargoes}=D;
const lowPower=matchMedia('(pointer:coarse)').matches||innerWidth<720;
const gl=canvas.getContext('webgl',{antialias:true,alpha:false,powerPreference:'high-performance'});
if(!gl)throw new Error('WebGL недоступен');
let state, options={},t=0,transform=null,verts=[],seed=43,confetti=0;
let yaw=.62,zoom=31,overview=false,camX=-24,camZ=0,vp,night=0;
const blocks=[],lamps=[];
const currentVehicle=()=>D.vehicles.find(v=>v.id===state.vehicle);
const currentCargo=()=>state.job?cargoes[state.job.cargo]:null;
const colorCache=new Map();
function hex(h){if(!colorCache.has(h)){let n=parseInt(h.replace('#',''),16);colorCache.set(h,[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]);}return colorCache.get(h);}
function material(c){return c==='#57b7c4'?2:['#a9d7df','#fff0b5','#fff0b2'].includes(c)?1:c==='#ffe2a4'?3:0;}
function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
function makeProgram(vs,fs){const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
const program=makeProgram(`
attribute vec3 p;attribute vec3 c;attribute float m;
uniform mat4 vp;uniform mat4 lightVP;
varying vec3 color;varying vec3 world;varying vec4 shadowPos;varying float mat;
void main(){world=p;color=c;mat=m;shadowPos=lightVP*vec4(p,1.0);gl_Position=vp*vec4(p,1.0);}`,
`precision highp float;
varying vec3 color;varying vec3 world;varying vec4 shadowPos;varying float mat;
uniform sampler2D shadowMap;uniform float shadowOn;uniform float night;uniform float clock;uniform vec2 focus;uniform vec3 sky;
float unpackDepth(vec4 rgba){return dot(rgba,vec4(1.0,1.0/255.0,1.0/65025.0,1.0/16581375.0));}
void main(){
 vec3 base=color;float sh=0.0;
 vec3 q=shadowPos.xyz/shadowPos.w*.5+.5;
 if(shadowOn>.5&&q.x>0.0&&q.x<1.0&&q.y>0.0&&q.y<1.0&&q.z<1.0){
  for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++){
   float d=unpackDepth(texture2D(shadowMap,q.xy+vec2(float(i),float(j))/2048.0));
   sh+=q.z-.0015>d?1.0/9.0:0.0;
  }
 }
 base*=mix(vec3(1.035,1.02,.98),vec3(.31,.45,.62),night);
 base*=1.0-sh*.28*(1.0-night*.7);
 if(mat>1.5&&mat<2.5){
  float wave=sin(world.z*.75+clock*.8+sin(world.x*.5+clock*.3))*sin(world.x*1.2-clock*.6);
  base+=vec3(.07,.12,.13)*smoothstep(.45,.8,wave)*(1.0-night*.5);
  base+=vec3(.02,.04,.05)*sin(world.z*.16+clock*.3);
 }
 if(mat>.5&&mat<1.5)base=mix(base,vec3(1.0,.76,.39),night*.96);
 float alpha=1.0;
 if(mat>2.5){alpha=night*.13;if(alpha<.005)discard;base=vec3(1.0,.8,.45);}
 float fog=smoothstep(80.0,340.0,length(world.xz-focus))*.54;
 gl_FragColor=vec4(mix(base,sky,fog),alpha);
}`);
const depthProgram=makeProgram('attribute vec3 p;uniform mat4 vp;void main(){gl_Position=vp*vec4(p,1.0);}',`precision highp float;void main(){vec4 rgba=fract(gl_FragCoord.z*vec4(1.,255.,65025.,16581375.));rgba-=rgba.yzww*vec4(1./255.,1./255.,1./255.,0.);gl_FragColor=rgba;}`);
const attr={p:gl.getAttribLocation(program,'p'),c:gl.getAttribLocation(program,'c'),m:gl.getAttribLocation(program,'m')};
const uniform=Object.fromEntries(['vp','lightVP','shadowMap','shadowOn','night','clock','focus','sky'].map(k=>[k,gl.getUniformLocation(program,k)]));
const dp=gl.getAttribLocation(depthProgram,'p'),dvp=gl.getUniformLocation(depthProgram,'vp');
gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
const shadowSize=Math.min(2048,gl.getParameter(gl.MAX_TEXTURE_SIZE));
const shadowTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,shadowTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,shadowSize,shadowSize,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.NEAREST);
for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);
const shadowFB=gl.createFramebuffer(),depthRB=gl.createRenderbuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFB);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,shadowTex,0);gl.bindRenderbuffer(gl.RENDERBUFFER,depthRB);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,shadowSize,shadowSize);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depthRB);
const shadowSupported=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;gl.bindFramebuffer(gl.FRAMEBUFFER,null);
function point(p){if(!transform)return p;let [x,y,z,a]=transform,c=Math.cos(a),s=Math.sin(a);return [x+p[0]*c+p[2]*s,y+p[1],z-p[0]*s+p[2]*c];}
function tri(a,b,c,color,shade=1){let rgb=typeof color==='string'?hex(color):color;for(let p of [a,b,c])verts.push(...point(p),...rgb.map(v=>Math.min(1,v*shade)),material(color));}
function quad(a,b,c,d,col,s=1){tri(a,b,c,col,s);tri(a,c,d,col,s);}
function box(x,y,z,w,h,d,col){let X=x-w/2,Z=z-d/2,Y=y+h;quad([X,y,Z],[X+w,y,Z],[X+w,Y,Z],[X,Y,Z],col,.76);quad([X,y,Z+d],[X,Y,Z+d],[X+w,Y,Z+d],[X+w,y,Z+d],col,.94);quad([X,y,Z],[X,Y,Z],[X,Y,Z+d],[X,y,Z+d],col,.7);quad([X+w,y,Z],[X+w,y,Z+d],[X+w,Y,Z+d],[X+w,Y,Z],col,.86);quad([X,Y,Z],[X+w,Y,Z],[X+w,Y,Z+d],[X,Y,Z+d],col,1.12);}
function cylinder(x,y,z,r,h,col,n=10,r2=r){for(let i=0;i<n;i++){let a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2,A=[x+Math.cos(a)*r,y,z+Math.sin(a)*r],B=[x+Math.cos(b)*r,y,z+Math.sin(b)*r],C=[x+Math.cos(b)*r2,y+h,z+Math.sin(b)*r2],D=[x+Math.cos(a)*r2,y+h,z+Math.sin(a)*r2];quad(A,B,C,D,col,.76+.17*Math.sin(a));tri([x,y+h,z],D,C,col,1.1);}}
function ring(x,y,z,r,col){for(let i=0;i<40;i++){let a=i/40*Math.PI*2,b=(i+1)/40*Math.PI*2;quad([x+Math.cos(a)*r,y,z+Math.sin(a)*r],[x+Math.cos(b)*r,y,z+Math.sin(b)*r],[x+Math.cos(b)*(r-.3),y,z+Math.sin(b)*(r-.3)],[x+Math.cos(a)*(r-.3),y,z+Math.sin(a)*(r-.3)],col);}}
function roof(x,y,z,w,d,col){let X=x-w/2,Z=z-d/2;quad([X,y,Z],[X,y,Z+d],[x,y+3,Z+d],[x,y+3,Z],col,.83);quad([x,y+3,Z],[x,y+3,Z+d],[X+w,y,Z+d],[X+w,y,Z],col,1.1);tri([X,y,Z],[X+w,y,Z],[x,y+3,Z],col,.8);tri([X,y,Z+d],[x,y+3,Z+d],[X+w,y,Z+d],col);}

function canopy(x,y,z,r,col){const N=9;for(let row=0;row<4;row++){const a=Math.PI*row/4,b=Math.PI*(row+1)/4;for(let i=0;i<N;i++){let u=i/N*Math.PI*2,v=(i+1)/N*Math.PI*2;quad([x+Math.sin(a)*Math.cos(u)*r,y+Math.cos(a)*r,z+Math.sin(a)*Math.sin(u)*r],[x+Math.sin(b)*Math.cos(u)*r,y+Math.cos(b)*r,z+Math.sin(b)*Math.sin(u)*r],[x+Math.sin(b)*Math.cos(v)*r,y+Math.cos(b)*r,z+Math.sin(b)*Math.sin(v)*r],[x+Math.sin(a)*Math.cos(v)*r,y+Math.cos(a)*r,z+Math.sin(a)*Math.sin(v)*r],col,.85+row*.055+(i%3)*.04);}}}
function tree(x,z,s=1){
 if(ROAD_GRID.some(v=>Math.abs(x-v)<8||Math.abs(z-v)<8)||blocks.some(b=>Math.abs(x-b.x)<b.w/2+2&&Math.abs(z-b.z)<b.d/2+2)||locations.some(p=>Math.hypot(x-p.x,z-p.z)<5.5)||D.landmarks.some(p=>Math.hypot(x-p.x,z-p.z)<5.5)||Math.abs(x+68)<13&&Math.abs(z-28)<13)return;
 blocks.push({x,z,w:.55,d:.55});
 cylinder(x,0,z,.24*s,3.8*s,'#867461',7);
 canopy(x,4.6*s,z,2.5*s,'#6fa68b');canopy(x-.8*s,5.6*s,z+.3*s,1.8*s,'#8db994');
}
function building(x,z,w,d,h,col){
 blocks.push({x,z,w:w+1,d:d+1});
 box(x,.1,z,w+1.4,.5,d+1.4,'#e4d9c5');box(x,.6,z,w,h,d,col);
 box(x,.6,z,w+.15,.65,d+.15,'#c4b49d');
 for(let y=3;y<h;y+=3.5){
  for(let xx=-w/2+2;xx<w/2-1;xx+=3.6){
   for(let side of [-1,1]){box(x+xx,y-.15,z+side*(d/2+.03),1.85,2.2,.12,'#f4e8d4');box(x+xx,y,z+side*(d/2+.13),1.4,1.8,.13,'#a9d7df');box(x+xx,y+.82,z+side*(d/2+.22),1.45,.09,.08,'#f3e4ce');box(x+xx,y,z+side*(d/2+.22),.08,1.8,.08,'#f3e4ce');box(x+xx,y-.2,z+side*(d/2+.24),2.0,.2,.38,'#fff1d7');}
  }
  for(let zz=-d/2+2;zz<d/2-1;zz+=3.7)for(let side of [-1,1]){box(x+side*(w/2+.06),y-.1,z+zz,.15,2.1,1.9,'#f2e4cc');box(x+side*(w/2+.15),y,z+zz,.12,1.8,1.5,'#a9d7df');box(x+side*(w/2+.22),y+.8,z+zz,.12,.08,1.55,'#f2e4cc');}
 }
 box(x,h+.6,z,w+.8,.4,d+.8,'#f4e7cc');roof(x,h+1,z,w+1.4,d+1.4,'#be7461');
 box(x-w*.3,h+1,z-d*.22,1.4,3.2,1.5,'#d3b398');box(x-w*.3,h+4.2,z-d*.22,1.8,.24,1.9,'#f0dec2');
 // Awnings, entrances and roof dormers give every street a human scale.
 box(x,.6,z+d/2+.1,2.3,3,.22,'#42666d');box(x,1.1,z+d/2+.24,1.6,1.65,.05,'#a9d7df');
 box(x,3.8,z+d/2+1.1,4.6,.18,2.4,'#f7edd6');
 for(let xx=-1.8;xx<=1.8;xx+=1.2)box(x+xx,3.84,z+d/2+1.1,.55,.1,2.4,'#ce8264');
 box(x,.14,z+d/2+1.8,3.4,.2,2.4,'#f4e4c9');
 for(let side of [-1,1]){box(x+side*(w/2-1.2),.4,z+d/2+.65,1.7,.7,1.2,'#e5b38b');canopy(x+side*(w/2-1.2),1.5,z+d/2+.65,.9,'#77a48b');}
}
function bench(x,z){box(x,.6,z,3,.3,1,'#b18b65');box(x,1,z-.45,3,1,.18,'#c49c74');box(x-1,0,z,.17,.8,.9,'#526b69');box(x+1,0,z,.17,.8,.9,'#526b69');}
function streetLamp(x,z){lamps.push({x,z});cylinder(x,0,z,.085,5.5,'#48686c',6);box(x+.4,5.4,z,1.2,.12,.15,'#48686c');box(x+.85,5.15,z,.6,.3,.7,'#fff0b5');box(x+.85,5.48,z,.8,.15,.85,'#48686c');}
function scooter(x,z,a,col='#db9e48',size=1){transform=[x,0,z,a];box(0,.35,0,.7*size,.22,2.5*size,col);for(let zz of [-.9,.9])box(0,.08,zz*size,.3,.5,.5,'#354e50');box(0,.45,1*size,.12,1.6,.12,'#41696a');box(0,2,1*size,1,.12,.15,col);transform=null;}
function buildExpansion(){
 const colors=['#eac9a1','#94b9b1','#e5ab91','#b2b7d0','#e1c986'];
 for(let i=34;i<locations.length;i++){
  const p=locations[i];if([34,36,37,46,47,48,49,53].includes(i))continue;
  building(p.x,p.z-14,17,16,8+(i%3)*3,colors[i%colors.length]);
 }
 // New neighborhoods are separated by gardens, courtyards and tree-lined boulevards.
 for(let x of [-168,-120,-72,-24,24,120,168])for(let z of [-208,208]){
  if(x>63&&x<91)continue;for(let dx of [-8,8])tree(x+dx,z,.8+(x%5)*.04);
 }
 for(let x of [-208,208])for(let z=-168;z<=168;z+=24){tree(x,z,1.15);if(z%48===24)bench(x-3,z+5);}
 // Farm pickup yard and orchard.
 for(let x=-180;x<=-156;x+=6)for(let z=-30;z<=-18;z+=6){tree(x,z,.7);cylinder(x,3.1,z,.35,.5,'#db8167',7);}
 box(-168,.15,-8,14,.08,10,'#dcc8a5');for(let x of [-175,-171,-167])box(x,.25,-12,2.5,1.2,2,'#c9a97b');
 // Observatory dome and institute plaza.
 blocks.push({x:-24,z:-172,w:20,d:18});box(-24,.2,-172,20,8,18,'#eee0bf');cylinder(-24,8.2,-172,10,1,'#577e89',24);canopy(-24,9,-172,8.8,'#82aeb4');box(-19,14,-171,10,1.5,1.5,'#486e7a');
 // Museum: columns, pediment and steps.
 building(-72,-173,21,17,10,'#e9d7b6');for(let x=-80;x<=-64;x+=4)cylinder(x,.3,-162,0.55,7,'#fff0d7',10);box(-72,7.3,-162,22,1.3,2.5,'#ddbf99');
 // Lighthouse.
 blocks.push({x:130,z:-121,w:6,d:6});cylinder(130,0,-121,3,16,'#f3dfbe',16,2.3);cylinder(130,6,-121,2.76,3,'#d77865',16,2.63);cylinder(130,16,-121,3,.5,'#587780',16);cylinder(130,16.5,-121,2,2.5,'#a9d7df',12);cylinder(130,19,-121,3,2,'#bc765f',12,0);
 // Hospital markings and solar panels.
 box(168,8.8,-31,4,1,2,'#f5e9d5');box(168,9.85,-31,2,.2,.5,'#d87263');box(168,9.85,-31,.5,.2,1.6,'#d87263');
 for(let x of [161,166,171])box(x,12,-20,3,.2,4,'#527c96');
 // Festival stage and ferris wheel supports.
 box(121,.08,164,31,.1,26,'#ead6b3');box(115,.2,158,14,1,6,'#be9a79');box(115,1.2,155,14,6,.4,'#8baeb1');for(let x of [109,121])box(x,1.2,159,1.5,2.7,1.5,'#466a70');
 blocks.push({x:136,z:165,w:4,d:6});box(136,.2,165,1,11,1,'#e2c695');box(136,.2,162,6,.4,8,'#d5b991');
 // Beach, umbrellas and promenade (east bank).
 box(205,.05,143,20,.1,82,'#e7d2a9');for(let z=112;z<=178;z+=16){cylinder(205,2.8,z,3,.7,z%3?'#e29a7e':'#78aaa9',12,0);cylinder(205,0,z,.1,2.9,'#9e8564',6);bench(210,z+3);}
 // Forest grove and a small pond; this water is a solid boundary for navigation.
 building(-162,-177,12,10,6,'#cbae85');box(-181,.08,-168,10,.1,14,'#739f92');blocks.push({x:-181,z:-168,w:10,d:14});
 for(let i=0;i<34;i++){const a=i*2.4,r=15+(i%5)*2;tree(-170+Math.cos(a)*r,-174+Math.sin(a)*r,.8+(i%3)*.22);}
 box(-176,.2,-159,10,.2,3,'#c5a47b');
 // Garden windmills and an open camping ground.
 cylinder(24,0,163,4,9,'#e6d2ad',10,2);roof(24,9,163,7,7,'#b27760');blocks.push({x:24,z:163,w:7,d:7});
 for(let x of [-131,-118,-105]){roof(x,0,165,9,7,['#cc9474','#82a6a0','#dab773'][Math.abs(x)%3]);blocks.push({x,z:165,w:9,d:7});}
 // Accurate collision for parked large structures and new entrance pads.
 for(let i=34;i<locations.length;i++){const p=locations[i];box(p.x,.17,p.z,5,.08,4,'#eddfc3');}
}
function buildWorld(){
verts=[];

// Two physical banks and a recessed, animated water surface.
box(-80,-3,0,288,3,448,'#a7c993');box(157,-3,0,134,3,448,'#a7c993');
box(0,-5,0,448,2,448,'#c6ad85');
for(let v of ROAD_GRID){
 for(let bank of [[-80,288],[157,134]]){
  box(bank[0],.025,v,bank[1],.06,10,'#667b80');
  for(let side of [-1,1]){box(bank[0],.04,v+side*6.1,bank[1],.18,2.2,'#e9dfcb');box(bank[0],.06,v+side*5.05,bank[1],.28,.16,'#fff0d8');}
 }
 box(v,.03,0,10,.06,440,'#667b80');
 for(let side of [-1,1]){box(v+side*6.1,.04,0,2.2,.18,440,'#e9dfcb');box(v+side*5.05,.06,0,.16,.28,440,'#fff0d8');}
 for(let n=-214;n<=214;n+=8){
  if(ROAD_GRID.every(r=>Math.abs(n-r)>9)){
   if(n<63||n>90)box(n,.115,v,3.3,.018,.15,'#efdcaf');
   box(v,.115,n,.15,.018,3.3,'#efdcaf');
  }
 }
}
for(let x of ROAD_GRID)for(let z of ROAD_GRID){
 // Crossings on all four sides; no markings through the junction itself.
 for(let side of [-1,1])for(let k=-3.5;k<=3.5;k+=1.4){
  box(x+k,.13,z+side*9,.7,.025,2.7,'#fff3da');
  box(x+side*9,.13,z+k,2.7,.025,.7,'#fff3da');
 }
 for(let side of [-1,1]){box(x+side*2.5,.13,z+side*12,4.3,.025,.2,'#fff3da');box(x+side*12,.13,z-side*2.5,.2,.025,4.3,'#fff3da');}
}
box(77,-.35,0,26,.4,448,'#57b7c4');
for(let side of [64,90])box(side,.02,0,1,.6,448,'#e4d9bb');
for(let z of BRIDGES){
 box(77,.13,z,27,.15,10,'#728992');
 for(let side of [-1,1]){box(77,.3,z+side*5,27,.65,.28,'#f3e7d0');for(let x=64;x<=90;x+=2)box(x,.3,z+side*5,.17,1.2,.17,'#567b80');box(77,1.4,z+side*5,27,.15,.25,'#efdbc0');}
 for(let x=68;x<=87;x+=7)box(x,.29,z,3,.01,.16,'#efdcaf');
}
for(let z of [-172,-124,-74,24,122,170]){box(77,.1,z,3,.5,6,'#f3e8c8');box(77,.6,z,2,.6,2,'#d88661');box(77,1.2,z,.1,4,.1,'#566e61');tri([77,1.5,z],[77,5.1,z],[77,1.5,z-2.4],'#fff5d9');}
// Original central neighbourhoods.
building(-65,-66,16,16,10,'#e9b287');building(-24,-65,17,17,13,'#a7c6ac');building(24,-65,18,17,9,'#d99781');building(-65,-15,17,17,10,'#e6c676');building(24,-15,18,17,14,'#e7b899');building(-66,79,16,16,11,'#b7acc5');building(-24,79,19,15,9,'#c3c59a');building(24,79,20,17,17,'#e2c788');building(104,-14,15,15,9,'#ecbf96');
// New outer districts.
building(-120,-120,18,16,12,'#d7a47f');building(-72,-120,17,16,10,'#9fc2b0');building(-24,-120,18,16,14,'#d7c18a');building(24,-120,19,17,11,'#d79788');building(118,-120,17,16,13,'#b9a9c8');
building(-120,-72,18,16,9,'#d9ba78');building(-120,72,17,17,12,'#a9c19b');building(118,72,18,16,14,'#e1b991');building(-120,120,18,16,10,'#b8c79c');building(-72,120,17,15,12,'#dda47f');building(-24,120,18,16,9,'#9fc0aa');building(24,120,18,17,15,'#c7accc');building(118,120,18,16,11,'#e1c580');
// Warehouse and its open loading apron.
blocks.push({x:-24,z:-24,w:24,d:16});box(-24,.1,-24,25,.4,17,'#e4d6b7');box(-24,.5,-24,24,7,16,'#dab48a');box(-24,7.5,-24,25,.6,17,'#467d7a');box(-24,1,-15.94,9,4.8,.1,'#5b7b77');box(-24,5.1,-15.8,10,.5,.2,'#e28e54');box(-24,.1,-9,20,.1,11,'#cfceb5');for(let x of [-33,-15]){box(x,.2,-12,2,1.6,2,'#bc9461');box(x,.2,-9,2,1.6,2,'#d0ac76');}for(let x=-30;x<-18;x+=3)box(x,6,-15.7,1.8,.55,.1,'#fff2c9');
// Central park with fountain and playground.
box(-24,.08,24,32,.1,31,'#bad399');box(-24,.2,24,4,.05,32,'#e4d4ac');box(-24,.2,24,32,.05,4,'#e4d4ac');blocks.push({x:-24,z:24,w:8,d:8});cylinder(-24,.22,24,5,.4,'#e8dfc4',16);cylinder(-24,.65,24,4.4,.12,'#7bc7c2',16);cylinder(-24,.7,24,1.6,.6,'#d5d9bd',12);cylinder(-24,1.3,24,.5,2.5,'#d5d9bd',8);cylinder(-24,3.6,24,2,.2,'#7ac9c6',12);bench(-32,19);bench(-16,29);for(let p of [[-35,34],[-34,12],[-14,13],[-14,36]])tree(...p,1.2);
box(-68,.1,28,22,.08,21,'#c4d79f');box(-68,.2,28,8,.1,8,'#e5ce99');box(-72,.3,28,.25,4,.25,'#d08053');box(-64,.3,28,.25,4,.25,'#d08053');box(-68,4.3,28,8.2,.25,.3,'#d08053');for(let x of [-70,-66]){box(x,1.6,28,.1,2.8,.1,'#747d63');box(x,1.6,28,1.5,.15,1.2,'#668e94');}
// Northern stadium.
box(-72,.08,-72,30,.12,28,'#a8ca8d');box(-72,.22,-72,24,.05,16,'#7fae72');for(let z=-78;z<=-66;z+=4)box(-72,.27,z,20,.02,.12,'#e8e0c2');for(let x of [-87,-57]){box(x,.25,-72,2,.9,26,'#d9d6c3');for(let z=-82;z<=-62;z+=4)box(x,.9,z,2.8,.35,2,'#6b8b91');}
// Western farm and orchard.
box(-120,.08,0,30,.08,28,'#d4c58d');for(let x=-131;x<=-109;x+=5)for(let z=-10;z<=10;z+=5){cylinder(x,.1,z,.18,1.1,'#6b8a59',5,.05);cylinder(x,.85,z,.65,.8,['#82a85f','#a7b55c','#d7a35d'][(Math.abs(x+z)/5)%3|0],6,.2);}blocks.push({x:-120,z:18,w:14,d:9});box(-120,.15,18,14,5,9,'#c88c67');roof(-120,5.2,18,15,10,'#8f6653');
// Upper fairground and greenhouse.
box(-72,.08,72,30,.1,28,'#c8d59d');for(let x of [-82,-72,-62]){cylinder(x,2.6,72,3.6,.5,['#e59a70','#e4c06b','#8db8ad'][(x+82)/10],8,.2);cylinder(x,0,72,.12,2.7,'#6c7864',6);}for(let z of [64,80])bench(-72,z);
blocks.push({x:-24,z:164,w:22,d:14});box(-24,.12,164,22,.4,14,'#d9e1c6');for(let x=-32;x<=-16;x+=4){box(x,.6,164,.12,5,13,'#87a5a0');}roof(-24,5.6,164,23,15,'#b9d6cd');
// East-bank promenade with market kiosks.
box(118,.08,24,30,.1,30,'#b8d49c');box(118,.18,24,4,.05,30,'#e2d5b7');box(118,.18,24,30,.05,4,'#e2d5b7');for(let a=0;a<4;a++){let x=108+a*6;box(x,.2,36,4,2.2,3,['#e0a47c','#d4c676','#9ebfa8','#b2a6c8'][a]);roof(x,2.5,36,4.5,3.5,'#f0e4c8');}
// Flower beds and small public spaces.
box(24,.13,25,29,.13,27,'#bad19b');box(24,.3,25,3,.08,27,'#e2d6b4');box(24,.31,25,29,.07,3,'#e2d6b4');for(let x of [16,31])for(let z of [17,33]){box(x,.32,z,5,.35,5,'#e6c6a0');for(let i=0;i<9;i++){let xx=x-1.7+(i%3)*1.7,zz=z-1.7+Math.floor(i/3)*1.7;cylinder(xx,.7,zz,.65,.3,['#e8a486','#e7ce86','#b5aac6'][i%3],6,.45);}}
buildExpansion();
// Trees: skip roads, river and buildings. The larger map uses fewer, larger clusters for performance.
for(let i=0;i<240;i++){let x=-213+rnd()*426,z=-213+rnd()*426;let road=ROAD_GRID.some(v=>Math.abs(x-v)<9||Math.abs(z-v)<9);if(x>59&&x<92||road||blocks.some(b=>Math.abs(x-b.x)<b.w/2+4&&Math.abs(z-b.z)<b.d/2+4)||Math.hypot(x+24,z-24)<20)continue;tree(x,z,.7+rnd()*.65);}
for(let v of ROAD_GRID)for(let n=-208;n<=208;n+=24){if(ROAD_GRID.every(r=>Math.abs(n-r)>11)){streetLamp(n,v+7);streetLamp(v-7,n);}}
for(let p of [[-86,-75],[-84,-60],[-84,-23],[-83,16],[-84,37],[-83,70],[-9,-82],[10,-84],[37,-82],[-35,-84],[-11,66],[10,64],[56,22],[56,-24],[56,80],[102,30],[102,68],[-136,-132],[-106,-132],[-136,132],[-106,132],[132,-82],[132,82]])tree(...p,.9);
bench(15,27);bench(32,23);bench(-126,46);bench(110,18);bench(126,18);
// Florist stalls, café tables and parked scooters.
for(let x of [-77,-73,-69]){cylinder(x,1.8,-34,1.5,.8,'#e7a167',6,.1);cylinder(x,0,-34,.09,2,'#7e8a6c',6);cylinder(x,.1,-34,.6,.6,'#8d9d7a',8);}for(let i=0;i<6;i++)scooter(10+i*2,39,0,['#e5a054','#87bfc1','#d88469'][i%3]);
for(let p of locations){box(p.x,.16,p.z,5,.1,4,'#e0d5b9');for(let ss of [-1,1]){box(p.x+ss*3,.2,p.z,1,.8,1,'#c98c68');cylinder(p.x+ss*3,1,p.z,.9,1,'#7bac79',6,.5);}}
for(let x of [-59,-55,-51]){cylinder(x,.15,-7,.75,.08,'#b78a61',8);cylinder(x,.23,-7,.08,1.2,'#6b7364',6);for(let a of [-1,1])box(x+a*1.2,.35,-7,.7,.18,.7,'#9b7d61');}
for(let z of [13,18,23]){box(37,.5,z,2.4,.18,1.2,'#a57d5e');box(37,1.1,z-.45,2.4,1,.16,'#b18a67');}
return new Float32Array(verts);}

function norm(v){let l=Math.hypot(...v);return v.map(x=>x/l);}function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}function dot(a,b){return a.reduce((s,v,i)=>s+v*b[i],0);}function multiply(a,b){let o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;}
function view(eye,target){let z=norm(eye.map((v,i)=>v-target[i])),x=norm(cross([0,1,0],z)),y=cross(z,x);return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];}
function ortho(w,h,far){return [1/w,0,0,0,0,1/h,0,0,0,0,-2/far,0,0,0,-1,1];}
const staticData=buildWorld(),staticBuffer=gl.createBuffer(),dynamicBuffer=gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER,staticBuffer);gl.bufferData(gl.ARRAY_BUFFER,staticData,gl.STATIC_DRAW);
function draw(buffer,count,depth=false){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);if(depth){for(const k of Object.values(attr))gl.disableVertexAttribArray(k);gl.enableVertexAttribArray(dp);gl.vertexAttribPointer(dp,3,gl.FLOAT,false,28,0);}else{for(const k of Object.values(attr))gl.enableVertexAttribArray(k);gl.vertexAttribPointer(attr.p,3,gl.FLOAT,false,28,0);gl.vertexAttribPointer(attr.c,3,gl.FLOAT,false,28,12);gl.vertexAttribPointer(attr.m,1,gl.FLOAT,false,28,24);}gl.drawArrays(gl.TRIANGLES,0,count);}
let lightVP=new Float32Array(16),shadowX=Infinity,shadowZ=Infinity;
function shadow(){
 if(!shadowSupported||options.quality==='low'||options.quality==='auto'&&lowPower||overview)return false;
 if(Math.hypot(camX-shadowX,camZ-shadowZ)>12){
  shadowX=camX;shadowZ=camZ;lightVP=multiply(ortho(110,110,450),view([camX-95,160,camZ+70],[camX,0,camZ]));
  gl.disable(gl.BLEND);gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFB);gl.viewport(0,0,shadowSize,shadowSize);gl.clearColor(1,1,1,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(depthProgram);gl.uniformMatrix4fv(dvp,false,lightVP);draw(staticBuffer,staticData.length/7,true);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.enable(gl.BLEND);
 }
 return true;
}
function near(x,z,extra=0){return overview||Math.hypot(x-camX,z-camZ)<(zoom*canvas.width/canvas.height+zoom+extra);}
function phase(axis=0){const p=(t+(axis?6.5:0))%13;return p<5.3?'green':p<6.5?'yellow':'red';}
const traffic=Array.from({length:30},(_,i)=>({axis:i%2,lane:ROAD_GRID[Math.floor(i/2)%ROAD_GRID.length],pos:-208+(i*31)%416,dir:i%4<2?1:-1,speed:5+(i%5)*.7,color:['#d98470','#7eaab4','#e2be72','#9ab6a0','#eee0b9'][i%5]}));
function updateTraffic(dt){for(const car of traffic){
 let stop=false;
 for(const crossing of ROAD_GRID){const dist=(crossing-car.pos)*car.dir;if(dist>8&&dist<13&&phase(car.axis)!=='green')stop=true;}
 const x=car.axis?car.pos:car.lane-car.dir*2.3,z=car.axis?car.lane+car.dir*2.3:car.pos;
 if(Math.hypot(x-state.x,z-state.z)<5)stop=true;
 if(!stop)car.pos+=car.dir*car.speed*dt;
 if(car.pos>218)car.pos=-218;if(car.pos< -218)car.pos=218;
}}
function signal(x,z,axis){
 transform=[x,0,z,axis?Math.PI/2:0];cylinder(0,0,0,.08,4.5,'#49686b',6);box(0,4.4,0,.6,1.65,.5,'#314d56');
 const ph=phase(axis);
 for(let i=0;i<3;i++)box(0,5.65-i*.5,.27,.35,.32,.05,ph===['red','yellow','green'][i]?['#fb7d6c','#f4d173','#92d9ae'][i]:'#41565a');
 transform=null;
}
function wheel(){if(!near(136,165,20))return;const cx=136,cy=12,z=165,r=10;for(let i=0;i<16;i++){
 const a=i/16*Math.PI*2+t*.06,b=(i+1)/16*Math.PI*2+t*.06;
 quad([cx+Math.cos(a)*r,cy+Math.sin(a)*r,z],[cx+Math.cos(b)*r,cy+Math.sin(b)*r,z],[cx+Math.cos(b)*(r-.3),cy+Math.sin(b)*(r-.3),z],[cx+Math.cos(a)*(r-.3),cy+Math.sin(a)*(r-.3),z],'#eed4a8');
 quad([cx-.07,cy,z],[cx+.07,cy,z],[cx+Math.cos(a)*r+.07,cy+Math.sin(a)*r,z],[cx+Math.cos(a)*r-.07,cy+Math.sin(a)*r,z],'#ead3ae');
 if(i%2===0){let x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;box(x,y-1,z,2,1.5,1.8,['#d88971','#7daab0','#d3b477','#9eb7a0'][i/2%4]);}
}}
let dynamicCount=0;
function dynamics(dt,fx){
 verts=[];rider();const goal=fx.target;
 // Clearly visible cyan breadcrumbs follow the navigable route.
 if(fx.route?.length>1&&!overview){for(let i=1;i<fx.route.length;i++){const a=fx.route[i-1],b=fx.route[i],length=Math.hypot(a.x-b.x,a.z-b.z);for(let j=2;j<length;j+=3.8){let x=a.x+(b.x-a.x)*j/length,z=a.z+(b.z-a.z)*j/length;if(near(x,z)&&Math.hypot(state.x-x,state.z-z)<85)cylinder(x,.36,z,.26,.04,'#9ce1cb',6);}}}
 if(goal){ring(goal.x,.38,goal.z,4+Math.sin(t*3)*.12,'#e79e61');ring(goal.x,.39,goal.z,3.5,'#fff1d1');let y=5.5+Math.sin(t*2)*.35;cylinder(goal.x,y,goal.z,.7,1,'#e99055',6,0);cylinder(goal.x,y+1,goal.z,0,.9,'#ffe0a0',6,.7);if(state.job?.stage==='pickup'){const c=currentCargo();if(c.type==='taxi')person(goal.x,goal.z,Math.PI/2,'#6f8fa0',2);else furniture(c.kind,goal.x,.4,goal.z);}}
 for(const v of traffic){const x=v.axis?v.pos:v.lane-v.dir*2.3,z=v.axis?v.lane+v.dir*2.3:v.pos;if(near(x,z))car(x,z,v.axis?v.dir*Math.PI/2:(v.dir===1?0:Math.PI),v.color,.8);}
 for(let i=0;i<12;i++){let lane=ROAD_GRID[i%9],pos=((t*(3+i*.05)+i*37)%420)-210,x=i%2?pos:lane+7.3,z=i%2?lane-7.3:pos;if((x<63||x>91)&&near(x,z))person(x,z,i%2?Math.PI/2:0,['#df996e','#7aa4ad','#af99b9','#dab97a'][i%4],i);}
 for(let i=0;i<7;i++){let a=i*1.73,x=-24+Math.cos(a)*14+Math.sin(t*.2+i),z=24+Math.sin(a)*12;if(near(x,z))person(x,z,a+Math.PI/2,['#db9977','#7fa8aa','#c1a0b4'][i%3],i);}
 for(const [x,z]of[[-31,31],[18,32],[-121,-52],[112,18],[-72,112]])if(near(x,z))animal('cat',x,z,Math.sin(t*.3));
 for(const x of ROAD_GRID)for(const z of ROAD_GRID)if(near(x,z)){signal(x+6.6,z+6.6,0);signal(x-6.6,z-6.6,1);}
 for(const s of D.souvenirs){if(state.souvenirs.includes(s.id)||!near(s.x,s.z))continue;let bob=.9+Math.sin(t*2+s.x*.03)*.22;transform=[s.x,bob,s.z,t*.7];box(0,0,0,.7,.7,.7,'#f2c66d');box(0,.1,0,1,.12,.2,'#fff0c4');transform=null;ring(s.x,.26,s.z,1,'#f4d787');}
 if(night>.1)for(const p of lamps)if(near(p.x,p.z))cylinder(p.x+.8,.27,p.z,3.8,.005,'#ffe2a4',16);
 wheel();
 if(near(24,163)){transform=[24,7.5,166,t*.6];transform=null;for(let i=0;i<4;i++){const a=t*.6+i*Math.PI/2;quad([24,7.5,166.5],[24+Math.cos(a)*7,7.5+Math.sin(a)*7,166.5],[24+Math.cos(a+.12)*7,7.5+Math.sin(a+.12)*7,166.5],[24.2,7.7,166.5],'#f5e6ca');}}
 if(fx.confetti>0)for(let i=0;i<26;i++){let a=i*2.4,r=(2.5-fx.confetti)*3+1;box(state.x+Math.cos(a)*r,2+fx.confetti*2+i%4,state.z+Math.sin(a)*r,.13,.32,.13,['#e79573','#ffecbc','#93c9b1'][i%3]);}
 const data=new Float32Array(verts);gl.bindBuffer(gl.ARRAY_BUFFER,dynamicBuffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);dynamicCount=data.length/7;draw(dynamicBuffer,dynamicCount);
}
let contextLost=false;canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;root.dispatchEvent(new Event('town-context-lost'));});
canvas.addEventListener('webglcontextrestored',()=>root.dispatchEvent(new Event('town-context-restored')));
function resize(){let dpr=Math.min(devicePixelRatio||1,options.quality==='low'?1:options.quality==='high'?2:lowPower?1.25:1.6);let w=Math.round(canvas.clientWidth*dpr),h=Math.round(canvas.clientHeight*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}}
function render(s,dt,fx={}){
 if(contextLost)return;state=s;options=s.settings;t+=dt;resize();
 yaw=fx.yaw??yaw;overview=!!fx.overview;zoom=fx.zoom||31;
 const smooth=options.motion?Math.min(1,dt*5):1;
 camX+=((overview?0:state.x)-camX)*smooth;camZ+=((overview?0:state.z)-camZ)*smooth;
 const h=overview?Math.max(265,265*canvas.height/canvas.width):zoom,w=h*canvas.width/canvas.height;
 // Overview camera sits far enough away to avoid clipping the near half of the city.
 const d=overview?430:140;
 vp=multiply(ortho(w,h,overview?1300:700),view([camX+Math.sin(yaw)*d,d*.98,camZ+Math.cos(yaw)*d],[camX,0,camZ]));
 const minutes=options.atmosphere==='day'?14*60:options.atmosphere==='night'?23*60:options.atmosphere==='sunset'?18.5*60:(16*60+10+state.playTime*1.7)%1440;
 const hr=minutes/60;night=hr>20?Math.min(1,(hr-20)/1.3):hr<6?1:hr<8?1-(hr-6)/2:0;
 const sunset=hr>=17&&hr<=20?Math.sin((hr-17)/3*Math.PI):0;
 const sky=[.72-night*.58+sunset*.06,.85-night*.66-sunset*.08,.84-night*.57-sunset*.14];
 const shadowOn=shadow();
 gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(...sky,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
 gl.uniformMatrix4fv(uniform.vp,false,vp);gl.uniformMatrix4fv(uniform.lightVP,false,lightVP);gl.uniform1f(uniform.shadowOn,shadowOn?1:0);gl.uniform1f(uniform.night,night);gl.uniform1f(uniform.clock,options.motion?t:0);gl.uniform2f(uniform.focus,camX,camZ);gl.uniform3fv(uniform.sky,sky);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,shadowTex);gl.uniform1i(uniform.shadowMap,0);
 draw(staticBuffer,staticData.length/7);updateTraffic(fx.playing?dt:0);dynamics(dt,fx);
 return {minutes,night,triangles:(staticData.length/7+dynamicCount)/3};
}
return {render,blocks,lowPower,phase,project(p,y=7){if(!vp)return null;let a=[p.x,y,p.z,1],o=[0,0,0,0];for(let r=0;r<4;r++)for(let c=0;c<4;c++)o[r]+=vp[c*4+r]*a[c];return{x:(o[0]/o[3]*.5+.5)*canvas.clientWidth,y:(-o[1]/o[3]*.5+.5)*canvas.clientHeight};},snap(p){camX=p.x;camZ=p.z;},stats:()=>({staticTriangles:staticData.length/21,webgl:!contextLost,shadowSupported,lowPower,traffic:traffic.map(c=>({...c,light:phase(c.axis)}))})};
function furniture(kind,x,y,z,s=1){if(['apples','vegetables','seedlings','medicine','medicalbox','tools','recycling'].includes(kind)){box(x,y,z,1.6*s,.95*s,1.4*s,kind==='medicine'||kind==='medicalbox'?'#f4efe1':kind==='recycling'?'#7eb9a1':'#c29b69');if(kind==='medicine'||kind==='medicalbox'){box(x,y+1*s,z,.85*s,.08,.22*s,'#e98072');box(x,y+1*s,z,.22*s,.08,.85*s,'#e98072');}else for(let a of [-.45,.45])for(let b of [-.4,.4])cylinder(x+a*s,y+.9*s,z+b*s,.28*s,.3*s,kind==='apples'?'#e17c67':kind==='tools'?'#72969a':'#8bbd73',8);}
else if(kind==='mattress'){box(x,y,z,1.6*s,.5*s,2.6*s,'#f2e8d7');for(let n=-1;n<=1;n++)box(x,y+.5*s,z+n*.7*s,1.5*s,.04,.07,'#c9c8b2');}
else if(kind==='boxes'||kind==='set'||kind==='parcel'||kind==='documents'){box(x,y,z,1.5*s,1.1*s,1.3*s,'#c7a16a');box(x,y+1.1*s,z,1.1*s,.8*s,1.1*s,'#dab880');box(x,y+1.1*s,z,.17,.82*s,1.12*s,'#f0d298');}
else if(kind==='wardrobe'||kind==='bookshelf'){box(x,y,z,1.9*s,2.7*s,1.1*s,kind==='bookshelf'?'#a77d57':'#b58961');if(kind==='bookshelf')for(let yy=.55;yy<2.5;yy+=.55)box(x,y+yy*s,z+.56*s,1.7*s,.08*s,.08*s,'#6e5948');else box(x,y+.1,z+.56*s,.07,2.5*s,.06,'#795f49');}
else if(kind==='table'||kind==='desk'){box(x,y+1.25*s,z,2.7*s,.22*s,1.5*s,kind==='desk'?'#9c7a5f':'#b4875f');for(let xx of [-1,1])for(let zz of [-.45,.45])box(x+xx*s,y,z+zz*s,.18*s,1.25*s,.18*s,'#795f49');if(kind==='desk')box(x,y+1.48*s,z-.35*s,1.2*s,.75*s,.12*s,'#4f6f75');}
else if(kind==='bed'){box(x,y,z,2.5*s,.55*s,3.2*s,'#b28b6b');box(x,y+.55*s,z,2.35*s,.5*s,3*s,'#efe3cc');box(x,y+1.05*s,z-1.35*s,2.45*s,1.2*s,.25*s,'#8e765f');}
else if(kind==='fridge'){box(x,y,z,1.6*s,2.7*s,1.5*s,'#dbe6e2');box(x+.55*s,y+1.35*s,z+.76*s,.08*s,.5*s,.08*s,'#70817e');box(x,y+1.45*s,z+.77*s,1.45*s,.05*s,.05*s,'#a8b9b5');}
else if(kind==='plant'||kind==='flowers'){cylinder(x,y,z,.65*s,.7*s,'#b98c63',8,.5*s);for(let i=0;i<7;i++){let a=i/7*Math.PI*2;cylinder(x+Math.cos(a)*.45*s,y+.55*s,z+Math.sin(a)*.45*s,.28*s,1.3*s,kind==='flowers'?'#9abc72':'#77a86f',6,.08*s);}}
else if(kind==='aquarium'){box(x,y,z,2.2*s,.25*s,1.2*s,'#8c765d');box(x,y+.25*s,z,2*s,1.55*s,1*s,'#86bdc4');box(x,y+1.8*s,z,2.15*s,.18*s,1.15*s,'#695b4b');for(let i=-1;i<=1;i++)cylinder(x+i*.5*s,y+.4*s,z,.12*s,.55*s,['#e29a57','#f0c35e','#7aa390'][i+1],6,.04*s);}
else if(kind==='piano'){box(x,y,z,2.5*s,1.7*s,1.15*s,'#51453c');box(x,y+1.55*s,z-.28*s,2.45*s,.18*s,.7*s,'#2f3433');box(x,y+1.05*s,z+.62*s,2.25*s,.12*s,.55*s,'#f3ead8');for(let i=-4;i<=4;i++)box(x+i*.22*s,y+1.08*s,z+.7*s,.12*s,.05*s,.35*s,i%2?'#ddd8ca':'#fbf7eb');for(let xx of [-.9,.9])box(x+xx*s,y,z,.16*s,.8*s,.16*s,'#403832');}
else if(['pizza','groceries','cake','meal'].includes(kind)){box(x,y,z,1.5*s,.45*s,1.5*s,kind==='cake'?'#f2d6c2':'#d69f68');if(kind==='pizza')cylinder(x,y+.46*s,z,.63*s,.12*s,'#e7ba61',12);if(kind==='cake')cylinder(x,y+.45*s,z,.55*s,.75*s,'#f2c6c2',12,.5*s);if(kind==='groceries'){for(let xx of [-.4,.4])box(x+xx*s,y+.45*s,z,.55*s,.9*s,.55*s,'#e7c98e');}}
else{let w=kind==='sofa'?2.8:1.5;box(x,y,z,w*s,.55*s,1.4*s,'#779e91');box(x,y+.45*s,z-.5*s,w*s,.9*s,.4*s,'#91b0a0');for(let a of [-1,1])box(x+a*(w/2-.12)*s,y+.4*s,z,.3*s,.65*s,1.4*s,'#a2bbab');}}

function rider(){let v=currentVehicle();transform=[state.x,.04,state.z,state.angle];if(v.cap>=3){box(0,.65,0,2.8,.8,5.4,v.color);box(0,1.4,-.9,2.75,2.4,3.5,v.id==='truck'?'#e5dec2':v.color);box(0,1.4,1.65,2.65,1.55,1.8,v.color);box(0,2,2.57,2.3,.8,.04,'#456d78');box(-1.34,1.9,1.7,.04,.8,1.4,'#547c82');box(1.34,1.9,1.7,.04,.8,1.4,'#547c82');box(0,.9,2.75,2.8,.25,.15,'#eef0d6');for(let x of [-1.1,1.1]){box(x,1.35,2.76,.45,.3,.1,'#fff0b2');for(let z of [-1.7,1.7])box(x*1.25,.3,z,.45,.9,.95,'#3d5454');}if(state.job?.stage==='deliver'){let c=currentCargo();if(c.type==='taxi'){box(0,2.15,-.65,.8,1.05,.55,'#6f8fa0');cylinder(0,3.2,-.65,.34,.52,'#e6b98f',7);box(.38,2.35,-.38,.12,.7,.12,'#dcb08a');}else furniture(c.kind,0,3.9,-.7,.7);}}else{box(0,.35,0,.7,.22,2.6,v.color);for(let z of [-1,1])box(0,.12,z,.38,.65,.6,'#354e50');box(0,.4,1,.14,1.8,.14,'#4d706c');box(0,2.1,1,1.15,.14,.17,v.color);let bob=Math.sin(t*12)*.035;box(0,.65,0,.7,1.05,.45,'#315a67');box(0,1.6+bob,.1,.95,1.1,.6,'#e7884f');cylinder(0,2.75+bob,.1,.39,.6,'#ecc39e',8);cylinder(0,3.29+bob,.1,.43,.2,'#f1d99b',8);for(let x of [-.57,.57])box(x,1.8+bob,.43,.25,.3,.9,'#e5bb94');if((v.id==='cargo'||v.id==='ebike')){box(0,.4,-2.5,1.9,.6,2.1,'#d9aa73');for(let x of [-1,1])box(x,.1,-2.5,.3,.6,.7,'#354e50');}if(state.job?.stage==='deliver'&&currentCargo().type!=='taxi')furniture(cargoes[state.job.cargo].kind,0,.95,(v.id==='cargo'||v.id==='ebike')?-2.5:-1,.65);}transform=null;}
function car(x,z,a,col='#d87d61',scale=1){transform=[x,.03,z,a];box(0,.35,0,2.2*scale,.55*scale,4*scale,col);box(0,.9,-.35*scale,1.8*scale,.8*scale,2*scale,col);box(0,1.3,-.3*scale,1.5*scale,.18*scale,1.45*scale,'#7aa0a5');for(let xx of [-1.05,1.05])for(let zz of [-1.25,1.25])box(xx*scale,.2,zz*scale,.35*scale,.6*scale,.75*scale,'#354e50');transform=null;}
function npcScooter(x,z,a,col='#d4996f',shirt='#668b91',scale=.85){transform=[x,.02,z,a];cylinder(0,.02,0,.55*scale,.035,'#31504d',8);box(0,.35,0,.7*scale,.22,2.5*scale,col);cylinder(0,.08,-.9*scale,.34*scale,.45,'#354e50',6);cylinder(0,.08,.9*scale,.34*scale,.45,'#354e50',6);box(0,.45,1*scale,.12,1.6,.12,'#41696a');box(0,2,1*scale,1,.12,.15,col);let bob=Math.sin(t*7+x*.1+z*.1)*.04;box(0,.7+bob,.05,.62,1.05,.42,shirt);cylinder(0,1.78+bob,.08,.3,.48,'#e6b98f',6);box(-.42,1.12+bob,.44,.14,.78,.14,'#e0ad87');box(.42,1.12+bob,.44,.14,.78,.14,'#e0ad87');box(-.2,.08,-.25,.15,.86,.15,'#465b5c');box(.2,.08,.25,.15,.86,.15,'#465b5c');transform=null;}
function person(x,z,a=0,col='#df8b61',walk=0){transform=[x,0,z,a];let swing=Math.sin(t*5+walk)*.25;box(0,.9,0,.65,1.2,.42,col);cylinder(0,2.1,0,.32,.55,'#e8bc96',8);box(-.22,.05,swing,.18,.95,.18,'#4e6261');box(.22,.05,-swing,.18,.95,.18,'#4e6261');box(-.45,1.1,-swing*.5,.16,.85,.16,'#e5b38d');box(.45,1.1,swing*.5,.16,.85,.16,'#e5b38d');transform=null;}
function animal(kind,x,z,a=0){transform=[x,0,z,a];let col=kind==='dog'?'#9b7657':'#c78f63';box(0,.35,0,.7,.55,1.25,col);cylinder(0,.75,.55,.32,.45,col,8);for(let xx of [-.24,.24])for(let zz of [-.38,.38])box(xx,.05,zz,.12,.42,.12,col);box(0,.52,-.78,.12,.12,.8,col);transform=null;}
};
})(window);
