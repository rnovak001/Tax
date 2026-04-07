const ENTITY_TYPES = [
  { type: "U.S. Corporation", shape: "rect", fill: "#ffffff" },
  { type: "Controlled Foreign Corporation", shape: "rect", fill: "#f6bf00" },
  { type: "U.S. Disregarded Entity", shape: "roundedRect", fill: "#69d1d3" },
  { type: "Foreign Disregarded Entity", shape: "roundedRect", fill: "#91cc4e" },
  { type: "U.S. Partnership", shape: "triangle", fill: "#d777c9" },
  { type: "Controlled Foreign Partnership", shape: "triangle", fill: "#9d67cc" },
  { type: "Branch", shape: "ellipse", fill: "#91cc4e" },
  { type: "Individual", shape: "circle", fill: "#cedce7" },
  { type: "Unrelated", shape: "octagon", fill: "#d7d7d7" },
];

const ENTITY_LOOKUP = Object.fromEntries(ENTITY_TYPES.map((x) => [x.type, x]));
const SIDES = ["top", "right", "bottom", "left"];
const svgNS = "http://www.w3.org/2000/svg";
const uid = () => crypto.randomUUID().slice(0, 8);

const state = {
  mode: "select",
  zoom: 1,
  panX: 0,
  panY: 0,
  entities: [],
  descriptions: [],
  relationships: [],
  selection: null,
  connectBuffer: null,
  dragEntityId: null,
  dragDescId: null,
  dragOrigin: null,
  panOrigin: null,
};

const el = {
  palette: document.getElementById("entityPalette"),
  modeSwitcher: document.getElementById("modeSwitcher"),
  modeLabel: document.getElementById("modeLabel"),
  canvas: document.getElementById("canvas"),
  viewport: document.getElementById("viewport"),
  selectionHint: document.getElementById("selectionHint"),
  entityEditor: document.getElementById("entityEditor"),
  relationshipEditor: document.getElementById("relationshipEditor"),
  descriptionEditor: document.getElementById("descriptionEditor"),
  entityLabel: document.getElementById("entityLabel"),
  entityType: document.getElementById("entityType"),
  entityJurisdiction: document.getElementById("entityJurisdiction"),
  entityStackCount: document.getElementById("entityStackCount"),
  entityLineStyle: document.getElementById("entityLineStyle"),
  entityShading: document.getElementById("entityShading"),
  entityX: document.getElementById("entityX"),
  innerLineStyle: document.getElementById("innerLineStyle"),
  innerShading: document.getElementById("innerShading"),
  relLabel: document.getElementById("relLabel"),
  relPercent: document.getElementById("relPercent"),
  relKind: document.getElementById("relKind"),
  relColor: document.getElementById("relColor"),
  relLineStyle: document.getElementById("relLineStyle"),
  relArrowBoth: document.getElementById("relArrowBoth"),
  relReverseArrow: document.getElementById("relReverseArrow"),
  relFromSide: document.getElementById("relFromSide"),
  relToSide: document.getElementById("relToSide"),
  descText: document.getElementById("descText"),
  deleteDesc: document.getElementById("deleteDesc"),
  deleteEntity: document.getElementById("deleteEntity"),
  deleteRel: document.getElementById("deleteRel"),
  addDescription: document.getElementById("addDescription"),
  saveBtn: document.getElementById("saveBtn"),
  savedDiagrams: document.getElementById("savedDiagrams"),
  template: document.getElementById("saveItemTemplate"),
};

function shapeMetrics(shape) {
  if (shape === "triangle") return { w: 150, h: 84 };
  if (shape === "circle") return { w: 90, h: 90 };
  if (shape === "ellipse") return { w: 128, h: 80 };
  if (shape === "octagon") return { w: 90, h: 90 };
  return { w: 172, h: 76 };
}

function entityById(id) { return state.entities.find((x) => x.id === id); }
function relById(id) { return state.relationships.find((x) => x.id === id); }
function descById(id) { return state.descriptions.find((x) => x.id === id); }

