// ---- DOM ready wrapper + dialog polyfill ----
(function(){
  const onReady = (fn) => { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn); else fn(); };
  window.__dialogSupport = ('HTMLDialogElement' in window) && ('showModal' in document.createElement('dialog'));
  window.openModal = (el) => { if(!el) return; if(window.__dialogSupport){ try{ el.showModal(); }catch{ fallbackOpen(el);} } else fallbackOpen(el); };
  window.closeModal = (el) => { if(!el) return; if(window.__dialogSupport && el.open){ try{ el.close(); }catch{ el.removeAttribute('open'); } } else fallbackClose(el); };
  function fallbackOpen(el){ el.setAttribute('open',''); if(!el.__overlay){ const ov=document.createElement('div'); ov.style.position='fixed';ov.style.inset='0';ov.style.background='rgba(0,0,0,.35)';ov.style.backdropFilter='blur(2px)';ov.style.zIndex='9998';ov.addEventListener('click',()=>fallbackClose(el)); document.body.appendChild(ov); el.__overlay=ov; el.style.zIndex='9999'; el.style.position='fixed'; el.style.left='50%'; el.style.top='50%'; el.style.transform='translate(-50%, -50%)'; } else el.__overlay.style.display='block'; }
  function fallbackClose(el){ el.removeAttribute('open'); if(el.__overlay) el.__overlay.style.display='none'; }
  window.__onReady = onReady;
})();

