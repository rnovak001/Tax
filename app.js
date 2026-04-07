const ENTITY_TYPES = [
  { type: "U.S. Corporation", shape: "rect", fill: "#ffffff" },
  { type: "Controlled Foreign Corporation", shape: "rect", fill: "#f6bf00" },
  { type: "U.S. Disregarded Entity", shape: "roundedRect", fill: "#64d7d9" },
  { type: "Foreign Disregarded Entity", shape: "roundedRect", fill: "#94d252" },
  { type: "U.S. Partnership", shape: "triangle", fill: "#d777c9" },
  { type: "Controlled Foreign Partnership", shape: "triangle", fill: "#9d67cc" },
  { type: "Branch", shape: "ellipse", fill: "#94d252" },
  { type: "Individual", shape: "circle", fill: "#cfdde8" },
  { type: "Unrelated", shape: "octagon", fill: "#d7d7d7" },
  { type: "Transactional Step", shape: "step", fill: "#f4f4f4" },
];

const RELATIONSHIP_TYPES = {
  equity: { label: "Equity", color: "#1f2d3d", dashed: false, markerEnd: false },
  debt: { label: "Debt", color: "#1f2d3d", dashed: true, markerEnd: true },
  action: { label: "Action Step", color: "#c41230", dashed: true, markerEnd: false },
};

const ENTITY_LOOKUP = Object.fromEntries(ENTITY_TYPES.map((x) => [x.type, x]));
const svgNS = "http://www.w3.org/2000/svg";
const uid = () => crypto.randomUUID().slice(0, 8);

const state = {
  mode: "select",
  zoom: 1,
  panX: 0,
  panY: 0,
  entities: [],
  relationships: [],
  selection: null,
  connectBuffer: null,
  dragEntityId: null,
  dragOrigin: null,
  panOrigin: null,
  showTxnLegend: false,
  txnLegendArrow: "Tx",
  txnLegendTail: "From",
};

const el = {
  palette: document.getElementById("entityPalette"),
  legend: document.getElementById("legendList"),
  modeSwitcher: document.getElementById("modeSwitcher"),
  modeLabel: document.getElementById("modeLabel"),
  canvas: document.getElementById("canvas"),
  viewport: document.getElementById("viewport"),
  selectionHint: document.getElementById("selectionHint"),
  entityEditor: document.getElementById("entityEditor"),
  equityEditor: document.getElementById("equityEditor"),
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
  showTxnLegend: document.getElementById("showTxnLegend"),
  txnLegendArrow: document.getElementById("txnLegendArrow"),
  txnLegendTail: document.getElementById("txnLegendTail"),
  deleteEntity: document.getElementById("deleteEntity"),
  deleteRel: document.getElementById("deleteRel"),
  saveBtn: document.getElementById("saveBtn"),
  savedDiagrams: document.getElementById("savedDiagrams"),
  template: document.getElementById("saveItemTemplate"),
};

function shapeMetrics(shape) {
  if (shape === "triangle") return { w: 136, h: 82 };
  if (shape === "circle" || shape === "step") return { w: 88, h: 88 };
  if (shape === "ellipse") return { w: 126, h: 76 };
  if (shape === "octagon") return { w: 88, h: 88 };
  return { w: 172, h: 74 };
}

function entityById(id) { return state.entities.find((x) => x.id === id); }
function relById(id) { return state.relationships.find((x) => x.id === id); }
function center(e) { return { x: e.x + e.w / 2, y: e.y + e.h / 2 }; }

function addEntity(type) {
  const spec = ENTITY_LOOKUP[type] || ENTITY_TYPES[0];
  const dims = shapeMetrics(spec.shape);
  state.entities.push({
    id: uid(),
    type: spec.type,
    label: spec.type,
    jurisdiction: "",
    shape: spec.shape,
    fill: spec.fill,
    stackCount: 1,
    lineStyle: "solid",
    shaded: false,
    showX: false,
    innerLineStyle: "solid",
    innerShaded: false,
    x: 170 + (state.entities.length % 6) * 190,
    y: 130 + Math.floor(state.entities.length / 6) * 135,
    w: dims.w,
    h: dims.h,
  });
  render();
}