function center(e) { return { x: e.x + e.w / 2, y: e.y + e.h / 2 }; }
function anchor(entity, side) {
  if (side === "top") return { x: entity.x + entity.w / 2, y: entity.y };
  if (side === "right") return { x: entity.x + entity.w, y: entity.y + entity.h / 2 };
  if (side === "bottom") return { x: entity.x + entity.w / 2, y: entity.y + entity.h };
  return { x: entity.x, y: entity.y + entity.h / 2 };
}

function autoSide(from, to) {
  const a = center(from); const b = center(to);
  const dx = b.x - a.x; const dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? ["right", "left"] : ["left", "right"];
  return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"];
}

function addEntity(type) {
  const spec = ENTITY_LOOKUP[type] || ENTITY_TYPES[0];
  const dims = shapeMetrics(spec.shape);
  state.entities.push({
    id: uid(), type: spec.type, label: spec.type, jurisdiction: "", shape: spec.shape, fill: spec.fill,
    stackCount: 1, lineStyle: "solid", shaded: false, showX: false, innerLineStyle: "solid", innerShaded: false,
    x: 170 + (state.entities.length % 6) * 190, y: 130 + Math.floor(state.entities.length / 6) * 135, w: dims.w, h: dims.h,
  });
  render();
}

function addDescription() {
  state.descriptions.push({ id: uid(), text: "Description", x: 640, y: 120 });
  render();
}

function addRelationship(fromId, toId, kind) {
  const from = entityById(fromId); const to = entityById(toId);
  const [fromSide, toSide] = autoSide(from, to);
  const isOwnership = kind === "ownership";
  state.relationships.push({
    id: uid(), fromId, toId, fromSide, toSide,
    kind, label: isOwnership ? "Ownership" : "Debt", percent: "",
    color: isOwnership ? "#202f4a" : "#d11f1f", dashed: !isOwnership,
    arrowBoth: false, reverseArrow: false,
  });
  render();
}

function setSelection(sel) {
  state.selection = sel;
  el.entityEditor.classList.add("hidden");
  el.relationshipEditor.classList.add("hidden");
  el.descriptionEditor.classList.add("hidden");

  if (!sel) { el.selectionHint.textContent = "Nothing selected"; render(); return; }

  if (sel.type === "entity") {
    const entity = entityById(sel.id); if (!entity) return;
    el.selectionHint.textContent = `Selected entity: ${entity.label}`;
    el.entityEditor.classList.remove("hidden");
    el.entityLabel.value = entity.label; el.entityType.value = entity.type; el.entityJurisdiction.value = entity.jurisdiction;
    el.entityStackCount.value = entity.stackCount; el.entityLineStyle.value = entity.lineStyle; el.entityShading.value = entity.shaded ? "shaded" : "none";
    el.entityX.checked = Boolean(entity.showX); el.innerLineStyle.value = entity.innerLineStyle; el.innerShading.value = entity.innerShaded ? "shaded" : "none";
  } else if (sel.type === "relationship") {
    const rel = relById(sel.id); if (!rel) return;
    el.selectionHint.textContent = `Selected relationship: ${rel.label}`;
    el.relationshipEditor.classList.remove("hidden");
    el.relLabel.value = rel.label; el.relPercent.value = rel.percent; el.relKind.value = rel.kind; el.relColor.value = rel.color;
    el.relLineStyle.value = rel.dashed ? "dashed" : "solid"; el.relArrowBoth.checked = rel.arrowBoth; el.relReverseArrow.checked = rel.reverseArrow;
    el.relFromSide.value = rel.fromSide; el.relToSide.value = rel.toSide;
  } else {
    const desc = descById(sel.id); if (!desc) return;
    el.selectionHint.textContent = "Selected description";
    el.descriptionEditor.classList.remove("hidden");
    el.descText.value = desc.text;
  }
  render();
}

function applyShapeStyle(node, entity, isInner = false) {
  const ls = (isInner ? entity.innerLineStyle : entity.lineStyle) === "dashed" ? "6 4" : null;
  node.setAttribute("class", isInner ? "inner-shape" : "shape");
  if (ls) node.setAttribute("stroke-dasharray", ls);
}

