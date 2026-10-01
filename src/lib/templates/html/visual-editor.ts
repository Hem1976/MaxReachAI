/** Visual email editor chrome. Safe to import from client and server. */

export const EDITOR_STYLE_ATTR = "data-mx-editor";

export function stripEditorChrome(html: string): string {
  let clean = html
    .replace(/<style[^>]*data-mx-editor[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*data-mx-editor[\s\S]*?<\/script>/gi, "")
    .replace(/<div id="mx-selection-box"[\s\S]*?<\/div>/gi, "")
    .replace(/<div[^>]*class="mx-handle[\s\S]*?<\/div>/gi, "")
    .replace(/\sdata-mx-selected="1"/gi, "")
    .replace(/\sdata-mx-editing="1"/gi, "")
    .replace(/\sdata-mx-draggable="1"/gi, "")
    .replace(/\sdraggable="true"/gi, "")
    .replace(/\scontenteditable="true"/gi, "")
    .replace(/\sspellcheck="true"/gi, "");

  return clean;
}

/** Flatten the free overlay layer for email clients while keeping absolute positions. */
export function flattenFreeLayer(html: string): string {
  return html.replace(
    /<div[^>]*id="mx-free-layer"[^>]*>([\s\S]*?)<\/div>/gi,
    "$1",
  );
}

export function applyEditorChrome(html: string): string {
  const clean = stripEditorChrome(html);
  if (clean.includes("data-mx-editor")) return clean;
  if (/<\/body>/i.test(clean)) {
    return clean.replace(/<\/body>/i, `${VISUAL_EDITOR_CHROME}</body>`);
  }
  return `${clean}${VISUAL_EDITOR_CHROME}`;
}

export const VISUAL_EDITOR_CHROME = `
<style data-mx-editor>
  html,body{overflow:visible !important;height:auto !important;min-height:0 !important;margin:0;padding:0;overscroll-behavior:contain;}
  body{position:relative !important;}
  td[height="100%"],td[height="100%"]{height:auto !important;}
  tr[aria-hidden="true"] td{height:auto !important;}
  #mx-free-layer{position:absolute;left:0;top:0;width:100%;min-height:100%;pointer-events:none;z-index:40;}
  #mx-free-layer>*{pointer-events:auto;}
  [data-slot],[data-mx-block],[data-mx-free]{outline:1px dashed rgba(111,225,209,.35);}
  [data-mx-selected="1"]{outline:2px solid #20a4b8 !important;}
  [data-mx-free],[data-mx-block],img[data-mx-selected="1"]{cursor:move;touch-action:none;}
  [data-mx-editing="1"]{cursor:text !important;outline:2px solid #20a4b8 !important;}
  #mx-selection-box{position:fixed;border:2px solid #20a4b8;pointer-events:none;z-index:9998;box-sizing:border-box;display:none;}
  .mx-handle{position:fixed;width:11px;height:11px;background:#fff;border:2px solid #20a4b8;border-radius:2px;z-index:9999;display:none;box-sizing:border-box;}
  .mx-handle-se{cursor:nwse-resize;}
  .mx-handle-e{cursor:ew-resize;}
</style>
<script data-mx-editor>
(function(){
  var selected = null;
  var editing = false;
  var dragging = false;
  var dragActive = false;
  var resizing = false;
  var zCounter = 50;
  var dragStartX = 0;
  var dragStartY = 0;
  var dragOriginLeft = 0;
  var dragOriginTop = 0;
  var resizeStartX = 0;
  var resizeStartW = 0;
  var emitTimer = null;
  var sizeTimer = null;

  var freeLayer = document.createElement("div");
  freeLayer.id = "mx-free-layer";
  document.body.appendChild(freeLayer);

  var selectionBox = document.createElement("div");
  selectionBox.id = "mx-selection-box";
  document.body.appendChild(selectionBox);

  var handleSe = document.createElement("div");
  handleSe.className = "mx-handle mx-handle-se";
  document.body.appendChild(handleSe);

  var handleE = document.createElement("div");
  handleE.className = "mx-handle mx-handle-e";
  document.body.appendChild(handleE);

  function isChrome(el){
    if (!el || el.nodeType !== 1) return true;
    if (el.id === "mx-free-layer" || el.id === "mx-selection-box") return true;
    if (el.classList && el.classList.contains("mx-handle")) return true;
    return false;
  }

  function isLocked(el){
    if (!el || el === document.body || el === document.documentElement) return true;
    return isChrome(el);
  }

  function selectable(el){
    if (!el || isLocked(el)) return null;
    if (el.closest && el.closest("#mx-free-layer")) {
      if (el.tagName === "IMG" || el.getAttribute("data-mx-block") || el.getAttribute("data-mx-free")) return el;
    }
    if (el.tagName === "IMG") return el;
    if (el.getAttribute && (el.getAttribute("data-slot") || el.getAttribute("data-mx-block") || el.getAttribute("data-mx-free"))) return el;
    if (/^(P|H1|H2|H3|H4|DIV|STRONG|SPAN|A)$/.test(el.tagName)) return el;
    return null;
  }

  function closestSelectable(el){
    var node = el;
    while (node && node !== document.body) {
      var hit = selectable(node);
      if (hit) return hit;
      node = node.parentElement;
    }
    return null;
  }

  function ensureFreeLayer(){
    if (!document.body.contains(freeLayer)) document.body.appendChild(freeLayer);
  }

  function parsePx(value){
    var n = parseFloat(String(value || "0"));
    return isNaN(n) ? 0 : n;
  }

  function makeFree(el){
    if (!el || el.getAttribute("data-mx-free") === "1") return el;
    ensureFreeLayer();
    var bodyRect = document.body.getBoundingClientRect();
    var rect = el.getBoundingClientRect();
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
    var scrollLeft = window.pageXOffset || document.documentElement.scrollLeft || 0;
    var left = rect.left - bodyRect.left + scrollLeft;
    var top = rect.top - bodyRect.top + scrollTop;
    var width = Math.max(40, rect.width);

    if (el.parentNode) el.parentNode.removeChild(el);

    el.setAttribute("data-mx-free", "1");
    el.style.position = "absolute";
    el.style.left = Math.round(left) + "px";
    el.style.top = Math.round(top) + "px";
    el.style.width = Math.round(width) + "px";
    el.style.margin = "0";
    el.style.maxWidth = "none";
    el.style.zIndex = String(zCounter++);
    el.style.boxSizing = "border-box";

    if (el.tagName === "IMG") {
      el.style.height = "auto";
      el.style.display = "block";
      el.removeAttribute("width");
    }

    freeLayer.appendChild(el);
    return el;
  }

  function stopEditing(){
    if (!selected || !editing) return;
    selected.removeAttribute("contenteditable");
    selected.removeAttribute("spellcheck");
    selected.removeAttribute("data-mx-editing");
    editing = false;
  }

  function startEditing(el){
    if (!el || el.tagName === "IMG") return;
    stopEditing();
    select(el);
    makeFree(el);
    el.setAttribute("contenteditable", "true");
    el.setAttribute("spellcheck", "true");
    el.setAttribute("data-mx-editing", "1");
    editing = true;
    el.focus({ preventScroll: true });
  }

  function hideOverlay(){
    selectionBox.style.display = "none";
    handleSe.style.display = "none";
    handleE.style.display = "none";
  }

  function placeOverlay(){
    if (!selected || editing) {
      hideOverlay();
      return;
    }
    var rect = selected.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      hideOverlay();
      return;
    }
    selectionBox.style.display = "block";
    selectionBox.style.left = rect.left + "px";
    selectionBox.style.top = rect.top + "px";
    selectionBox.style.width = rect.width + "px";
    selectionBox.style.height = rect.height + "px";

    handleSe.style.display = "block";
    handleSe.style.left = (rect.right - 6) + "px";
    handleSe.style.top = (rect.bottom - 6) + "px";

    handleE.style.display = "block";
    handleE.style.left = (rect.right - 6) + "px";
    handleE.style.top = (rect.top + rect.height / 2 - 6) + "px";
  }

  function reportSize(){
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
    var maxBottom = 0;
    document.querySelectorAll("body *").forEach(function(el){
      if (isChrome(el)) return;
      var rect = el.getBoundingClientRect();
      if (rect.height <= 0) return;
      maxBottom = Math.max(maxBottom, rect.bottom + scrollTop);
    });
    if (maxBottom <= 0) maxBottom = document.body.offsetHeight || 400;
    window.parent.postMessage({ type: "maxreach-size", height: Math.ceil(maxBottom) + 8 }, "*");
  }

  function scheduleReportSize(){
    clearTimeout(sizeTimer);
    sizeTimer = setTimeout(function(){
      window.requestAnimationFrame(reportSize);
    }, 32);
  }

  function reportSelection(){
    if (!selected) {
      window.parent.postMessage({ type: "maxreach-selection", kind: "none" }, "*");
      return;
    }
    if (selected.tagName === "IMG") {
      var w = Math.round(selected.getBoundingClientRect().width || parsePx(selected.style.width) || 200);
      window.parent.postMessage({ type: "maxreach-selection", kind: "image", width: w }, "*");
      return;
    }
    window.parent.postMessage({ type: "maxreach-selection", kind: "text", width: Math.round(selected.getBoundingClientRect().width || parsePx(selected.style.width) || 200) }, "*");
  }

  function emitHtmlNow(){
    hideOverlay();
    var clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll("#mx-selection-box,.mx-handle").forEach(function(node){
      node.parentNode.removeChild(node);
    });
    var layer = clone.querySelector("#mx-free-layer");
    if (layer && layer.parentNode) {
      while (layer.firstChild) layer.parentNode.insertBefore(layer.firstChild, layer);
      layer.parentNode.removeChild(layer);
    }
    window.parent.postMessage({ type: "maxreach-html", html: "<!doctype html>" + clone.outerHTML }, "*");
    scheduleReportSize();
    if (selected) placeOverlay();
  }

  function emitHtml(){
    clearTimeout(emitTimer);
    emitTimer = setTimeout(emitHtmlNow, 160);
  }

  function emitSlot(el){
    var slot = el && el.getAttribute && el.getAttribute("data-slot");
    if (!slot) return;
    window.parent.postMessage({ type: "maxreach-slot", slot: slot, value: (el.innerText || "").trim() }, "*");
  }

  function select(el){
    if (selected === el) return;
    stopEditing();
    if (selected) selected.removeAttribute("data-mx-selected");
    selected = el;
    if (selected) selected.setAttribute("data-mx-selected", "1");
    placeOverlay();
    reportSelection();
  }

  function deselect(){
    stopEditing();
    if (selected) selected.removeAttribute("data-mx-selected");
    selected = null;
    hideOverlay();
    reportSelection();
  }

  function setElementWidth(el, width){
    var w = Math.max(40, Math.min(640, Math.round(width)));
    el.style.width = w + "px";
    el.style.maxWidth = "none";
    if (el.tagName === "IMG") {
      el.style.height = "auto";
      el.style.display = "block";
    }
  }

  function viewportCenter(){
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
    var scrollLeft = window.pageXOffset || document.documentElement.scrollLeft || 0;
    var viewH = window.innerHeight || 600;
    var viewW = window.innerWidth || 600;
    return {
      left: Math.max(16, scrollLeft + viewW / 2 - 120),
      top: Math.max(16, scrollTop + viewH / 2 - 40),
    };
  }

  function addText(){
    stopEditing();
    ensureFreeLayer();
    var center = viewportCenter();
    var box = document.createElement("div");
    box.setAttribute("data-mx-block", "text");
    box.setAttribute("data-mx-free", "1");
    box.style.position = "absolute";
    box.style.left = Math.round(center.left) + "px";
    box.style.top = Math.round(center.top) + "px";
    box.style.width = "240px";
    box.style.padding = "8px 10px";
    box.style.margin = "0";
    box.style.fontSize = "15px";
    box.style.lineHeight = "1.6";
    box.style.fontFamily = "Arial,Helvetica,sans-serif";
    box.style.color = "#222";
    box.style.background = "rgba(255,255,255,.92)";
    box.style.zIndex = String(zCounter++);
    box.style.boxSizing = "border-box";
    box.textContent = "New text";
    freeLayer.appendChild(box);
    select(box);
    startEditing(box);
    emitHtmlNow();
  }

  function insertImage(url){
    if (selected && selected.tagName === "IMG") {
      selected.setAttribute("src", url);
      selected.addEventListener("load", scheduleReportSize, { once: true });
      emitHtmlNow();
      return;
    }
    ensureFreeLayer();
    var center = viewportCenter();
    var img = document.createElement("img");
    img.setAttribute("data-mx-block", "image");
    img.setAttribute("data-mx-free", "1");
    img.setAttribute("src", url);
    img.setAttribute("alt", "");
    img.style.position = "absolute";
    img.style.left = Math.round(center.left) + "px";
    img.style.top = Math.round(center.top) + "px";
    img.style.width = "200px";
    img.style.height = "auto";
    img.style.display = "block";
    img.style.margin = "0";
    img.style.border = "0";
    img.style.zIndex = String(zCounter++);
    img.style.boxSizing = "border-box";
    freeLayer.appendChild(img);
    img.addEventListener("load", scheduleReportSize, { once: true });
    select(img);
    emitHtmlNow();
  }

  function deleteSelected(){
    if (!selected || isLocked(selected)) return;
    var victim = selected;
    deselect();
    if (victim.parentNode) victim.parentNode.removeChild(victim);
    emitHtmlNow();
  }

  function layerStep(direction){
    if (!selected) return;
    makeFree(selected);
    var step = direction === "forward" ? 1 : -1;
    var current = parseInt(selected.style.zIndex || "1", 10) || 1;
    selected.style.zIndex = String(Math.max(1, current + step));
    zCounter = Math.max(zCounter, current + step + 1);
    emitHtmlNow();
  }

  document.querySelectorAll("a").forEach(function(a){
    a.addEventListener("click", function(e){ e.preventDefault(); });
  });

  document.addEventListener("mousedown", function(e){
    if (e.target === handleSe) {
      if (!selected) return;
      e.preventDefault();
      resizing = true;
      resizeStartX = e.clientX;
      resizeStartW = selected.getBoundingClientRect().width;
      return;
    }
    if (e.target === handleE) {
      if (!selected) return;
      e.preventDefault();
      resizing = true;
      resizeStartX = e.clientX;
      resizeStartW = selected.getBoundingClientRect().width;
      return;
    }
    if (isChrome(e.target)) return;

    var el = closestSelectable(e.target);
    if (!el) {
      deselect();
      return;
    }

    if (editing && el !== selected) stopEditing();

    select(el);
    makeFree(el);

    if (editing) return;

    dragging = true;
    dragActive = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragOriginLeft = parsePx(el.style.left);
    dragOriginTop = parsePx(el.style.top);
    e.preventDefault();
  });

  document.addEventListener("dblclick", function(e){
    var el = closestSelectable(e.target);
    if (!el) return;
    if (el.tagName === "IMG") {
      window.parent.postMessage({ type: "maxreach-pick-image", mode: "replace" }, "*");
      return;
    }
    startEditing(el);
    e.preventDefault();
  });

  document.addEventListener("mousemove", function(e){
    if (resizing && selected) {
      var next = resizeStartW + (e.clientX - resizeStartX);
      setElementWidth(selected, next);
      placeOverlay();
      reportSelection();
      return;
    }
    if (!dragging || !selected || editing) return;
    var dx = e.clientX - dragStartX;
    var dy = e.clientY - dragStartY;
    if (!dragActive && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    dragActive = true;
    selected.style.left = Math.round(dragOriginLeft + dx) + "px";
    selected.style.top = Math.round(dragOriginTop + dy) + "px";
    placeOverlay();
  });

  document.addEventListener("mouseup", function(){
    if (resizing) {
      resizing = false;
      emitHtmlNow();
    } else if (dragging) {
      dragging = false;
      if (dragActive) emitHtmlNow();
      dragActive = false;
    }
  });

  document.addEventListener("input", function(e){
    emitSlot(e.target);
    emitHtml();
    scheduleReportSize();
    placeOverlay();
  });

  document.addEventListener("keydown", function(e){
    if (!selected || editing) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      deleteSelected();
    }
  });

  window.addEventListener("scroll", placeOverlay, { passive: true });
  window.addEventListener("resize", function(){
    placeOverlay();
    scheduleReportSize();
  });

  window.addEventListener("message", function(event){
    var data = event.data || {};
    if (data.type === "maxreach-add-text") addText();
    if (data.type === "maxreach-delete") deleteSelected();
    if (data.type === "maxreach-layer" && (data.direction === "forward" || data.direction === "backward")) {
      layerStep(data.direction);
    }
    if (data.type === "maxreach-set-width" && selected) {
      setElementWidth(selected, data.width);
      placeOverlay();
      reportSelection();
      emitHtmlNow();
    }
    if (data.type === "maxreach-set-image-url" && data.url) insertImage(data.url);
  });

  document.querySelectorAll("img").forEach(function(img){
    if (!img.complete) img.addEventListener("load", scheduleReportSize, { once: true });
  });

  document.querySelectorAll("[data-mx-free]").forEach(function(el){
    if (isChrome(el) || el.parentNode === freeLayer) return;
    freeLayer.appendChild(el);
  });

  document.querySelectorAll("body *").forEach(function(el){
    if (isChrome(el) || el.parentNode === freeLayer) return;
    if (window.getComputedStyle(el).position !== "absolute") return;
    el.setAttribute("data-mx-free", "1");
    freeLayer.appendChild(el);
  });

  if (window.ResizeObserver) {
    new ResizeObserver(function(){
      scheduleReportSize();
      placeOverlay();
    }).observe(document.body);
  }

  scheduleReportSize();
  emitHtmlNow();
})();
</script>
`;