function addRelationship(fromId, toId, kind) {
  const isOwnership = kind === "ownership";
  state.relationships.push({
    id: uid(),
    fromId,
    toId,
    kind,
    label: isOwnership ? "Ownership" : "Transaction",
    percent: "",
    color: "#202f4a",
    dashed: !isOwnership,
    arrowBoth: false,
    reverseArrow: !isOwnership,
  });
  render();
}

function setSelection(sel) {
  state.selection = sel;
  el.entityEditor.classList.add("hidden");
  el.equityEditor.classList.add("hidden");

  if (!sel) {
    el.selectionHint.textContent = "Nothing selected";
    render();
    return;
  }

  if (sel.type === "entity") {
    const entity = entityById(sel.id);
    if (!entity) return;
    el.selectionHint.textContent = `Selected entity: ${entity.label}`;
    el.entityEditor.classList.remove("hidden");
    el.entityLabel.value = entity.label;
    el.entityType.value = entity.type;
    el.entityJurisdiction.value = entity.jurisdiction;
    el.entityStackCount.value = entity.stackCount;
    el.entityLineStyle.value = entity.lineStyle || "solid";
    el.entityShading.value = entity.shaded ? "shaded" : "none";
    el.entityX.checked = Boolean(entity.showX);
    el.innerLineStyle.value = entity.innerLineStyle || "solid";
    el.innerShading.value = entity.innerShaded ? "shaded" : "none";
  } else {
    const rel = relById(sel.id);
    if (!rel) return;
    el.selectionHint.textContent = `Selected relationship: ${rel.label}`;
    el.relationshipEditor.classList.remove("hidden");
    el.relLabel.value = rel.label;
    el.relPercent.value = rel.percent;
    el.relKind.value = rel.kind;
    el.relColor.value = rel.color;
    el.relLineStyle.value = rel.dashed ? "dashed" : "solid";
    el.relArrowBoth.checked = Boolean(rel.arrowBoth);
    el.relReverseArrow.checked = Boolean(rel.reverseArrow);
  }

  render();
}

function applyShapeStyle(node, entity, isInner = false) {
  const strokeDasharray = (isInner ? entity.innerLineStyle : entity.lineStyle) === "dashed" ? "6 4" : null;
  node.setAttribute("class", isInner ? "inner-shape" : "shape");
  if (strokeDasharray) node.setAttribute("stroke-dasharray", strokeDasharray);
}

