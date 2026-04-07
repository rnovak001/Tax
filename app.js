const ENTITY_TYPES = [
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
  entityJurisdiction: document.getElementById("entityJurisdiction"),
  entityStackCount: document.getElementById("entityStackCount"),
  relLabel: document.getElementById("relLabel"),
  relPercent: document.getElementById("relPercent"),
  deleteEntity: document.getElementById("deleteEntity"),
  deleteRel: document.getElementById("deleteRel"),
  toggleDashed: document.getElementById("toggleDashed"),
  saveBtn: document.getElementById("saveBtn"),
  savedDiagrams: document.getElementById("savedDiagrams"),
  template: document.getElementById("saveItemTemplate"),
};

const uid = () => crypto.randomUUID().slice(0, 8);
const svgNS = "http://www.w3.org/2000/svg";

function shapeMetrics(shape) {
  if (shape === "triangle") return { w: 150, h: 84 };
  if (shape === "circle") return { w: 90, h: 90 };
  if (shape === "ellipse") return { w: 128, h: 80 };
  if (shape === "octagon") return { w: 90, h: 90 };
  return { w: 172, h: 76 };
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
    x: 220 + state.entities.length * 28,
    y: 170 + state.entities.length * 24,
    w: dims.w,
    h: dims.h,
  });

  render();
}

function addRelationship(fromId, toId, kind) {
  state.relationships.push({
    id: uid(),
    fromId,
    toId,
    kind,
    label: kind === "ownership" ? "Equity" : "Debt",
    percent: "",
    dashed: kind === "transaction",
  });
  render();
}

function entityCenter(e) {
  return { x: e.x + e.w / 2, y: e.y + e.h / 2 };
}

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
    const entity = state.entities.find((x) => x.id === sel.id);
    el.selectionHint.textContent = `Selected entity: ${entity.label}`;
    el.entityEditor.classList.remove("hidden");
    el.entityLabel.value = entity.label;
    el.entityJurisdiction.value = entity.jurisdiction;
    el.entityStackCount.value = entity.stackCount || 1;
  } else {
    const rel = state.relationships.find((x) => x.id === sel.id);
    el.selectionHint.textContent = `Selected relationship: ${rel.label}`;
    el.relationshipEditor.classList.remove("hidden");
    el.relLabel.value = rel.label;
    el.relPercent.value = rel.percent;
  }

  render();
}

function createShape(entity, dx = 0, dy = 0) {
  const shape = entity.shape;

  if (shape === "rect") {
    const rect = document.createElementNS(svgNS, "rect");
    rect.setAttribute("x", entity.x + dx);
    rect.setAttribute("y", entity.y + dy);
    rect.setAttribute("width", entity.w);
    rect.setAttribute("height", entity.h);
    rect.setAttribute("fill", entity.fill);
    rect.setAttribute("class", "shape");
    return [rect];
  }

  if (shape === "roundedRect") {
    const rect = document.createElementNS(svgNS, "rect");
    rect.setAttribute("x", entity.x + dx);
    rect.setAttribute("y", entity.y + dy);
    rect.setAttribute("width", entity.w);
    rect.setAttribute("height", entity.h);
    rect.setAttribute("fill", entity.fill);
    rect.setAttribute("class", "shape");

    const oval = document.createElementNS(svgNS, "ellipse");
    oval.setAttribute("cx", entity.x + entity.w / 2 + dx);
    oval.setAttribute("cy", entity.y + entity.h / 2 + dy);
    oval.setAttribute("rx", entity.w / 2 - 2);
    oval.setAttribute("ry", entity.h / 2 - 2);
    oval.setAttribute("fill", "none");
    oval.setAttribute("class", "shape");

    return [rect, oval];
  }

  if (shape === "triangle") {
    const poly = document.createElementNS(svgNS, "polygon");
    poly.setAttribute(
      "points",
      `${entity.x + entity.w / 2 + dx},${entity.y + dy} ${entity.x + entity.w + dx},${entity.y + entity.h + dy} ${entity.x + dx},${entity.y + entity.h + dy}`
    );
    poly.setAttribute("fill", entity.fill);
    poly.setAttribute("class", "shape");
    return [poly];
  }

  if (shape === "ellipse") {
    const ellipse = document.createElementNS(svgNS, "ellipse");
    ellipse.setAttribute("cx", entity.x + entity.w / 2 + dx);
    ellipse.setAttribute("cy", entity.y + entity.h / 2 + dy);
    ellipse.setAttribute("rx", entity.w / 2);
    ellipse.setAttribute("ry", entity.h / 2);
    ellipse.setAttribute("fill", entity.fill);
    ellipse.setAttribute("class", "shape");
    return [ellipse];
  }

  if (shape === "circle") {
    const circle = document.createElementNS(svgNS, "circle");
    const r = Math.min(entity.w, entity.h) / 2;
    circle.setAttribute("cx", entity.x + entity.w / 2 + dx);
    circle.setAttribute("cy", entity.y + entity.h / 2 + dy);
    circle.setAttribute("r", r);
    circle.setAttribute("fill", entity.fill);
    circle.setAttribute("class", "shape");
    return [circle];
  }

  const oct = document.createElementNS(svgNS, "polygon");
  const x = entity.x + dx;
  const y = entity.y + dy;
  const w = entity.w;
  const h = entity.h;
  const c = 18;
  oct.setAttribute(
    "points",
    `${x + c},${y} ${x + w - c},${y} ${x + w},${y + c} ${x + w},${y + h - c} ${x + w - c},${y + h} ${x + c},${y + h} ${x},${y + h - c} ${x},${y + c}`
  );
  oct.setAttribute("fill", entity.fill);
  oct.setAttribute("class", "shape");
  return [oct];
}