__onReady(() => {
  const $ = (sel) => document.querySelector(sel);

  // elements
  const grid = $("#grid");
  const tileModal = $("#tileModal");
  const wolModal  = $("#wolModal");
  const bgModal   = $("#bgModal");
  const themeModal= $("#themeModal");
  const bgLayer = $("#bgLayer");
  const bgShade = $("#bgShade");

  // storage keys
  const LS = {
    tiles: "customTiles.v1",
    bg: "dashboard.bg.v1",
    theme: "dashboard.theme.v1",
    wol: "dashboard.wol.devices.v1",
    wolLast: "dashboard.wol.lastIndex.v1"
  };

  // defaults
  const DEFAULT_TILES = [
    { title:"Google", url:"https://www.google.com", desc:"Suche",  iconType:"auto", icon:"" },
    { title:"YouTube", url:"https://www.youtube.com", desc:"Videos", iconType:"auto", icon:"" },
    { title:"GitHub", url:"https://github.com", desc:"Code", iconType:"auto", icon:"" },
    { title:"Router", url:"http://192.168.1.1", desc:"Admin", iconType:"auto", icon:"" },
  ];
  const DEFAULT_BG = { type:"gradient", dataUrl:"", size:"cover", position:"center center", blur:0, dim:30 };
  const DEFAULT_THEME = { accent:"#8c7bff", accent2:"#27d3a2", bg1:"#0f1226", bg2:"#171a3a", topbarColor:"#0e1135", topbarOpacity:65 };

  // state
  let tiles = load(LS.tiles, DEFAULT_TILES);
  const bgState = load(LS.bg, DEFAULT_BG);
  const theme = load(LS.theme, DEFAULT_THEME);
  let wolDevices = load(LS.wol, []);

  // helpers
  function load(key, def){ try{ const raw=localStorage.getItem(key); return raw? JSON.parse(raw) : structuredClone(def);}catch{ return structuredClone(def);} }
  function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
  function ensureUrl(u){ if(!/^https?:\/\//i.test(u) && !/^ftp:\/\/\//i.test(u)) return "https://" + u; return u; }
  function faviconFor(u){ try{ const host=new URL(ensureUrl(u)).hostname; return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`; }catch{ return ""; } }
  function hexToRgb(hex){ const m=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); return m?{r:parseInt(m[1],16),g:parseInt(m[2],16),b:parseInt(m[3],16)}:null; }

  // scale image to ~128px
  function resizeToIconDataUrl(file, max = 128){
    return new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const s = max / Math.max(img.width, img.height);
          const w = Math.round(img.width * Math.min(s,1));
          const h = Math.round(img.height * Math.min(s,1));
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // theme / background
  function applyTheme(t){
    const root=document.documentElement;
    root.style.setProperty('--accent', t.accent);
    root.style.setProperty('--accent-2', t.accent2);
    root.style.setProperty('--bg1', t.bg1);
    root.style.setProperty('--bg2', t.bg2);
    const {r,g,b}=hexToRgb(t.topbarColor)||{r:14,g:17,b:53};
    const alpha=Math.round((t.topbarOpacity??65))/100;
    root.style.setProperty('--topbar-bg', `rgba(${r},${g},${b},${alpha})`);
    const tileAlpha=Math.min(Math.max(alpha*0.9,0.22),0.55);
    const tileAlphaHover=Math.min(tileAlpha+0.10,0.70);
    root.style.setProperty('--panel-bg', `rgba(${r},${g},${b},${tileAlpha})`);
    root.style.setProperty('--panel-bg-hover', `rgba(${r},${g},${b},${tileAlphaHover})`);
    root.style.setProperty('--panel-border', 'rgba(255,255,255,0.14)');
  }
  function applyBackground(bg){
    if(bg.type==="image" && bg.dataUrl){
      bgLayer.style.backgroundImage=`url('${bg.dataUrl}')`;
      bgLayer.style.backgroundSize=bg.size||"cover";
      bgLayer.style.backgroundPosition=bg.position||"center center";
      bgLayer.style.filter=bg.blur?`blur(${bg.blur}px)`:"none";
      bgShade.style.background=`rgba(0,0,0,${(bg.dim||0)/100})`;
    }else{
      bgLayer.style.backgroundImage="none"; bgLayer.style.filter="none"; bgShade.style.background="transparent";
    }
  }
  applyTheme(theme);
  applyBackground(bgState);

  // render tiles
  function render(){
    grid.innerHTML = "";
    tiles.forEach((t, idx) => {
      const a = document.createElement("a");
      a.href = ensureUrl(t.url);
      a.target = "_blank"; a.rel = "noopener noreferrer";
      a.className = "reset";

      const tile = document.createElement("div");
      tile.className = "tile";
      tile.title = t.url;

      const pin = document.createElement("button");
      pin.type="button"; pin.className="pin"; pin.textContent="…"; pin.title="Kachel bearbeiten/löschen";
      pin.addEventListener("click", (ev)=>{ ev.preventDefault(); ev.stopPropagation(); openEdit(idx); });
      tile.appendChild(pin);

      // favicon / custom icon
      const fav = document.createElement("div"); fav.className="favicon";
      const img = document.createElement("img"); img.alt="";
      const fb = document.createElement("div"); fb.className="fallback"; fb.textContent = initials(t.title);

      // pick source
      let src = "";
      if (t.iconType === "url" && t.icon) src = t.icon;
      else if (t.iconType === "upload" && t.icon) src = t.icon;
      else src = faviconFor(t.url);

      if (src) {
        img.src = src;
        img.onload = () => { img.style.display = "block"; fb.style.display = "none"; };
        img.onerror = () => { img.style.display = "none"; fb.style.display = "grid"; };
      } else {
        img.style.display = "none";
      }

      fav.appendChild(fb);
      fav.appendChild(img);
      tile.appendChild(fav);

      const title = document.createElement("div");
      title.className="title"; title.textContent=t.title;
      tile.appendChild(title);

      const desc = document.createElement("div");
      desc.className="desc"; desc.textContent = t.desc || safeHost(t.url);
      tile.appendChild(desc);

      a.appendChild(tile);
      grid.appendChild(a);
    });
  }

  function safeHost(u){ try{ return new URL(ensureUrl(u)).hostname; }catch{ return u; } }
  function initials(str){
    const parts = (str||"").trim().split(/\s+/).filter(Boolean);
    const chars = (parts[0]?.[0]||"").toUpperCase() + (parts[1]?.[0]||"").toUpperCase();
    return chars || "?";
  }

  // clock
  function updateClock(){
    const d = new Date();
    $("#dateTxt").textContent = d.toLocaleDateString(undefined, {weekday:"short", day:"2-digit", month:"short"});
    $("#timeTxt").textContent = d.toLocaleTimeString(undefined, {hour:"2-digit", minute:"2-digit"});
  }
  setInterval(updateClock,1000); updateClock();

  // search
  $("#searchForm").addEventListener("submit", (e)=>{
    e.preventDefault();
    const q = $("#searchInput").value.trim();
    if(!q) return;
    const isUrl = /^(https?:\/\/|ftp:\/\/)/i.test(q) || (q.includes(".") && !q.includes(" "));
    const target = isUrl ? ensureUrl(q) : `https://www.google.com/search?q=${encodeURIComponent(q)}`;
    window.open(target, "_blank", "noopener");
  });

  // add/edit tiles
  const iconPreviewImg = $("#iconPreviewImg");
  const iconPreviewFallback = $("#iconPreviewFallback");
  const iconUrlInput = $("#tileIconUrl");
  const iconFileInput = $("#tileIconFile");
  const iconPickBtn = document.getElementById("iconPickBtn");

  $("#addTileBtn").addEventListener("click", ()=>{
    $("#tileModalTitle").textContent="Kachel hinzufügen";
    $("#tileIndex").value="";
    $("#tileTitle").value=""; $("#tileUrl").value=""; $("#tileDesc").value="";
    setIconSource("auto"); setIconPreview("", $("#tileTitle").value);
    $("#deleteTileBtn").classList.add("hidden");
    resetDeleteButtonState();
    openModal(tileModal);
  });

  function openEdit(idx){
    const t = tiles[idx];
    $("#tileModalTitle").textContent="Kachel bearbeiten";
    $("#tileIndex").value=idx;
    $("#tileTitle").value=t.title;
    $("#tileUrl").value=t.url;
    $("#tileDesc").value=t.desc||"";
    setIconSource(t.iconType||"auto");
    if(t.iconType==="url"||t.iconType==="upload") setIconPreview(t.icon||"", t.title);
    else setIconPreview("", t.title);
    $("#deleteTileBtn").classList.remove("hidden");
    resetDeleteButtonState();
    openModal(tileModal);
  }

  // icon source controls
  Array.from(document.getElementsByName("iconSrc")).forEach(r=>{
    r.addEventListener("change", ()=>{
      const v = getIconSource();
      iconUrlInput.classList.toggle("hidden", v!=="url");
      iconFileInput.classList.toggle("hidden", v!=="upload");
      if (iconPickBtn) iconPickBtn.style.display = (v==="upload") ? "inline-block" : "none";

      if(v==="auto"){ setIconPreview("", $("#tileTitle").value); }
      if(v==="url" && iconUrlInput.value){ setIconPreview(iconUrlInput.value, $("#tileTitle").value); }
      if(v==="upload"){
        // Versuch, den Picker automatisch zu öffnen (manche Sandboxes blocken das -> Button als Fallback)
        requestAnimationFrame(()=>{ try{ iconFileInput.click(); }catch{} });
      }
    });
  });

  iconUrlInput.addEventListener("input", ()=>{
    const v = iconUrlInput.value.trim();
    setIconPreview(v, $("#tileTitle").value);
  });

  iconFileInput.addEventListener("change", async ()=>{
    const f = iconFileInput.files[0];
    if(!f) return;
    try{
      const dataUrl = await resizeToIconDataUrl(f, 128);
      setIconPreview(dataUrl, $("#tileTitle").value);
      iconFileInput.dataset.dataUrl = dataUrl; // später beim Speichern verwenden
    }catch{
      alert("Icon konnte nicht verarbeitet werden.");
    }
  });

  if (iconPickBtn) {
    iconPickBtn.addEventListener("click", () => {
      iconFileInput.click();
    });
  }

  function getIconSource(){
    const r = document.querySelector('input[name="iconSrc"]:checked');
    return r ? r.value : "auto";
  }
  function setIconSource(v){
    const radios = document.getElementsByName("iconSrc");
    Array.from(radios).forEach(r=> r.checked = (r.value===v));

    const showUrl = v === "url";
    const showUpload = v === "upload";

    iconUrlInput.classList.toggle("hidden", !showUrl);
    iconFileInput.classList.toggle("hidden", !showUpload);
    if (iconPickBtn) iconPickBtn.style.display = showUpload ? "inline-block" : "none";

    if (showUpload) {
      requestAnimationFrame(() => { try { iconFileInput.click(); } catch {} });
    } else {
      delete iconFileInput.dataset.dataUrl;
      iconFileInput.value = "";
    }
  }
  function setIconPreview(src, title){
    if(src){
      iconPreviewImg.src = src;
      iconPreviewImg.style.display="block";
      iconPreviewFallback.style.display="none";
    }else{
      iconPreviewImg.src = "";
      iconPreviewImg.style.display="none";
      iconPreviewFallback.textContent = initials(title||"");
      iconPreviewFallback.style.display="block";
    }
  }

  $("#tileTitle").addEventListener("input", ()=>{
    if(!iconPreviewImg.src) setIconPreview("", $("#tileTitle").value);
  });

  $("#saveTileBtn").addEventListener("click", ()=>{
    const idx = $("#tileIndex").value;
    const title = $("#tileTitle").value.trim();
    const url   = $("#tileUrl").value.trim();
    const desc  = $("#tileDesc").value.trim();
    if(!title || !url) return;

    let iconType = getIconSource();
    let icon = "";
    if(iconType==="url"){
      icon = (document.getElementById("tileIconUrl").value || "").trim();
      if(!icon) iconType="auto";
    }else if(iconType==="upload"){
      icon = document.getElementById("tileIconFile").dataset.dataUrl || "";
      if(!icon) iconType="auto";
    }

    const item = { title, url, desc, iconType, icon };

    if(idx===""){ tiles.push(item); }
    else{ tiles[Number(idx)] = item; }

    save(LS.tiles, tiles);
    render();
    closeModal(tileModal);
  });

  // Delete (2-Klick)
  let deleteArmedTimer = null;
  function resetDeleteButtonState(){
    const btn = $("#deleteTileBtn");
    btn.dataset.armed="false"; btn.textContent="Löschen"; btn.classList.remove("acc");
    if(deleteArmedTimer){ clearTimeout(deleteArmedTimer); deleteArmedTimer=null; }
  }
  $("#deleteTileBtn").addEventListener("click", ()=>{
    const btn = $("#deleteTileBtn");
    const armed = btn.dataset.armed==="true";
    const idx = $("#tileIndex").value;
    if(!armed){
      btn.dataset.armed="true"; btn.textContent="Zum Löschen erneut klicken"; btn.classList.add("acc");
      deleteArmedTimer = setTimeout(resetDeleteButtonState, 5000);
    }else{
      if(idx==="") return;
      tiles.splice(Number(idx),1); save(LS.tiles, tiles); render(); closeModal(tileModal); resetDeleteButtonState();
    }
  });

  // WOL basics (Geräteverwaltung ist in HTML/CSS vorbereitet – hier nur Öffnen/Schliessen)
  $("#wolBtn").addEventListener("click", ()=> openModal(wolModal));
  $("#wolCloseBtn").addEventListener("click", ()=> closeModal(wolModal));

  // Background
  $("#bgBtn").addEventListener("click", ()=>{
    $("#bgSize").value=bgState.size||"cover";
    $("#bgPos").value=bgState.position||"center center";
    $("#bgBlur").value=bgState.blur||0; $("#bgBlurVal").textContent=String(bgState.blur||0);
    $("#bgDim").value=bgState.dim??30;   $("#bgDimVal").textContent=String(bgState.dim??30);
    $("#bgFile").value="";
    openModal(bgModal);
  });
  $("#bgCloseBtn").addEventListener("click", ()=> closeModal(bgModal));
  $("#bgCancelBtn").addEventListener("click", ()=> closeModal(bgModal));
  $("#bgBlur").addEventListener("input", e => $("#bgBlurVal").textContent=e.target.value);
  $("#bgDim").addEventListener("input", e => $("#bgDimVal").textContent=e.target.value);
  $("#bgSaveBtn").addEventListener("click", async ()=>{
    const size=$("#bgSize").value, position=$("#bgPos").value;
    const blur=Number($("#bgBlur").value), dim=Number($("#bgDim").value);
    const file=$("#bgFile").files[0];
    const next={...bgState, type:"image", size, position, blur, dim};
    try{ if(file){ next.dataUrl = await (async file=>{
            const maxW=1920, maxH=1080;
            const reader=new FileReader();
            const data=await new Promise((res,rej)=>{ reader.onerror=rej; reader.onload=()=>res(reader.result); reader.readAsDataURL(file); });
            const img=new Image();
            await new Promise((res,rej)=>{ img.onload=res; img.onerror=rej; img.src=data; });
            const r=Math.min(maxW/img.width, maxH/img.height, 1);
            if(r<1){ const c=document.createElement("canvas"); c.width=Math.round(img.width*r); c.height=Math.round(img.height*r);
              c.getContext("2d").drawImage(img,0,0,c.width,c.height); return c.toDataURL("image/jpeg",0.9); }
            return data;
          })(file); }
      Object.assign(bgState,next); save(LS.bg, bgState); applyBackground(bgState); closeModal(bgModal);
    }catch{ alert("Bild konnte nicht verarbeitet werden."); }
  });
  $("#bgResetBtn").addEventListener("click", ()=>{
    const def = {...DEFAULT_BG}; Object.assign(bgState, def); save(LS.bg, bgState); applyBackground(bgState); closeModal(bgModal);
  });

  // Theme
  $("#themeBtn").addEventListener("click", ()=>{
    $("#thAccent").value=theme.accent; $("#thAccent2").value=theme.accent2;
    $("#thBg1").value=theme.bg1; $("#thBg2").value=theme.bg2;
    $("#thTopbarColor").value=theme.topbarColor;
    $("#thTopbarOpacity").value=theme.topbarOpacity??65; $("#thTopbarOpacityVal").textContent=String(theme.topbarOpacity??65);
    openModal(themeModal);
  });
  $("#themeCloseBtn").addEventListener("click", ()=> closeModal(themeModal));
  $("#themeCancelBtn").addEventListener("click", ()=> closeModal(themeModal));
  $("#thTopbarOpacity").addEventListener("input", e => $("#thTopbarOpacityVal").textContent=e.target.value);
  $("#themeSaveBtn").addEventListener("click", ()=>{
    theme.accent=$("#thAccent").value;
    theme.accent2=$("#thAccent2").value;
    theme.bg1=$("#thBg1").value;
    theme.bg2=$("#thBg2").value;
    theme.topbarColor=$("#thTopbarColor").value;
    theme.topbarOpacity=Number($("#thTopbarOpacity").value);
    save(LS.theme, theme); applyTheme(theme); closeModal(themeModal);
  });
  $("#themeResetBtn").addEventListener("click", ()=>{
    Object.assign(theme, DEFAULT_THEME); save(LS.theme, theme); applyTheme(theme); closeModal(themeModal);
  });

  // init
  render();
});