function createShape(entity, dx = 0, dy = 0) {
  const shape = entity.shape;
  const nodes = [];
  const fill = entity.shaded ? shade(entity.fill, -0.1) : entity.fill;

  if (shape === "rect") {
    const rect = document.createElementNS(svgNS, "rect");
    rect.setAttribute("x", entity.x + dx);
    rect.setAttribute("y", entity.y + dy);
    rect.setAttribute("width", entity.w);
    rect.setAttribute("height", entity.h);
    rect.setAttribute("fill", fill);
    applyShapeStyle(rect, entity);
    nodes.push(rect);
    return nodes;
  }

  if (shape === "roundedRect") {
    const rect = document.createElementNS(svgNS, "rect");
    rect.setAttribute("x", entity.x + dx);
    rect.setAttribute("y", entity.y + dy);
    rect.setAttribute("width", entity.w);
    rect.setAttribute("height", entity.h);
    rect.setAttribute("fill", fill);
    applyShapeStyle(rect, entity);
    nodes.push(rect);

    const oval = document.createElementNS(svgNS, "ellipse");
    oval.setAttribute("cx", entity.x + entity.w / 2 + dx);
    oval.setAttribute("cy", entity.y + entity.h / 2 + dy);
    oval.setAttribute("rx", entity.w / 2 - 2);
    oval.setAttribute("ry", entity.h / 2 - 2);
    oval.setAttribute("fill", entity.innerShaded ? "rgba(0,0,0,0.08)" : "none");
    applyShapeStyle(oval, entity, true);
    nodes.push(oval);
    return nodes;
  }

  if (shape === "triangle") {
    const poly = document.createElementNS(svgNS, "polygon");
    poly.setAttribute("points", `${entity.x + entity.w / 2 + dx},${entity.y + dy} ${entity.x + entity.w + dx},${entity.y + entity.h + dy} ${entity.x + dx},${entity.y + entity.h + dy}`);
    poly.setAttribute("fill", fill);
    applyShapeStyle(poly, entity);
    nodes.push(poly);
    return nodes;
  }

  if (shape === "ellipse") {
    const ellipse = document.createElementNS(svgNS, "ellipse");
    ellipse.setAttribute("cx", entity.x + entity.w / 2 + dx);
    ellipse.setAttribute("cy", entity.y + entity.h / 2 + dy);
    ellipse.setAttribute("rx", entity.w / 2);
    ellipse.setAttribute("ry", entity.h / 2);
    ellipse.setAttribute("fill", fill);
    applyShapeStyle(ellipse, entity);
    nodes.push(ellipse);
    return nodes;
  }

  if (shape === "circle" || shape === "step") {
    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", entity.x + entity.w / 2 + dx);
    circle.setAttribute("cy", entity.y + entity.h / 2 + dy);
    circle.setAttribute("r", Math.min(entity.w, entity.h) / 2);
    circle.setAttribute("fill", fill);
    applyShapeStyle(circle, entity);
    nodes.push(circle);
    return nodes;
  }

  const oct = document.createElementNS(svgNS, "polygon");
  const x = entity.x + dx;
  const y = entity.y + dy;
  const c = 17;
  oct.setAttribute("points", `${x + c},${y} ${x + entity.w - c},${y} ${x + entity.w},${y + c} ${x + entity.w},${y + entity.h - c} ${x + entity.w - c},${y + entity.h} ${x + c},${y + entity.h} ${x},${y + entity.h - c} ${x},${y + c}`);
  oct.setAttribute("fill", fill);
  applyShapeStyle(oct, entity);
  nodes.push(oct);
  return nodes;
}

function relationshipPath(rel, a, b) {
  if (rel.kind !== "ownership") {
    return { d: `M ${a.x} ${a.y} L ${b.x} ${b.y}`, labelX: (a.x + b.x) / 2, labelY: (a.y + b.y) / 2 };
  }
  const midX = (a.x + b.x) / 2;
  return {
    d: `M ${a.x} ${a.y} L ${midX} ${a.y} L ${midX} ${b.y} L ${b.x} ${b.y}`,
    labelX: midX + 6,
    labelY: (a.y + b.y) / 2 - 8,
  };
}

function drawRelationships() {
  for (const rel of state.relationships) {
    const from = entityById(rel.fromId);
    const to = entityById(rel.toId);
    if (!from || !to) continue;
    const a = center(from);
    const b = center(to);
    const pathSpec = relationshipPath(rel, a, b);
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", pathSpec.d);
    path.setAttribute("class", "rel-line");
    path.setAttribute("stroke", rel.color || "#202f4a");
    if (rel.dashed) path.setAttribute("stroke-dasharray", "8 5");

    const arrowStart = rel.arrowBoth || rel.reverseArrow;
    const arrowEnd = rel.arrowBoth || !rel.reverseArrow;
    if (arrowStart) path.setAttribute("marker-start", "url(#arrowhead)");
    if (arrowEnd) path.setAttribute("marker-end", "url(#arrowhead)");

    path.addEventListener("click", (evt) => {
      evt.stopPropagation();
      setSelection({ type: "relationship", id: rel.id });
    });

    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("x", labelX);
    label.setAttribute("y", labelY);
    label.setAttribute("class", "rel-label");
    label.setAttribute("fill", rel.color || spec.color);
    label.textContent = rel.label;

    el.viewport.append(path, label);

    if (state.showTxnLegend && rel.kind === "transaction") {
      const t1 = document.createElementNS(svgNS, "text");
      t1.setAttribute("x", a.x - 8);
      t1.setAttribute("y", a.y - 10);
      t1.setAttribute("text-anchor", "end");
      t1.setAttribute("font-size", "11");
      t1.textContent = state.txnLegendTail;

      const t2 = document.createElementNS(svgNS, "text");
      t2.setAttribute("x", b.x + 8);
      t2.setAttribute("y", b.y - 10);
      t2.setAttribute("font-size", "11");
      t2.textContent = state.txnLegendArrow;
      el.viewport.append(t1, t2);
    }
  }
}

