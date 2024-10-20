import{t as z,v as L,b as E,c as A}from"./index-C1O4TDP0.js";import{w as v,T as _,N as I,C as T,p as C,E as H,g as N,i as S,V as P}from"./example-CdYP11SK.js";const V=v.auxiliaries.log,O=v.auxiliaries.LogLevel;class M{}const h=class h{static initializeHeader(t){t.csv_delimiter=";",t.id_column="ids",t.parent_column="parents"}static parseHeader(t,e){for(;t.length>=1&&t[0].startsWith("#");){const i=t.shift().substring(1).trim(),[o,a]=i.split("=").map(l=>l.trim());o=="delimiter"?e.csv_delimiter=a||";":o=="ids"?e.id_column=a||"ids":o=="parents"?e.parent_column=a||"parents":o=="weights"?e.weight_column=a||"":o=="heights"?e.height_column=a||"":o=="colors"?e.color_column=a||"":o=="labels"?e.label_column=a||"":V(O.Warning,"Unparsed header",o,"=",a)}}static parsePapaparseResult(t,e,i){const o=(n,r)=>{if(n.meta.fields.indexOf(r)<0)return new Uint32Array(n.data.length);const f=n.data.map(s=>s[r]?s[r]:0);return Uint32Array.from(f)},a=(n,r)=>{if(n.meta.fields.indexOf(r)<0)return new Float32Array(n.data.length);const f=n.data.map(s=>s[r]?s[r]:-1);return Float32Array.from([0].concat(f))},l=n=>t.meta.fields.indexOf(n)>=0,g=(n,r)=>n.meta.fields.indexOf(r)<0?new Array(n.data.length):n.data.map(s=>s[r]?s[r]:""),c=o(t,e.id_column),d=o(t,e.parent_column),b=a(t,e.weight_column),m=a(t,e.height_column),u=a(t,e.color_column),w=g(t,e.label_column),p=new Array;for(let n=0;n<c.length;n++){const r=c[n],f=d[n];p.push(f),p.push(r)}if(i.topology={edges:p,semantics:_.InputSemantics.ParentIdId,format:_.InputFormat.Interleaved},i.buffers=[{identifier:"source-weights",type:"numbers",data:b,linearization:"topology"},{identifier:"source-heights",type:"numbers",data:m,linearization:"topology"},{identifier:"source-colors",type:"numbers",data:u,linearization:"topology"}],i.bufferViews=[{identifier:"weights",source:"buffer:source-weights",transformations:[{type:"fill-invalid",value:0,invalidValue:-1},{type:"propagate-up",operation:"sum"}]},{identifier:"heights-normalized",source:"buffer:source-heights",transformations:[{type:"fill-invalid",value:0,invalidValue:-1},{type:"normalize",operation:"zero-to-max"}]},{identifier:"colors-normalized",source:"buffer:source-colors",transformations:[{type:"fill-invalid",value:0,invalidValue:-1},{type:"normalize",operation:"zero-to-max"}]}],l(e.label_column)){const n=new Map;for(let r=0;r<w.length;++r)n.set(c[r],w[r]);i.labels={innerNodeLayerRange:[1,2],numTopInnerNodes:50,numTopWeightNodes:50,numTopHeightNodes:50,numTopColorNodes:50,names:n}}i.colors=[{identifier:"emphasis",colorspace:"hex",value:"#00b0ff"},{identifier:"auxiliary",colorspace:"hex",values:["#00aa5e","#71237c"]},{identifier:"inner",colorspace:"hex",values:["#e8eaee","#eef0f4"]},{identifier:"leaf",preset:"Oranges",steps:7}],i.layout={algorithm:"snake",weight:"bufferView:weights",sort:{key:"bufferView:weights",algorithm:I.Algorithm.Keep},parentPadding:{type:"relative",value:.05},siblingMargin:{type:"relative",value:.05},accessoryPadding:{type:"absolute",direction:"bottom",value:[0,.02,.01,0],relativeAreaThreshold:.4,targetAspectRatio:8}},i.geometry={parentLayer:{showRoot:!0},leafLayer:{colorMap:"color:leaf",height:"bufferView:heights-normalized",colors:"bufferView:colors-normalized"},emphasis:{outline:new Array,highlight:new Array},heightScale:.5},i.altered.alter("any")}static loadAsync(t){const e=new M;h.initializeHeader(e);const i=t.split(`
`);h.parseHeader(i,e);const o=i.join(`
`);return this.loadAsyncHeader(o,e)}static loadAsyncHeader(t,e){return new Promise((i,o)=>{const a=new T;C.parse(t,{error:l=>o(l),complete:l=>{h.parsePapaparseResult(l,e,a),i(a)},delimiter:e.csv_delimiter,quoteChar:'"',escapeChar:'"',header:!0,comments:"#",skipEmptyLines:!0})})}};h.FAILED=(t,e)=>`fetching '${t}' failed (${e.status}): ${e.statusText}`;let x=h;const R=v.auxiliaries.log,B=v.auxiliaries.LogLevel;class U extends H{obtainUrl(t){return window.location.origin+window.location.pathname+"?data="+t}get canvas(){return this._canvas}get visualization(){return this._visualization}get renderer(){return this._renderer}validate(t){return this.initialize(t)}preview(t){return this.initialize(t)}feature(t){const e=window.document.getElementById("csv-data"),i=window.document.getElementById("data-hash"),o=window.document.getElementById("reload"),a=window.document.getElementById("config-display"),l=this.initialize(t),g=this._visualization.renderer,c=this._canvas,d=this._visualization,b=m=>{const u=d.configuration;try{d.configuration=m,g.invalidate(),a&&(a.textContent=JSON.stringify(m.toJSON(),null,2))}catch{d.configuration=u,g.invalidate()}};if(window.gloperate=N,window.canvas=c,window.context=c.context,window.controller=c.controller,window.visualization=d,window.renderer=g,e){const u=new URLSearchParams(window.location.search).get("data");u&&(R(B.Debug,"Load from",u),e.value=atob(u)),e.oninput=w=>{const p=e.value;x.loadAsync(p).then(n=>{b(n),i&&(i.textContent=this.obtainUrl(btoa(p)))})},e.oninput({})}return o&&i&&(o.onclick=m=>{i.textContent&&i.textContent!==""&&(window.location.href=i.textContent)}),l&&e!==void 0&&e!==null}initialize(t){this._canvas=S(t),this._visualization=new P;const e=this._visualization.renderer;return this._canvas.renderer=e,super.expose(),!0}uninitialize(){this._canvas.dispose(),this._renderer.uninitialize()}}window.onload=function(){const y=document.getElementById("canvas"),t=new U;window.example=t,t.feature(y);const e=window.document.getElementById("context-about");e&&(e.innerText=context.aboutString())};window.treemaprenderer=z;document.title="treemap-renderer";document.querySelector("#version").innerHTML=L();document.querySelector("#branch").innerHTML=E();document.querySelector("#commit").innerHTML=A();document.querySelector("#cryear").innerHTML=new Date().getFullYear();
