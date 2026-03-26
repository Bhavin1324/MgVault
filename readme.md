# 🔒 Zero-Knowledge Local Vault

A military-grade, air-gapped personal photo vault built entirely in a single HTML file.

This utility allows you to encrypt, zip, and view sensitive images purely within your browser's local memory using the native Web Crypto API. **No backends, no databases, no cloud uploads, and zero tracking.**

## ✨ Features

### 🛡️ Core Security

* **Zero-Knowledge Architecture:** Everything runs client-side. Your plaintext images and passwords never touch a network.
* **Military-Grade Cryptography:** Uses **AES-256-GCM** for authenticated encryption and **PBKDF2** (100,000 iterations) for rigorous key derivation.
* **Automatic EXIF Stripping:** Before encryption, images are repainted via an HTML5 `<canvas>` to permanently destroy hidden metadata (GPS coordinates, timestamps, camera models).
* **60-Second Kill Switch:** A background event listener tracks mouse and touch activity. After 60 seconds of inactivity, it automatically purges the RAM cache, destroys the DOM elements, and locks the screen.
* **Anti-Leak Memory Management:** Aggressively uses `URL.revokeObjectURL()` and explicit variable clearing to prevent decrypted bytes from lingering in the JavaScript Garbage Collector.

### 💻 User Experience

* **Batch Processing & ZIP Integration:** Encrypt hundreds of images at once. The app securely packages them into a single `Vault.zip` file purely in RAM using `JSZip`.
* **Direct ZIP Unlocking:** No need to extract your zip file manually. Upload the `Vault.zip` directly into the decryptor, and the app will unzip and decrypt the contents on the fly.
* **Interactive Secure Lightbox:** Click any decrypted image to view it full screen. Supports mouse-wheel zoom/pan on desktop and pinch-to-zoom on mobile devices.
* **Responsive & Native Feel:** Built with modern CSS variables, Grid, and Flexbox to look and feel like a native application on both desktop and iOS/Android browsers.

---

## 🚀 How to Use (No Installation Required)

Because this is designed to be an air-gapped utility, there are no `npm installs`, no build steps, and no dependencies to manage.

1. **Download:** Clone this repository or simply download the `index.html` file.
2. **Run:** Double-click `index.html` to open it in any modern web browser (Chrome, Firefox, Safari, Edge).
3. *(Optional but Recommended)* **Go Offline:** For absolute maximum security, disconnect your computer from the internet before opening the file.

### Workflow: Locking Images

1. Go to the **Encrypt & Zip** tab.
2. Select your raw images (JPEG, PNG, etc.).
3. Enter a strong master password (minimum 8 characters).
4. Click **Encrypt**. The app will strip EXIF data, encrypt the files, and prompt you to download a single `.zip` archive.

### Workflow: Unlocking the Vault

1. Go to the **View Vault** tab.
2. Select the `Vault.zip` file you previously downloaded (or select an extracted folder of `.enc` files).
3. Enter your exact master password.
4. The images will decrypt in batches of 10 and display in a secure gallery. Close the tab or walk away for 60 seconds to wipe the memory.

---

## 🏗️ Technical Architecture & Dependencies

This project is built using:

* **Vanilla HTML5, CSS3, JavaScript (ES6+)**
* **Web Crypto API:** Native browser API used for all cryptographic operations.
* **JSZip:** The only external library, used for creating and reading `.zip` archives in memory.

> **⚠️ Air-Gap Security Notice:** > By default, the `index.html` file fetches `JSZip` from a CDN (`cdnjs.cloudflare.com`). For a truly offline, air-gapped setup, download the `jszip.min.js` file, remove the CDN `<script>` tag, and embed the minified JSZip code directly into the HTML file.

---

## 🛑 Threat Model & Limitations

While the cryptography (AES-256-GCM) is mathematically unbreakable, **the web browser environment is not flawless.** Please be aware of the following limitations:

1. **Malicious Browser Extensions:** Browser extensions (like ad-blockers or grammar checkers) with "Read all site data" permissions can theoretically scrape DOM data. **Always run this utility in an extension-free Incognito/Private window.**
2. **OS RAM Swapping (Pagefiles):** If your computer runs out of physical RAM while decrypting heavy images, your Operating System may temporarily write the browser's active memory to your hard drive.
3. **Host Compromise:** This tool cannot protect you if your host machine is infected with a keylogger or screen-recording malware.
4. **Browser Memory Limits:** Web browsers limit how much RAM a single tab can consume. Attempting to decrypt a single `Vault.zip` file larger than 1GB may cause mobile browsers (like iOS Safari) to crash. Keep your ZIP files organized into smaller batches.

---

## ⚖️ License & Disclaimer

This software is provided "as is", without warranty of any kind, express or implied. The authors are not responsible for any lost data, forgotten passwords (there is no recovery mechanism), or security breaches resulting from compromised host machines.

**Remember your password. If you lose it, your photos are gone forever.**