function drawEntities() {
  for (const entity of state.entities) {
    const group = document.createElementNS(svgNS, "g");
    group.setAttribute("class", `entity ${state.selection?.type === "entity" && state.selection.id === entity.id ? "selected" : ""}`);
    group.setAttribute("data-id", entity.id);

    const count = Math.max(1, Math.min(6, Number(entity.stackCount || 1)));
    for (let i = count - 1; i >= 0; i--) {
      for (const node of createShape(entity, i * 8, i * -8)) group.appendChild(node);
    }

    if (entity.showX) {
      const x1 = document.createElementNS(svgNS, "line");
      const x2 = document.createElementNS(svgNS, "line");
      x1.setAttribute("class", "entity-x");
      x2.setAttribute("class", "entity-x");
      x1.setAttribute("x1", entity.x + 8); x1.setAttribute("y1", entity.y + 8);
      x1.setAttribute("x2", entity.x + entity.w - 8); x1.setAttribute("y2", entity.y + entity.h - 8);
      x2.setAttribute("x1", entity.x + entity.w - 8); x2.setAttribute("y1", entity.y + 8);
      x2.setAttribute("x2", entity.x + 8); x2.setAttribute("y2", entity.y + entity.h - 8);
      group.append(x1, x2);
    }

    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("x", entity.x + entity.w / 2);
    label.setAttribute("y", entity.y + entity.h / 2 - 2);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-weight", "600");
    label.textContent = entity.shape === "step" ? String(entity.stepNumber || 1) : entity.label;

    const sub = document.createElementNS(svgNS, "text");
    sub.setAttribute("x", entity.x + entity.w / 2);
    sub.setAttribute("y", entity.y + entity.h / 2 + 15);
    sub.setAttribute("text-anchor", "middle");
    sub.setAttribute("fill", "#546681");
    sub.textContent = entity.shape === "step" ? "Transactional Step" : (entity.jurisdiction || entity.type);

    group.append(label, sub);
    el.viewport.appendChild(group);
  }
}

function render() {
  el.viewport.innerHTML = "";
  el.viewport.setAttribute("transform", `translate(${state.panX} ${state.panY}) scale(${state.zoom})`);
  drawRelationships();
  drawEntities();
}

function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * (pct * 100));
  const r = Math.min(255, Math.max(0, (n >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0x00ff) + amt));
  const b = Math.min(255, Math.max(0, (n & 0x0000ff) + amt));
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

function initPaletteAndLegend() {
  el.palette.innerHTML = "";
  for (const spec of ENTITY_TYPES) {
    const button = document.createElement("button");
    button.className = "palette-item";
    button.dataset.type = spec.type;
    button.innerHTML = `<svg viewBox="0 0 44 34" aria-hidden="true">${renderPaletteShape(spec)}</svg><span><span class="title">${spec.type}</span></span>`;
    el.palette.appendChild(button);
  }

  el.entityType.innerHTML = ENTITY_TYPES.map((item) => `<option value="${item.type}">${item.type}</option>`).join("");
}