function createShape(entity, dx = 0, dy = 0) {
  const nodes = []; const fill = entity.shaded ? shade(entity.fill, -0.1) : entity.fill;
  const x = entity.x + dx; const y = entity.y + dy;
  if (entity.shape === "rect") {
    const n = document.createElementNS(svgNS, "rect"); n.setAttribute("x", x); n.setAttribute("y", y); n.setAttribute("width", entity.w); n.setAttribute("height", entity.h); n.setAttribute("fill", fill); applyShapeStyle(n, entity); nodes.push(n); return nodes;
  }
  if (entity.shape === "roundedRect") {
    const r = document.createElementNS(svgNS, "rect"); r.setAttribute("x", x); r.setAttribute("y", y); r.setAttribute("width", entity.w); r.setAttribute("height", entity.h); r.setAttribute("fill", fill); applyShapeStyle(r, entity); nodes.push(r);
    const o = document.createElementNS(svgNS, "ellipse"); o.setAttribute("cx", x + entity.w / 2); o.setAttribute("cy", y + entity.h / 2); o.setAttribute("rx", entity.w / 2 - 2); o.setAttribute("ry", entity.h / 2 - 2); o.setAttribute("fill", entity.innerShaded ? "rgba(0,0,0,0.08)" : "none"); applyShapeStyle(o, entity, true); nodes.push(o); return nodes;
  }
  if (entity.shape === "triangle") {
    const n = document.createElementNS(svgNS, "polygon"); n.setAttribute("points", `${x + entity.w / 2},${y} ${x + entity.w},${y + entity.h} ${x},${y + entity.h}`); n.setAttribute("fill", fill); applyShapeStyle(n, entity); nodes.push(n); return nodes;
  }
  if (entity.shape === "ellipse") {
    const n = document.createElementNS(svgNS, "ellipse"); n.setAttribute("cx", x + entity.w / 2); n.setAttribute("cy", y + entity.h / 2); n.setAttribute("rx", entity.w / 2); n.setAttribute("ry", entity.h / 2); n.setAttribute("fill", fill); applyShapeStyle(n, entity); nodes.push(n); return nodes;
  }
  if (entity.shape === "circle") {
    const n = document.createElementNS(svgNS, "circle"); n.setAttribute("cx", x + entity.w / 2); n.setAttribute("cy", y + entity.h / 2); n.setAttribute("r", Math.min(entity.w, entity.h) / 2); n.setAttribute("fill", fill); applyShapeStyle(n, entity); nodes.push(n); return nodes;
  }
  const c = 18; const n = document.createElementNS(svgNS, "polygon");
  n.setAttribute("points", `${x + c},${y} ${x + entity.w - c},${y} ${x + entity.w},${y + c} ${x + entity.w},${y + entity.h - c} ${x + entity.w - c},${y + entity.h} ${x + c},${y + entity.h} ${x},${y + entity.h - c} ${x},${y + c}`);
  n.setAttribute("fill", fill); applyShapeStyle(n, entity); nodes.push(n); return nodes;
}

function relationshipPath(rel, a, b) {
  if (rel.kind !== "ownership") return { d: `M ${a.x} ${a.y} L ${b.x} ${b.y}`, labelX: (a.x + b.x) / 2, labelY: (a.y + b.y) / 2 };
  const midX = (a.x + b.x) / 2;
  return { d: `M ${a.x} ${a.y} L ${midX} ${a.y} L ${midX} ${b.y} L ${b.x} ${b.y}`, labelX: midX + 6, labelY: (a.y + b.y) / 2 - 8 };
}

