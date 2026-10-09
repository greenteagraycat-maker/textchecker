/* Manhwa Translation Alignment Checker - client-side MVP */
const $=id=>document.getElementById(id);
const state={pages:[],pairs:[],selectedPage:null,issues:[],ocrRunning:false,sourceName:"translation.txt"};
const imageFiles=$("imageFiles"),txtFile=$("txtFile");
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2600)}
function natural(a,b){return a.localeCompare(b,undefined,{numeric:true,sensitivity:"base"})}
function basename(s){return s.replace(/\.[^.]+$/,"")}
function parseTxt(text){
 state.sourceName=txtFile.files[0]?.name||"translation.txt";
 const lines=text.replace(/\r\n?/g,"\n").split("\n");
 const headers=[],records=[];let page="";let i=0;
 while(i<lines.length){
  const raw=lines[i],trim=raw.trim();
  if(!trim){i++;continue}
  if(/^(?:page\s*)?\d{1,4}$/i.test(trim)&&!/[.!?]$/.test(trim)&&trim.length<=8){page=trim;headers.push({page,line:i+1,text:trim});i++;continue}
  const enLine=i+1,en=raw;i++;
  while(i<lines.length&&!lines[i].trim())i++;
  if(i>=lines.length){records.push({page,en,th:"",sourceLine:enLine,thLine:null,missingTH:true});break}
  const possible=lines[i];
  if(/^(?:page\s*)?\d{1,4}$/i.test(possible.trim())&&possible.trim().length<=8){records.push({page,en,th:"",sourceLine:enLine,thLine:null,missingTH:true});continue}
  records.push({page,en,th:possible,sourceLine:enLine,thLine:i+1});i++;
 }
 state.pairs=records.map((p,n)=>({...p,id:n+1,manualFlag:false}));
 state.headers=headers;
 checkAll();render();
}
function currentPageName(){return state.selectedPage?.label||""}
function pairsForPage(p){if(!p)return state.pairs;const pg=String(p.page||"").replace(/^0+/,"")||"0";return state.pairs.filter(x=>!x.page||((String(x.page).replace(/^0+/,"")||"0")===pg)||x.page===p.label||x.page===basename(p.label))}
function issuesForPair(p){
 const out=[];
 if(!p.en?.trim())out.push({kind:"bad",text:"ไม่มีข้อความต้นฉบับอังกฤษ"});
 if(!p.th?.trim())out.push({kind:"bad",text:"ไม่มีคำแปลไทย หรือบรรทัดคำแปลว่าง"});
 if(/[ \t]+$/.test(p.th||""))out.push({kind:"warn",text:"มี Space/Tab ท้ายบรรทัดไทย"});
 if(/[ \t]+$/.test(p.en||""))out.push({kind:"warn",text:"มี Space/Tab ท้ายบรรทัดต้นฉบับ"});
 if(p.manualFlag)out.push({kind:"warn",text:"ทำเครื่องหมายให้ตรวจสอบด้วยตนเอง"});
 return out;
}
function checkAll(){
 state.issues=[];
 state.pairs.forEach(p=>{const is=issuesForPair(p);is.forEach(x=>state.issues.push({...x,pair:p}))});
 // Row-count and likely merged translations are heuristics, never automatic certainty.
 state.pairs.forEach((p,i)=>{
  const th=(p.th||"").trim();
  if(th.length>180 && /[.!?。！？]\s+\S/.test(th))state.issues.push({kind:"warn",text:"คำแปลยาวและมีหลายประโยค อาจมีหลายกล่องถูกรวมกัน (โปรดตรวจภาพ)",pair:p});
  if((p.th||"").includes("\t"))state.issues.push({kind:"warn",text:"พบ Tab ในคำแปล",pair:p});
 });
 updateStats();renderIssues();renderReport();
}
function updateStats(){
 $("statPages").textContent=state.pages.length;
 $("statPairs").textContent=state.pairs.length;
 $("statIssues").textContent=state.issues.length;
 $("statSpaces").textContent=state.pairs.filter(p=>/[ \t]+$/.test(p.th||"")).length;
}
function renderPages(){
 const host=$("pageList");host.innerHTML="";
 if(!state.pages.length){host.innerHTML='<div class="empty">ยังไม่มีภาพ<br>อัปโหลดภาพเพื่อเริ่มต้น</div>';return}
 state.pages.forEach((p,i)=>{
  const b=document.createElement("button");b.className="page-item"+(state.selectedPage===p?" active":"");
  const img=document.createElement("img");img.className="thumb";img.src=p.url;
  const meta=document.createElement("span");meta.className="page-meta";
  const strong=document.createElement("strong");strong.textContent=p.label;
  const small=document.createElement("small");small.textContent=`หน้า ${i+1} · ${pairsForPage(p).length} คู่ที่จับคู่ได้`;
  meta.append(strong,small);b.append(img,meta);b.onclick=()=>{state.selectedPage=p;render();};host.append(b);
 });
}
function renderImage(){
 const v=$("imageViewer");v.innerHTML="";
 if(!state.selectedPage){v.innerHTML='<div class="empty">เลือกภาพจากรายการด้านซ้าย</div>';return}
 const img=document.createElement("img");img.src=state.selectedPage.url;img.alt=state.selectedPage.label;v.append(img);
 $("currentPageLabel").textContent=`${state.selectedPage.label} · ${pairsForPage(state.selectedPage).length} คู่ข้อความ (อิงหัวข้อหน้าใน TXT หากตรงกัน)`;
}
function renderRows(){
 const body=$("pairRows");body.innerHTML="";
 let arr=state.selectedPage?pairsForPage(state.selectedPage):state.pairs;
 if(!arr.length){body.innerHTML='<tr><td colspan="5" class="empty">ไม่มีคู่ข้อความในหน้านี้ หรือหัวข้อหน้าไม่ตรงกับชื่อภาพ</td></tr>';return}
 arr.forEach(p=>{
  const is=issuesForPair(p);const tr=document.createElement("tr");if(is.length)tr.className="flagged";
  const num=document.createElement("td");num.textContent=p.id;
  const en=document.createElement("td");en.className="source-text";en.textContent=p.en||"(ไม่มีข้อความอังกฤษ)";
  const thtd=document.createElement("td");const ta=document.createElement("textarea");ta.className="cell-input";ta.value=p.th||"";ta.setAttribute("aria-label",`คำแปลไทยรายการ ${p.id}`);ta.oninput=()=>{p.th=ta.value;checkAll();};thtd.append(ta);
  const status=document.createElement("td");const s=document.createElement("span");s.className="status "+(is.some(x=>x.kind==="bad")?"bad":is.length?"warn":"good");s.textContent=is.some(x=>x.kind==="bad")?"ขาดข้อมูล":is.length?"ควรตรวจ":"เบื้องต้นปกติ";status.append(s);
  const act=document.createElement("td");const actions=document.createElement("div");actions.className="row-actions";
  const split=document.createElement("button");split.className="icon-btn";split.textContent="แยก";split.title="แยกรายการนี้เป็นสองรายการ";split.onclick=()=>splitPair(p.id);
  const flag=document.createElement("button");flag.className="icon-btn";flag.textContent=p.manualFlag?"ยกเลิก":"ตรวจ";flag.title="ทำเครื่องหมายให้ตรวจสอบ";flag.onclick=()=>{p.manualFlag=!p.manualFlag;checkAll();renderRows()};
  const del=document.createElement("button");del.className="icon-btn";del.textContent="ลบ";del.title="ลบรายการนี้";del.onclick=()=>{if(confirm(`ลบรายการ ${p.id}?`)){state.pairs=state.pairs.filter(x=>x!==p);renumber();checkAll();render()}};
  actions.append(split,flag,del);act.append(actions);tr.append(num,en,thtd,status,act);body.append(tr);
 });
}
function renderIssues(){
 const host=$("issues");host.innerHTML="";
 if(!state.issues.length){host.innerHTML='<div class="issue ok">ไม่พบความผิดปกติจากกฎตรวจสอบเบื้องต้น (ยังควรตรวจเทียบกับภาพ)</div>';return}
 state.issues.slice(0,100).forEach(it=>{const d=document.createElement("div");d.className="issue "+(it.kind==="bad"?"error":"");d.textContent=`รายการ ${it.pair.id}${it.pair.page?` · หน้า ${it.pair.page}`:""} · ${it.text}`;host.append(d)});
 if(state.issues.length>100){const d=document.createElement("div");d.className="issue";d.textContent=`แสดง 100 จาก ${state.issues.length} รายการ`;host.append(d)}
}
function renderReport(){
 const spaces=state.pairs.filter(p=>/[ \t]+$/.test(p.th||""));
 const bad=state.issues.filter(x=>x.kind==="bad");
 const lines=[`รายงานตรวจสอบ: ${state.sourceName}`,`จำนวนภาพ: ${state.pages.length}`,`จำนวนคู่ข้อความ: ${state.pairs.length}`,`จุดที่ควรตรวจ: ${state.issues.length}`,`รายการขาดข้อมูล: ${bad.length}`,`พบ Space/Tab ท้ายบรรทัดไทย: ${spaces.length}`,""];
 if(spaces.length){lines.push("รายการที่พบช่องว่างท้ายคำแปล:");spaces.forEach(p=>lines.push(`- รายการ ${p.id}${p.page?` (หน้า ${p.page})`:""} · บรรทัด TXT ${p.thLine||"ไม่ทราบ"}`));}
 if(state.issues.length){lines.push("จุดที่ควรตรวจ:");state.issues.forEach(x=>lines.push(`- รายการ ${x.pair.id}${x.pair.page?` (หน้า ${x.pair.page})`:""}: ${x.text}`));}
 $("report").textContent=lines.join("\n");
}
function render(){renderPages();renderImage();renderRows();updateStats();renderIssues();renderReport()}
function renumber(){state.pairs.forEach((p,i)=>p.id=i+1)}
function splitPair(id){
 const p=state.pairs.find(x=>x.id===id);if(!p)return;
 const raw=prompt("ใส่คำแปลไทยส่วนที่ 1 (รายการเดิม):",p.th||"");if(raw===null)return;
 const second=prompt("ใส่คำแปลไทยส่วนที่ 2 (รายการใหม่):","");if(second===null)return;
 p.th=raw;const newP={...p,id:0,en:"[เพิ่มรายการ / ใส่ข้อความอังกฤษ]",th:second,sourceLine:p.sourceLine,thLine:p.thLine,manualFlag:true};
 state.pairs.splice(state.pairs.indexOf(p)+1,0,newP);renumber();checkAll();render();toast("แยกรายการแล้ว อย่าลืมแก้ข้อความอังกฤษของรายการใหม่");
}
function cleanSpaces(){
 let count=0;
 state.pairs.forEach(p=>{const before=p.th||"";const after=before.replace(/[ \t]+$/g,"");if(before!==after){p.th=after;count++}});
 state.pairs.forEach(p=>{p.en=(p.en||"").replace(/[ \t]+$/g,"")});
 checkAll();render();toast(`ลบ Space/Tab ท้ายบรรทัดคำแปล ${count} รายการ`);
}
function exportTxt(){
 const byPage=new Map();
 state.pairs.forEach(p=>{const key=p.page||"";if(!byPage.has(key))byPage.set(key,[]);byPage.get(key).push(p)});
 const parts=[];
 for(const [page,arr] of byPage){
  if(page&&$("includeHeaders").checked)parts.push(page);
  arr.forEach(p=>{
   if($("includeEnglish").checked&&p.en)parts.push((p.en||"").replace(/[ \t]+$/g,""));
   parts.push((p.th||"").replace(/[ \t]+$/g,""));
   if($("keepBlankLines").checked)parts.push("");
  });
  if(!$("keepBlankLines").checked)parts.push("");
 }
 const blob=new Blob([parts.join("\n").replace(/\n+$/,"\n")],{type:"text/plain;charset=utf-8"});
 const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=(state.sourceName.replace(/\.txt$/i,"")||"translation")+"_checked.txt";a.click();URL.revokeObjectURL(a.href);toast("ส่งออก TXT แล้ว");
}
async function doOCR(){
 if(!state.pages.length){toast("กรุณาอัปโหลดภาพก่อน");return}
 if(!window.Tesseract){toast("โหลด OCR ไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่");return}
 state.ocrRunning=true;$("runOcr").disabled=true;
 try{
  for(let i=0;i<state.pages.length;i++){
   const p=state.pages[i];$("ocrStatus").textContent=`กำลัง OCR ${i+1}/${state.pages.length}: ${p.label}`;
   const result=await Tesseract.recognize(p.file,"eng",{logger:m=>{if(m.status==="recognizing text")$("ocrStatus").textContent=`OCR ${p.label}: ${Math.round((m.progress||0)*100)}%`}});
   p.ocr=result.data.text||"";p.ocrWords=result.data.words||[];
  }
  $("ocrStatus").textContent="OCR เสร็จแล้ว · ข้อความ OCR ใช้เป็นข้อมูลช่วยตรวจ ไม่ได้จับคู่คำแปลให้อัตโนมัติ";
  if(state.selectedPage){$("ocrText").classList.remove("hidden");$("ocrText").textContent="ผล OCR: "+state.selectedPage.label+"\n"+(state.selectedPage.ocr||"");}
  toast("OCR เสร็จแล้ว");
 }catch(e){console.error(e);$("ocrStatus").textContent="OCR มีปัญหา: "+e.message;toast("OCR ไม่สำเร็จ")}
 finally{state.ocrRunning=false;$("runOcr").disabled=false}
}
imageFiles.addEventListener("change",()=>{
 state.pages.forEach(p=>URL.revokeObjectURL(p.url));
 state.pages=[...imageFiles.files].filter(f=>f.type.startsWith("image/")).sort((a,b)=>natural(a.name,b.name)).map((file,i)=>({file,label:file.name,index:i,url:URL.createObjectURL(file),page:basename(file.name)}));
 state.selectedPage=state.pages[0]||null;render();toast(`นำเข้าภาพ ${state.pages.length} ไฟล์`);
});
txtFile.addEventListener("change",async()=>{
 const f=txtFile.files[0];if(!f)return;
 const text=await f.text();parseTxt(text);toast(`อ่าน TXT แล้ว: ${state.pairs.length} คู่ข้อความ`);
});
$("runOcr").onclick=doOCR;
$("checkAll").onclick=()=>{checkAll();renderRows();toast("ตรวจสอบกฎทั้งหมดแล้ว")};
$("cleanSpaces").onclick=cleanSpaces;
$("exportTxt").onclick=exportTxt;
$("copyReport").onclick=async()=>{try{await navigator.clipboard.writeText($("report").textContent);toast("คัดลอกรายงานแล้ว")}catch{toast("คัดลอกไม่ได้ กรุณาเลือกข้อความรายงานแล้วคัดลอก")}};
$("loadDemo").onclick=()=>{
 state.pages=[];state.selectedPage=null;state.sourceName="demo_translation.txt";
 state.pairs=[
 {id:1,page:"001",en:"QUIETLY HAND OVER THE SPRING AUTUMN CICADA AND I'LL MAKE YOUR DEATH SWIFT!",th:"ส่งมอบจักจั่นสารทวสันต์มาแต่โดยดี แล้วข้าจะสงเคราะห์ให้แกตายอย่างรวดเร็ว!",sourceLine:3,thLine:4},
 {id:2,page:"001",en:"OLD BASTARD FANG! STOP STRUGGLING!",th:"ไอ้เฒ่าสารเลวฟาง หยุดดิ้นรนเสียที! ",sourceLine:6,thLine:7},
 {id:3,page:"001",en:"TODAY, ALL THE MAJOR RIGHTEOUS FACTIONS HAVE UNITED JUST TO DESTROY YOUR DEMONIC LAIR!",th:"วันนี้ เหล่าฝ่ายธรรมะรวมพลังกันเพื่อทำลายรังมารของแกโดยเฉพาะ!",sourceLine:9,thLine:10},
 {id:4,page:"002",en:"TODAY WILL SEE YOU DEAD!",th:"วันนี้จะเป็นวันตายของแก!",sourceLine:32,thLine:33}
 ];checkAll();render();toast("โหลดตัวอย่างแล้ว (มี Space ท้ายบรรทัดจำลอง 1 จุด)");
};
$("parseMode").addEventListener("change",()=>toast("การเปลี่ยนโหมดจะมีผลเมื่ออัปโหลด TXT ใหม่"));