function setupPointerEvents() {
  el.canvas.addEventListener("mousedown", (evt) => {
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
      const entity = entityById(state.dragEntityId);
      const dx = (evt.clientX - state.dragOrigin.x) / state.zoom;
      const dy = (evt.clientY - state.dragOrigin.y) / state.zoom;
      entity.x = state.dragOrigin.ex + dx;
      entity.y = state.dragOrigin.ey + dy;
      render();
      return;
    }

    if (state.panOrigin) {
      state.panX = state.panOrigin.ox + (evt.clientX - state.panOrigin.x);
      state.panY = state.panOrigin.oy + (evt.clientY - state.panOrigin.y);
      render();
    }
  });

  window.addEventListener("mouseup", () => {
    state.dragEntityId = null;
    state.dragOrigin = null;
    state.panOrigin = null;
  });
}

function refreshSaves() {
  const saves = JSON.parse(localStorage.getItem("tax-diagram-saves") || "[]");
  el.savedDiagrams.innerHTML = "";
  saves.forEach((save, idx) => {
    const node = el.template.content.firstElementChild.cloneNode(true);
    node.querySelector(".name").textContent = save.name;
    node.querySelector(".load").addEventListener("click", () => {
      Object.assign(state, save.data, { selection: null, connectBuffer: null, dragEntityId: null, dragOrigin: null, panOrigin: null });
      render();
    });
    node.querySelector(".delete").addEventListener("click", () => {
      saves.splice(idx, 1);
      localStorage.setItem("tax-diagram-saves", JSON.stringify(saves));
      refreshSaves();
    });
    el.savedDiagrams.appendChild(node);
  });
}

