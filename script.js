/**
 * ========================================================================
 * 1. CONFIGURATION
 * ========================================================================
 */
const CONFIG = {
  PBKDF2_ITERATIONS: 100000,
  BATCH_SIZE: 10,
  INACTIVITY_TIMEOUT: 60000, // 60s
  MAX_IMAGE_DIM: 4096, // 4K cap for GPU safety
};

/**
 * ========================================================================
 * 2. CORE ENGINES
 * ========================================================================
 */

const CryptoEngine = {
  _canvas: document.createElement("canvas"),

  async deriveKey(password, salt) {
    const enc = new TextEncoder();
    const baseKey = await window.crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      false,
      ["deriveBits", "deriveKey"],
    );
    return window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: CONFIG.PBKDF2_ITERATIONS,
        hash: "SHA-256",
      },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  },

  async stripAndClean(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        let w = img.width,
          h = img.height;
        if (Math.max(w, h) > CONFIG.MAX_IMAGE_DIM) {
          const ratio = CONFIG.MAX_IMAGE_DIM / Math.max(w, h);
          w *= ratio;
          h *= ratio;
        }
        this._canvas.width = w;
        this._canvas.height = h;
        const ctx = this._canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        this._canvas.toBlob(
          (b) => {
            URL.revokeObjectURL(url);
            if (!b) return reject();
            b.arrayBuffer().then(resolve);
          },
          "image/jpeg",
          0.95,
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject();
      };
      img.src = url;
    });
  },
};

const SecurityVault = {
  cache: new Map(),
  blobUrls: [],
  timer: null,

  init() {
    const reset = () => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.lock(), CONFIG.INACTIVITY_TIMEOUT);
    };
    ["mousemove", "keydown", "click", "scroll"].forEach((e) =>
      window.addEventListener(e, reset),
    );
    reset();
  },

  lock() {
    this.purge();
    document.getElementById("lockScreen").classList.add("active");
    Lightbox.close();
  },

  purge() {
    this.cache.clear();
    this.blobUrls.forEach(URL.revokeObjectURL);
    this.blobUrls = [];
    document.getElementById("galleryGrid").innerHTML = "";
    document
      .querySelectorAll('input:not([type="radio"])')
      .forEach((i) => (i.value = ""));
  },
};

/**
 * ========================================================================
 * 3. UI COMPONENTS
 * ========================================================================
 */

const Tabs = {
  show(id) {
    document
      .querySelectorAll(".tab-content, .tab-link")
      .forEach((e) => e.classList.remove("active"));
    document.getElementById(id).classList.add("active");
    document
      .querySelector(`[onclick="Tabs.show('${id}')"]`)
      .classList.add("active");
    SecurityVault.purge();
  },
  toggleInputMode() {
    const isZip = document.getElementById("modeZip").checked;
    document.getElementById("boxZip").style.display = isZip ? "block" : "none";
    document.getElementById("boxFolder").style.display = isZip
      ? "none"
      : "block";
  },
  notify(msg, type = "info") {
    const div = document.createElement("div");
    div.className = `toast ${type === "error" ? "error" : ""}`;
    div.innerText = msg;
    document.getElementById("toasts").appendChild(div);
    setTimeout(() => div.remove(), 3000);
  },
};

const Lightbox = {
  scale: 1,
  pos: { x: 0, y: 0 },
  start: { x: 0, y: 0 },
  isPanning: false,

  init() {
    const over = document.getElementById("zoomOverlay");
    const img = document.getElementById("zoomImage");

    over.onmousedown = (e) => {
      this.isPanning = true;
      this.start = { x: e.clientX - this.pos.x, y: e.clientY - this.pos.y };
    };
    window.onmouseup = () => (this.isPanning = false);
    over.onmousemove = (e) => {
      if (!this.isPanning) return;
      this.pos = { x: e.clientX - this.start.x, y: e.clientY - this.start.y };
      this.update();
    };
    over.onwheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.8 : 1.2;
      this.scale *= delta;
      this.update();
    };
    // Mobile Support
    over.ontouchstart = (e) => {
      if (e.touches.length === 1) {
        this.isPanning = true;
        this.start = {
          x: e.touches[0].clientX - this.pos.x,
          y: e.touches[0].clientY - this.pos.y,
        };
      }
    };
    over.ontouchmove = (e) => {
      if (!this.isPanning || e.touches.length !== 1) return;
      this.pos = {
        x: e.touches[0].clientX - this.start.x,
        y: e.touches[0].clientY - this.start.y,
      };
      this.update();
    };
    over.ontouchend = () => (this.isPanning = false);
  },

  open(id, name) {
    const bytes = SecurityVault.cache.get(id);
    const url = URL.createObjectURL(new Blob([bytes], { type: "image/jpeg" }));
    const img = document.getElementById("zoomImage");
    img.src = url;
    document.getElementById("zoomTitle").innerText = name;
    document.getElementById("lightbox").classList.add("active");
    this.scale = 1;
    this.pos = { x: 0, y: 0 };
    this.update();
  },

  close() {
    document.getElementById("lightbox").classList.remove("active");
    const img = document.getElementById("zoomImage");
    if (img.src) URL.revokeObjectURL(img.src);
    img.src = "";
  },

  update() {
    const img = document.getElementById("zoomImage");
    img.style.transform = `translate(${this.pos.x}px, ${this.pos.y}px) scale(${this.scale})`;
  },
};

