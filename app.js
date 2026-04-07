const state = {
  mode: "select",
  zoom: 1,
  panX: 0,
  panY: 0,
  entities: [],
  relationships: [],
  selection: null,
  connectBuffer: null,
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

function addEntity(type) {
  const id = uid();
  state.entities.push({
    id,
    type,
    label: `${type} ${state.entities.length + 1}`,
    jurisdiction: "",
    x: 250 + state.entities.length * 30,
    y: 180 + state.entities.length * 25,
    w: 170,
    h: 70,
  });
  render();
}

function addRelationship(fromId, toId, kind) {
  const id = uid();
  state.relationships.push({
    id,
    fromId,
    toId,
    kind,
    label: kind === "ownership" ? "Ownership" : "Transaction",
    percent: "",
    dashed: false,
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
  } else {
    const rel = state.relationships.find((x) => x.id === sel.id);
    el.selectionHint.textContent = `Selected relationship: ${rel.label}`;
    el.relationshipEditor.classList.remove("hidden");
    el.relLabel.value = rel.label;
    el.relPercent.value = rel.percent;
  }

  render();
}

function drawRelationships() {
  for (const rel of state.relationships) {
    const from = state.entities.find((e) => e.id === rel.fromId);
    const to = state.entities.find((e) => e.id === rel.toId);
    if (!from || !to) continue;

    const a = entityCenter(from);
    const b = entityCenter(to);

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(a.x));
    line.setAttribute("y1", String(a.y));
    line.setAttribute("x2", String(b.x));
    line.setAttribute("y2", String(b.y));
    line.setAttribute("class", `rel-line ${rel.dashed ? "dashed" : ""}`);
    if (rel.kind === "transaction") line.setAttribute("marker-end", "url(#arrowhead)");

    line.addEventListener("click", (evt) => {
      evt.stopPropagation();
      setSelection({ type: "relationship", id: rel.id });
    });

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", String((a.x + b.x) / 2 + 4));
    label.setAttribute("y", String((a.y + b.y) / 2 - 6));
    label.setAttribute("class", "rel-label");
    label.textContent = rel.percent ? `${rel.label} (${rel.percent})` : rel.label;

    el.viewport.appendChild(line);
    el.viewport.appendChild(label);
  }
}

function drawEntities() {
  for (const entity of state.entities) {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute(
      "class",
      `entity ${state.selection?.type === "entity" && state.selection.id === entity.id ? "selected" : ""}`
    );

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", String(entity.x));
    rect.setAttribute("y", String(entity.y));
    rect.setAttribute("width", String(entity.w));
    rect.setAttribute("height", String(entity.h));

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", String(entity.x + 10));
    label.setAttribute("y", String(entity.y + 28));
    label.textContent = entity.label;

    const sub = document.createElementNS("http://www.w3.org/2000/svg", "text");
    sub.setAttribute("x", String(entity.x + 10));
    sub.setAttribute("y", String(entity.y + 50));
    sub.setAttribute("font-size", "12");
    sub.setAttribute("fill", "#52627f");
    sub.textContent = entity.jurisdiction || entity.type;

    let dragStart = null;

    group.addEventListener("mousedown", (evt) => {
      evt.stopPropagation();
      if (state.mode === "select") {
        dragStart = { x: evt.clientX, y: evt.clientY, ex: entity.x, ey: entity.y };
      }
    });

    window.addEventListener("mousemove", (evt) => {
      if (!dragStart || state.mode !== "select") return;
      const dx = (evt.clientX - dragStart.x) / state.zoom;
      const dy = (evt.clientY - dragStart.y) / state.zoom;
      entity.x = dragStart.ex + dx;
      entity.y = dragStart.ey + dy;
      render();
    });

    window.addEventListener("mouseup", () => {
      dragStart = null;
    });

    group.addEventListener("click", (evt) => {
      evt.stopPropagation();
      if (state.mode === "select") {
        setSelection({ type: "entity", id: entity.id });
        return;
      }

      if (!state.connectBuffer) {
        state.connectBuffer = entity.id;
        el.selectionHint.textContent = `Selected source: ${entity.label}. Click target entity.`;
      } else if (state.connectBuffer !== entity.id) {
        addRelationship(state.connectBuffer, entity.id, state.mode);
        state.connectBuffer = null;
      }
    });

    group.append(rect, label, sub);
    el.viewport.appendChild(group);
  }
}

function render() {
  el.viewport.innerHTML = "";
  el.viewport.setAttribute("transform", `translate(${state.panX} ${state.panY}) scale(${state.zoom})`);
  drawRelationships();
  drawEntities();
}

function setupPan() {
  let start = null;
  el.canvas.addEventListener("mousedown", (evt) => {
    if (evt.target !== el.canvas) return;
    start = { x: evt.clientX, y: evt.clientY, ox: state.panX, oy: state.panY };
    setSelection(null);
  });
  window.addEventListener("mousemove", (evt) => {
    if (!start) return;
    state.panX = start.ox + (evt.clientX - start.x);
    state.panY = start.oy + (evt.clientY - start.y);
    render();
  });
  window.addEventListener("mouseup", () => {
    start = null;
  });
}

function refreshSaves() {
  const saves = JSON.parse(localStorage.getItem("tax-diagram-saves") || "[]");
  el.savedDiagrams.innerHTML = "";
  saves.forEach((save, idx) => {
    const node = el.template.content.firstElementChild.cloneNode(true);
    node.querySelector(".name").textContent = save.name;
    node.querySelector(".load").addEventListener("click", () => {
      Object.assign(state, save.data, { selection: null, connectBuffer: null });
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
    const btn = evt.target.closest("button[data-type]");
    if (btn) addEntity(btn.dataset.type);
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

wireUi();
setupPan();
refreshSaves();
render();
