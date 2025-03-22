var R=class{type=3;name="";prefix="";value="";suffix="";modifier=3;constructor(t,r,n,o,c,l){this.type=t,this.name=r,this.prefix=n,this.value=o,this.suffix=c,this.modifier=l;}hasCustomName(){return this.name!==""&&typeof this.name!="number"}},be=/[$_\p{ID_Start}]/u,Pe=/[$_\u200C\u200D\p{ID_Continue}]/u,M=".*";function Re(e,t){return (t?/^[\x00-\xFF]*$/:/^[\x00-\x7F]*$/).test(e)}function v(e,t=!1){let r=[],n=0;for(;n<e.length;){let o=e[n],c=function(l){if(!t)throw new TypeError(l);r.push({type:"INVALID_CHAR",index:n,value:e[n++]});};if(o==="*"){r.push({type:"ASTERISK",index:n,value:e[n++]});continue}if(o==="+"||o==="?"){r.push({type:"OTHER_MODIFIER",index:n,value:e[n++]});continue}if(o==="\\"){r.push({type:"ESCAPED_CHAR",index:n++,value:e[n++]});continue}if(o==="{"){r.push({type:"OPEN",index:n,value:e[n++]});continue}if(o==="}"){r.push({type:"CLOSE",index:n,value:e[n++]});continue}if(o===":"){let l="",s=n+1;for(;s<e.length;){let i=e.substr(s,1);if(s===n+1&&be.test(i)||s!==n+1&&Pe.test(i)){l+=e[s++];continue}break}if(!l){c(`Missing parameter name at ${n}`);continue}r.push({type:"NAME",index:n,value:l}),n=s;continue}if(o==="("){let l=1,s="",i=n+1,a=!1;if(e[i]==="?"){c(`Pattern cannot start with "?" at ${i}`);continue}for(;i<e.length;){if(!Re(e[i],!1)){c(`Invalid character '${e[i]}' at ${i}.`),a=!0;break}if(e[i]==="\\"){s+=e[i++]+e[i++];continue}if(e[i]===")"){if(l--,l===0){i++;break}}else if(e[i]==="("&&(l++,e[i+1]!=="?")){c(`Capturing groups are not allowed at ${i}`),a=!0;break}s+=e[i++];}if(a)continue;if(l){c(`Unbalanced pattern at ${n}`);continue}if(!s){c(`Missing pattern at ${n}`);continue}r.push({type:"REGEX",index:n,value:s}),n=i;continue}r.push({type:"CHAR",index:n,value:e[n++]});}return r.push({type:"END",index:n,value:""}),r}function D(e,t={}){let r=v(e);t.delimiter??="/#?",t.prefixes??="./";let n=`[^${S(t.delimiter)}]+?`,o=[],c=0,l=0,i=new Set,a=h=>{if(l<r.length&&r[l].type===h)return r[l++].value},f=()=>a("OTHER_MODIFIER")??a("ASTERISK"),d=h=>{let u=a(h);if(u!==void 0)return u;let{type:p,index:A}=r[l];throw new TypeError(`Unexpected ${p} at ${A}, expected ${h}`)},T=()=>{let h="",u;for(;u=a("CHAR")??a("ESCAPED_CHAR");)h+=u;return h},Se=h=>h,L=t.encodePart||Se,I="",U=h=>{I+=h;},$=()=>{I.length&&(o.push(new R(3,"","",L(I),"",3)),I="");},V=(h,u,p,A,Y)=>{let g=3;switch(Y){case"?":g=1;break;case"*":g=0;break;case"+":g=2;break}if(!u&&!p&&g===3){U(h);return}if($(),!u&&!p){if(!h)return;o.push(new R(3,"","",L(h),"",g));return}let m;p?p==="*"?m=M:m=p:m=n;let O=2;m===n?(O=1,m=""):m===M&&(O=0,m="");let P;if(u?P=u:p&&(P=c++),i.has(P))throw new TypeError(`Duplicate name '${P}'.`);i.add(P),o.push(new R(O,P,L(h),m,L(A),g));};for(;l<r.length;){let h=a("CHAR"),u=a("NAME"),p=a("REGEX");if(!u&&!p&&(p=a("ASTERISK")),u||p){let g=h??"";t.prefixes.indexOf(g)===-1&&(U(g),g=""),$();let m=f();V(g,u,p,"",m);continue}let A=h??a("ESCAPED_CHAR");if(A){U(A);continue}if(a("OPEN")){let g=T(),m=a("NAME"),O=a("REGEX");!m&&!O&&(O=a("ASTERISK"));let P=T();d("CLOSE");let xe=f();V(g,m,O,P,xe);continue}$(),d("END");}return o}function S(e){return e.replace(/([.+*?^${}()[\]|/\\])/g,"\\$1")}function X(e){return e&&e.ignoreCase?"ui":"u"}function Z(e,t,r){return F(D(e,r),t,r)}function k(e){switch(e){case 0:return "*";case 1:return "?";case 2:return "+";case 3:return ""}}function F(e,t,r={}){r.delimiter??="/#?",r.prefixes??="./",r.sensitive??=!1,r.strict??=!1,r.end??=!0,r.start??=!0,r.endsWith="";let n=r.start?"^":"";for(let s of e){if(s.type===3){s.modifier===3?n+=S(s.value):n+=`(?:${S(s.value)})${k(s.modifier)}`;continue}t&&t.push(s.name);let i=`[^${S(r.delimiter)}]+?`,a=s.value;if(s.type===1?a=i:s.type===0&&(a=M),!s.prefix.length&&!s.suffix.length){s.modifier===3||s.modifier===1?n+=`(${a})${k(s.modifier)}`:n+=`((?:${a})${k(s.modifier)})`;continue}if(s.modifier===3||s.modifier===1){n+=`(?:${S(s.prefix)}(${a})${S(s.suffix)})`,n+=k(s.modifier);continue}n+=`(?:${S(s.prefix)}`,n+=`((?:${a})(?:`,n+=S(s.suffix),n+=S(s.prefix),n+=`(?:${a}))*)${S(s.suffix)})`,s.modifier===0&&(n+="?");}let o=`[${S(r.endsWith)}]|$`,c=`[${S(r.delimiter)}]`;if(r.end)return r.strict||(n+=`${c}?`),r.endsWith.length?n+=`(?=${o})`:n+="$",new RegExp(n,X(r));r.strict||(n+=`(?:${c}(?=${o}))?`);let l=!1;if(e.length){let s=e[e.length-1];s.type===3&&s.modifier===3&&(l=r.delimiter.indexOf(s)>-1);}return l||(n+=`(?=${c}|${o})`),new RegExp(n,X(r))}var x={delimiter:"",prefixes:"",sensitive:!0,strict:!0},B={delimiter:".",prefixes:"",sensitive:!0,strict:!0},q={delimiter:"/",prefixes:"/",sensitive:!0,strict:!0};function J(e,t){return e.length?e[0]==="/"?!0:!t||e.length<2?!1:(e[0]=="\\"||e[0]=="{")&&e[1]=="/":!1}function Q(e,t){return e.startsWith(t)?e.substring(t.length,e.length):e}function Ee(e,t){return e.endsWith(t)?e.substr(0,e.length-t.length):e}function W(e){return !e||e.length<2?!1:e[0]==="["||(e[0]==="\\"||e[0]==="{")&&e[1]==="["}var ee=["ftp","file","http","https","ws","wss"];function N(e){if(!e)return !0;for(let t of ee)if(e.test(t))return !0;return !1}function te(e,t){if(e=Q(e,"#"),t||e==="")return e;let r=new URL("https://example.com");return r.hash=e,r.hash?r.hash.substring(1,r.hash.length):""}function re(e,t){if(e=Q(e,"?"),t||e==="")return e;let r=new URL("https://example.com");return r.search=e,r.search?r.search.substring(1,r.search.length):""}function ne(e,t){return t||e===""?e:W(e)?j(e):z(e)}function se(e,t){if(t||e==="")return e;let r=new URL("https://example.com");return r.password=e,r.password}function ie(e,t){if(t||e==="")return e;let r=new URL("https://example.com");return r.username=e,r.username}function ae(e,t,r){if(r||e==="")return e;if(t&&!ee.includes(t))return new URL(`${t}:${e}`).pathname;let n=e[0]=="/";return e=new URL(n?e:"/-"+e,"https://example.com").pathname,n||(e=e.substring(2,e.length)),e}function oe(e,t,r){return _(t)===e&&(e=""),r||e===""?e:K(e)}function ce(e,t){return e=Ee(e,":"),t||e===""?e:y(e)}function _(e){switch(e){case"ws":case"http":return "80";case"wws":case"https":return "443";case"ftp":return "21";default:return ""}}function y(e){if(e==="")return e;if(/^[-+.A-Za-z0-9]*$/.test(e))return e.toLowerCase();throw new TypeError(`Invalid protocol '${e}'.`)}function le(e){if(e==="")return e;let t=new URL("https://example.com");return t.username=e,t.username}function fe(e){if(e==="")return e;let t=new URL("https://example.com");return t.password=e,t.password}function z(e){if(e==="")return e;if(/[\t\n\r #%/:<>?@[\]^\\|]/g.test(e))throw new TypeError(`Invalid hostname '${e}'`);let t=new URL("https://example.com");return t.hostname=e,t.hostname}function j(e){if(e==="")return e;if(/[^0-9a-fA-F[\]:]/g.test(e))throw new TypeError(`Invalid IPv6 hostname '${e}'`);return e.toLowerCase()}function K(e){if(e===""||/^[0-9]*$/.test(e)&&parseInt(e)<=65535)return e;throw new TypeError(`Invalid port '${e}'.`)}function he(e){if(e==="")return e;let t=new URL("https://example.com");return t.pathname=e[0]!=="/"?"/-"+e:e,e[0]!=="/"?t.pathname.substring(2,t.pathname.length):t.pathname}function ue(e){return e===""?e:new URL(`data:${e}`).pathname}function de(e){if(e==="")return e;let t=new URL("https://example.com");return t.search=e,t.search.substring(1,t.search.length)}function pe(e){if(e==="")return e;let t=new URL("https://example.com");return t.hash=e,t.hash.substring(1,t.hash.length)}var H=class{#i;#n=[];#t={};#e=0;#s=1;#l=0;#o=0;#d=0;#p=0;#g=!1;constructor(t){this.#i=t;}get result(){return this.#t}parse(){for(this.#n=v(this.#i,!0);this.#e<this.#n.length;this.#e+=this.#s){if(this.#s=1,this.#n[this.#e].type==="END"){if(this.#o===0){this.#b(),this.#f()?this.#r(9,1):this.#h()?this.#r(8,1):this.#r(7,0);continue}else if(this.#o===2){this.#u(5);continue}this.#r(10,0);break}if(this.#d>0)if(this.#A())this.#d-=1;else continue;if(this.#T()){this.#d+=1;continue}switch(this.#o){case 0:this.#P()&&this.#u(1);break;case 1:if(this.#P()){this.#C();let t=7,r=1;this.#E()?(t=2,r=3):this.#g&&(t=2),this.#r(t,r);}break;case 2:this.#S()?this.#u(3):(this.#x()||this.#h()||this.#f())&&this.#u(5);break;case 3:this.#O()?this.#r(4,1):this.#S()&&this.#r(5,1);break;case 4:this.#S()&&this.#r(5,1);break;case 5:this.#y()?this.#p+=1:this.#w()&&(this.#p-=1),this.#k()&&!this.#p?this.#r(6,1):this.#x()?this.#r(7,0):this.#h()?this.#r(8,1):this.#f()&&this.#r(9,1);break;case 6:this.#x()?this.#r(7,0):this.#h()?this.#r(8,1):this.#f()&&this.#r(9,1);break;case 7:this.#h()?this.#r(8,1):this.#f()&&this.#r(9,1);break;case 8:this.#f()&&this.#r(9,1);break;}}this.#t.hostname!==void 0&&this.#t.port===void 0&&(this.#t.port="");}#r(t,r){switch(this.#o){case 0:break;case 1:this.#t.protocol=this.#c();break;case 2:break;case 3:this.#t.username=this.#c();break;case 4:this.#t.password=this.#c();break;case 5:this.#t.hostname=this.#c();break;case 6:this.#t.port=this.#c();break;case 7:this.#t.pathname=this.#c();break;case 8:this.#t.search=this.#c();break;case 9:this.#t.hash=this.#c();break;}this.#o!==0&&t!==10&&([1,2,3,4].includes(this.#o)&&[6,7,8,9].includes(t)&&(this.#t.hostname??=""),[1,2,3,4,5,6].includes(this.#o)&&[8,9].includes(t)&&(this.#t.pathname??=this.#g?"/":""),[1,2,3,4,5,6,7].includes(this.#o)&&t===9&&(this.#t.search??="")),this.#R(t,r);}#R(t,r){this.#o=t,this.#l=this.#e+r,this.#e+=r,this.#s=0;}#b(){this.#e=this.#l,this.#s=0;}#u(t){this.#b(),this.#o=t;}#m(t){return t<0&&(t=this.#n.length-t),t<this.#n.length?this.#n[t]:this.#n[this.#n.length-1]}#a(t,r){let n=this.#m(t);return n.value===r&&(n.type==="CHAR"||n.type==="ESCAPED_CHAR"||n.type==="INVALID_CHAR")}#P(){return this.#a(this.#e,":")}#E(){return this.#a(this.#e+1,"/")&&this.#a(this.#e+2,"/")}#S(){return this.#a(this.#e,"@")}#O(){return this.#a(this.#e,":")}#k(){return this.#a(this.#e,":")}#x(){return this.#a(this.#e,"/")}#h(){if(this.#a(this.#e,"?"))return !0;if(this.#n[this.#e].value!=="?")return !1;let t=this.#m(this.#e-1);return t.type!=="NAME"&&t.type!=="REGEX"&&t.type!=="CLOSE"&&t.type!=="ASTERISK"}#f(){return this.#a(this.#e,"#")}#T(){return this.#n[this.#e].type=="OPEN"}#A(){return this.#n[this.#e].type=="CLOSE"}#y(){return this.#a(this.#e,"[")}#w(){return this.#a(this.#e,"]")}#c(){let t=this.#n[this.#e],r=this.#m(this.#l).index;return this.#i.substring(r,t.index)}#C(){let t={};Object.assign(t,x),t.encodePart=y;let r=Z(this.#c(),void 0,t);this.#g=N(r);}};var G=["protocol","username","password","hostname","port","pathname","search","hash"],E="*";function ge(e,t){if(typeof e!="string")throw new TypeError("parameter 1 is not of type 'string'.");let r=new URL(e,t);return {protocol:r.protocol.substring(0,r.protocol.length-1),username:r.username,password:r.password,hostname:r.hostname,port:r.port,pathname:r.pathname,search:r.search!==""?r.search.substring(1,r.search.length):void 0,hash:r.hash!==""?r.hash.substring(1,r.hash.length):void 0}}function b(e,t){return t?C(e):e}function w(e,t,r){let n;if(typeof t.baseURL=="string")try{n=new URL(t.baseURL),t.protocol===void 0&&(e.protocol=b(n.protocol.substring(0,n.protocol.length-1),r)),!r&&t.protocol===void 0&&t.hostname===void 0&&t.port===void 0&&t.username===void 0&&(e.username=b(n.username,r)),!r&&t.protocol===void 0&&t.hostname===void 0&&t.port===void 0&&t.username===void 0&&t.password===void 0&&(e.password=b(n.password,r)),t.protocol===void 0&&t.hostname===void 0&&(e.hostname=b(n.hostname,r)),t.protocol===void 0&&t.hostname===void 0&&t.port===void 0&&(e.port=b(n.port,r)),t.protocol===void 0&&t.hostname===void 0&&t.port===void 0&&t.pathname===void 0&&(e.pathname=b(n.pathname,r)),t.protocol===void 0&&t.hostname===void 0&&t.port===void 0&&t.pathname===void 0&&t.search===void 0&&(e.search=b(n.search.substring(1,n.search.length),r)),t.protocol===void 0&&t.hostname===void 0&&t.port===void 0&&t.pathname===void 0&&t.search===void 0&&t.hash===void 0&&(e.hash=b(n.hash.substring(1,n.hash.length),r));}catch{throw new TypeError(`invalid baseURL '${t.baseURL}'.`)}if(typeof t.protocol=="string"&&(e.protocol=ce(t.protocol,r)),typeof t.username=="string"&&(e.username=ie(t.username,r)),typeof t.password=="string"&&(e.password=se(t.password,r)),typeof t.hostname=="string"&&(e.hostname=ne(t.hostname,r)),typeof t.port=="string"&&(e.port=oe(t.port,e.protocol,r)),typeof t.pathname=="string"){if(e.pathname=t.pathname,n&&!J(e.pathname,r)){let o=n.pathname.lastIndexOf("/");o>=0&&(e.pathname=b(n.pathname.substring(0,o+1),r)+e.pathname);}e.pathname=ae(e.pathname,e.protocol,r);}return typeof t.search=="string"&&(e.search=re(t.search,r)),typeof t.hash=="string"&&(e.hash=te(t.hash,r)),e}function C(e){return e.replace(/([+*?:{}()\\])/g,"\\$1")}function Oe(e){return e.replace(/([.+*?^${}()[\]|/\\])/g,"\\$1")}function ke(e,t){t.delimiter??="/#?",t.prefixes??="./",t.sensitive??=!1,t.strict??=!1,t.end??=!0,t.start??=!0,t.endsWith="";let r=".*",n=`[^${Oe(t.delimiter)}]+?`,o=/[$_\u200C\u200D\p{ID_Continue}]/u,c="";for(let l=0;l<e.length;++l){let s=e[l];if(s.type===3){if(s.modifier===3){c+=C(s.value);continue}c+=`{${C(s.value)}}${k(s.modifier)}`;continue}let i=s.hasCustomName(),a=!!s.suffix.length||!!s.prefix.length&&(s.prefix.length!==1||!t.prefixes.includes(s.prefix)),f=l>0?e[l-1]:null,d=l<e.length-1?e[l+1]:null;if(!a&&i&&s.type===1&&s.modifier===3&&d&&!d.prefix.length&&!d.suffix.length)if(d.type===3){let T=d.value.length>0?d.value[0]:"";a=o.test(T);}else a=!d.hasCustomName();if(!a&&!s.prefix.length&&f&&f.type===3){let T=f.value[f.value.length-1];a=t.prefixes.includes(T);}a&&(c+="{"),c+=C(s.prefix),i&&(c+=`:${s.name}`),s.type===2?c+=`(${s.value})`:s.type===1?i||(c+=`(${n})`):s.type===0&&(!i&&(!f||f.type===3||f.modifier!==3||a||s.prefix!=="")?c+="*":c+=`(${r})`),s.type===1&&i&&s.suffix.length&&o.test(s.suffix[0])&&(c+="\\"),c+=C(s.suffix),a&&(c+="}"),s.modifier!==3&&(c+=k(s.modifier));}return c}var me=class{#i;#n={};#t={};#e={};#s={};#l=!1;constructor(t={},r,n){try{let o;if(typeof r=="string"?o=r:n=r,typeof t=="string"){let i=new H(t);if(i.parse(),t=i.result,o===void 0&&typeof t.protocol!="string")throw new TypeError("A base URL must be provided for a relative constructor string.");t.baseURL=o;}else {if(!t||typeof t!="object")throw new TypeError("parameter 1 is not of type 'string' and cannot convert to dictionary.");if(o)throw new TypeError("parameter 1 is not of type 'string'.")}typeof n>"u"&&(n={ignoreCase:!1});let c={ignoreCase:n.ignoreCase===!0},l={pathname:E,protocol:E,username:E,password:E,hostname:E,port:E,search:E,hash:E};this.#i=w(l,t,!0),_(this.#i.protocol)===this.#i.port&&(this.#i.port="");let s;for(s of G){if(!(s in this.#i))continue;let i={},a=this.#i[s];switch(this.#t[s]=[],s){case"protocol":Object.assign(i,x),i.encodePart=y;break;case"username":Object.assign(i,x),i.encodePart=le;break;case"password":Object.assign(i,x),i.encodePart=fe;break;case"hostname":Object.assign(i,B),W(a)?i.encodePart=j:i.encodePart=z;break;case"port":Object.assign(i,x),i.encodePart=K;break;case"pathname":N(this.#n.protocol)?(Object.assign(i,q,c),i.encodePart=he):(Object.assign(i,x,c),i.encodePart=ue);break;case"search":Object.assign(i,x,c),i.encodePart=de;break;case"hash":Object.assign(i,x,c),i.encodePart=pe;break}try{this.#s[s]=D(a,i),this.#n[s]=F(this.#s[s],this.#t[s],i),this.#e[s]=ke(this.#s[s],i),this.#l=this.#l||this.#s[s].some(f=>f.type===2);}catch{throw new TypeError(`invalid ${s} pattern '${this.#i[s]}'.`)}}}catch(o){throw new TypeError(`Failed to construct 'URLPattern': ${o.message}`)}}test(t={},r){let n={pathname:"",protocol:"",username:"",password:"",hostname:"",port:"",search:"",hash:""};if(typeof t!="string"&&r)throw new TypeError("parameter 1 is not of type 'string'.");if(typeof t>"u")return !1;try{typeof t=="object"?n=w(n,t,!1):n=w(n,ge(t,r),!1);}catch{return !1}let o;for(o of G)if(!this.#n[o].exec(n[o]))return !1;return !0}exec(t={},r){let n={pathname:"",protocol:"",username:"",password:"",hostname:"",port:"",search:"",hash:""};if(typeof t!="string"&&r)throw new TypeError("parameter 1 is not of type 'string'.");if(typeof t>"u")return;try{typeof t=="object"?n=w(n,t,!1):n=w(n,ge(t,r),!1);}catch{return null}let o={};r?o.inputs=[t,r]:o.inputs=[t];let c;for(c of G){let l=this.#n[c].exec(n[c]);if(!l)return null;let s={};for(let[i,a]of this.#t[c].entries())if(typeof a=="string"||typeof a=="number"){let f=l[i+1];s[a]=f;}o[c]={input:n[c]??"",groups:s};}return o}static compareComponent(t,r,n){let o=(i,a)=>{for(let f of ["type","modifier","prefix","value","suffix"]){if(i[f]<a[f])return -1;if(i[f]===a[f])continue;return 1}return 0},c=new R(3,"","","","",3),l=new R(0,"","","","",3),s=(i,a)=>{let f=0;for(;f<Math.min(i.length,a.length);++f){let d=o(i[f],a[f]);if(d)return d}return i.length===a.length?0:o(i[f]??c,a[f]??c)};return !r.#e[t]&&!n.#e[t]?0:r.#e[t]&&!n.#e[t]?s(r.#s[t],[l]):!r.#e[t]&&n.#e[t]?s([l],n.#s[t]):s(r.#s[t],n.#s[t])}get protocol(){return this.#e.protocol}get username(){return this.#e.username}get password(){return this.#e.password}get hostname(){return this.#e.hostname}get port(){return this.#e.port}get pathname(){return this.#e.pathname}get search(){return this.#e.search}get hash(){return this.#e.hash}get hasRegExpGroups(){return this.#l}};

if (!globalThis.URLPattern) {
  globalThis.URLPattern = me;
}

if (typeof URLPattern === "undefined") {
    throw new Error("urlpattern-polyfill did not import correctly");
}
const globalURLPattern = URLPattern;

/* c8 ignore start */
function isLike(value, ...and) {
    if (!and.length)
        return !!value;
    return !!value && and.every((value) => !!value);
}
function ok$2(value, message, ...conditions) {
    if (conditions.length ? !conditions.every((value) => value) : !value) {
        throw new Error(message ?? "Expected value");
    }
}

function isObjectLike(value) {
    return !!(typeof value === "object" && value) || typeof value === "function";
}
class DoubleMap {
    objects;
    values;
    get(parts, fn) {
        const found = this.pick(parts);
        if (isLike(found)) {
            return found;
        }
        return this.place(parts, fn(parts));
    }
    getStored(key) {
        if (isObjectLike(key)) {
            return this.objects?.get(key);
        }
        else {
            return this.values?.get(key);
        }
    }
    pick(parts) {
        const [key, ...rest] = parts;
        const value = this.getStored(key);
        if (value instanceof DoubleMap) {
            return value.pick(rest);
        }
        return value;
    }
    place(parts, value) {
        const target = parts.slice(0, -1).reduce((map, key) => {
            const existing = map.getStored(key);
            if (existing instanceof DoubleMap) {
                return existing;
            }
            const next = new DoubleMap();
            map.set(key, next);
            return next;
        }, this);
        ok$2(target instanceof DoubleMap);
        target.set(parts.at(-1), value);
        return value;
    }
    set(key, value) {
        if (isObjectLike(key)) {
            if (!this.objects) {
                this.objects = new WeakMap();
            }
            this.objects.set(key, value);
        }
        else {
            if (!this.values) {
                this.values = new Map();
            }
            this.values.set(key, value);
        }
    }
}
function createCompositeValue(fn) {
    const keys = new Map();
    return function compositeValue(...parts) {
        const { length } = parts;
        let map = keys.get(length);
        if (!map) {
            map = new DoubleMap();
            keys.set(length, map);
        }
        return map.get(parts, fn);
    };
}
function createCompositeKey() {
    return createCompositeValue(() => Object.freeze({ __proto__: null }));
}
let internalCompositeKey = undefined;
function compositeKey(...parts) {
    if (!internalCompositeKey) {
        internalCompositeKey = createCompositeKey();
    }
    return internalCompositeKey(...parts);
}

function isURLPatternStringWildcard(pattern) {
    return pattern === "*";
}
const patternSymbols = Object.values({
    // From https://wicg.github.io/urlpattern/#parsing-patterns
    open: "{",
    close: "}",
    regexpOpen: "(",
    regexpClose: ")",
    nameStart: ":",
    asterisk: "*"
});
const patternParts = [
    "protocol",
    "hostname",
    "username",
    "password",
    "port",
    "pathname",
    "search",
    "hash"
];
function isURLPatternStringPlain(pattern) {
    for (const symbol of patternSymbols) {
        if (pattern.includes(symbol)) {
            return false;
        }
    }
    return true;
}
function isURLPatternPlainPathname(pattern) {
    if (!isURLPatternStringPlain(pattern.pathname)) {
        return false;
    }
    for (const part of patternParts) {
        if (part === "pathname")
            continue;
        if (!isURLPatternStringWildcard(pattern[part])) {
            return false;
        }
    }
    return true;
}
// Note, this weak map will contain all urls
// matched in the current process.
// This may not be wanted by everyone
let execCache = undefined;
function enableURLPatternCache() {
    execCache = execCache ?? new WeakMap();
}
function exec(pattern, url) {
    if (!execCache) {
        return pattern.exec(url);
    }
    const key = compositeKey(pattern, ...patternParts
        .filter(part => !isURLPatternStringWildcard(pattern[part]))
        .map(part => url[part]));
    const existing = execCache.get(key);
    if (existing)
        return existing;
    if (existing === false)
        return undefined;
    const result = pattern.exec(url);
    execCache.set(key, result ?? false);
    return result;
}

function isPromise(value) {
    return (like(value) &&
        typeof value.then === "function");
}
function ok$1(value, message = "Expected value") {
    if (!value) {
        throw new Error(message);
    }
}
function isPromiseRejectedResult(value) {
    return value.status === "rejected";
}
function like(value) {
    return !!value;
}

async function transitionEvent(router, event) {
    const promises = [];
    const { signal, } = event;
    const url = getURL(event);
    const { pathname } = url;
    transitionPart("route", (route, match) => route.fn(event, match), handleResolve, handleReject);
    if (promises.length) {
        await Promise.all(promises);
    }
    function transitionPart(type, fn, resolve = handleResolve, reject = handleReject) {
        let isRoute = false;
        resolveRouter(router);
        return isRoute;
        function matchRoute(route, parentMatch) {
            const { router, pattern, string } = route;
            let match = parentMatch;
            if (string) {
                if (string !== pathname) {
                    return;
                }
            }
            else if (pattern) {
                match = exec(pattern, url);
                if (!match)
                    return;
            }
            if (isRouter(router)) {
                return resolveRouter(router, match);
            }
            isRoute = true;
            try {
                const maybe = fn(route, match);
                if (isPromise(maybe)) {
                    promises.push(maybe
                        .then(resolve)
                        .catch(reject));
                }
                else {
                    resolve(maybe);
                }
            }
            catch (error) {
                reject(error);
            }
        }
        function resolveRouter(router, match) {
            const routes = getRouterRoutes(router);
            resolveRoutes(routes[type]);
            resolveRoutes(routes.router);
            function resolveRoutes(routes) {
                for (const route of routes) {
                    if (signal?.aborted)
                        break;
                    matchRoute(route, match);
                }
            }
        }
    }
    function noop() { }
    function handleResolve(value) {
        transitionPart("resolve", (route, match) => route.fn(value, event, match), noop, handleReject);
    }
    function handleReject(error) {
        const isRoute = transitionPart("reject", (route, match) => route.fn(error, event, match), noop, (error) => Promise.reject(error));
        if (!isRoute) {
            throw error;
        }
    }
    function getURL(event) {
        if (isDestination(event)) {
            return new URL(event.destination.url);
        }
        else if (isRequest(event)) {
            return new URL(event.request.url);
        }
        else if (isURL(event)) {
            return new URL(event.url);
        }
        throw new Error("Could not get url from event");
        function isDestination(event) {
            return (like(event) &&
                !!event.destination);
        }
        function isRequest(event) {
            return (like(event) &&
                !!event.request);
        }
        function isURL(event) {
            return (like(event) &&
                !!(event.url && (typeof event.url === "string" ||
                    event.url instanceof URL)));
        }
    }
}

const Routes = Symbol.for("@virtualstate/navigation/routes/routes");
const Attached = Symbol.for("@virtualstate/navigation/routes/attached");
const Detach = Symbol.for("@virtualstate/navigation/routes/detach");
const Target = Symbol.for("@virtualstate/navigation/routes/target");
const TargetType = Symbol.for("@virtualstate/navigation/routes/target/type");
/**
 * @internal
 */
function getRouterRoutes(router) {
    return router[Routes];
}
function isRouter(value) {
    function isRouterLike(value) {
        return !!value;
    }
    return isRouterLike(value) && !!value[Routes];
}
function getPatternString(pattern) {
    if (!pattern)
        return undefined;
    if (typeof pattern === "string") {
        if (isURLPatternStringPlain(pattern)) {
            return pattern;
        }
        else {
            return undefined;
        }
    }
    if (isURLPatternPlainPathname(pattern)) {
        return pattern.pathname;
    }
    return undefined;
}
function getPattern(pattern) {
    if (!pattern)
        return undefined;
    if (typeof pattern !== "string") {
        return pattern;
    }
    return new globalURLPattern({ pathname: pattern });
}
class Router {
    [Routes] = {
        router: [],
        route: [],
        reject: [],
        resolve: [],
    };
    [Attached] = new Set();
    [Target];
    [TargetType];
    listening = false;
    constructor(target, type) {
        this[Target] = target;
        this[TargetType] = type;
        // Catch use override types with
        // arrow functions so need to bind manually
        this.routes = this.routes.bind(this);
        this.route = this.route.bind(this);
        this.then = this.then.bind(this);
        this.catch = this.catch.bind(this);
    }
    routes(...args) {
        let router, pattern;
        if (args.length === 1) {
            [router] = args;
        }
        else if (args.length === 2) {
            [pattern, router] = args;
        }
        if (router[Attached].has(this)) {
            throw new Error("Router already attached");
        }
        this[Routes].router.push({
            string: getPatternString(pattern),
            pattern: getPattern(pattern),
            router,
        });
        router[Attached].add(this);
        this.#init();
        return this;
    }
    then(...args) {
        if (args.length === 1) {
            const [fn] = args;
            this[Routes].resolve.push({
                fn,
            });
        }
        else if (args.length === 2 && isThenError(args)) {
            const [fn, errorFn] = args;
            this[Routes].resolve.push({
                fn,
            });
            this[Routes].reject.push({
                fn: errorFn,
            });
        }
        else {
            const [pattern, fn, errorFn] = args;
            this[Routes].resolve.push({
                string: getPatternString(pattern),
                pattern: getPattern(pattern),
                fn,
            });
            if (errorFn) {
                this[Routes].reject.push({
                    string: getPatternString(pattern),
                    pattern: getPattern(pattern),
                    fn: errorFn
                });
            }
        }
        // No init for just then
        return this;
        function isThenError(args) {
            const [left, right] = args;
            return typeof left === "function" && typeof right === "function";
        }
    }
    catch(...args) {
        if (args.length === 1) {
            const [fn] = args;
            this[Routes].reject.push({
                fn,
            });
        }
        else {
            const [pattern, fn] = args;
            this[Routes].reject.push({
                string: getPatternString(pattern),
                pattern: getPattern(pattern),
                fn,
            });
        }
        // No init for just catch
        return this;
    }
    route(...args) {
        if (args.length === 1) {
            const [fn] = args;
            this[Routes].route.push({
                fn,
            });
        }
        else {
            const [pattern, fn] = args;
            this[Routes].route.push({
                string: getPatternString(pattern),
                pattern: getPattern(pattern),
                fn,
            });
        }
        this.#init();
        return this;
    }
    [Detach](router) {
        const index = this[Routes].router.findIndex((route) => route.router === router);
        if (index > -1) {
            this[Routes].router.splice(index, 1);
        }
        const length = Object.values(this[Routes]).reduce((sum, routes) => sum + routes.length, 0);
        if (length === 0) {
            this.#deinit();
        }
    }
    detach = () => {
        if (this.listening) {
            this.#deinit();
        }
        for (const attached of this[Attached]) {
            if (isRouter(attached)) {
                attached[Detach](this);
            }
        }
        this[Attached] = new Set();
    };
    #init = () => {
        if (this.listening) {
            return;
        }
        const target = this[Target];
        if (!target)
            return;
        this.listening = true;
        if (typeof target === "function") {
            return target(this.#event);
        }
        const type = this[TargetType] ?? "navigate";
        target.addEventListener(type, this.#event);
    };
    #deinit = () => {
        if (!this.listening) {
            return;
        }
        const target = this[Target];
        if (!target)
            return;
        if (typeof target === "function") {
            throw new Error("Cannot stop listening");
        }
        this.listening = false;
        const type = this[TargetType] ?? "navigate";
        target.removeEventListener(type, this.#event);
    };
    #event = (event) => {
        if (!event.canIntercept)
            return;
        if (isIntercept(event)) {
            event.intercept({
                handler: () => {
                    return this.#transition(event);
                }
            });
        }
        else if (isTransitionWhile(event)) {
            event.transitionWhile(this.#transition(event));
        }
        else if (isWaitUntil(event)) {
            event.waitUntil(this.#transition(event));
        }
        else if (isRespondWith(event)) {
            event.respondWith(this.#transition(event));
        }
        else {
            return this.#transition(event);
        }
        function isIntercept(event) {
            return (like(event) &&
                typeof event.intercept === "function");
        }
        function isTransitionWhile(event) {
            return (like(event) &&
                typeof event.transitionWhile === "function");
        }
        function isRespondWith(event) {
            return (like(event) &&
                typeof event.respondWith === "function");
        }
        function isWaitUntil(event) {
            return (like(event) &&
                typeof event.waitUntil === "function");
        }
    };
    #transition = async (event) => {
        return transitionEvent(this, event);
    };
}

let globalNavigation = undefined;
if (typeof window !== "undefined" && window.navigation) {
    const navigation = window.navigation;
    assertNavigation(navigation);
    globalNavigation = navigation;
}
function assertNavigation(value) {
    if (!value) {
        throw new Error("Expected Navigation");
    }
}

function isEvent(value) {
    function isLike(value) {
        return !!value;
    }
    return (isLike(value) &&
        (typeof value.type === "string" || typeof value.type === "symbol"));
}
function assertEvent(value, type) {
    if (!isEvent(value)) {
        throw new Error("Expected event");
    }
    if (typeof type !== "undefined" && value.type !== type) {
        throw new Error(`Expected event type ${String(type)}, got ${value.type.toString()}`);
    }
}

function isParallelEvent(value) {
    return isEvent(value) && value.parallel !== false;
}

class AbortError extends Error {
    constructor(message) {
        super(`AbortError${message ? `: ${message}` : ""}`);
        this.name = "AbortError";
    }
}
function isAbortError(error) {
    return error instanceof Error && error.name === "AbortError";
}
class InvalidStateError extends Error {
    constructor(message) {
        super(`InvalidStateError${message ? `: ${message}` : ""}`);
        this.name = "InvalidStateError";
    }
}
function isInvalidStateError(error) {
    return error instanceof Error && error.name === "InvalidStateError";
}

function isAbortSignal(value) {
    function isAbortSignalLike(value) {
        return typeof value === "object";
    }
    return (isAbortSignalLike(value) &&
        typeof value.aborted === "boolean" &&
        typeof value.addEventListener === "function");
}
function isSignalEvent(value) {
    function isSignalEventLike(value) {
        return value.hasOwnProperty("signal");
    }
    return (isEvent(value) && isSignalEventLike(value) && isAbortSignal(value.signal));
}
function isSignalHandled(event, error) {
    if (isSignalEvent(event) &&
        event.signal.aborted &&
        error instanceof Error &&
        isAbortError(error)) {
        return true;
    }
}

/**
 * @experimental
 */
const EventTargetListeners$1 = Symbol.for("@opennetwork/environment/events/target/listeners");
/**
 * @experimental
 */
const EventTargetListenersIgnore = Symbol.for("@opennetwork/environment/events/target/listeners/ignore");
/**
 * @experimental
 */
const EventTargetListenersMatch = Symbol.for("@opennetwork/environment/events/target/listeners/match");
/**
 * @experimental
 */
const EventTargetListenersThis = Symbol.for("@opennetwork/environment/events/target/listeners/this");

const EventDescriptorSymbol = Symbol.for("@opennetwork/environment/events/descriptor");

function matchEventCallback(type, callback, options) {
    const optionsDescriptor = isOptionsDescriptor(options) ? options : undefined;
    return (descriptor) => {
        if (optionsDescriptor) {
            return optionsDescriptor === descriptor;
        }
        return ((!callback || callback === descriptor.callback) &&
            type === descriptor.type);
    };
    function isOptionsDescriptor(options) {
        function isLike(options) {
            return !!options;
        }
        return isLike(options) && options[EventDescriptorSymbol] === true;
    }
}

function isFunctionEventCallback(fn) {
    return typeof fn === "function";
}
const EventTargetDescriptors = Symbol.for("@virtualstate/navigation/event-target/descriptors");
class EventTargetListeners {
    [EventTargetDescriptors] = [];
    [EventTargetListenersIgnore] = new WeakSet();
    get [EventTargetListeners$1]() {
        return [...(this[EventTargetDescriptors] ?? [])];
    }
    [EventTargetListenersMatch](type) {
        const external = this[EventTargetListeners$1];
        const matched = [
            ...new Set([...(external ?? []), ...(this[EventTargetDescriptors] ?? [])]),
        ]
            .filter((descriptor) => descriptor.type === type || descriptor.type === "*")
            .filter((descriptor) => !this[EventTargetListenersIgnore]?.has(descriptor));
        const listener = typeof type === "string" ? this[`on${type}`] : undefined;
        if (typeof listener === "function" && isFunctionEventCallback(listener)) {
            matched.push({
                type,
                callback: listener,
                [EventDescriptorSymbol]: true,
            });
        }
        return matched;
    }
    addEventListener(type, callback, options) {
        const listener = {
            ...options,
            isListening: () => !!this[EventTargetDescriptors]?.find(matchEventCallback(type, callback)),
            descriptor: {
                [EventDescriptorSymbol]: true,
                ...options,
                type,
                callback,
            },
            timestamp: Date.now(),
        };
        if (listener.isListening()) {
            return;
        }
        this[EventTargetDescriptors]?.push(listener.descriptor);
    }
    removeEventListener(type, callback, options) {
        if (!isFunctionEventCallback(callback)) {
            return;
        }
        const externalListeners = this[EventTargetListeners$1] ?? this[EventTargetDescriptors] ?? [];
        const externalIndex = externalListeners.findIndex(matchEventCallback(type, callback, options));
        if (externalIndex === -1) {
            return;
        }
        const index = this[EventTargetDescriptors]?.findIndex(matchEventCallback(type, callback, options)) ??
            -1;
        if (index !== -1) {
            this[EventTargetDescriptors]?.splice(index, 1);
        }
        const descriptor = externalListeners[externalIndex];
        if (descriptor) {
            this[EventTargetListenersIgnore]?.add(descriptor);
        }
    }
    hasEventListener(type, callback) {
        if (callback && !isFunctionEventCallback(callback)) {
            return false;
        }
        const foundIndex = this[EventTargetDescriptors]?.findIndex(matchEventCallback(type, callback)) ?? -1;
        return foundIndex > -1;
    }
}

class AsyncEventTarget extends EventTargetListeners {
    [EventTargetListenersThis];
    constructor(thisValue = undefined) {
        super();
        this[EventTargetListenersThis] = thisValue;
    }
    async dispatchEvent(event) {
        const listeners = this[EventTargetListenersMatch]?.(event.type) ?? [];
        // Don't even dispatch an aborted event
        if (isSignalEvent(event) && event.signal.aborted) {
            throw new AbortError();
        }
        const parallel = isParallelEvent(event);
        const promises = [];
        for (let index = 0; index < listeners.length; index += 1) {
            const descriptor = listeners[index];
            const promise = (async () => {
                // Remove the listener before invoking the callback
                // This ensures that inside of the callback causes no more additional event triggers to this
                // listener
                if (descriptor.once) {
                    // by passing the descriptor as the options, we get an internal redirect
                    // that forces an instance level object equals, meaning
                    // we will only remove _this_ descriptor!
                    this.removeEventListener(descriptor.type, descriptor.callback, descriptor);
                }
                await descriptor.callback.call(this[EventTargetListenersThis] ?? this, event);
            })();
            if (!parallel) {
                try {
                    await promise;
                }
                catch (error) {
                    if (!isSignalHandled(event, error)) {
                        await Promise.reject(error);
                    }
                }
                if (isSignalEvent(event) && event.signal.aborted) {
                    // bye
                    return;
                }
            }
            else {
                promises.push(promise);
            }
        }
        if (promises.length) {
            // Allows for all promises to settle finish so we can stay within the event, we then
            // will utilise Promise.all which will reject with the first rejected promise
            const results = await Promise.allSettled(promises);
            const rejected = results.filter((result) => {
                return result.status === "rejected";
            });
            if (rejected.length) {
                let unhandled = rejected;
                // If the event was aborted, then allow abort errors to occur, and handle these as handled errors
                // The dispatcher does not care about this because they requested it
                //
                // There may be other unhandled errors that are more pressing to the task they are doing.
                //
                // The dispatcher can throw an abort error if they need to throw it up the chain
                if (isSignalEvent(event) && event.signal.aborted) {
                    unhandled = unhandled.filter((result) => !isSignalHandled(event, result.reason));
                }
                if (unhandled.length === 1) {
                    await Promise.reject(unhandled[0].reason);
                    throw unhandled[0].reason; // We shouldn't get here
                }
                else if (unhandled.length > 1) {
                    throw new AggregateError(unhandled.map(({ reason }) => reason));
                }
            }
        }
    }
}

const defaultEventTargetModule = {
    EventTarget: AsyncEventTarget,
    AsyncEventTarget,
    SyncEventTarget: AsyncEventTarget,
};
let eventTargetModule = defaultEventTargetModule;
//
// try {
//     eventTargetModule = await import("@virtualstate/navigation/event-target");
//     console.log("Using @virtualstate/navigation/event-target", eventTargetModule);
// } catch {
//     console.log("Using defaultEventTargetModule");
//     eventTargetModule = defaultEventTargetModule;
// }
const EventTargetImplementation = eventTargetModule.EventTarget || eventTargetModule.SyncEventTarget || eventTargetModule.AsyncEventTarget;
function assertEventTarget(target) {
    if (typeof target !== "function") {
        throw new Error("Could not load EventTarget implementation");
    }
}
class EventTarget extends AsyncEventTarget {
    constructor(...args) {
        super();
        if (EventTargetImplementation) {
            assertEventTarget(EventTargetImplementation);
            const { dispatchEvent } = new EventTargetImplementation(...args);
            this.dispatchEvent = dispatchEvent;
        }
    }
}

class NavigationEventTarget extends EventTarget {
    addEventListener(type, listener, options) {
        assertEventCallback(listener);
        return super.addEventListener(type, listener, typeof options === "boolean" ? { once: options } : options);
        function assertEventCallback(listener) {
            if (typeof listener !== "function")
                throw new Error("Please us the function variant of event listener");
        }
    }
    removeEventListener(type, listener, options) {
        assertEventCallback(listener);
        return super.removeEventListener(type, listener);
        function assertEventCallback(listener) {
            if (typeof listener !== "function")
                throw new Error("Please us the function variant of event listener");
        }
    }
}

const isWebCryptoSupported = "crypto" in globalThis && typeof globalThis.crypto.randomUUID === "function";
const v4 = isWebCryptoSupported
    ? globalThis.crypto.randomUUID.bind(globalThis.crypto)
    : () => Array.from({ length: 5 }, () => `${Math.random()}`.replace(/^0\./, ""))
        .join("-")
        .replace(".", "");

// To prevent cyclic imports, where a circular is used, instead use the prototype interface
// and then copy over the "private" symbol
const NavigationGetState$1 = Symbol.for("@virtualstate/navigation/getState");
const NavigationHistoryEntryNavigationType = Symbol.for("@virtualstate/navigation/entry/navigationType");
const NavigationHistoryEntryKnownAs = Symbol.for("@virtualstate/navigation/entry/knownAs");
const NavigationHistoryEntrySetState = Symbol.for("@virtualstate/navigation/entry/setState");
function isPrimitiveValue(state) {
    return (typeof state === "number" ||
        typeof state === "boolean" ||
        typeof state === "symbol" ||
        typeof state === "bigint" ||
        typeof state === "string");
}
function isValue(state) {
    return !!(state || isPrimitiveValue(state));
}
class NavigationHistoryEntry extends NavigationEventTarget {
    #index;
    #state;
    get index() {
        return typeof this.#index === "number" ? this.#index : this.#index();
    }
    key;
    id;
    url;
    sameDocument;
    get [NavigationHistoryEntryNavigationType]() {
        return this.#options.navigationType;
    }
    get [NavigationHistoryEntryKnownAs]() {
        const set = new Set(this.#options[NavigationHistoryEntryKnownAs]);
        set.add(this.id);
        return set;
    }
    #options;
    get [EventTargetListeners$1]() {
        return [
            ...(super[EventTargetListeners$1] ?? []),
            ...(this.#options[EventTargetListeners$1] ?? []),
        ];
    }
    constructor(init) {
        super();
        this.#options = init;
        this.key = init.key || v4();
        this.id = v4();
        this.url = init.url ?? undefined;
        this.#index = init.index;
        this.sameDocument = init.sameDocument ?? true;
        this.#state = init.state ?? undefined;
    }
    [NavigationGetState$1]() {
        return this.#options?.getState?.(this);
    }
    getState() {
        let state = this.#state;
        if (!isValue(state)) {
            const external = this[NavigationGetState$1]();
            if (isValue(external)) {
                state = this.#state = external;
            }
        }
        /**
         * https://github.com/WICG/app-history/blob/7c0332b30746b14863f717404402bc49e497a2b2/spec.bs#L1406
         * Note that in general, unless the state value is a primitive, entry.getState() !== entry.getState(), since a fresh copy is returned each time.
         */
        if (typeof state === "undefined" ||
            isPrimitiveValue(state)) {
            return state;
        }
        if (typeof state === "function") {
            console.warn("State passed to Navigation.navigate was a function, this may be unintentional");
            console.warn("Unless a state value is primitive, with a standard implementation of Navigation");
            console.warn("your state value will be serialized and deserialized before this point, meaning");
            console.warn("a function would not be usable.");
        }
        return {
            ...state,
        };
    }
    [NavigationHistoryEntrySetState](state) {
        this.#state = state;
    }
}

/**
 * @param handleCatch rejected promises automatically to allow free usage
 */
function deferred(handleCatch) {
    let resolve = undefined, reject = undefined;
    const promise = new Promise((resolveFn, rejectFn) => {
        resolve = resolveFn;
        reject = rejectFn;
    });
    ok(resolve);
    ok(reject);
    return {
        resolve,
        reject,
        promise: handleCatch ? promise.catch(handleCatch) : promise,
    };
}
function ok(value) {
    if (!value) {
        throw new Error("Value not provided");
    }
}

const GlobalAbortController = typeof AbortController !== "undefined" ? AbortController : undefined;

if (!GlobalAbortController) {
    throw new Error("AbortController expected to be available or polyfilled");
}
const AbortController$1 = GlobalAbortController;

const THIS_WILL_BE_REMOVED = "This will be removed when version 1.0.0 of @virtualstate/navigation is published";
const WARNINGS = {
    EVENT_INTERCEPT_HANDLER: `You are using a non standard interface, please update your code to use event.intercept({ async handler() {} })\n${THIS_WILL_BE_REMOVED}`
};
function logWarning(warning, ...message) {
    try {
        {
            console.trace(WARNINGS[warning], ...message);
        }
    }
    catch {
        // We don't want attempts to log causing issues
        // maybe we don't have a console
    }
}

const Rollback = Symbol.for("@virtualstate/navigation/rollback");
const Unset = Symbol.for("@virtualstate/navigation/unset");
const NavigationTransitionParentEventTarget = Symbol.for("@virtualstate/navigation/transition/parentEventTarget");
const NavigationTransitionFinishedDeferred = Symbol.for("@virtualstate/navigation/transition/deferred/finished");
const NavigationTransitionCommittedDeferred = Symbol.for("@virtualstate/navigation/transition/deferred/committed");
const NavigationTransitionNavigationType = Symbol.for("@virtualstate/navigation/transition/navigationType");
const NavigationTransitionInitialEntries = Symbol.for("@virtualstate/navigation/transition/entries/initial");
const NavigationTransitionFinishedEntries = Symbol.for("@virtualstate/navigation/transition/entries/finished");
const NavigationTransitionInitialIndex = Symbol.for("@virtualstate/navigation/transition/index/initial");
const NavigationTransitionFinishedIndex = Symbol.for("@virtualstate/navigation/transition/index/finished");
const NavigationTransitionEntry = Symbol.for("@virtualstate/navigation/transition/entry");
const NavigationTransitionIsCommitted = Symbol.for("@virtualstate/navigation/transition/isCommitted");
const NavigationTransitionIsFinished = Symbol.for("@virtualstate/navigation/transition/isFinished");
const NavigationTransitionIsRejected = Symbol.for("@virtualstate/navigation/transition/isRejected");
const NavigationTransitionKnown = Symbol.for("@virtualstate/navigation/transition/known");
const NavigationTransitionPromises = Symbol.for("@virtualstate/navigation/transition/promises");
const NavigationIntercept = Symbol.for("@virtualstate/navigation/intercept");
const NavigationTransitionIsOngoing = Symbol.for("@virtualstate/navigation/transition/isOngoing");
const NavigationTransitionIsPending = Symbol.for("@virtualstate/navigation/transition/isPending");
const NavigationTransitionIsAsync = Symbol.for("@virtualstate/navigation/transition/isAsync");
const NavigationTransitionWait = Symbol.for("@virtualstate/navigation/transition/wait");
const NavigationTransitionPromiseResolved = Symbol.for("@virtualstate/navigation/transition/promise/resolved");
const NavigationTransitionRejected = Symbol.for("@virtualstate/navigation/transition/rejected");
const NavigationTransitionCommit = Symbol.for("@virtualstate/navigation/transition/commit");
const NavigationTransitionFinish = Symbol.for("@virtualstate/navigation/transition/finish");
const NavigationTransitionStart = Symbol.for("@virtualstate/navigation/transition/start");
const NavigationTransitionStartDeadline = Symbol.for("@virtualstate/navigation/transition/start/deadline");
const NavigationTransitionError = Symbol.for("@virtualstate/navigation/transition/error");
const NavigationTransitionFinally = Symbol.for("@virtualstate/navigation/transition/finally");
const NavigationTransitionAbort = Symbol.for("@virtualstate/navigation/transition/abort");
const NavigationTransitionInterceptOptionsCommit = Symbol.for("@virtualstate/navigation/transition/intercept/options/commit");
const NavigationTransitionCommitIsManual = Symbol.for("@virtualstate/navigation/transition/commit/isManual");
class NavigationTransition extends EventTarget {
    finished;
    /**
     * @experimental
     */
    committed;
    from;
    navigationType;
    /**
     * true if transition has an async intercept
     */
    [NavigationTransitionIsAsync] = false;
    /**
     * @experimental
     */
    [NavigationTransitionInterceptOptionsCommit];
    #options;
    [NavigationTransitionFinishedDeferred] = deferred();
    [NavigationTransitionCommittedDeferred] = deferred();
    get [NavigationTransitionIsPending]() {
        return !!this.#promises.size;
    }
    get [NavigationTransitionNavigationType]() {
        return this.#options[NavigationTransitionNavigationType];
    }
    get [NavigationTransitionInitialEntries]() {
        return this.#options[NavigationTransitionInitialEntries];
    }
    get [NavigationTransitionInitialIndex]() {
        return this.#options[NavigationTransitionInitialIndex];
    }
    get [NavigationTransitionCommitIsManual]() {
        return !!(this[NavigationTransitionInterceptOptionsCommit]?.includes("after-transition") ||
            this[NavigationTransitionInterceptOptionsCommit]?.includes("manual"));
    }
    [NavigationTransitionFinishedEntries];
    [NavigationTransitionFinishedIndex];
    [NavigationTransitionIsCommitted] = false;
    [NavigationTransitionIsFinished] = false;
    [NavigationTransitionIsRejected] = false;
    [NavigationTransitionIsOngoing] = false;
    [NavigationTransitionKnown] = new Set();
    [NavigationTransitionEntry];
    #promises = new Set();
    #rolledBack = false;
    #abortController = new AbortController$1();
    get signal() {
        return this.#abortController.signal;
    }
    get [NavigationTransitionPromises]() {
        return this.#promises;
    }
    constructor(init) {
        super();
        this[NavigationTransitionInterceptOptionsCommit] = [];
        this[NavigationTransitionFinishedDeferred] =
            init[NavigationTransitionFinishedDeferred] ??
                this[NavigationTransitionFinishedDeferred];
        this[NavigationTransitionCommittedDeferred] =
            init[NavigationTransitionCommittedDeferred] ??
                this[NavigationTransitionCommittedDeferred];
        this.#options = init;
        const finished = (this.finished =
            this[NavigationTransitionFinishedDeferred].promise);
        const committed = (this.committed =
            this[NavigationTransitionCommittedDeferred].promise);
        // Auto catching abort
        void finished.catch((error) => error);
        void committed.catch((error) => error);
        this.from = init.from;
        this.navigationType = init.navigationType;
        this[NavigationTransitionFinishedEntries] =
            init[NavigationTransitionFinishedEntries];
        this[NavigationTransitionFinishedIndex] =
            init[NavigationTransitionFinishedIndex];
        const known = init[NavigationTransitionKnown];
        if (known) {
            for (const entry of known) {
                this[NavigationTransitionKnown].add(entry);
            }
        }
        this[NavigationTransitionEntry] = init[NavigationTransitionEntry];
        // Event listeners
        {
            // Events to promises
            {
                this.addEventListener(NavigationTransitionCommit, this.#onCommitPromise, { once: true });
                this.addEventListener(NavigationTransitionFinish, this.#onFinishPromise, { once: true });
            }
            // Events to property setters
            {
                this.addEventListener(NavigationTransitionCommit, this.#onCommitSetProperty, { once: true });
                this.addEventListener(NavigationTransitionFinish, this.#onFinishSetProperty, { once: true });
            }
            // Rejection + Abort
            {
                this.addEventListener(NavigationTransitionError, this.#onError, {
                    once: true,
                });
                this.addEventListener(NavigationTransitionAbort, () => {
                    if (!this[NavigationTransitionIsFinished]) {
                        return this[NavigationTransitionRejected](new AbortError());
                    }
                });
            }
            // Proxy all events from this transition onto entry + the parent event target
            //
            // The parent could be another transition, or the Navigation, this allows us to
            // "bubble up" events layer by layer
            //
            // In this implementation, this allows individual transitions to "intercept" navigate and break the child
            // transition from happening
            //
            // TODO WARN this may not be desired behaviour vs standard spec'd Navigation
            {
                this.addEventListener("*", this[NavigationTransitionEntry].dispatchEvent.bind(this[NavigationTransitionEntry]));
                this.addEventListener("*", init[NavigationTransitionParentEventTarget].dispatchEvent.bind(init[NavigationTransitionParentEventTarget]));
            }
        }
    }
    rollback = (options) => {
        // console.log({ rolled: this.#rolledBack });
        if (this.#rolledBack) {
            // TODO
            throw new InvalidStateError("Rollback invoked multiple times: Please raise an issue at https://github.com/virtualstate/navigation with the use case where you want to use a rollback multiple times, this may have been unexpected behaviour");
        }
        this.#rolledBack = true;
        return this.#options.rollback(options);
    };
    #onCommitSetProperty = () => {
        this[NavigationTransitionIsCommitted] = true;
    };
    #onFinishSetProperty = () => {
        this[NavigationTransitionIsFinished] = true;
    };
    #onFinishPromise = () => {
        // console.log("onFinishPromise")
        this[NavigationTransitionFinishedDeferred].resolve(this[NavigationTransitionEntry]);
    };
    #onCommitPromise = () => {
        if (this.signal.aborted) ;
        else {
            this[NavigationTransitionCommittedDeferred].resolve(this[NavigationTransitionEntry]);
        }
    };
    #onError = (event) => {
        return this[NavigationTransitionRejected](event.error);
    };
    [NavigationTransitionPromiseResolved] = (...promises) => {
        for (const promise of promises) {
            this.#promises.delete(promise);
        }
    };
    [NavigationTransitionRejected] = async (reason) => {
        if (this[NavigationTransitionIsRejected])
            return;
        this[NavigationTransitionIsRejected] = true;
        this[NavigationTransitionAbort]();
        const navigationType = this[NavigationTransitionNavigationType];
        // console.log({ navigationType, reason, entry: this[NavigationTransitionEntry] });
        if (typeof navigationType === "string" || navigationType === Rollback) {
            // console.log("navigateerror", { reason, z: isInvalidStateError(reason) });
            await this.dispatchEvent({
                type: "navigateerror",
                error: reason,
                get message() {
                    if (reason instanceof Error) {
                        return reason.message;
                    }
                    return `${reason}`;
                },
            });
            // console.log("navigateerror finished");
            if (navigationType !== Rollback &&
                !(isInvalidStateError(reason) || isAbortError(reason))) {
                try {
                    // console.log("Rollback", navigationType);
                    // console.warn("Rolling back immediately due to internal error", error);
                    await this.rollback()?.finished;
                    // console.log("Rollback complete", navigationType);
                }
                catch (error) {
                    // console.error("Failed to rollback", error);
                    throw new InvalidStateError("Failed to rollback, please raise an issue at https://github.com/virtualstate/navigation/issues");
                }
            }
        }
        this[NavigationTransitionCommittedDeferred].reject(reason);
        this[NavigationTransitionFinishedDeferred].reject(reason);
    };
    [NavigationIntercept] = (options) => {
        const transition = this;
        const promise = parseOptions();
        this[NavigationTransitionIsOngoing] = true;
        if (!promise)
            return;
        this[NavigationTransitionIsAsync] = true;
        const statusPromise = promise
            .then(() => ({
            status: "fulfilled",
            value: undefined,
        }))
            .catch(async (reason) => {
            await this[NavigationTransitionRejected](reason);
            return {
                status: "rejected",
                reason,
            };
        });
        this.#promises.add(statusPromise);
        function parseOptions() {
            if (!options)
                return undefined;
            if (isPromise(options)) {
                logWarning("EVENT_INTERCEPT_HANDLER");
                return options;
            }
            if (typeof options === "function") {
                logWarning("EVENT_INTERCEPT_HANDLER");
                return options();
            }
            const { handler, commit } = options;
            if (commit && typeof commit === "string") {
                transition[NavigationTransitionInterceptOptionsCommit].push(commit);
            }
            if (typeof handler !== "function") {
                return;
            }
            return handler();
        }
    };
    [NavigationTransitionWait] = async () => {
        if (!this.#promises.size)
            return this[NavigationTransitionEntry];
        try {
            const captured = [...this.#promises];
            const results = await Promise.all(captured);
            const rejected = results.filter((result) => result.status === "rejected");
            // console.log({ rejected, results, captured });
            if (rejected.length) {
                // TODO handle differently when there are failures, e.g. we could move navigateerror to here
                if (rejected.length === 1) {
                    throw rejected[0].reason;
                }
                if (typeof AggregateError !== "undefined") {
                    throw new AggregateError(rejected.map(({ reason }) => reason));
                }
                throw new Error();
            }
            this[NavigationTransitionPromiseResolved](...captured);
            if (this[NavigationTransitionIsPending]) {
                return this[NavigationTransitionWait]();
            }
            return this[NavigationTransitionEntry];
        }
        catch (error) {
            await this.#onError(error);
            throw await Promise.reject(error);
        }
        finally {
            await this[NavigationTransitionFinish]();
        }
    };
    [NavigationTransitionAbort]() {
        if (this.#abortController.signal.aborted)
            return;
        this.#abortController.abort();
        this.dispatchEvent({
            type: NavigationTransitionAbort,
            transition: this,
            entry: this[NavigationTransitionEntry],
        });
    }
    [NavigationTransitionFinish] = async () => {
        if (this[NavigationTransitionIsFinished]) {
            return;
        }
        await this.dispatchEvent({
            type: NavigationTransitionFinish,
            transition: this,
            entry: this[NavigationTransitionEntry],
            intercept: this[NavigationIntercept],
        });
    };
}

function getWindowBaseURL() {
    try {
        if (typeof window !== "undefined" && window.location) {
            return window.location.href;
        }
    }
    catch { }
}
function getBaseURL(url) {
    const baseURL = getWindowBaseURL() ?? "https://html.spec.whatwg.org/";
    return new URL(
    // Deno wants this to be always a string
    (url ?? "").toString(), baseURL);
}

function defer() {
    let resolve = undefined, reject = undefined, settled = false, status = "pending";
    const promise = new Promise((resolveFn, rejectFn) => {
        resolve = (value) => {
            status = "fulfilled";
            settled = true;
            resolveFn(value);
        };
        reject = (reason) => {
            status = "rejected";
            settled = true;
            rejectFn(reason);
        };
    });
    ok$1(resolve);
    ok$1(reject);
    return {
        get settled() {
            return settled;
        },
        get status() {
            return status;
        },
        resolve,
        reject,
        promise,
    };
}

class NavigationCurrentEntryChangeEvent {
    type;
    from;
    navigationType;
    constructor(type, init) {
        this.type = type;
        if (!init) {
            throw new TypeError("init required");
        }
        if (!init.from) {
            throw new TypeError("from required");
        }
        this.from = init.from;
        this.navigationType = init.navigationType ?? undefined;
    }
}

class NavigateEvent {
    type;
    canIntercept;
    /**
     * @deprecated
     */
    canTransition;
    destination;
    downloadRequest;
    formData;
    hashChange;
    info;
    signal;
    userInitiated;
    navigationType;
    constructor(type, init) {
        this.type = type;
        if (!init) {
            throw new TypeError("init required");
        }
        if (!init.destination) {
            throw new TypeError("destination required");
        }
        if (!init.signal) {
            throw new TypeError("signal required");
        }
        this.canIntercept = init.canIntercept ?? false;
        this.canTransition = init.canIntercept ?? false;
        this.destination = init.destination;
        this.downloadRequest = init.downloadRequest;
        this.formData = init.formData;
        this.hashChange = init.hashChange ?? false;
        this.info = init.info;
        this.signal = init.signal;
        this.userInitiated = init.userInitiated ?? false;
        this.navigationType = init.navigationType ?? "push";
    }
    commit() {
        throw new Error("Not implemented");
    }
    intercept(options) {
        throw new Error("Not implemented");
    }
    preventDefault() {
        throw new Error("Not implemented");
    }
    reportError(reason) {
        throw new Error("Not implemented");
    }
    scroll() {
        throw new Error("Not implemented");
    }
    /**
     * @deprecated
     */
    transitionWhile(options) {
        return this.intercept(options);
    }
}

const NavigationFormData = Symbol.for("@virtualstate/navigation/formData");
const NavigationDownloadRequest = Symbol.for("@virtualstate/navigation/downloadRequest");
const NavigationCanIntercept = Symbol.for("@virtualstate/navigation/canIntercept");
const NavigationUserInitiated = Symbol.for("@virtualstate/navigation/userInitiated");
const NavigationOriginalEvent = Symbol.for("@virtualstate/navigation/originalEvent");
function noop() {
    return undefined;
}
function getEntryIndex(entries, entry) {
    const knownIndex = entry.index;
    if (knownIndex !== -1) {
        return knownIndex;
    }
    // TODO find an entry if it has changed id
    return -1;
}
function createNavigationTransition(context) {
    const { commit: transitionCommit, currentIndex, options, known: initialKnown, currentEntry, transition, transition: { [NavigationTransitionInitialEntries]: previousEntries, [NavigationTransitionEntry]: entry, [NavigationIntercept]: intercept, }, reportError } = context;
    let { transition: { [NavigationTransitionNavigationType]: navigationType }, } = context;
    let resolvedEntries = [...previousEntries];
    const known = new Set(initialKnown);
    let destinationIndex = -1, nextIndex = currentIndex;
    if (navigationType === Rollback) {
        const { index } = options ?? { index: undefined };
        if (typeof index !== "number")
            throw new InvalidStateError("Expected index to be provided for rollback");
        destinationIndex = index;
        nextIndex = index;
    }
    else if (navigationType === "traverse" || navigationType === "reload") {
        destinationIndex = getEntryIndex(previousEntries, entry);
        nextIndex = destinationIndex;
    }
    else if (navigationType === "replace") {
        if (currentIndex === -1) {
            navigationType = "push";
            destinationIndex = currentIndex + 1;
            nextIndex = destinationIndex;
        }
        else {
            destinationIndex = currentIndex;
            nextIndex = currentIndex;
        }
    }
    else {
        destinationIndex = currentIndex + 1;
        nextIndex = destinationIndex;
    }
    if (typeof destinationIndex !== "number" || destinationIndex === -1) {
        throw new InvalidStateError("Could not resolve next index");
    }
    // console.log({ navigationType, entry, options });
    if (!entry.url) {
        console.trace({ navigationType, entry, options });
        throw new InvalidStateError("Expected entry url");
    }
    const destination = {
        url: entry.url,
        key: entry.key,
        index: destinationIndex,
        sameDocument: entry.sameDocument,
        getState() {
            return entry.getState();
        },
    };
    let hashChange = false;
    const currentUrlInstance = getBaseURL(currentEntry?.url);
    const destinationUrlInstance = new URL(destination.url);
    const currentHash = currentUrlInstance.hash;
    const destinationHash = destinationUrlInstance.hash;
    // console.log({ currentHash, destinationHash });
    if (currentHash !== destinationHash) {
        const currentUrlInstanceWithoutHash = new URL(currentUrlInstance.toString());
        currentUrlInstanceWithoutHash.hash = "";
        const destinationUrlInstanceWithoutHash = new URL(destinationUrlInstance.toString());
        destinationUrlInstanceWithoutHash.hash = "";
        hashChange =
            currentUrlInstanceWithoutHash.toString() ===
                destinationUrlInstanceWithoutHash.toString();
        // console.log({ hashChange, currentUrlInstanceWithoutHash: currentUrlInstanceWithoutHash.toString(), before: destinationUrlInstanceWithoutHash.toString() })
    }
    let contextToCommit;
    const { resolve: resolveCommit, promise: waitForCommit } = defer();
    function commit() {
        ok$1(contextToCommit, "Expected contextToCommit");
        resolveCommit(transitionCommit(contextToCommit));
    }
    const abortController = new AbortController$1();
    const event = new NavigateEvent("navigate", {
        signal: abortController.signal,
        info: undefined,
        ...options,
        canIntercept: options?.[NavigationCanIntercept] ?? true,
        formData: options?.[NavigationFormData] ?? undefined,
        downloadRequest: options?.[NavigationDownloadRequest] ?? undefined,
        hashChange,
        navigationType: options?.navigationType ??
            (typeof navigationType === "string" ? navigationType : "replace"),
        userInitiated: options?.[NavigationUserInitiated] ?? false,
        destination,
    });
    const originalEvent = options?.[NavigationOriginalEvent];
    const preventDefault = transition[NavigationTransitionAbort].bind(transition);
    if (originalEvent) {
        const definedEvent = originalEvent;
        event.intercept = function originalEventIntercept(options) {
            definedEvent.preventDefault();
            return intercept(options);
        };
        event.preventDefault = function originalEventPreventDefault() {
            definedEvent.preventDefault();
            return preventDefault();
        };
    }
    else {
        event.intercept = intercept;
        event.preventDefault = preventDefault;
    }
    // Enforce that transitionWhile and intercept match
    event.transitionWhile = event.intercept;
    event.commit = commit;
    if (reportError) {
        event.reportError = reportError;
    }
    event.scroll = noop;
    if (originalEvent) {
        event.originalEvent = originalEvent;
    }
    const currentEntryChange = new NavigationCurrentEntryChangeEvent("currententrychange", {
        from: currentEntry,
        navigationType: event.navigationType,
    });
    let updatedEntries = [], removedEntries = [], addedEntries = [];
    const previousKeys = previousEntries.map(entry => entry.key);
    if (navigationType === Rollback) {
        const { entries } = options ?? { entries: undefined };
        if (!entries)
            throw new InvalidStateError("Expected entries to be provided for rollback");
        resolvedEntries = entries;
        resolvedEntries.forEach((entry) => known.add(entry));
        const keys = resolvedEntries.map(entry => entry.key);
        removedEntries = previousEntries.filter(entry => !keys.includes(entry.key));
        addedEntries = resolvedEntries.filter(entry => !previousKeys.includes(entry.key));
    }
    // Default next index is current entries length, aka
    // console.log({ navigationType, givenNavigationType, index: this.#currentIndex, resolvedNextIndex });
    else if (navigationType === "replace" ||
        navigationType === "traverse" ||
        navigationType === "reload") {
        resolvedEntries[destination.index] = entry;
        if (navigationType !== "traverse") {
            updatedEntries.push(entry);
        }
        if (navigationType === "replace") {
            resolvedEntries = resolvedEntries.slice(0, destination.index + 1);
        }
        const keys = resolvedEntries.map(entry => entry.key);
        removedEntries = previousEntries.filter(entry => !keys.includes(entry.key));
        if (previousKeys.includes(entry.id)) {
            addedEntries = [entry];
        }
    }
    else if (navigationType === "push") {
        let removed = false;
        // Trim forward, we have reset our stack
        if (resolvedEntries[destination.index]) {
            // const before = [...this.#entries];
            resolvedEntries = resolvedEntries.slice(0, destination.index);
            // console.log({ before, after: [...this.#entries]})
            removed = true;
        }
        resolvedEntries.push(entry);
        addedEntries = [entry];
        if (removed) {
            const keys = resolvedEntries.map(entry => entry.key);
            removedEntries = previousEntries.filter(entry => !keys.includes(entry.key));
        }
    }
    known.add(entry);
    let entriesChange = undefined;
    if (updatedEntries.length || addedEntries.length || removedEntries.length) {
        entriesChange = {
            updatedEntries,
            addedEntries,
            removedEntries
        };
    }
    contextToCommit = {
        entries: resolvedEntries,
        index: nextIndex,
        known,
        entriesChange
    };
    return {
        entries: resolvedEntries,
        known,
        index: nextIndex,
        currentEntryChange,
        destination,
        navigate: event,
        navigationType,
        waitForCommit,
        commit,
        abortController
    };
}

function createEvent(event) {
    if (typeof CustomEvent !== "undefined" && typeof event.type === "string") {
        if (event instanceof CustomEvent) {
            return event;
        }
        const { type, detail, ...rest } = event;
        const customEvent = new CustomEvent(type, {
            detail: detail ?? rest,
        });
        Object.assign(customEvent, rest);
        assertEvent(customEvent, event.type);
        return customEvent;
    }
    return event;
}

const NavigationSetOptions = Symbol.for("@virtualstate/navigation/setOptions");
const NavigationSetEntries = Symbol.for("@virtualstate/navigation/setEntries");
const NavigationSetCurrentIndex = Symbol.for("@virtualstate/navigation/setCurrentIndex");
const NavigationSetCurrentKey = Symbol.for("@virtualstate/navigation/setCurrentKey");
const NavigationGetState = Symbol.for("@virtualstate/navigation/getState");
const NavigationSetState = Symbol.for("@virtualstate/navigation/setState");
const NavigationDisposeState = Symbol.for("@virtualstate/navigation/disposeState");
function isNavigationNavigationType(value) {
    return (value === "reload" ||
        value === "push" ||
        value === "replace" ||
        value === "traverse");
}
class Navigation extends NavigationEventTarget {
    // Should be always 0 or 1
    #transitionInProgressCount = 0;
    // #activePromise?: Promise<void> = undefined;
    #entries = [];
    #known = new Set();
    #currentIndex = -1;
    #activeTransition;
    #knownTransitions = new WeakSet();
    #baseURL = "";
    #initialEntry = undefined;
    #options = undefined;
    get canGoBack() {
        return !!this.#entries[this.#currentIndex - 1];
    }
    get canGoForward() {
        return !!this.#entries[this.#currentIndex + 1];
    }
    get currentEntry() {
        if (this.#currentIndex === -1) {
            if (!this.#initialEntry) {
                this.#initialEntry = new NavigationHistoryEntry({
                    getState: this[NavigationGetState],
                    navigationType: "push",
                    index: -1,
                    sameDocument: false,
                    url: this.#baseURL.toString()
                });
            }
            return this.#initialEntry;
        }
        return this.#entries[this.#currentIndex];
    }
    get transition() {
        const transition = this.#activeTransition;
        // Never let an aborted transition leak, it doesn't need to be accessed any more
        return transition?.signal.aborted ? undefined : transition;
    }
    constructor(options = {}) {
        super();
        this[NavigationSetOptions](options);
    }
    [NavigationSetOptions](options) {
        this.#options = options;
        this.#baseURL = getBaseURL(options?.baseURL);
        this.#entries = [];
        if (options.entries) {
            this[NavigationSetEntries](options.entries);
        }
        if (options.currentKey) {
            this[NavigationSetCurrentKey](options.currentKey);
        }
        else if (typeof options.currentIndex === "number") {
            this[NavigationSetCurrentIndex](options.currentIndex);
        }
    }
    /**
     * Set the current entry key without any lifecycle eventing
     *
     * This would be more exact than providing an index
     * @param key
     */
    [NavigationSetCurrentKey](key) {
        const index = this.#entries.findIndex(entry => entry.key === key);
        // If the key can't be found, becomes a no-op
        if (index === -1)
            return;
        this.#currentIndex = index;
    }
    /**
     * Set the current entry index without any lifecycle eventing
     * @param index
     */
    [NavigationSetCurrentIndex](index) {
        if (index <= -1)
            return;
        if (index >= this.#entries.length)
            return;
        this.#currentIndex = index;
    }
    /**
     * Set the entries available without any lifecycle eventing
     * @param entries
     */
    [NavigationSetEntries](entries) {
        this.#entries = entries.map(({ key, url, navigationType, state, sameDocument }, index) => new NavigationHistoryEntry({
            getState: this[NavigationGetState],
            navigationType: isNavigationNavigationType(navigationType) ? navigationType : "push",
            sameDocument: sameDocument ?? true,
            index,
            url,
            key,
            state
        }));
        if (this.#currentIndex === -1 && this.#entries.length) {
            // Initialise, even if its not the one that was expected
            this.#currentIndex = 0;
        }
    }
    [NavigationGetState] = (entry) => {
        return this.#options?.getState?.(entry) ?? undefined;
    };
    [NavigationSetState] = (entry) => {
        return this.#options?.setState?.(entry);
    };
    [NavigationDisposeState] = (entry) => {
        return this.#options?.disposeState?.(entry);
    };
    back(options) {
        if (!this.canGoBack)
            throw new InvalidStateError("Cannot go back");
        const entry = this.#entries[this.#currentIndex - 1];
        return this.#pushEntry("traverse", this.#cloneNavigationHistoryEntry(entry, {
            ...options,
            navigationType: "traverse",
        }));
    }
    entries() {
        return [...this.#entries];
    }
    forward(options) {
        if (!this.canGoForward)
            throw new InvalidStateError();
        const entry = this.#entries[this.#currentIndex + 1];
        return this.#pushEntry("traverse", this.#cloneNavigationHistoryEntry(entry, {
            ...options,
            navigationType: "traverse",
        }));
    }
    /**
    /**
     * @deprecated use traverseTo
     */
    goTo(key, options) {
        return this.traverseTo(key, options);
    }
    traverseTo(key, options) {
        const found = this.#entries.find((entry) => entry.key === key);
        if (found) {
            return this.#pushEntry("traverse", this.#cloneNavigationHistoryEntry(found, {
                ...options,
                navigationType: "traverse",
            }));
        }
        throw new InvalidStateError();
    }
    #isSameDocument = (url) => {
        function isSameOrigins(a, b) {
            return a.origin === b.origin;
        }
        const currentEntryUrl = this.currentEntry?.url;
        if (!currentEntryUrl)
            return true;
        return isSameOrigins(new URL(currentEntryUrl), new URL(url));
    };
    navigate(url, options) {
        let baseURL = this.#baseURL;
        if (this.currentEntry?.url) {
            // This allows use to use relative
            baseURL = this.currentEntry?.url;
        }
        const nextUrl = new URL(url, baseURL).toString();
        let navigationType = "push";
        if (options?.history === "push" || options?.history === "replace") {
            navigationType = options?.history;
        }
        const entry = this.#createNavigationHistoryEntry({
            getState: this[NavigationGetState],
            url: nextUrl,
            ...options,
            sameDocument: this.#isSameDocument(nextUrl),
            navigationType,
        });
        return this.#pushEntry(navigationType, entry, undefined, options);
    }
    #cloneNavigationHistoryEntry = (entry, options) => {
        return this.#createNavigationHistoryEntry({
            ...entry,
            getState: this[NavigationGetState],
            index: entry?.index ?? undefined,
            state: options?.state ?? entry?.getState(),
            navigationType: entry?.[NavigationHistoryEntryNavigationType] ??
                (typeof options?.navigationType === "string"
                    ? options.navigationType
                    : "replace"),
            ...options,
            get [NavigationHistoryEntryKnownAs]() {
                return entry?.[NavigationHistoryEntryKnownAs];
            },
            get [EventTargetListeners$1]() {
                return entry?.[EventTargetListeners$1];
            },
        });
    };
    #createNavigationHistoryEntry = (options) => {
        const entry = new NavigationHistoryEntry({
            ...options,
            index: options.index ??
                (() => {
                    return this.#entries.indexOf(entry);
                }),
        });
        return entry;
    };
    #pushEntry = (navigationType, entry, transition, options) => {
        /* c8 ignore start */
        if (entry === this.currentEntry)
            throw new InvalidStateError();
        const existingPosition = this.#entries.findIndex((existing) => existing.id === entry.id);
        if (existingPosition > -1) {
            throw new InvalidStateError();
        }
        /* c8 ignore end */
        return this.#commitTransition(navigationType, entry, transition, options);
    };
    #commitTransition = (givenNavigationType, entry, transition, options) => {
        const nextTransition = transition ??
            new NavigationTransition({
                from: entry,
                navigationType: typeof givenNavigationType === "string"
                    ? givenNavigationType
                    : "replace",
                rollback: (options) => {
                    return this.#rollback(nextTransition, options);
                },
                [NavigationTransitionNavigationType]: givenNavigationType,
                [NavigationTransitionInitialEntries]: [...this.#entries],
                [NavigationTransitionInitialIndex]: this.#currentIndex,
                [NavigationTransitionKnown]: [...this.#known],
                [NavigationTransitionEntry]: entry,
                [NavigationTransitionParentEventTarget]: this,
            });
        const { finished, committed } = nextTransition;
        const handler = () => {
            return this.#immediateTransition(givenNavigationType, entry, nextTransition, options);
        };
        this.#queueTransition(nextTransition);
        void handler().catch((error) => void error);
        // let nextPromise;
        // if (!this.#transitionInProgressCount || !this.#activePromise) {
        //   nextPromise = handler().catch((error) => void error);
        // } else {
        //   nextPromise = this.#activePromise.then(handler);
        // }
        //
        // const promise = nextPromise
        //     .catch(error => void error)
        //     .then(() => {
        //       if (this.#activePromise === promise) {
        //         this.#activePromise = undefined;
        //       }
        //     })
        //
        // this.#activePromise = promise;
        return { committed, finished };
    };
    #queueTransition = (transition) => {
        // TODO consume errors that are not abort errors
        // transition.finished.catch(error => void error);
        this.#knownTransitions.add(transition);
    };
    #immediateTransition = (givenNavigationType, entry, transition, options) => {
        try {
            // This number can grow if navigation is
            // called during a transition
            //
            // ... I had used transitionInProgressCount as a
            // safeguard until I could see this flow firsthand
            this.#transitionInProgressCount += 1;
            return this.#transition(givenNavigationType, entry, transition, options);
        }
        finally {
            this.#transitionInProgressCount -= 1;
        }
    };
    #rollback = (rollbackTransition, options) => {
        const previousEntries = rollbackTransition[NavigationTransitionInitialEntries];
        const previousIndex = rollbackTransition[NavigationTransitionInitialIndex];
        const previousCurrent = previousEntries[previousIndex];
        // console.log("z");
        // console.log("Rollback!", { previousCurrent, previousEntries, previousIndex });
        const entry = previousCurrent
            ? this.#cloneNavigationHistoryEntry(previousCurrent, options)
            : undefined;
        const nextOptions = {
            ...options,
            index: previousIndex,
            known: new Set([...this.#known, ...previousEntries]),
            navigationType: entry?.[NavigationHistoryEntryNavigationType] ?? "replace",
            entries: previousEntries,
        };
        const resolvedNavigationType = entry ? Rollback : Unset;
        const resolvedEntry = entry ??
            this.#createNavigationHistoryEntry({
                getState: this[NavigationGetState],
                navigationType: "replace",
                index: nextOptions.index,
                sameDocument: true,
                ...options,
            });
        return this.#pushEntry(resolvedNavigationType, resolvedEntry, undefined, nextOptions);
    };
    #transition = (givenNavigationType, entry, transition, options) => {
        // console.log({ givenNavigationType, transition });
        let navigationType = givenNavigationType;
        const performance = getPerformance();
        if (performance &&
            entry.sameDocument &&
            typeof navigationType === "string") {
            performance?.mark?.(`same-document-navigation:${entry.id}`);
        }
        let currentEntryChangeEvent = false, committedCurrentEntryChange = false;
        const { currentEntry } = this;
        void this.#activeTransition?.finished?.catch((error) => error);
        void this.#activeTransition?.[NavigationTransitionFinishedDeferred]?.promise?.catch((error) => error);
        void this.#activeTransition?.[NavigationTransitionCommittedDeferred]?.promise?.catch((error) => error);
        this.#activeTransition?.[NavigationTransitionAbort]();
        this.#activeTransition = transition;
        const startEventPromise = transition.dispatchEvent({
            type: NavigationTransitionStart,
            transition,
            entry,
        });
        const syncCommit = ({ entries, index, known }) => {
            if (transition.signal.aborted)
                return;
            this.#entries = entries;
            if (known) {
                this.#known = new Set([...this.#known, ...known]);
            }
            this.#currentIndex = index;
            // Let's trigger external state here
            // because it is the absolute point of
            // committing to using an entry
            //
            // If the entry came from an external source
            // then internal to getState the external source will be pulled from
            // only if the entry doesn't hold the state in memory
            //
            // TLDR I believe this will be no issue doing here, even if we end up
            // calling an external setState multiple times, it is better than
            // loss of the state
            this[NavigationSetState](this.currentEntry);
        };
        const asyncCommit = async (commit) => {
            if (committedCurrentEntryChange) {
                return;
            }
            committedCurrentEntryChange = true;
            syncCommit(commit);
            const { entriesChange } = commit;
            const promises = [
                transition.dispatchEvent(createEvent({
                    type: NavigationTransitionCommit,
                    transition,
                    entry,
                }))
            ];
            if (entriesChange) {
                promises.push(this.dispatchEvent(createEvent({
                    type: "entrieschange",
                    ...entriesChange
                })));
            }
            await Promise.all(promises);
        };
        const unsetTransition = async () => {
            await startEventPromise;
            if (!(typeof options?.index === "number" && options.entries))
                throw new InvalidStateError();
            const previous = this.entries();
            const previousKeys = previous.map(entry => entry.key);
            const keys = options.entries.map(entry => entry.key);
            const removedEntries = previous.filter(entry => !keys.includes(entry.key));
            const addedEntries = options.entries.filter(entry => !previousKeys.includes(entry.key));
            await asyncCommit({
                entries: options.entries,
                index: options.index,
                known: options.known,
                entriesChange: (removedEntries.length || addedEntries.length) ? {
                    removedEntries,
                    addedEntries,
                    updatedEntries: []
                } : undefined
            });
            await this.dispatchEvent(createEvent({
                type: "currententrychange",
            }));
            currentEntryChangeEvent = true;
            return entry;
        };
        const completeTransition = () => {
            if (givenNavigationType === Unset) {
                return unsetTransition();
            }
            const transitionResult = createNavigationTransition({
                currentEntry,
                currentIndex: this.#currentIndex,
                options,
                transition,
                known: this.#known,
                commit: asyncCommit,
                reportError: transition[NavigationTransitionRejected]
            });
            const microtask = new Promise(queueMicrotask);
            let promises = [];
            const iterator = transitionSteps(transitionResult)[Symbol.iterator]();
            const iterable = {
                [Symbol.iterator]: () => ({ next: () => iterator.next() }),
            };
            async function syncTransition() {
                for (const promise of iterable) {
                    if (isPromise(promise)) {
                        promises.push(Promise.allSettled([
                            promise
                        ]).then(([result]) => result));
                    }
                    if (transition[NavigationTransitionCommitIsManual] ||
                        (currentEntryChangeEvent && transition[NavigationTransitionIsAsync])) {
                        return asyncTransition().then(syncTransition);
                    }
                    if (transition.signal.aborted) {
                        break;
                    }
                }
                if (promises.length) {
                    return asyncTransition();
                }
            }
            async function asyncTransition() {
                const captured = [...promises];
                if (captured.length) {
                    promises = [];
                    const results = await Promise.all(captured);
                    const rejected = results.filter(isPromiseRejectedResult);
                    if (rejected.length === 1) {
                        throw await Promise.reject(rejected[0]);
                    }
                    else if (rejected.length) {
                        throw new AggregateError(rejected, rejected[0].reason?.message);
                    }
                }
                else if (!transition[NavigationTransitionIsOngoing]) {
                    await microtask;
                }
            }
            // console.log("Returning", { entry });
            return syncTransition()
                .then(() => transition[NavigationTransitionIsOngoing] ? undefined : microtask)
                .then(() => entry);
        };
        const dispose = async () => this.#dispose();
        function* transitionSteps(transitionResult) {
            const microtask = new Promise(queueMicrotask);
            const { currentEntryChange, navigate, waitForCommit, commit, abortController } = transitionResult;
            const navigateAbort = abortController.abort.bind(abortController);
            transition.signal.addEventListener("abort", navigateAbort, {
                once: true,
            });
            if (typeof navigationType === "string" || navigationType === Rollback) {
                const promise = currentEntry?.dispatchEvent(createEvent({
                    type: "navigatefrom",
                    intercept: transition[NavigationIntercept],
                    /**
                     * @deprecated
                     */
                    transitionWhile: transition[NavigationIntercept],
                }));
                if (promise)
                    yield promise;
            }
            if (typeof navigationType === "string") {
                yield transition.dispatchEvent(navigate);
            }
            if (!transition[NavigationTransitionCommitIsManual]) {
                commit();
            }
            yield waitForCommit;
            if (entry.sameDocument) {
                yield transition.dispatchEvent(currentEntryChange);
            }
            currentEntryChangeEvent = true;
            if (typeof navigationType === "string") {
                yield entry.dispatchEvent(createEvent({
                    type: "navigateto",
                    intercept: transition[NavigationIntercept],
                    /**
                     * @deprecated
                     */
                    transitionWhile: transition[NavigationIntercept],
                }));
            }
            yield dispose();
            if (!transition[NavigationTransitionPromises].size) {
                yield microtask;
            }
            yield transition.dispatchEvent({
                type: NavigationTransitionStartDeadline,
                transition,
                entry,
            });
            yield transition[NavigationTransitionWait]();
            transition.signal.removeEventListener("abort", navigateAbort);
            yield transition[NavigationTransitionFinish]();
            if (typeof navigationType === "string") {
                yield transition.dispatchEvent(createEvent({
                    type: "finish",
                    intercept: transition[NavigationIntercept],
                    /**
                     * @deprecated
                     */
                    transitionWhile: transition[NavigationIntercept],
                }));
                yield transition.dispatchEvent(createEvent({
                    type: "navigatesuccess",
                    intercept: transition[NavigationIntercept],
                    /**
                     * @deprecated
                     */
                    transitionWhile: transition[NavigationIntercept],
                }));
            }
        }
        const maybeSyncTransition = () => {
            try {
                return completeTransition();
            }
            catch (error) {
                return Promise.reject(error);
            }
        };
        return Promise.allSettled([maybeSyncTransition()])
            .then(async ([detail]) => {
            if (detail.status === "rejected") {
                await transition.dispatchEvent({
                    type: NavigationTransitionError,
                    error: detail.reason,
                    transition,
                    entry,
                });
            }
            await dispose();
            await transition.dispatchEvent({
                type: NavigationTransitionFinally,
                transition,
                entry,
            });
            await transition[NavigationTransitionWait]();
            if (this.#activeTransition === transition) {
                this.#activeTransition = undefined;
            }
            if (entry.sameDocument && typeof navigationType === "string") {
                performance.mark(`same-document-navigation-finish:${entry.id}`);
                performance.measure(`same-document-navigation:${entry.url}`, `same-document-navigation:${entry.id}`, `same-document-navigation-finish:${entry.id}`);
            }
        })
            .then(() => entry);
    };
    #dispose = async () => {
        // console.log(JSON.stringify({ known: [...this.#known], entries: this.#entries }));
        for (const known of this.#known) {
            const index = this.#entries.findIndex((entry) => entry.key === known.key);
            if (index !== -1) {
                // Still in use
                continue;
            }
            // No index, no longer known
            this.#known.delete(known);
            const event = createEvent({
                type: "dispose",
                entry: known,
            });
            this[NavigationDisposeState](known);
            await known.dispatchEvent(event);
            await this.dispatchEvent(event);
        }
        // console.log(JSON.stringify({ pruned: [...this.#known] }));
    };
    reload(options) {
        const { currentEntry } = this;
        if (!currentEntry)
            throw new InvalidStateError();
        const entry = this.#cloneNavigationHistoryEntry(currentEntry, options);
        return this.#pushEntry("reload", entry, undefined, options);
    }
    updateCurrentEntry(options) {
        const { currentEntry } = this;
        if (!currentEntry) {
            throw new InvalidStateError("Expected current entry");
        }
        // Instant change
        currentEntry[NavigationHistoryEntrySetState](options.state);
        this[NavigationSetState](currentEntry);
        const currentEntryChange = new NavigationCurrentEntryChangeEvent("currententrychange", {
            from: currentEntry,
            navigationType: undefined,
        });
        const entriesChange = createEvent({
            type: "entrieschange",
            addedEntries: [],
            removedEntries: [],
            updatedEntries: [
                currentEntry
            ]
        });
        return Promise.all([
            this.dispatchEvent(currentEntryChange),
            this.dispatchEvent(entriesChange)
        ]);
    }
}
function getPerformance() {
    if (typeof performance !== "undefined") {
        return performance;
    }
    /* c8 ignore start */
    return {
        now() {
            return Date.now();
        },
        mark() { },
        measure() { },
    };
    // const { performance: nodePerformance } = await import("perf_hooks");
    // return nodePerformance;
    /* c8 ignore end */
}