function download(filename, dataUrl) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function wireUi() {
  el.palette.addEventListener("click", (evt) => {
    const button = evt.target.closest("button[data-type]");
    if (button) addEntity(button.dataset.type);
  });

  el.modeSwitcher.addEventListener("click", (evt) => {
    const btn = evt.target.closest("button[data-mode]");
    if (!btn) return;
    state.mode = btn.dataset.mode;
    state.connectBuffer = null;
    [...el.modeSwitcher.querySelectorAll("button")].forEach((x) => x.classList.toggle("active", x === btn));
    el.modeLabel.textContent = `Current mode: ${btn.textContent}`;
  });

  el.showTxnLegend.addEventListener("change", () => { state.showTxnLegend = el.showTxnLegend.checked; render(); });
  el.txnLegendArrow.addEventListener("input", () => { state.txnLegendArrow = el.txnLegendArrow.value; render(); });
  el.txnLegendTail.addEventListener("input", () => { state.txnLegendTail = el.txnLegendTail.value; render(); });

  el.entityLabel.addEventListener("input", () => { const item = entityById(state.selection?.id); if (item) { item.label = el.entityLabel.value; render(); } });
  el.entityType.addEventListener("input", () => {
    const item = entityById(state.selection?.id);
    if (!item) return;
    const spec = ENTITY_LOOKUP[el.entityType.value];
    const dims = shapeMetrics(spec.shape);
    item.type = spec.type; item.shape = spec.shape; item.fill = spec.fill; item.w = dims.w; item.h = dims.h; render();
  });
  el.entityJurisdiction.addEventListener("input", () => { const item = entityById(state.selection?.id); if (item) { item.jurisdiction = el.entityJurisdiction.value; render(); } });
  el.entityStackCount.addEventListener("input", () => { const item = entityById(state.selection?.id); if (item) { item.stackCount = Math.max(1, Math.min(6, Number(el.entityStackCount.value || 1))); render(); } });
  el.entityLineStyle.addEventListener("input", () => { const item = entityById(state.selection?.id); if (item) { item.lineStyle = el.entityLineStyle.value; render(); } });
  el.entityShading.addEventListener("input", () => { const item = entityById(state.selection?.id); if (item) { item.shaded = el.entityShading.value === "shaded"; render(); } });
  el.entityX.addEventListener("change", () => { const item = entityById(state.selection?.id); if (item) { item.showX = el.entityX.checked; render(); } });
  el.innerLineStyle.addEventListener("input", () => { const item = entityById(state.selection?.id); if (item) { item.innerLineStyle = el.innerLineStyle.value; render(); } });
  el.innerShading.addEventListener("input", () => { const item = entityById(state.selection?.id); if (item) { item.innerShaded = el.innerShading.value === "shaded"; render(); } });

  el.relLabel.addEventListener("input", () => { const rel = relById(state.selection?.id); if (rel) { rel.label = el.relLabel.value; render(); } });
  el.relPercent.addEventListener("input", () => { const rel = relById(state.selection?.id); if (rel) { rel.percent = el.relPercent.value; render(); } });
  el.relKind.addEventListener("input", () => {
    const rel = relById(state.selection?.id);
    if (!rel) return;
    rel.kind = el.relKind.value;
    rel.dashed = rel.kind === "transaction";
    if (rel.kind === "transaction") rel.reverseArrow = true;
    render();
  });
  el.relColor.addEventListener("input", () => { const rel = relById(state.selection?.id); if (rel) { rel.color = el.relColor.value; render(); } });
  el.relLineStyle.addEventListener("input", () => { const rel = relById(state.selection?.id); if (rel) { rel.dashed = el.relLineStyle.value === "dashed"; render(); } });
  el.relArrowBoth.addEventListener("change", () => { const rel = relById(state.selection?.id); if (rel) { rel.arrowBoth = el.relArrowBoth.checked; render(); } });
  el.relReverseArrow.addEventListener("change", () => { const rel = relById(state.selection?.id); if (rel) { rel.reverseArrow = el.relReverseArrow.checked; render(); } });

  el.deleteEntity.addEventListener("click", () => {
    if (state.selection?.type !== "entity") return;
    state.entities = state.entities.filter((x) => x.id !== state.selection.id);
    state.relationships = state.relationships.filter((x) => x.fromId !== state.selection.id && x.toId !== state.selection.id);
    setSelection(null);
  });

  el.deleteRel.addEventListener("click", () => {
    if (state.selection?.type !== "relationship") return;
    const rel = relById(state.selection.id);
    if (!rel || rel.kind !== "equity") return;
    state.relationships = state.relationships.filter((x) => x.id !== state.selection.id);
    setSelection(null);
  });

  document.getElementById("zoomIn").addEventListener("click", () => { state.zoom = Math.min(2, state.zoom + 0.1); render(); });
  document.getElementById("zoomOut").addEventListener("click", () => { state.zoom = Math.max(0.4, state.zoom - 0.1); render(); });
  document.getElementById("zoomReset").addEventListener("click", () => { state.zoom = 1; render(); });
  document.getElementById("clearBtn").addEventListener("click", () => { state.entities = []; state.relationships = []; setSelection(null); render(); });

  el.saveBtn.addEventListener("click", () => {
    const saves = JSON.parse(localStorage.getItem("tax-diagram-saves") || "[]");
    saves.unshift({
      name: `Diagram ${new Date().toLocaleString()}`,
      data: {
        mode: "select", zoom: state.zoom, panX: state.panX, panY: state.panY,
        entities: state.entities, relationships: state.relationships,
        showTxnLegend: state.showTxnLegend, txnLegendArrow: state.txnLegendArrow, txnLegendTail: state.txnLegendTail,
      },
    });
    localStorage.setItem("tax-diagram-saves", JSON.stringify(saves.slice(0, 5)));
    refreshSaves();
  });

  document.getElementById("exportSvg").addEventListener("click", () => {
    const source = new XMLSerializer().serializeToString(el.canvas);
    download("tax-diagram.svg", `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`);
  });

  document.getElementById("exportPng").addEventListener("click", () => {
    const source = new XMLSerializer().serializeToString(el.canvas);
    const img = new Image();
    const svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = 1500;
      c.height = 920;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);
      download("tax-diagram.png", c.toDataURL("image/png"));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

initPaletteAndLegend();
wireUi();
setupPointerEvents();
refreshSaves();
render();