function drawRelationships() {
  for (const rel of state.relationships) {
    const from = entityById(rel.fromId); const to = entityById(rel.toId); if (!from || !to) continue;
    const a = anchor(from, rel.fromSide); const b = anchor(to, rel.toSide);
    const spec = relationshipPath(rel, a, b);
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", spec.d); path.setAttribute("class", "rel-line"); path.setAttribute("stroke", rel.color);
    if (rel.dashed) path.setAttribute("stroke-dasharray", "8 5");
    const arrowStart = rel.arrowBoth || rel.reverseArrow;
    const arrowEnd = rel.arrowBoth || !rel.reverseArrow;
    if (arrowStart) path.setAttribute("marker-start", "url(#arrowhead)");
    if (arrowEnd) path.setAttribute("marker-end", "url(#arrowhead)");
    path.addEventListener("click", (e) => { e.stopPropagation(); setSelection({ type: "relationship", id: rel.id }); });

    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("x", spec.labelX); label.setAttribute("y", spec.labelY); label.setAttribute("class", "rel-label"); label.setAttribute("fill", rel.color);
    label.textContent = rel.percent ? `${rel.label} (${rel.percent})` : rel.label;
    el.viewport.append(path, label);
  }
}

function drawEntities() {
  for (const entity of state.entities) {
    const g = document.createElementNS(svgNS, "g");
    g.setAttribute("class", `entity ${state.selection?.type === "entity" && state.selection.id === entity.id ? "selected" : ""}`);
    g.setAttribute("data-id", entity.id);
    const count = Math.max(1, Math.min(6, Number(entity.stackCount || 1)));
    for (let i = count - 1; i >= 0; i--) for (const n of createShape(entity, i * 8, i * -8)) g.appendChild(n);
    if (entity.showX) {
      const x1 = document.createElementNS(svgNS, "line"); const x2 = document.createElementNS(svgNS, "line");
      x1.setAttribute("class", "entity-x"); x2.setAttribute("class", "entity-x");
      x1.setAttribute("x1", entity.x + 8); x1.setAttribute("y1", entity.y + 8); x1.setAttribute("x2", entity.x + entity.w - 8); x1.setAttribute("y2", entity.y + entity.h - 8);
      x2.setAttribute("x1", entity.x + entity.w - 8); x2.setAttribute("y1", entity.y + 8); x2.setAttribute("x2", entity.x + 8); x2.setAttribute("y2", entity.y + entity.h - 8);
      g.append(x1, x2);
    }
    const t1 = document.createElementNS(svgNS, "text"); t1.setAttribute("x", entity.x + entity.w / 2); t1.setAttribute("y", entity.y + entity.h / 2 - 2); t1.setAttribute("text-anchor", "middle"); t1.setAttribute("font-weight", "600"); t1.textContent = entity.label;
    const t2 = document.createElementNS(svgNS, "text"); t2.setAttribute("x", entity.x + entity.w / 2); t2.setAttribute("y", entity.y + entity.h / 2 + 16); t2.setAttribute("text-anchor", "middle"); t2.setAttribute("font-size", "12"); t2.setAttribute("fill", "#4d5d7a"); t2.textContent = entity.jurisdiction || entity.type;
    g.append(t1, t2); el.viewport.appendChild(g);
  }
}

function drawDescriptions() {
  for (const d of state.descriptions) {
    const t = document.createElementNS(svgNS, "text");
    t.setAttribute("x", d.x); t.setAttribute("y", d.y); t.setAttribute("class", "description"); t.setAttribute("data-id", d.id);
    t.setAttribute("font-size", "14"); t.setAttribute("font-weight", "500"); t.setAttribute("fill", "#233551");
    if (state.selection?.type === "description" && state.selection.id === d.id) t.setAttribute("text-decoration", "underline");
    t.textContent = d.text;
    t.addEventListener("click", (e) => { e.stopPropagation(); setSelection({ type: "description", id: d.id }); });
    el.viewport.appendChild(t);
  }
}

function render() {
  el.viewport.innerHTML = "";
  el.viewport.setAttribute("transform", `translate(${state.panX} ${state.panY}) scale(${state.zoom})`);
  drawRelationships();
  drawEntities();
  drawDescriptions();
}

