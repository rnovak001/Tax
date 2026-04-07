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
  entityStepNumber: document.getElementById("entityStepNumber"),
  equityLabel: document.getElementById("equityLabel"),
  equityColor: document.getElementById("equityColor"),
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

function elbowPath(a, b) {
  const midX = (a.x + b.x) / 2;
  return {
    d: `M ${a.x} ${a.y} L ${midX} ${a.y} L ${midX} ${b.y} L ${b.x} ${b.y}`,
    labelX: midX + 8,
    labelY: (a.y + b.y) / 2 - 9,
  };
}

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
    stepNumber: 1,
    x: 180 + (state.entities.length % 6) * 190,
    y: 130 + Math.floor(state.entities.length / 6) * 130,
    w: dims.w,
    h: dims.h,
  });
  render();
}

function addRelationship(fromId, toId, kind) {
  const spec = RELATIONSHIP_TYPES[kind] || RELATIONSHIP_TYPES.equity;
  state.relationships.push({
    id: uid(),
    fromId,
    toId,
    kind,
    label: spec.label,
    color: spec.color,
  });
  render();
}

function setSelection(sel) {
  state.selection = sel;
  el.entityEditor.classList.add("hidden");
  el.equityEditor.classList.add("hidden");

  if (!sel) {
    el.selectionHint.textContent = "Nothing selected.";
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
    el.entityStepNumber.value = entity.stepNumber || 1;
  }

  if (sel.type === "relationship") {
    const rel = relById(sel.id);
    if (!rel) return;
    el.selectionHint.textContent = `Selected relationship: ${rel.label}`;
    if (rel.kind === "equity") {
      el.equityEditor.classList.remove("hidden");
      el.equityLabel.value = rel.label;
      el.equityColor.value = rel.color || "#1f2d3d";
    }
  }

  render();
}

function createShape(entity, dx = 0, dy = 0) {
  const shape = entity.shape;
  const nodes = [];
  const styleShape = (node, fill) => {
    node.setAttribute("fill", fill);
    node.setAttribute("class", "shape");
    nodes.push(node);
  };

  if (shape === "rect") {
    const rect = document.createElementNS(svgNS, "rect");
    rect.setAttribute("x", entity.x + dx);
    rect.setAttribute("y", entity.y + dy);
    rect.setAttribute("width", entity.w);
    rect.setAttribute("height", entity.h);
    styleShape(rect, entity.fill);
    return nodes;
  }

  if (shape === "roundedRect") {
    const rect = document.createElementNS(svgNS, "rect");
    rect.setAttribute("x", entity.x + dx);
    rect.setAttribute("y", entity.y + dy);
    rect.setAttribute("width", entity.w);
    rect.setAttribute("height", entity.h);
    styleShape(rect, entity.fill);
    const oval = document.createElementNS(svgNS, "ellipse");
    oval.setAttribute("cx", entity.x + entity.w / 2 + dx);
    oval.setAttribute("cy", entity.y + entity.h / 2 + dy);
    oval.setAttribute("rx", entity.w / 2 - 2);
    oval.setAttribute("ry", entity.h / 2 - 2);
    oval.setAttribute("fill", "none");
    oval.setAttribute("class", "shape");
    nodes.push(oval);
    return nodes;
  }

  if (shape === "triangle") {
    const poly = document.createElementNS(svgNS, "polygon");
    poly.setAttribute("points", `${entity.x + entity.w / 2 + dx},${entity.y + dy} ${entity.x + entity.w + dx},${entity.y + entity.h + dy} ${entity.x + dx},${entity.y + entity.h + dy}`);
    styleShape(poly, entity.fill);
    return nodes;
  }

  if (shape === "ellipse") {
    const ellipse = document.createElementNS(svgNS, "ellipse");
    ellipse.setAttribute("cx", entity.x + entity.w / 2 + dx);
    ellipse.setAttribute("cy", entity.y + entity.h / 2 + dy);
    ellipse.setAttribute("rx", entity.w / 2);
    ellipse.setAttribute("ry", entity.h / 2);
    styleShape(ellipse, entity.fill);
    return nodes;
  }

  if (shape === "circle" || shape === "step") {
    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", entity.x + entity.w / 2 + dx);
    circle.setAttribute("cy", entity.y + entity.h / 2 + dy);
    circle.setAttribute("r", Math.min(entity.w, entity.h) / 2);
    styleShape(circle, entity.fill);
    return nodes;
  }

  const oct = document.createElementNS(svgNS, "polygon");
  const x = entity.x + dx;
  const y = entity.y + dy;
  const c = 17;
  oct.setAttribute("points", `${x + c},${y} ${x + entity.w - c},${y} ${x + entity.w},${y + c} ${x + entity.w},${y + entity.h - c} ${x + entity.w - c},${y + entity.h} ${x + c},${y + entity.h} ${x},${y + entity.h - c} ${x},${y + c}`);
  styleShape(oct, entity.fill);
  return nodes;
}