/**
 * ========================================================================
 * 4. APPLICATION LOGIC
 * ========================================================================
 */

const App = {
  queue: [],
  idx: 0,
  password: null,

  async runEncryption() {
    const files = document.getElementById("inputFiles").files;
    const pass = document.getElementById("inputPassEnc").value;
    const btn = document.getElementById("btnRunEnc");

    if (!files.length || pass.length < 8)
      return Tabs.notify("Select images and a strong password.", "error");

    btn.disabled = true;
    try {
      const zip = new JSZip();
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        Tabs.notify(`Encrypting: ${file.name}`);

        const raw = await CryptoEngine.stripAndClean(file);
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const key = await CryptoEngine.deriveKey(pass, salt);

        const encrypted = await window.crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          key,
          raw,
        );

        const payload = new Uint8Array(16 + 12 + encrypted.byteLength);
        payload.set(salt, 0);
        payload.set(iv, 16);
        payload.set(new Uint8Array(encrypted), 28);

        zip.file(file.name + ".enc", payload);
        await new Promise((r) => setTimeout(r, 20)); // Yield to UI
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Vault_${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      Tabs.notify("Vault created!", "success");
      SecurityVault.purge();
    } catch (e) {
      Tabs.notify("Encryption failed.", "error");
    } finally {
      btn.disabled = false;
    }
  },

  async runDecryption() {
    const isZip = document.getElementById("modeZip").checked;
    const pass = document.getElementById("inputPassDec").value;
    const btn = document.getElementById("btnRunDec");

    SecurityVault.purge();
    if (!pass) return Tabs.notify("Enter password.", "error");
    this.password = pass;

    btn.disabled = true;
    try {
      if (isZip) {
        const file = document.getElementById("inputZip").files[0];
        if (!file) throw new Error("Select ZIP.");
        const zip = await JSZip.loadAsync(file);
        this.queue = [];
        zip.forEach((path, entry) => {
          if (path.endsWith(".enc")) this.queue.push(entry);
        });
      } else {
        const files = document.getElementById("inputFolder").files;
        this.queue = Array.from(files).filter((f) => f.name.endsWith(".enc"));
      }

      if (!this.queue.length) throw new Error("No encrypted files found.");
      this.idx = 0;
      await this.loadNextBatch();
    } catch (e) {
      Tabs.notify(e.message, "error");
    } finally {
      btn.disabled = false;
    }
  },

  async loadNextBatch() {
    const grid = document.getElementById("galleryGrid");
    const status = document.getElementById("batchStatus");
    const btn = document.getElementById("btnLoadMore");
    btn.style.display = "none";

    const end = Math.min(this.idx + CONFIG.BATCH_SIZE, this.queue.length);
    status.innerText = `Unlocking ${this.idx + 1} to ${end}...`;

    for (let i = this.idx; i < end; i++) {
      const entry = this.queue[i];
      try {
        const buffer = entry.async
          ? await entry.async("arraybuffer")
          : await entry.arrayBuffer();
        const payload = new Uint8Array(buffer);
        const salt = payload.slice(0, 16);
        const iv = payload.slice(16, 28);
        const ciphertext = payload.slice(28);

        const key = await CryptoEngine.deriveKey(this.password, salt);
        const decrypted = await window.crypto.subtle.decrypt(
          { name: "AES-GCM", iv },
          key,
          ciphertext,
        );

        this.renderCard(new Uint8Array(decrypted), entry.name);
      } catch (e) {
        console.warn("Failed file:", entry.name);
      }
      await new Promise((r) => setTimeout(r, 20));
    }

    this.idx = end;
    status.innerText = `Showing ${this.idx} of ${this.queue.length} items.`;
    if (this.idx < this.queue.length) btn.style.display = "block";
  },

  renderCard(bytes, name) {
    const id = "id_" + Math.random().toString(36).substr(2, 9);
    SecurityVault.cache.set(id, bytes);

    const blob = new Blob([bytes], { type: "image/jpeg" });
    const url = URL.createObjectURL(blob);
    SecurityVault.blobUrls.push(url);

    const div = document.createElement("div");
    div.className = "gallery-card";
    div.innerHTML = `
            <div class="img-container" onclick="Lightbox.open('${id}', '${name}')">
                <img src="${url}">
            </div>
            <div class="card-actions">
                <button class="btn btn-sm btn-secondary" onclick="App.saveFile('${id}', '${name}')">💾 Save</button>
            </div>
        `;
    document.getElementById("galleryGrid").appendChild(div);
  },

  saveFile(id, name) {
    const bytes = SecurityVault.cache.get(id);
    const url = URL.createObjectURL(new Blob([bytes], { type: "image/jpeg" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name.replace(".enc", "");
    a.click();
    URL.revokeObjectURL(url);
  },
};

SecurityVault.init();
Lightbox.init();
