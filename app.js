const ENTITY_TYPES = [
  { type: "U.S. Corporation", shape: "rect", fill: "#ffffff", description: "U.S. Corporation" },
  { type: "U.S. Corporation", shape: "rect", fill: "#d9d9d9", description: "U.S. Corporation" },
  { type: "Controlled Foreign Corporation", shape: "rect", fill: "#f6bf00", description: "Controlled Foreign Corporation" },
  { type: "U.S. Disregarded Entity", shape: "roundedRect", fill: "#69d1d3", description: "U.S. Disregarded Entity" },
  { type: "Foreign Disregarded Entity", shape: "roundedRect", fill: "#91cc4e", description: "Foreign Disregarded Entity" },
  { type: "U.S. Partnership", shape: "triangle", fill: "#d777c9", description: "U.S. Partnership" },
  { type: "Controlled Foreign Partnership", shape: "triangle", fill: "#9d67cc", description: "Controlled Foreign Partnership" },
  { type: "Branch", shape: "ellipse", fill: "#91cc4e", description: "Branch" },
  { type: "Individual", shape: "circle", fill: "#cedce7", description: "Individual" },
  { type: "Unrelated", shape: "octagon", fill: "#d7d7d7", description: "Unrelated" },
];

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
  modeSwitcher: document.getElementById("modeSwitcher"),
  modeLabel: document.getElementById("modeLabel"),
  canvas: document.getElementById("canvas"),
  viewport: document.getElementById("viewport"),
  selectionHint: document.getElementById("selectionHint"),
  entityEditor: document.getElementById("entityEditor"),
  relationshipEditor: document.getElementById("relationshipEditor"),
  entityLabel: document.getElementById("entityLabel"),
  entityType: document.getElementById("entityType"),
  entityJurisdiction: document.getElementById("entityJurisdiction"),
  entityStackCount: document.getElementById("entityStackCount"),
  relLabel: document.getElementById("relLabel"),
  relPercent: document.getElementById("relPercent"),
  relKind: document.getElementById("relKind"),
  relColor: document.getElementById("relColor"),
  relLineStyle: document.getElementById("relLineStyle"),
  relConnector: document.getElementById("relConnector"),
  relArrowStart: document.getElementById("relArrowStart"),
  relArrowEnd: document.getElementById("relArrowEnd"),
  deleteEntity: document.getElementById("deleteEntity"),
  deleteRel: document.getElementById("deleteRel"),
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
    x: 170 + (state.entities.length % 6) * 190,
    y: 130 + Math.floor(state.entities.length / 6) * 135,
    w: dims.w,
    h: dims.h,
  });
  render();
}

function addRelationship(fromId, toId, kind) {
  const isEquity = kind === "ownership";
  state.relationships.push({
    id: uid(),
    fromId,
    toId,
    kind,
    label: isEquity ? "Equity" : "Transaction",
    percent: "",
    color: "#202f4a",
    dashed: !isEquity,
    connector: "straight",
    arrowStart: false,
    arrowEnd: !isEquity,
  });
  render();
}

function center(e) { return { x: e.x + e.w / 2, y: e.y + e.h / 2 }; }

function setSelection(sel) {
  state.selection = sel;
  el.entityEditor.classList.add("hidden");
  el.relationshipEditor.classList.add("hidden");

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
    el.relConnector.value = rel.connector || "straight";
    el.relArrowStart.checked = Boolean(rel.arrowStart);
    el.relArrowEnd.checked = Boolean(rel.arrowEnd);
  }

  render();
}