function drawRelationships() {
  for (const rel of state.relationships) {
    const from = state.entities.find((e) => e.id === rel.fromId);
    const to = state.entities.find((e) => e.id === rel.toId);
    if (!from || !to) continue;

    const a = entityCenter(from);
    const b = entityCenter(to);

    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", a.x);
    line.setAttribute("y1", a.y);
    line.setAttribute("x2", b.x);
    line.setAttribute("y2", b.y);
    line.setAttribute("class", `rel-line ${rel.dashed ? "dashed" : ""}`);
    if (rel.kind === "transaction") line.setAttribute("marker-end", "url(#arrowhead)");

    line.addEventListener("click", (evt) => {
      evt.stopPropagation();
      setSelection({ type: "relationship", id: rel.id });
    });

    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("x", (a.x + b.x) / 2 + 5);
    label.setAttribute("y", (a.y + b.y) / 2 - 6);
    label.setAttribute("class", "rel-label");
    label.textContent = rel.percent ? `${rel.label} (${rel.percent})` : rel.label;

    el.viewport.append(line, label);
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
  if (spec.shape === "roundedRect") {
    return `<rect x="2" y="2" width="40" height="30" fill="${spec.fill}" stroke="#111" stroke-width="1.8"/><ellipse cx="22" cy="17" rx="19" ry="13" fill="none" stroke="#111" stroke-width="1.8"/>`;
  }
  return `<rect x="2" y="2" width="40" height="30" fill="${spec.fill}" stroke="#111" stroke-width="1.8"/>`;
}

function initPalette() {
  el.palette.innerHTML = "";
  for (const spec of ENTITY_TYPES) {
    const button = document.createElement("button");
    button.className = "palette-item";
    button.dataset.type = spec.type;
    button.innerHTML = `
      <svg viewBox="0 0 44 34" aria-hidden="true">${renderPaletteShape(spec)}</svg>
      <span>
        <span class="title">${spec.type}</span>
        <span class="desc">${spec.description}</span>
      </span>
    `;
    el.palette.appendChild(button);
  }
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
    const entity = state.entities.find((x) => x.id === id);

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
      const entity = state.entities.find((x) => x.id === state.dragEntityId);
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
      Object.assign(state, save.data, { selection: null, connectBuffer: null, dragEntityId: null });
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
    const item = state.entities.find((x) => x.id === state.selection?.id);
    if (!item) return;
    item.label = el.entityLabel.value;
    render();
  });

  el.entityJurisdiction.addEventListener("input", () => {
    const item = state.entities.find((x) => x.id === state.selection?.id);
    if (!item) return;
    item.jurisdiction = el.entityJurisdiction.value;
    render();
  });

  el.entityStackCount.addEventListener("input", () => {
    const item = state.entities.find((x) => x.id === state.selection?.id);
    if (!item) return;
    item.stackCount = Math.max(1, Math.min(6, Number(el.entityStackCount.value || 1)));
    render();
  });

  el.relLabel.addEventListener("input", () => {
    const rel = state.relationships.find((x) => x.id === state.selection?.id);
    if (!rel) return;
    rel.label = el.relLabel.value;
    render();
  });

  el.relPercent.addEventListener("input", () => {
    const rel = state.relationships.find((x) => x.id === state.selection?.id);
    if (!rel) return;
    rel.percent = el.relPercent.value;
    render();
  });

  el.deleteEntity.addEventListener("click", () => {
    if (state.selection?.type !== "entity") return;
    state.entities = state.entities.filter((x) => x.id !== state.selection.id);
    state.relationships = state.relationships.filter(
      (x) => x.fromId !== state.selection.id && x.toId !== state.selection.id
    );
    setSelection(null);
  });

  el.deleteRel.addEventListener("click", () => {
    if (state.selection?.type !== "relationship") return;
    state.relationships = state.relationships.filter((x) => x.id !== state.selection.id);
    setSelection(null);
  });

  el.toggleDashed.addEventListener("click", () => {
    const rel = state.relationships.find((x) => x.id === state.selection?.id);
    if (!rel) return;
    rel.dashed = !rel.dashed;
    render();
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
