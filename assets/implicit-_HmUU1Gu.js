import{t as M,v as N,b as R,c as S}from"./index-CpFY1vd5.js";import{w as _,N as k,T as H,C as F,p as B,E as W,g as $,i as q,V as D}from"./example-B1gPw968.js";const P=_.auxiliaries.log,V=_.auxiliaries.LogLevel;class O{}const d=class d{static initializeHeader(e){e.path_column="name"}static initializeConfig(e){e.colors=[{identifier:"emphasis",colorspace:"hex",value:"#00b0ff"},{identifier:"auxiliary",colorspace:"hex",values:["#00aa5e","#71237c"]},{identifier:"inner",colorspace:"hex",values:["#e8eaee","#eef0f4"]},{identifier:"leaf",preset:"Greens",steps:7}],e.layout={algorithm:"snake",weight:"bufferView:weights",sort:{key:"bufferView:weights",algorithm:k.Algorithm.Keep},parentPadding:{type:"relative",value:.05},siblingMargin:{type:"relative",value:.05},accessoryPadding:{type:"absolute",direction:"bottom",value:[0,.02,.01,0],relativeAreaThreshold:.4,targetAspectRatio:8}},e.geometry={parentLayer:{showRoot:!1},leafLayer:{colorMap:"color:leaf",height:"bufferView:heights-normalized",colors:"bufferView:colors-normalized"},emphasis:{outline:new Array,highlight:new Array},heightScale:.5},e.labels={innerNodeLayerRange:[1,2],numTopInnerNodes:50,numTopWeightNodes:50,numTopHeightNodes:50,numTopColorNodes:50}}static parseHeader(e,t){for(;e.length>=1&&e[0].startsWith("#");){const o=e.shift().substring(1).trim(),[a,i]=o.split("=").map(c=>c.trim());a=="paths"?t.path_column=i:a=="weights"?t.weight_column=i:a=="heights"?t.height_column=i:a=="colors"?t.color_column=i:a=="labels"?t.label_column=i:P(V.Warning,"Unparsed header",a,"=",i)}}static parsePapaparseResult(e,t,o){const a=(n,r)=>n.meta.fields.indexOf(r)<0?new Array(n.data.length):n.data.map(l=>l[r]?l[r]:""),i=(n,r)=>n.meta.fields.indexOf(r)<0?new Array(n.data.length):n.data.map(l=>l[r]?parseFloat(l[r]):-1),c=n=>e.meta.fields.indexOf(n)>=0,s=a(e,t.path_column);for(let n=0;n<s.length;++n)s[n]=s[n].replace("./","");const u=s.map(n=>n.split("/")),v=i(e,t.weight_column),f=i(e,t.height_column),m=i(e,t.color_column);c(t.label_column)?a(e,t.label_column):u.map(n=>n.at(-1));const y=(n,r)=>({parentIndex:r,index:n}),g=(n,r)=>"/"+n.slice(0,r).join("/"),w=new Array,C=new Map,b=new Array,z=new Array,x=new Array,p={};let h=-1;p["/"]=y(h,-1),h+=1,b.push(0),z.push(0),x.push(0),u.forEach((n,r)=>{n.forEach((L,l)=>{const I=g(n,l),A=g(n,l+1);if(!(I in p)){P(V.Warning,I,"not in",p);return}A in p||(p[A]=y(h,p[I].index),w.push(p[A].parentIndex),w.push(h),C.set(h,L),h+=1,l==n.length-1?(b.push(v[r]),z.push(f[r]),x.push(m[r])):(b.push(0),z.push(0),x.push(0)))})}),o.topology={edges:w,semantics:H.InputSemantics.ParentIdId,format:H.InputFormat.Interleaved},o.buffers=[{identifier:"source-weights",type:"numbers",data:b,linearization:"topology"},{identifier:"source-heights",type:"numbers",data:z,linearization:"topology"},{identifier:"source-colors",type:"numbers",data:x,linearization:"topology"}],o.bufferViews=[{identifier:"weights",source:"buffer:source-weights",transformations:[{type:"fill-invalid",value:0,invalidValue:-1},{type:"propagate-up",operation:"sum"}]},{identifier:"heights-normalized",source:"buffer:source-heights",transformations:[{type:"fill-invalid",value:0,invalidValue:-1},{type:"normalize",operation:"zero-to-max"}]},{identifier:"colors-normalized",source:"buffer:source-colors",transformations:[{type:"fill-invalid",value:0,invalidValue:-1},{type:"normalize",operation:"zero-to-max"}]}],o.labels.names=C,o.altered.alter("any")}static loadAsync(e){const t=new O;d.initializeHeader(t);const o=e.split(`
`);d.parseHeader(o,t);const a=o.join(`
`);return this.loadAsyncHeader(a,t)}static loadAsyncHeader(e,t){return new Promise((o,a)=>{const i=new F;d.initializeConfig(i),B.parse(e,{error:c=>a(c),complete:c=>{d.parsePapaparseResult(c,t,i),o(i)},delimiter:d.CSV_FIELD_DELIMITER,quoteChar:'"',escapeChar:'"',header:!0,comments:"#",skipEmptyLines:!0})})}};d.CSV_FIELD_DELIMITER=";",d.FAILED=(e,t)=>`fetching '${e}' failed (${t.status}): ${t.statusText}`;let T=d;const U=_.auxiliaries.log,K=_.auxiliaries.LogLevel;class j extends W{obtainUrl(e){return window.location.origin+window.location.pathname+"?data="+e}get canvas(){return this._canvas}get visualization(){return this._visualization}get renderer(){return this._renderer}validate(e){return this.initialize(e)}preview(e){return this.initialize(e)}feature(e){const t=this.initialize(e),o=this._visualization.renderer,a=this._canvas,i=this._visualization,c=f=>{const m=i.configuration;try{i.configuration=f,o.invalidate()}catch{i.configuration=m,o.invalidate()}};window.gloperate=$,window.canvas=a,window.context=a.context,window.controller=a.controller,window.visualization=i,window.renderer=o;const s=window.document.getElementById("csv-data"),u=window.document.getElementById("data-hash"),v=window.document.getElementById("reload");if(s!==void 0){const m=new URLSearchParams(window.location.search).get("data");m&&(U(K.Debug,"Load from",m),s.value=atob(m)),s.oninput=y=>{const g=s.value;T.loadAsync(g).then(w=>{c(w),u!==void 0&&(u.textContent=this.obtainUrl(btoa(g)))})},s.oninput({})}return v!==void 0&&u!==void 0&&(v.onclick=f=>{u.textContent!==void 0&&u.textContent!==""&&(window.location.href=u.textContent)}),t&&s!==void 0}initialize(e){this._canvas=q(e),this._visualization=new D;const t=this._visualization.renderer;return this._canvas.renderer=t,super.expose(),!0}uninitialize(){this._canvas.dispose(),this._renderer.uninitialize()}}window.onload=function(){const E=document.getElementById("canvas"),e=new j;window.example=e,e.feature(E);const t=window.document.getElementById("context-about");t&&(t.innerText=context.aboutString())};window.treemaprenderer=M;document.title="treemap-renderer";document.querySelector("#version").innerHTML=N();document.querySelector("#branch").innerHTML=R();document.querySelector("#commit").innerHTML=S();document.querySelector("#cryear").innerHTML=new Date().getFullYear();