function createShape(entity, dx = 0, dy = 0) {
  const shape = entity.shape;
  const nodes = [];

  function styleShape(node, fill) {
    node.setAttribute("fill", fill);
    node.setAttribute("class", "shape");
    nodes.push(node);
  }

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

  if (shape === "circle") {
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
  const c = 18;
  oct.setAttribute("points", `${x + c},${y} ${x + entity.w - c},${y} ${x + entity.w},${y + c} ${x + entity.w},${y + entity.h - c} ${x + entity.w - c},${y + entity.h} ${x + c},${y + entity.h} ${x},${y + entity.h - c} ${x},${y + c}`);
  styleShape(oct, entity.fill);
  return nodes;
}

function relationshipPath(rel, a, b) {
  if (rel.connector !== "elbow") {
    return { d: `M ${a.x} ${a.y} L ${b.x} ${b.y}`, labelX: (a.x + b.x) / 2, labelY: (a.y + b.y) / 2 };
  }

  const horizontalFirst = Math.abs(a.x - b.x) >= Math.abs(a.y - b.y);
  if (horizontalFirst) {
    const midX = (a.x + b.x) / 2;
    return {
      d: `M ${a.x} ${a.y} L ${midX} ${a.y} L ${midX} ${b.y} L ${b.x} ${b.y}`,
      labelX: midX + 6,
      labelY: (a.y + b.y) / 2 - 8,
    };
  }

  const midY = (a.y + b.y) / 2;
  return {
    d: `M ${a.x} ${a.y} L ${a.x} ${midY} L ${b.x} ${midY} L ${b.x} ${b.y}`,
    labelX: (a.x + b.x) / 2 + 6,
    labelY: midY - 8,
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
    if (rel.arrowStart) path.setAttribute("marker-start", "url(#arrowhead)");
    if (rel.arrowEnd) path.setAttribute("marker-end", "url(#arrowhead)");

    path.addEventListener("click", (evt) => {
      evt.stopPropagation();
      setSelection({ type: "relationship", id: rel.id });
    });

    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("x", pathSpec.labelX);
    label.setAttribute("y", pathSpec.labelY);
    label.setAttribute("class", "rel-label");
    label.setAttribute("fill", rel.color || "#202f4a");
    label.textContent = rel.percent ? `${rel.label} (${rel.percent})` : rel.label;

    el.viewport.append(path, label);
  }
}

function drawEntities() {
  for (const entity of state.entities) {
    const group = document.createElementNS(svgNS, "g");
    group.setAttribute("class", `entity ${state.selection?.type === "entity" && state.selection.id === entity.id ? "selected" : ""}`);
    group.setAttribute("data-id", entity.id);

    const stackCount = Math.max(1, Math.min(6, Number(entity.stackCount || 1)));
    for (let i = stackCount - 1; i >= 0; i--) {
      const dx = i * 8;
      const dy = i * -8;
      for (const node of createShape(entity, dx, dy)) group.appendChild(node);
    }

    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("x", entity.x + entity.w / 2);
    label.setAttribute("y", entity.y + entity.h / 2 - 2);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-weight", "600");
    label.textContent = entity.label;

    const sub = document.createElementNS(svgNS, "text");
    sub.setAttribute("x", entity.x + entity.w / 2);
    sub.setAttribute("y", entity.y + entity.h / 2 + 16);
    sub.setAttribute("text-anchor", "middle");
    sub.setAttribute("font-size", "12");
    sub.setAttribute("fill", "#4d5d7a");
    sub.textContent = entity.jurisdiction || entity.type;

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
    const button = document.createElement("button");
    button.className = "palette-item";
    button.dataset.type = spec.type;
    button.innerHTML = `<svg viewBox="0 0 44 34" aria-hidden="true">${renderPaletteShape(spec)}</svg><span><span class="title">${spec.type}</span><span class="desc">${spec.description}</span></span>`;
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
    if (!spec) return;
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

  el.relLabel.addEventListener("input", () => {
    const rel = relById(state.selection?.id);
    if (!rel) return;
    rel.label = el.relLabel.value;
    render();
  });

  el.relPercent.addEventListener("input", () => {
    const rel = relById(state.selection?.id);
    if (!rel) return;
    rel.percent = el.relPercent.value;
    render();
  });

  el.relKind.addEventListener("input", () => {
    const rel = relById(state.selection?.id);
    if (!rel) return;
    rel.kind = el.relKind.value;
    if (rel.kind === "ownership") {
      rel.dashed = false;
      if (!rel.arrowStart && !rel.arrowEnd) rel.arrowEnd = false;
    } else {
      rel.dashed = true;
      if (!rel.arrowStart && !rel.arrowEnd) rel.arrowEnd = true;
    }
    render();
  });

  el.relColor.addEventListener("input", () => {
    const rel = relById(state.selection?.id);
    if (!rel) return;
    rel.color = el.relColor.value;
    render();
  });

  el.relLineStyle.addEventListener("input", () => {
    const rel = relById(state.selection?.id);
    if (!rel) return;
    rel.dashed = el.relLineStyle.value === "dashed";
    render();
  });

  el.relConnector.addEventListener("input", () => {
    const rel = relById(state.selection?.id);
    if (!rel) return;
    rel.connector = el.relConnector.value;
    render();
  });

  el.relArrowStart.addEventListener("change", () => {
    const rel = relById(state.selection?.id);
    if (!rel) return;
    rel.arrowStart = el.relArrowStart.checked;
    render();
  });

  el.relArrowEnd.addEventListener("change", () => {
    const rel = relById(state.selection?.id);
    if (!rel) return;
    rel.arrowEnd = el.relArrowEnd.checked;
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
    state.relationships = state.relationships.filter((x) => x.id !== state.selection.id);
    setSelection(null);
  });

  document.getElementById("zoomIn").addEventListener("click", () => {
    state.zoom = Math.min(2, state.zoom + 0.1);
    render();
  });

  document.getElementById("zoomOut").addEventListener("click", () => {
    state.zoom = Math.max(0.4, state.zoom - 0.1);
    render();
  });

  document.getElementById("zoomReset").addEventListener("click", () => {
    state.zoom = 1;
    render();
  });

  document.getElementById("clearBtn").addEventListener("click", () => {
    state.entities = [];
    state.relationships = [];
    setSelection(null);
    render();
  });

  el.saveBtn.addEventListener("click", () => {
    const saves = JSON.parse(localStorage.getItem("tax-diagram-saves") || "[]");
    saves.unshift({
      name: `Diagram ${new Date().toLocaleString()}`,
      data: {
        mode: "select",
        zoom: state.zoom,
        panX: state.panX,
        panY: state.panY,
        entities: state.entities,
        relationships: state.relationships,
      },
    });
    localStorage.setItem("tax-diagram-saves", JSON.stringify(saves.slice(0, 5)));
    refreshSaves();
  });

  document.getElementById("exportSvg").addEventListener("click", () => {
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(el.canvas);
    download("tax-diagram.svg", `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`);
  });

  document.getElementById("exportPng").addEventListener("click", () => {
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(el.canvas);
    const img = new Image();
    const svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1400;
      canvas.height = 900;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      download("tax-diagram.png", canvas.toDataURL("image/png"));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

initPalette();
wireUi();
setupPointerEvents();
refreshSaves();
render();