function drawRelationships() {
  for (const rel of state.relationships) {
    const from = entityById(rel.fromId);
    const to = entityById(rel.toId);
    if (!from || !to) continue;
    const a = center(from);
    const b = center(to);
    const spec = RELATIONSHIP_TYPES[rel.kind] || RELATIONSHIP_TYPES.equity;

    let line;
    let labelX = (a.x + b.x) / 2 + 8;
    let labelY = (a.y + b.y) / 2 - 9;

    if (rel.kind === "equity") {
      const elbow = elbowPath(a, b);
      line = document.createElementNS(svgNS, "path");
      line.setAttribute("d", elbow.d);
      labelX = elbow.labelX;
      labelY = elbow.labelY;
    } else {
      line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", a.x);
      line.setAttribute("y1", a.y);
      line.setAttribute("x2", b.x);
      line.setAttribute("y2", b.y);
    }

    line.setAttribute("class", "rel-line");
    line.setAttribute("stroke", rel.color || spec.color);
    if (spec.dashed) line.setAttribute("stroke-dasharray", "8 5");
    if (spec.markerEnd) line.setAttribute("marker-end", "url(#arrowhead-dark)");

    line.addEventListener("click", (evt) => {
      evt.stopPropagation();
      setSelection({ type: "relationship", id: rel.id });
    });

    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("x", labelX);
    label.setAttribute("y", labelY);
    label.setAttribute("class", "rel-label");
    label.setAttribute("fill", rel.color || spec.color);
    label.textContent = rel.label;

    el.viewport.append(line, label);
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

function shapePreview(spec) {
  if (spec.shape === "triangle") return `<polygon points="24,2 44,33 4,33" fill="${spec.fill}" stroke="#111"/>`;
  if (spec.shape === "circle" || spec.shape === "step") return `<circle cx="24" cy="18" r="15" fill="${spec.fill}" stroke="#111"/>`;
  if (spec.shape === "ellipse") return `<ellipse cx="24" cy="18" rx="20" ry="13" fill="${spec.fill}" stroke="#111"/>`;
  if (spec.shape === "octagon") return `<polygon points="13,2 35,2 46,12 46,24 35,34 13,34 2,24 2,12" fill="${spec.fill}" stroke="#111"/>`;
  if (spec.shape === "roundedRect") return `<rect x="2" y="2" width="44" height="32" fill="${spec.fill}" stroke="#111"/><ellipse cx="24" cy="18" rx="21" ry="14" fill="none" stroke="#111"/>`;
  return `<rect x="2" y="2" width="44" height="32" fill="${spec.fill}" stroke="#111"/>`;
}

function initPaletteAndLegend() {
  el.palette.innerHTML = "";
  for (const spec of ENTITY_TYPES) {
    const b = document.createElement("button");
    b.className = "palette-item";
    b.dataset.type = spec.type;
    b.innerHTML = `<svg viewBox="0 0 48 36">${shapePreview(spec)}</svg><span class="title">${spec.type}</span>`;
    el.palette.appendChild(b);
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

  el.entityLabel.addEventListener("input", () => {
    const item = entityById(state.selection?.id);
    if (!item) return;
    item.label = el.entityLabel.value;
    render();
  });

  el.entityType.addEventListener("input", () => {
    const item = entityById(state.selection?.id);
    if (!item) return;
    const spec = ENTITY_LOOKUP[el.entityType.value];
    const dims = shapeMetrics(spec.shape);
    item.type = spec.type;
    item.shape = spec.shape;
    item.fill = spec.fill;
    item.w = dims.w;
    item.h = dims.h;
    render();
  });

  el.entityJurisdiction.addEventListener("input", () => {
    const item = entityById(state.selection?.id);
    if (!item) return;
    item.jurisdiction = el.entityJurisdiction.value;
    render();
  });

  el.entityStackCount.addEventListener("input", () => {
    const item = entityById(state.selection?.id);
    if (!item) return;
    item.stackCount = Math.max(1, Math.min(6, Number(el.entityStackCount.value || 1)));
    render();
  });

  el.entityStepNumber.addEventListener("input", () => {
    const item = entityById(state.selection?.id);
    if (!item) return;
    item.stepNumber = Math.max(1, Math.min(99, Number(el.entityStepNumber.value || 1)));
    render();
  });

  el.equityLabel.addEventListener("input", () => {
    const rel = relById(state.selection?.id);
    if (!rel || rel.kind !== "equity") return;
    rel.label = el.equityLabel.value;
    render();
  });

  el.equityColor.addEventListener("input", () => {
    const rel = relById(state.selection?.id);
    if (!rel || rel.kind !== "equity") return;
    rel.color = el.equityColor.value;
    render();
  });

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
      data: { mode: "select", zoom: state.zoom, panX: state.panX, panY: state.panY, entities: state.entities, relationships: state.relationships },
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