let navigation;
function getNavigation() {
    if (globalNavigation) {
        return globalNavigation;
    }
    if (navigation) {
        return navigation;
    }
    return (navigation = new Navigation());
}

let router;
function getRouter() {
    if (isRouter(router)) {
        return router;
    }
    const navigation = getNavigation();
    const local = new Router(navigation, "navigate");
    router = local;
    return local;
}
function route(...args) {
    let pattern, fn;
    if (args.length === 1) {
        [fn] = args;
    }
    else if (args.length === 2) {
        [pattern, fn] = args;
    }
    return routes(pattern).route(fn);
}
function routes(...args) {
    let router;
    if (!args.length) {
        router = new Router();
        getRouter().routes(router);
    }
    else if (args.length === 1) {
        const [arg] = args;
        if (isRouter(arg)) {
            router = arg;
            getRouter().routes(router);
        }
        else {
            const pattern = arg;
            router = new Router();
            getRouter().routes(pattern, router);
        }
    }
    else if (args.length >= 2) {
        const [pattern, routerArg] = args;
        router = routerArg ?? new Router();
        getRouter().routes(pattern, router);
    }
    return router;
}

export { Router, enableURLPatternCache, getRouter, getRouterRoutes, isRouter, route, routes, transitionEvent };
//# sourceMappingURL=routes-rollup.js.map