function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16); const amt = Math.round(2.55 * (pct * 100));
  const r = Math.min(255, Math.max(0, (n >> 16) + amt)); const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amt)); const b = Math.min(255, Math.max(0, (n & 0xff) + amt));
  return `#${(1 << 24 | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function renderPaletteShape(spec) {
  if (spec.shape === "triangle") return `<polygon points="22,2 42,30 2,30" fill="${spec.fill}" stroke="#111" stroke-width="1.8"/>`;
  if (spec.shape === "circle") return `<circle cx="22" cy="17" r="14" fill="${spec.fill}" stroke="#111" stroke-width="1.8"/>`;
  if (spec.shape === "ellipse") return `<ellipse cx="22" cy="17" rx="20" ry="13" fill="${spec.fill}" stroke="#111" stroke-width="1.8"/>`;
  if (spec.shape === "octagon") return `<polygon points="12,2 32,2 42,12 42,22 32,32 12,32 2,22 2,12" fill="${spec.fill}" stroke="#111" stroke-width="1.8"/>`;
  if (spec.shape === "roundedRect") return `<rect x="2" y="2" width="40" height="30" fill="${spec.fill}" stroke="#111" stroke-width="1.8"/><ellipse cx="22" cy="17" rx="19" ry="13" fill="none" stroke="#111" stroke-width="1.8"/>`;
  return `<rect x="2" y="2" width="40" height="30" fill="${spec.fill}" stroke="#111" stroke-width="1.8"/>`;
}

function initPalette() {
  el.palette.innerHTML = "";
  for (const spec of ENTITY_TYPES) {
    const b = document.createElement("button");
    b.className = "palette-item"; b.dataset.type = spec.type;
    b.innerHTML = `<svg viewBox="0 0 44 34" aria-hidden="true">${renderPaletteShape(spec)}</svg><span><span class="title">${spec.type}</span></span>`;
    el.palette.appendChild(b);
  }
  el.entityType.innerHTML = ENTITY_TYPES.map((i) => `<option value="${i.type}">${i.type}</option>`).join("");
  const sideOptions = SIDES.map((s) => `<option value="${s}">${s[0].toUpperCase() + s.slice(1)}</option>`).join("");
  el.relFromSide.innerHTML = sideOptions; el.relToSide.innerHTML = sideOptions;
}

function setupPointerEvents() {
  el.canvas.addEventListener("mousedown", (evt) => {
    const desc = evt.target.closest("text.description");
    if (desc && state.mode === "select") {
      const d = descById(desc.dataset.id);
      setSelection({ type: "description", id: d.id });
      state.dragDescId = d.id;
      state.dragOrigin = { x: evt.clientX, y: evt.clientY, dx: d.x, dy: d.y };
      return;
    }

    const node = evt.target.closest("g.entity");
    if (!node) {
      state.panOrigin = { x: evt.clientX, y: evt.clientY, ox: state.panX, oy: state.panY };
      setSelection(null);
      return;
    }

    const id = node.dataset.id;
    const entity = entityById(id);
    if (state.mode === "select") {
      setSelection({ type: "entity", id });
      state.dragEntityId = id;
      state.dragOrigin = { x: evt.clientX, y: evt.clientY, ex: entity.x, ey: entity.y };
      return;
    }

    if (!state.connectBuffer) {
      state.connectBuffer = id;
      el.selectionHint.textContent = `Selected source: ${entity.label}. Click target entity.`;
    } else if (state.connectBuffer !== id) {
      addRelationship(state.connectBuffer, id, state.mode);
      state.connectBuffer = null;
    }
  });

  window.addEventListener("mousemove", (evt) => {
    if (state.dragEntityId && state.dragOrigin && state.mode === "select") {
      const e = entityById(state.dragEntityId); const dx = (evt.clientX - state.dragOrigin.x) / state.zoom; const dy = (evt.clientY - state.dragOrigin.y) / state.zoom;
      e.x = state.dragOrigin.ex + dx; e.y = state.dragOrigin.ey + dy; render(); return;
    }
    if (state.dragDescId && state.dragOrigin && state.mode === "select") {
      const d = descById(state.dragDescId); const dx = (evt.clientX - state.dragOrigin.x) / state.zoom; const dy = (evt.clientY - state.dragOrigin.y) / state.zoom;
      d.x = state.dragOrigin.dx + dx; d.y = state.dragOrigin.dy + dy; render(); return;
    }
    if (state.panOrigin) {
      state.panX = state.panOrigin.ox + (evt.clientX - state.panOrigin.x);
      state.panY = state.panOrigin.oy + (evt.clientY - state.panOrigin.y);
      render();
    }
  });

  window.addEventListener("mouseup", () => { state.dragEntityId = null; state.dragDescId = null; state.dragOrigin = null; state.panOrigin = null; });
}

function refreshSaves() {
  const saves = JSON.parse(localStorage.getItem("tax-diagram-saves") || "[]");
  el.savedDiagrams.innerHTML = "";
  saves.forEach((save, idx) => {
    const node = el.template.content.firstElementChild.cloneNode(true);
    node.querySelector(".name").textContent = save.name;
    node.querySelector(".load").addEventListener("click", () => { Object.assign(state, save.data, { selection: null, connectBuffer: null, dragEntityId: null, dragDescId: null, dragOrigin: null, panOrigin: null }); render(); });
    node.querySelector(".delete").addEventListener("click", () => { saves.splice(idx, 1); localStorage.setItem("tax-diagram-saves", JSON.stringify(saves)); refreshSaves(); });
    el.savedDiagrams.appendChild(node);
  });
}

function download(filename, dataUrl) { const a = document.createElement("a"); a.href = dataUrl; a.download = filename; a.click(); }

function wireUi() {
  el.palette.addEventListener("click", (evt) => { const b = evt.target.closest("button[data-type]"); if (b) addEntity(b.dataset.type); });
  el.addDescription.addEventListener("click", addDescription);

  el.modeSwitcher.addEventListener("click", (evt) => {
    const btn = evt.target.closest("button[data-mode]"); if (!btn) return;
    state.mode = btn.dataset.mode; state.connectBuffer = null;
    [...el.modeSwitcher.querySelectorAll("button")].forEach((x) => x.classList.toggle("active", x === btn));
    el.modeLabel.textContent = `Current mode: ${btn.textContent}`;
  });

  el.entityLabel.addEventListener("input", () => { const item = entityById(state.selection?.id); if (item) { item.label = el.entityLabel.value; render(); } });
  el.entityType.addEventListener("input", () => { const item = entityById(state.selection?.id); if (!item) return; const spec = ENTITY_LOOKUP[el.entityType.value]; const d = shapeMetrics(spec.shape); Object.assign(item, { type: spec.type, shape: spec.shape, fill: spec.fill, w: d.w, h: d.h }); render(); });
  el.entityJurisdiction.addEventListener("input", () => { const i = entityById(state.selection?.id); if (i) { i.jurisdiction = el.entityJurisdiction.value; render(); } });
  el.entityStackCount.addEventListener("input", () => { const i = entityById(state.selection?.id); if (i) { i.stackCount = Math.max(1, Math.min(6, Number(el.entityStackCount.value || 1))); render(); } });
  el.entityLineStyle.addEventListener("input", () => { const i = entityById(state.selection?.id); if (i) { i.lineStyle = el.entityLineStyle.value; render(); } });
  el.entityShading.addEventListener("input", () => { const i = entityById(state.selection?.id); if (i) { i.shaded = el.entityShading.value === "shaded"; render(); } });
  el.entityX.addEventListener("change", () => { const i = entityById(state.selection?.id); if (i) { i.showX = el.entityX.checked; render(); } });
  el.innerLineStyle.addEventListener("input", () => { const i = entityById(state.selection?.id); if (i) { i.innerLineStyle = el.innerLineStyle.value; render(); } });
  el.innerShading.addEventListener("input", () => { const i = entityById(state.selection?.id); if (i) { i.innerShaded = el.innerShading.value === "shaded"; render(); } });

  el.relLabel.addEventListener("input", () => { const r = relById(state.selection?.id); if (r) { r.label = el.relLabel.value; render(); } });
  el.relPercent.addEventListener("input", () => { const r = relById(state.selection?.id); if (r) { r.percent = el.relPercent.value; render(); } });
  el.relKind.addEventListener("input", () => {
    const r = relById(state.selection?.id); if (!r) return;
    r.kind = el.relKind.value; const isOwn = r.kind === "ownership";
    r.color = isOwn ? "#202f4a" : "#d11f1f"; r.dashed = !isOwn; if (!isOwn) r.reverseArrow = false;
    render();
  });
  el.relColor.addEventListener("input", () => { const r = relById(state.selection?.id); if (r) { r.color = el.relColor.value; render(); } });
  el.relLineStyle.addEventListener("input", () => { const r = relById(state.selection?.id); if (r) { r.dashed = el.relLineStyle.value === "dashed"; render(); } });
  el.relArrowBoth.addEventListener("change", () => { const r = relById(state.selection?.id); if (r) { r.arrowBoth = el.relArrowBoth.checked; render(); } });
  el.relReverseArrow.addEventListener("change", () => { const r = relById(state.selection?.id); if (r) { r.reverseArrow = el.relReverseArrow.checked; render(); } });
  el.relFromSide.addEventListener("input", () => { const r = relById(state.selection?.id); if (r) { r.fromSide = el.relFromSide.value; render(); } });
  el.relToSide.addEventListener("input", () => { const r = relById(state.selection?.id); if (r) { r.toSide = el.relToSide.value; render(); } });

  el.descText.addEventListener("input", () => { const d = descById(state.selection?.id); if (d) { d.text = el.descText.value; render(); } });
  el.deleteDesc.addEventListener("click", () => { if (state.selection?.type !== "description") return; state.descriptions = state.descriptions.filter((d) => d.id !== state.selection.id); setSelection(null); });

  el.deleteEntity.addEventListener("click", () => {
    if (state.selection?.type !== "entity") return;
    state.entities = state.entities.filter((x) => x.id !== state.selection.id);
    state.relationships = state.relationships.filter((x) => x.fromId !== state.selection.id && x.toId !== state.selection.id);
    setSelection(null);
  });
  el.deleteRel.addEventListener("click", () => { if (state.selection?.type !== "relationship") return; state.relationships = state.relationships.filter((x) => x.id !== state.selection.id); setSelection(null); });

  document.getElementById("zoomIn").addEventListener("click", () => { state.zoom = Math.min(2, state.zoom + 0.1); render(); });
  document.getElementById("zoomOut").addEventListener("click", () => { state.zoom = Math.max(0.4, state.zoom - 0.1); render(); });
  document.getElementById("zoomReset").addEventListener("click", () => { state.zoom = 1; render(); });
  document.getElementById("clearBtn").addEventListener("click", () => { state.entities = []; state.relationships = []; state.descriptions = []; setSelection(null); render(); });

  el.saveBtn.addEventListener("click", () => {
    const saves = JSON.parse(localStorage.getItem("tax-diagram-saves") || "[]");
    saves.unshift({ name: `Diagram ${new Date().toLocaleString()}`, data: { mode: "select", zoom: state.zoom, panX: state.panX, panY: state.panY, entities: state.entities, relationships: state.relationships, descriptions: state.descriptions } });
    localStorage.setItem("tax-diagram-saves", JSON.stringify(saves.slice(0, 5))); refreshSaves();
  });

  document.getElementById("exportSvg").addEventListener("click", () => { const source = new XMLSerializer().serializeToString(el.canvas); download("tax-diagram.svg", `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`); });
  document.getElementById("exportPng").addEventListener("click", () => {
    const source = new XMLSerializer().serializeToString(el.canvas); const img = new Image(); const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" }); const url = URL.createObjectURL(blob);
    img.onload = () => { const c = document.createElement("canvas"); c.width = 1400; c.height = 900; const ctx = c.getContext("2d"); ctx.fillStyle = "white"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0); download("tax-diagram.png", c.toDataURL("image/png")); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

initPalette();
wireUi();
setupPointerEvents();
refreshSaves();
render();
