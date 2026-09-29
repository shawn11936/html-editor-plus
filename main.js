/*
 * HTML Editor Plus —— HTML Viewer Plus 的修改版（增强版）
 *
 * 原版 Original work:
 *   HTML Viewer Plus by lzq
 *   https://github.com/kuaile1407/html-viewer-plus
 *
 * 本作品是对上述原版的修改版（GPL-3.0 第 5 条要求的修改声明）：
 *   修改日期：2026-09-22、2026-09-28
 *   修改内容：可视化编辑（就地编辑文字 / 图片并保存回写原 .html）、
 *             底栏 SVG 图标与手动暗色 / 日间切换、表格分隔线拖拽调宽 / 调高。
 *             完整清单见 README.md。
 *
 * Copyright (C) 2026 lzq（原版 HTML Viewer Plus）与 shawn11936（本修改版）
 *
 * 本程序是自由软件：你可以在自由软件基金会发布的 GNU 通用公共许可证
 * 第 3 版（或由你选择的任何更新版本）的条款下重新发布它和 / 或修改它。
 *
 * 本程序的发布是希望它有用，但不附带任何担保；甚至没有适销性或
 * 特定用途适用性的默示担保。详见 GNU 通用公共许可证（LICENSE 文件）。
 */

const obsidian = require("obsidian");
const path = require("path");

var _hvpId = 0;
var _hvpDebug = true; // 2026-09-22 暂时打开，用于排查关闭对话框不弹的问题
var _hvpLogPath = null;
var _hvpLogBuf = [];
var _hvpLogTimer = null;
function _hvpLog(msg) {
	if (!_hvpDebug) return;
	var line = new Date().toISOString().substr(11, 12) + " [" + (++_hvpId) + "] " + msg;
	console.log("[HVP] " + line);
	if (_hvpLogPath) {
		_hvpLogBuf.push(line);
		if (!_hvpLogTimer) {
			_hvpLogTimer = setTimeout(function() {
				var buf = _hvpLogBuf.splice(0);
				_hvpLogTimer = null;
				if (buf.length > 0) {
					try { require("fs").appendFileSync(_hvpLogPath, buf.join("\n") + "\n"); } catch(e) {}
				}
			}, 500);
		}
	}
}

// --- 内联 SVG 图标（2026-09-22）：不用字体图标，跨设备一致 ---
function svgIcon(name, size) {
	var s = size || 16;
	var d = {
		close: 'M6 6 L18 18 M18 6 L6 18',
		bold: 'M7 5 H13.5 a3.5 3.5 0 0 1 0 7 H7 Z M7 12 H15 a3.5 3.5 0 0 1 0 7 H7 Z',
		italic: 'M10 5 H18 M6 19 H14 M14 5 L10 19',
		underline: 'M6 4 V11 a6 6 0 0 0 12 0 V4 M5 20 H19',
		color: 'M12 4 L18 19 H15.5 L14.3 16 H9.7 L8.5 19 H6 Z',
		alignLeft: 'M4 6 H20 M4 10 H14 M4 14 H20 M4 18 H14',
		alignCenter: 'M4 6 H20 M7 10 H17 M4 14 H20 M7 18 H17',
		alignRight: 'M4 6 H20 M10 10 H20 M4 14 H20 M10 18 H20',
		fontInc: 'M2 20 L7 6 L12 20 M4 15.5 H10 M15 13 H21 M18 10 V16',
		fontDec: 'M2 20 L7 6 L12 20 M4 15.5 H10 M15 10 V16',
		dark: 'M20 14.5 A8.5 8.5 0 1 1 9.5 4 a7 7 0 0 0 10.5 10.5 Z',
		sun: 'M12 7 a5 5 0 1 0 0 10 a5 5 0 0 0 0 -10 Z M12 2 V4 M12 20 V22 M2 12 H4 M20 12 H22 M5 5 L6.5 6.5 M17.5 17.5 L19 19 M19 5 L17.5 6.5 M6.5 17.5 L5 19',
		refresh: 'M20 12 a8 8 0 1 1 -2.3 -5.6 M20 4 V9 H15',
		edit: 'M4 20 L4.5 16.5 L15.5 5.5 L18.5 8.5 L7.5 19.5 Z M14 7 L17 10',
		fullscreen: 'M4 9 V4 H9 M15 4 H20 V9 M20 15 V20 H15 M9 20 H4 V15',
		external: 'M14 4 H20 V10 M20 4 L11 13 M18 14 V19 H5 V6 H10',
		locate: 'M4 12 H20 M14 6 L20 12 L14 18',
		inlineCode: 'M8 8 L4 12 L8 16 M16 8 L20 12 L16 16',
		quote: 'M6 6 H11 V11 H8 V15 M13 6 H18 V11 H15 V15',
		hr: 'M3 12 H21 M7 6 H17 M7 18 H17'
	}[name] || 'M4 4 H20 V20 H4 Z';
	var fill = (name === 'bold');
	return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="' +
		(fill ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.8" ' +
		'stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>';
}

const VIEW_TYPE = "html-editor-plus";
const HTML_EXT = ["htm", "html", "shtml", "xht", "xhtml"];
const MHTML_EXT = ["mht", "mhtml"];

const DEFAULT_SETTINGS = {
	defaultWidth: "100%",
	aspectRatio: "4/3",
	showToolbar: true,
	enableZoom: true,
	zoomStep: 0.1,
	syncDarkTheme: true,
	customDarkCSS: "",
	enableSearch: true,
	bgColor: "#ffffff",
	bgColorEnabled: false,
	hotRefresh: false,
	mhtmlSupport: true,
};

// --- Blob URL Cache: share blob URLs for same file + dark theme combo ---
var _blobCache = {};
var _blobCacheOrder = []; // LRU order
var _blobCacheMax = 30;
function _cacheKey(file, dark) { return file.path + "|" + (dark ? "1" : "0"); }
function _getCachedBlob(key) { return _blobCache[key] || null; }
function _setCachedBlob(key, url) {
	_evictBlob(key); // remove old if exists
	_blobCache[key] = url;
	_blobCacheOrder.push(key);
	// LRU eviction
	while (_blobCacheOrder.length > _blobCacheMax) {
		var oldKey = _blobCacheOrder.shift();
		var oldUrl = _blobCache[oldKey];
		if (oldUrl) { URL.revokeObjectURL(oldUrl); delete _blobCache[oldKey]; }
	}
}
function _evictBlob(key) {
	var url = _blobCache[key];
	if (url) { URL.revokeObjectURL(url); delete _blobCache[key]; }
	var idx = _blobCacheOrder.indexOf(key);
	if (idx !== -1) _blobCacheOrder.splice(idx, 1);
}
function _clearAllBlobs() {
	for (var k in _blobCache) { URL.revokeObjectURL(_blobCache[k]); }
	_blobCache = {};
	_blobCacheOrder = [];
}

// --- Pending reads dedup: share in-flight read result ---
var _pendingReads = {};
function _readFile(vault, file) {
	var fp = file.path;
	if (_pendingReads[fp]) return _pendingReads[fp];
	var p = vault.read(file);
	_pendingReads[fp] = p;
	var done = function() { delete _pendingReads[fp]; };
	p.then(done, done);
	return p;
}

function parseSize(v) {
	if (!v) return null;
	return v === String(Number(v)) ? v + "px" : v;
}

function parseAspectRatio(v) {
	if (!v) return "4/3";
	if (v.indexOf(":") !== -1) {
		var parts = v.split(":");
		return (parseFloat(parts[0]) / parseFloat(parts[1])).toString();
	}
	if (v.indexOf("/") !== -1) return v;
	return v;
}

function parseSubpath(sp) {
	if (!sp) return null;
	if (sp.charAt(0) !== "#") sp = "#" + sp;
	var rest = sp.substring(1);
	return { elementId: decodeURIComponent(rest) };
}

function isDark() {
	return document.body.classList.contains("theme-dark");
}

function themeColors() {
	var s = getComputedStyle(document.body);
	return {
		bg: s.getPropertyValue("--background-primary").trim(),
		bg2: s.getPropertyValue("--background-secondary").trim(),
		text: s.getPropertyValue("--text-normal").trim(),
		border: s.getPropertyValue("--background-modifier-border").trim(),
		accent: s.getPropertyValue("--interactive-accent").trim(),
	};
}

function darkCSS(c, extra) {
	return (
		"body{background:" + c.bg + "!important;color:" + c.text + "!important}" +
		"table,th,td{border-color:" + c.border + "!important}" +
		"input,textarea,select{background:" + c.bg2 + "!important;color:" + c.text + "!important}" +
		"a{color:" + c.accent + "!important}" +
		"pre,code{background:" + c.bg2 + "!important;color:" + c.text + "!important}" +
		(extra || "")
	);
}

function parseMhtml(raw) {
	var m = raw.match(/boundary="?([^"\s;\r\n]+)"?/i);
	if (!m) return raw;
	var parts = raw.split("--" + m[1]);
	for (var i = 0; i < parts.length; i++) {
		var p = parts[i];
		if (!/Content-Type:\s*text\/html/i.test(p)) continue;
			var idx = p.indexOf("\r\n\r\n");
			var skip = 4;
			if (idx === -1) { idx = p.indexOf("\n\n"); skip = 2; }
			if (idx === -1) continue;
			var body = p.substring(idx + skip);
		if (/Content-Transfer-Encoding:\s*quoted-printable/i.test(p)) {
			body = body.replace(/=\r?\n/g, "").replace(/=([0-9A-Fa-f]{2})/g, function(_, h) {
				return String.fromCharCode(parseInt(h, 16));
			});
		} else if (/Content-Transfer-Encoding:\s*base64/i.test(p)) {
			try { body = atob(body.trim()); } catch (e) {}
		}
		return body.trim();
	}
	return raw;
}

function makeBtn(parent, text, title, cls, onClick) {
	var btn = parent.createEl("button", { cls: cls, attr: { title: title }, text: text });
	btn.addEventListener("click", function(e) { e.preventDefault(); e.stopPropagation(); onClick(); });
	return btn;
}

// --- HtmlRenderer ---

function HtmlRenderer(plugin, containerEl, file, isFullView) {
	this.plugin = plugin;
	this.s = plugin.settings;
	this.containerEl = containerEl;
	this.file = file;
	this.isFullView = isFullView;
	this.subpath = "";
	this.iframe = null;
	this.toolbar = null;
	this.zoom = 1;
	this.zoomDisplay = null;
	this.searchBar = null;
	this.searchCount = null;
	this._themeObs = null;
}

HtmlRenderer.prototype.render = function() {
	var self = this;
	_hvpLog("render " + (this.isFullView ? "fullView" : "embed") + " file=" + (this.file ? this.file.name : "?") + " subpath=" + this.subpath);
	this.containerEl.empty();
	this.containerEl.addClass("html-viewer-container");

	if (!this.isFullView) {
		var badge = this.containerEl.createDiv({ cls: "html-viewer-badge", text: "< >" });
		badge.addEventListener("click", function(e) {
			e.stopPropagation();
			var view = self.plugin.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
			if (!view) return;
			var editor = view.editor;
			if (!editor) return;
			var embedEl = self.containerEl.closest(".internal-embed");
			if (!embedEl || !editor.cm) return;
			try {
				var pos = editor.cm.posAtDOM(embedEl);
				var line = editor.cm.state.doc.lineAt(pos).number - 1;
				editor.setCursor({ line: line, ch: 0 });
				editor.focus();
			} catch(e) {}
		});
	}

	if (this.isFullView) {
		this.containerEl.style.height = "100%";
		this.containerEl.style.overflow = "hidden";
	}

	// Build DOM structure first (iframe without src)
	if (!this.isFullView) {
		this._scrollArea = this.containerEl.createDiv({ cls: "html-viewer-scroll" });
		this.iframe = this._scrollArea.createEl("iframe", {
			attr: { width: "100%", sandbox: "allow-scripts allow-same-origin allow-popups allow-forms" }
		});
	} else {
		this.iframe = this.containerEl.createEl("iframe", {
			attr: { width: "100%", sandbox: "allow-scripts allow-same-origin allow-popups allow-forms" }
		});
	}
	this.iframe.style.border = "none";
	this.iframe.style.display = "block";
	if (this.isFullView) {
		this.iframe.style.height = "100%";
		// 2026-09-22：全屏视图两边留白
		this.iframe.style.padding = "0 44px 28px";
		this.iframe.style.boxSizing = "border-box";
	}

	if (!this.isFullView) {
		this._scrollGuard = this._scrollArea.createDiv({ cls: "html-viewer-scroll-guard" });
		this._scrollGuard.addEventListener("click", function() {
			self._scrollGuard.style.display = "none";
			self.iframe.focus();
		});
		this.iframe.addEventListener("blur", function() {
			if (self._scrollGuard) self._scrollGuard.style.display = "";
		});
	}

	if (this.s.showToolbar) this._createToolbar();
	if (!this.isFullView) this._updateSize();

	// Lazy load: embed mode checks visibility before setting up observer
	if (!this.isFullView) {
		var rect = this.containerEl.getBoundingClientRect();
		if (rect.top < window.innerHeight + 200 && rect.bottom > -200) {
			self._loadContent();
		} else if (typeof IntersectionObserver !== "undefined") {
			this._lazyObs = new IntersectionObserver(function(entries) {
				if (entries[0].isIntersecting) {
					self._lazyObs.disconnect();
					self._lazyObs = null;
					self._loadContent();
				}
			}, { rootMargin: "200px" });
			this._lazyObs.observe(this.containerEl);
		} else {
			self._loadContent();
		}
	} else {
		self._loadContent();
	}

	if (!this.isFullView && typeof ResizeObserver !== "undefined") {
		var ro = new ResizeObserver(function() { if (self.iframe && self.containerEl) self._updateSize(); });
		ro.observe(self.containerEl);
		self._resizeObs = ro;
	}
};

HtmlRenderer.prototype._loadContent = function() {
	var self = this;
	if (!this.containerEl || !this.iframe) return;
	this._extractedEl = null; // clear stale reference from previous content
	var dark = this.s.syncDarkTheme && isDark();
	var key = _cacheKey(this.file, dark);
	var cached = _getCachedBlob(key);
	if (cached) {
		_hvpLog("loadContent-cached file=" + this.file.name);
		this._blobUrl = cached;
		this._ownBlob = false;
		this._attachIframe();
		return;
	}
	_readFile(this.plugin.app.vault, this.file).then(function(content) {
		if (!self.containerEl || !self.iframe) return;
		if (MHTML_EXT.indexOf(self.file.extension) !== -1) content = parseMhtml(content);
		var doc = new DOMParser().parseFromString(content, "text/html");
		self._patchDoc(doc);
		var blob = new Blob([doc.documentElement.outerHTML], { type: "text/html" });
		var url = URL.createObjectURL(blob);
		_setCachedBlob(key, url);
		self._blobUrl = url;
		self._ownBlob = false; // shared cache owns it
		self._attachIframe();
	});
};

HtmlRenderer.prototype._attachIframe = function() {
	var self = this;
	// Remove previous load handler to prevent accumulation
	if (this._loadHandler) this.iframe.removeEventListener("load", this._loadHandler);
	this._loadHandler = function() {
		_hvpLog("iframe-load file=" + (self.file ? self.file.name : "?"));
		if (self.s.enableZoom && self.isFullView) self._setupZoom();
		self._setupLinks();
		self._setupContextMenu();
		if (self.isFullView || self.s.enableZoom) self._setupSearchShortcut();
		if (self.s.syncDarkTheme) self._watchTheme();
		if (self.s.hotRefresh) self._watchFile();
		self._applySubpath();
		// 打开/刷新后按 Obsidian 当前主题给默认模式（2026-09-22）
		try { self._setDefaultMode(); } catch (e) {}
	};
	this.iframe.addEventListener("load", this._loadHandler);
	// If src hasn't changed (cache hit), load event won't fire — call handler directly
	if (this.iframe.src === this._blobUrl) {
		this._loadHandler();
	} else {
		this.iframe.src = this._blobUrl;
	}
};

HtmlRenderer.prototype._patchDoc = function(doc) {
	var base = doc.querySelector("base");
	if (!base) { base = doc.createElement("base"); doc.head.prepend(base); }
	base.href = this.plugin.app.vault.getResourcePath(this.file);
	if (this.s.syncDarkTheme && isDark()) {
		var style = doc.createElement("style");
		style.id = "hvp-plugin-dark";   // 打标记，日间模式可精确移除
		style.textContent = darkCSS(themeColors(), this.s.customDarkCSS);
		doc.head.appendChild(style);
	}
	if (this.s.bgColorEnabled && this.s.bgColor) {
		var style2 = doc.createElement("style");
		style2.textContent = "body{background-color:" + this.s.bgColor + "!important}";
		doc.head.appendChild(style2);
	}
	if (!this.isFullView) {
		var hideScroll = doc.createElement("style");
			hideScroll.textContent = "html{overflow-x:hidden!important;overflow-y:auto!important;scrollbar-width:thin!important;scrollbar-color:#999 transparent!important}html::-webkit-scrollbar{width:6px!important}html::-webkit-scrollbar-track{background:transparent!important}html::-webkit-scrollbar-thumb{background:#999!important;border-radius:3px!important}body{overflow-x:hidden!important;margin:0!important}";
		doc.head.appendChild(hideScroll);
	}
};

HtmlRenderer.prototype._updateSize = function() {
	var w = this.containerEl.getAttr("width") || this.s.defaultWidth;
	var h = this.containerEl.getAttr("height");
	if (h) {
		this.containerEl.setCssProps({ width: parseSize(w), height: parseSize(h) });
		if (this.iframe) {
			this.iframe.style.minHeight = "";
			this.iframe.style.aspectRatio = "";
		}
	} else {
		this.containerEl.setCssProps({ width: parseSize(w) });
		this.containerEl.style.height = "";
			// Extract mode: fit to content, cap at aspect-ratio height
			if (this.iframe && this.subpath && !this.isFullView) {
				try {
					var doc = this.iframe.contentDocument;
					if (doc) {
						var contentH = this._extractedEl ? this._extractedEl.scrollHeight : (doc.documentElement.scrollHeight || doc.body.scrollHeight);
						if (contentH === 0) return; // iframe still loading, skip to avoid 200px flash
						var ratioStr = parseAspectRatio(this.s.aspectRatio);
						var ratioNum = ratioStr.indexOf("/") !== -1 ? parseFloat(ratioStr.split("/")[0]) / parseFloat(ratioStr.split("/")[1]) : parseFloat(ratioStr);
						var defaultH = this.iframe.clientWidth / ratioNum;
						var finalH = Math.min(contentH, defaultH > 0 ? defaultH : 200);
						_hvpLog("updateSize-extract: subpath=" + this.subpath + " contentH=" + contentH + " defaultH=" + defaultH + " finalH=" + finalH);
						this.iframe.style.height = (contentH + 10) + "px";
						this.containerEl.style.height = (finalH + 10) + "px";
						return;
					}
				} catch(e) { _hvpLog("updateSize-extract error: " + e.message); }
			}
		// Default: use aspect-ratio (embed only)
		if (this.iframe && !this.isFullView) {
			this.iframe.style.aspectRatio = parseAspectRatio(this.s.aspectRatio);
			this.iframe.style.minHeight = "200px";
			this.iframe.style.height = "";
			this.containerEl.style.height = "";
		}
	}
};

// --- Subpath ---

HtmlRenderer.prototype._applySubpath = function() {
	var parsed = parseSubpath(this.subpath);
	if (!parsed || !parsed.elementId) return;
	try {
		var doc = this.iframe.contentDocument;
		if (!doc) return;
		var el = doc.getElementById(parsed.elementId);
		if (!el) return;

		// Find the containing section/tab
		var section = el.closest(".section") || (el.classList.contains("section") ? el : null);
		var isSectionTarget = el.classList.contains("section");

		// Activate the section tab
		if (section) {
			var allSections = doc.querySelectorAll(".section");
			for (var s = 0; s < allSections.length; s++) allSections[s].classList.remove("active");
			section.classList.add("active");
			var navBtns = doc.querySelectorAll(".nav button");
			for (var b = 0; b < navBtns.length; b++) navBtns[b].classList.remove("active");
			for (var b = 0; b < navBtns.length; b++) {
				if (navBtns[b].dataset.tab === section.id || navBtns[b].getAttribute("data-tab") === section.id) {
					navBtns[b].classList.add("active");
					break;
				}
			}
		}

		// In embed mode: always extract the target, no scrolling
		if (!this.isFullView) {
			// Hide nav
			var nav = doc.querySelector(".nav");
			if (nav) nav.style.display = "none";

			// Hide all body children that don't contain the target
			for (var c = doc.body.firstChild; c; c = c.nextSibling) {
				if (c.nodeType === 1 && !c.contains(el)) c.style.display = "none";
			}

			// If targeting a card (not the section itself), also hide sibling cards
			if (!isSectionTarget && section) {
				var siblings = section.children;
				for (var i = 0; i < siblings.length; i++) {
					if (siblings[i].nodeType === 1 && !siblings[i].contains(el) && siblings[i] !== el) {
						siblings[i].style.display = "none";
					}
				}
			}

			el.style.display = "block";
			el.style.visibility = "visible";
			el.style.opacity = "1";

				this._extractedEl = el;
				if (!doc.getElementById("hvp-extract-style")) {
					var so = doc.createElement("style"); so.id = "hvp-extract-style"; so.textContent = "html,body{overflow:hidden!important}"; doc.head.appendChild(so);
				}
				this._updateSize();
		} else {
			// Full view: just scroll to element
			var rect = el.getBoundingClientRect();
			var html = doc.documentElement || doc.body;
			html.scrollTop = html.scrollTop + rect.top;
		}
	} catch (e) {}
};

// --- Zoom ---

HtmlRenderer.prototype._setupZoom = function() {
	var self = this;
	this.iframe.addEventListener("wheel", function(e) {
		if (!(e.ctrlKey || e.metaKey)) return;
		e.preventDefault();
		e.stopPropagation();
		if (e.deltaY < 0) self._zoomIn(); else self._zoomOut();
	}, { passive: false });
};

HtmlRenderer.prototype._zoomIn = function() {
	this.zoom = Math.min(this.zoom + this.s.zoomStep, 5); this._applyZoom();
};
HtmlRenderer.prototype._zoomOut = function() {
	this.zoom = Math.max(this.zoom - this.s.zoomStep, 0.2); this._applyZoom();
};
HtmlRenderer.prototype._zoomReset = function() {
	this.zoom = 1; this._applyZoom();
};
HtmlRenderer.prototype._applyZoom = function() {
	this.iframe.style.transform = "scale(" + this.zoom + ")";
	this.iframe.style.transformOrigin = "top left";
	if (this.zoomDisplay) this.zoomDisplay.textContent = Math.round(this.zoom * 100) + "%";
};

HtmlRenderer.prototype._setupLinks = function() {
	try {
		var doc = this.iframe.contentDocument;
		if (!doc) return;
		doc.addEventListener("click", function(e) {
			var a = e.target.closest("a");
			if (!a) return;
			var href = a.getAttribute("href");
			if (href && (href.startsWith("http://") || href.startsWith("https://"))) {
				e.preventDefault();
				window.open(href, "_blank");
			}
		});
	} catch (e) {}
};

HtmlRenderer.prototype._setupContextMenu = function() {
	var self = this;
	var SKIP_TAGS = ["marker", "defs", "lineargradient", "radialgradient", "clippath", "mask", "symbol", "use", "svg", "path", "g", "rect", "circle", "line", "polyline", "polygon", "text", "tspan", "canvas"];
	function getLabel(el) {
		var h = el.querySelector("h1, h2, h3, h4, h5, h6");
		if (h && h.textContent.trim()) return h.textContent.trim().substring(0, 30);
		var tag = el.tagName.toLowerCase();
		if ("h1 h2 h3 h4 h5 h6".indexOf(tag) !== -1) return el.textContent.trim().substring(0, 30);
		var raw = el.textContent.trim();
		if (raw) return raw.length > 25 ? raw.substring(0, 25) + "..." : raw;
		return tag;
	}
	try {
		var doc = this.iframe.contentDocument;
		if (!doc) return;
		doc.addEventListener("contextmenu", function(e) {
			var el = e.target;
			var targets = [];
			var walkEl = el;
			while (walkEl && walkEl !== doc.body) {
				if (SKIP_TAGS.indexOf(walkEl.tagName.toLowerCase()) !== -1) return;
				if (walkEl.id && walkEl.id !== "nav") {
					targets.push({ el: walkEl, label: getLabel(walkEl), id: walkEl.id });
				}
				walkEl = walkEl.parentElement;
			}
			if (targets.length === 0) return;
			e.preventDefault();
			var existing = document.querySelector(".html-viewer-ctx-menu");
			if (existing) existing.remove();
			var menu = document.body.createDiv({ cls: "html-viewer-ctx-menu" });
			var rect = self.iframe.getBoundingClientRect();
			var menuX = rect.left + e.clientX * (rect.width / doc.documentElement.clientWidth);
			var menuY = rect.top + e.clientY * (rect.height / doc.documentElement.clientHeight);
			if (menuX + 220 > window.innerWidth) menuX = window.innerWidth - 230;
			if (menuY + targets.length * 90 > window.innerHeight) menuY = Math.max(4, window.innerHeight - targets.length * 90 - 20);
			menu.style.left = Math.max(4, menuX) + "px";
			menu.style.top = Math.max(4, menuY) + "px";
			for (var i = 0; i < targets.length; i++) {
				(function(entry) {
					var group = menu.createDiv({ cls: "html-viewer-ctx-group" });
					group.addEventListener("mouseenter", function() {
						var el = doc.getElementById(entry.id);
						if (el) el.style.boxShadow = "0 0 0 3px #38bdf8";
					});
					group.addEventListener("mouseleave", function() {
						var el = doc.getElementById(entry.id);
						if (el) el.style.boxShadow = "";
					});
					group.createDiv({ cls: "html-viewer-ctx-id", text: entry.label });
					group.createDiv({ cls: "html-viewer-ctx-sep", text: "#" + entry.id });
					var row = group.createDiv({ cls: "html-viewer-ctx-row" });
					var btn1 = row.createDiv({ cls: "html-viewer-ctx-item", text: "嵌入" });
					var btn2 = row.createDiv({ cls: "html-viewer-ctx-item", text: "链接" });
					btn1.addEventListener("click", function() {
						var s = "![[" + self.file.name + "#" + entry.id + "]]";
						navigator.clipboard.writeText(s).then(function() { new obsidian.Notice("已复制: " + s); });
						menu.remove();
					});
					btn2.addEventListener("click", function() {
						var s = "[[" + self.file.name + "#" + entry.id + "]]";
						navigator.clipboard.writeText(s).then(function() { new obsidian.Notice("已复制: " + s); });
						menu.remove();
					});
				})(targets[i]);
			}
				setTimeout(function() {
					var closeHandler = function() {
						menu.remove();
						document.removeEventListener("click", closeHandler);
						document.removeEventListener("contextmenu", closeHandler);
						try { doc.removeEventListener("click", closeHandler); } catch(e) {}
					};
					document.addEventListener("click", closeHandler);
					document.addEventListener("contextmenu", closeHandler);
					try { doc.addEventListener("click", closeHandler); } catch(e) {}
				}, 10);
		});
	} catch (e) {}
};
HtmlRenderer.prototype._watchTheme = function() {
	var self = this;
	if (this._themeObs) return;
	var lastDark = isDark();
	this._themeObs = new MutationObserver(function() {
		var nowDark = isDark();
		if (nowDark !== lastDark) {
			lastDark = nowDark;
			// 用户明确要求：「不保存」必须保留当前显示内容。
			// 主题变化时不再自动重载（重载会读回文件原内容，看起来就像撤销了编辑）。
			// 需要换外观时，用户点工具栏的 ☀/🌙 手动切换即可。
			_hvpLog("theme changed (reload suppressed to preserve unsaved view)");
		}
	});
	this._themeObs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
};

HtmlRenderer.prototype._watchFile = function() {
	if (this._fileWatchReg) return; // prevent duplicate registration
	var self = this;
	this._fileWatchReg = this.plugin.registerEvent(this.plugin.app.vault.on("modify", function(file) {
		if (file.path === self.file.path) self.reload();
	}));
};

HtmlRenderer.prototype.reload = function() {
	var self = this;
	_hvpLog("reload() called" + (this._editing ? " WHILE EDITING (edits will be lost!)" : ""));
	if (!this.iframe) return;
	// Evict old cache entry so theme/file changes get fresh blob
	var dark = this.s.syncDarkTheme && isDark();
	_evictBlob(_cacheKey(this.file, dark));
	_evictBlob(_cacheKey(this.file, !dark));
	this._loadContent();
};

// --- Toolbar ---

HtmlRenderer.prototype._createToolbar = function() {
	this.toolbar = this.containerEl.createDiv({ cls: "html-viewer-toolbar" });
	// 2026-09-22：底栏改为 SVG 图标；全屏只留 刷新 / 暗色切换 / 编辑
	var self = this;
	function iconBtn(icon, title, fn) {
		var b = makeBtn(self.toolbar, "", title, "html-viewer-toolbar-btn", fn);
		b.innerHTML = svgIcon(icon);
		return b;
	}
	if (!this.isFullView) {
		iconBtn("fullscreen", "全屏", this._toggleFullscreen.bind(this));
		iconBtn("external", "外部打开", this._openExternally.bind(this));
		iconBtn("locate", "定位到文件", this._gotoFile.bind(this));
	} else {
		iconBtn("refresh", "刷新", this.reload.bind(this));
	}
	this.darkBtn = iconBtn("dark", "切换暗色 / 日间（仅当前 HTML）", this._toggleDarkMode.bind(this));
	this.editBtn = iconBtn("edit", "可视化编辑", this._toggleEdit.bind(this));
};

// --- 可视化编辑（2026-09-22 新增）---
// 在渲染后的 iframe 上直接编辑文字与图片，保存时回写原 .html，并在文件内留一份原内容备份。

HtmlRenderer.prototype._enterEditMode = function() {
	var self = this;   // ← 之前漏了这行：observer 与 markDirty 都引用 self，
	                   //   缺失时一触发就抛 ReferenceError 并被空 catch 吞掉
	var doc = null;
	try { doc = this.iframe.contentDocument; } catch (e) { doc = null; }
	if (!doc || !doc.body) return false;
	var body = doc.body;
	try { body.setAttribute("contenteditable", "true"); } catch (e) {}
	try { body.spellcheck = false; } catch (e) {}
	// 细虚线提示：用低饱和中性色，避免紫色硬边太抢眼
	body.style.setProperty("outline", "1px dashed var(--text-faint, #8a8f98)", "important");
	body.style.setProperty("outline-offset", "-1px", "important");
	this._editing = true;
	this._dirty = false;
	this._suppressMutation = false;   // 明确复位，避免上次暗色切换中途出错后卡住
	this._obsLogged = false;
	this._fontSize = 16;
	this._setupEditBehaviors(doc);
	this._setupTableResize(doc);   // 2026-09-28：表格分隔线拖拽调宽/调高（仅编辑态）
	// 进入编辑：挂 DOM 变化监听 —— 任何编辑动作（含改回原样）都能被捕捉
	try {
		if (this._editObs) { this._editObs.disconnect(); this._editObs = null; }
		var obs = new MutationObserver(function(muts) {
			// 渲染器自己的补丁（如切换暗色）不算用户编辑
			if (self._suppressMutation) {
				if (!self._obsLogged) { self._obsLogged = true; _hvpLog("observer FIRED but suppressed"); }
				return;
			}
			if (self._editing) {
				if (!self._obsLogged) {
					self._obsLogged = true;
					_hvpLog("observer FIRED -> dirty (mutations=" + (muts ? muts.length : 0) + ")");
				}
				self._dirty = true;
			}
		});
		obs.observe(body, { childList: true, subtree: true, characterData: true, attributes: true });
		this._editObs = obs;
		_hvpLog("observer attached to body, connected=" + (!!this._editObs));
	} catch (e) {
		_hvpLog("observer attach FAILED: " + (e && e.message ? e.message : e));
	}
	// 辅助标记（这些是补充）
	var markDirty = function() { if (self._editing) self._dirty = true; };
	try {
		body.addEventListener("input", markDirty);
		body.addEventListener("paste", markDirty);
		body.addEventListener("cut", markDirty);
		body.addEventListener("drop", markDirty);
		body.addEventListener("keyup", markDirty);
	} catch (e) {}
	body.focus();
	try {
		var sel = doc.getSelection();
		var rng = doc.createRange();
		rng.selectNodeContents(body);
		rng.collapse(true);
		sel.removeAllRanges();
		sel.addRange(rng);
	} catch (e) {}
	_hvpLog("edit-mode ON file=" + (this.file ? this.file.name : "?") +
		" snapshotLen=" + (this._snapshot ? this._snapshot.length : -1));
	return true;
};

HtmlRenderer.prototype._exitEditMode = function() {
	var doc = null;
	try { doc = this.iframe.contentDocument; } catch (e) {}
	if (doc && doc.body) {
		try { doc.body.removeAttribute("contenteditable"); } catch (e) {}
		// 用 removeProperty 才能清掉带 !important 的行内样式
		try { doc.body.style.removeProperty("outline"); } catch (e) {}
		try { doc.body.style.removeProperty("outline-offset"); } catch (e) {}
		doc.body.style.outline = "";
		doc.body.style.outlineOffset = "";
	}
	if (this._editFileInput && this._editFileInput.parentNode) {
		this._editFileInput.parentNode.removeChild(this._editFileInput);
	}
	this._editFileInput = null;
	this._hideImagePanel();
	this._teardownTableResize();   // 2026-09-28：清掉编辑态注入的表格分隔线命中样式
	try { if (this._editObs) { this._editObs.disconnect(); this._editObs = null; } } catch (e) {}
	this._editing = false;
	// 注意：这里【不】动内容、也不重载 —— 用户选择「不保存」时，
	// 界面保持当前样子，只有下次重新打开文件才会读到文件里的原内容
	_hvpLog("exitEditMode done (content untouched, no reload)");
};

HtmlRenderer.prototype._toggleEdit = function() {
	if (this._editing) { this._exitEdit(); return; }
	if (this._enterEditMode()) {
		this._showEditorBar();
		if (this.editBtn) this.editBtn.classList.add("is-active");
	} else {
		new obsidian.Notice("HTML 编辑器：内容尚未加载完成，请稍后重试");
	}
};

// 把界面还原成「点编辑按钮之前」的样子：清掉缓存 → 重载 → 插件重新打补丁
HtmlRenderer.prototype._restoreOriginal = function() {
	var self = this;
	_hvpLog("restoreOriginal: clearing cache then reload from file");
	try { if (this._editObs) { this._editObs.disconnect(); this._editObs = null; } } catch (e) {}
	try {
		var dark = this.s.syncDarkTheme && isDark();
		_evictBlob(_cacheKey(this.file, dark));
		_evictBlob(_cacheKey(this.file, !dark));
	} catch (e) {}
	this._dirty = false;
	try { this.reload(); } catch (e) {
		_hvpLog("restoreOriginal reload failed: " + (e && e.message ? e.message : e));
	}
	_hvpLog("restoreOriginal -> reload issued");
};

HtmlRenderer.prototype._exitEdit = function(force) {
	// 只要本次编辑会话内【编辑过内容】，就必须弹窗确认 ——
	// 哪怕改回了原样也要问（用户明确要求）。_dirty 一旦置位就不再清除，
	// 因此这里不能靠"和快照比对"来重置它。
	_hvpLog("exitEdit called force=" + force + " dirty=" + this._dirty +
		" editing=" + this._editing);
	if (!force && this._dirty) {
		_hvpLog("exitEdit -> showing confirm modal");
		this._confirmClose();
		return;
	}
	_hvpLog("exitEdit -> exiting directly (force=" + force + ")");
	this._exitEditMode();
	this._removeEditorBar();
	if (this.editBtn) this.editBtn.classList.remove("is-active");
	_hvpLog("exitEdit -> done");
};

HtmlRenderer.prototype._setupEditBehaviors = function(doc) {
	var self = this;
	if (doc.__hvpEditBehaviors) return;
	doc.__hvpEditBehaviors = true;

	doc.addEventListener("click", function(e) {
		if (!self._editing) return;
		var t = e.target;
		if (t && t.tagName === "IMG") {
			e.preventDefault();
			self._showImagePanel(t);
		} else {
			self._hideImagePanel();
		}
	}, true);

	doc.addEventListener("keydown", function(e) {
		if (!self._editing) return;
		var mod = e.metaKey || e.ctrlKey;
		// 常用快捷键：保留功能，只是不放进工具栏
		if (mod) {
			var k = e.key;
			var handled = true;
			if ((k === "z" || k === "Z") && e.shiftKey) {
				doc.execCommand("redo");
			} else if (k === "z" || k === "Z") {
				doc.execCommand("undo");
			} else if (k === "y" || k === "Y") {
				doc.execCommand("redo");
			} else if (k === "b" || k === "B") {
				doc.execCommand("bold");
			} else if (k === "i" || k === "I") {
				doc.execCommand("italic");
			} else if (k === "u" || k === "U") {
				doc.execCommand("underline");
			} else if (k === "a" || k === "A") {
				var r0 = doc.createRange();
				r0.selectNodeContents(doc.body);
				var s0 = doc.getSelection();
				s0.removeAllRanges();
				s0.addRange(r0);
			} else {
				handled = false;
			}
			if (handled) {
				e.preventDefault();
				e.stopPropagation();
				self._dirty = true;
				return;
			}
		}
		if (mod && e.key === "s") {
			e.preventDefault();
			// 保存后自动退出编辑模式（2026-09-22）
			self._saveEdit();
			self._exitEdit(true);
		} else if (e.key === "Escape") {
			e.preventDefault();
			self._exitEdit();
		}
	}, true);
};

// --- 表格分隔线拖拽调宽 / 调高（2026-09-28 新增，仅可视化编辑态生效）---
// 鼠标移到单元格边缘的分隔线上会出现 col-resize / row-resize 光标（悬停时高亮那条线），
// 按住拖动即可左右改列宽、上下改行高；改动写在单元格的行内 width / height 上，
// 文字随列宽自动重排，保存时与其他编辑一起写回 .html。
// 说明：命中区用伪元素做，样式只注入 iframe 的 <head>（进编辑态挂上、退出即摘掉），
//       不碰 body，因此不会触发「编辑过」标记，也不会写进保存的文件。
var HVP_TBL_STYLE_ID = "hvp-table-resize";
var HVP_TBL_ZONE = 5;      // 分隔线命中容差（px）
var HVP_TBL_MIN_W = 24;    // 列最小宽度（px）
var HVP_TBL_MIN_H = 18;    // 行最小高度（px）
var HVP_TBL_START = 2;     // 位移超过该值才算真正拖动（避免误触把内容标脏）

HtmlRenderer.prototype._tblCssText = function() {
	return "td,th{position:relative}" +
		"td::after,th::after{content:'';position:absolute;top:0;bottom:0;right:-3px;width:7px;cursor:col-resize;z-index:8}" +
		"td::before,th::before{content:'';position:absolute;left:0;right:0;bottom:-3px;height:7px;cursor:row-resize;z-index:7}" +
		"td::after:hover,th::after:hover{background:rgba(124,92,255,.45)}" +
		"td::before:hover,th::before:hover{background:rgba(124,92,255,.45)}";
};

HtmlRenderer.prototype._tblInjectCSS = function(doc) {
	try {
		if (!doc || !doc.head) return;
		var old = doc.getElementById(HVP_TBL_STYLE_ID);
		if (old && old.parentNode) old.parentNode.removeChild(old);
		var st = doc.createElement("style");
		st.id = HVP_TBL_STYLE_ID;
		st.textContent = this._tblCssText();
		doc.head.appendChild(st);
	} catch (e) {}
};

HtmlRenderer.prototype._tblRemoveCSS = function(doc) {
	try {
		if (!doc) return;
		var st = doc.getElementById(HVP_TBL_STYLE_ID);
		if (st && st.parentNode) st.parentNode.removeChild(st);
	} catch (e) {}
};

HtmlRenderer.prototype._setupTableResize = function(doc) {
	var self = this;
	if (!doc || !doc.body) return;
	this._tblInjectCSS(doc);        // 每次进入编辑态都补一次（退出时已摘掉）
	if (doc.__hvpTableResize) return;
	doc.__hvpTableResize = true;

	doc.addEventListener("mousedown", function(e) {
		if (!self._editing || self._tblDrag) return;
		if (e.button !== 0) return;
		var hit = self._tblHitTest(e.target, e.clientX, e.clientY);
		if (!hit) return;
		if (!self._tblBegin(hit, e)) return;
		e.preventDefault();          // 不让默认行为去放光标 / 选文字
		e.stopPropagation();
	}, true);

	doc.addEventListener("mousemove", function(e) {
		if (!self._tblDrag) return;
		e.preventDefault();
		self._tblMove(e.clientX, e.clientY);
	}, true);

	doc.addEventListener("mouseup", function() {
		if (self._tblDrag) self._tblFinish();
	}, true);

	// 拖出 iframe 也能继续跟手 / 松开即结束
	if (!this._tblWinBound) {
		this._tblWinBound = true;
		this._tblWinMove = function(e) {
			if (!self._tblDrag || !self.iframe) return;
			try {
				var r = self.iframe.getBoundingClientRect();
				var z = self.zoom || 1;
				self._tblMove((e.clientX - r.left) / z, (e.clientY - r.top) / z);
			} catch (err) {}
		};
		this._tblWinUp = function() {
			if (self._tblDrag) self._tblFinish();
		};
		window.addEventListener("mousemove", this._tblWinMove, true);
		window.addEventListener("mouseup", this._tblWinUp, true);
	}
};

HtmlRenderer.prototype._teardownTableResize = function() {
	this._tblDrag = null;
	var doc = null;
	try { doc = this.iframe ? this.iframe.contentDocument : null; } catch (e) { doc = null; }
	this._tblRemoveCSS(doc);
};

// 落在单元格哪条分隔线上（取最近的一条边）
HtmlRenderer.prototype._tblHitTest = function(target, x, y) {
	var cell = null;
	try { cell = target && target.closest ? target.closest("td,th") : null; } catch (e) { cell = null; }
	if (!cell) return null;
	var table = null;
	try { table = cell.closest("table"); } catch (e) { table = null; }
	if (!table) return null;
	var r = cell.getBoundingClientRect();
	var cands = [
		{ axis: "col", line: r.left,   d: Math.abs(x - r.left) },
		{ axis: "col", line: r.right,  d: Math.abs(x - r.right) },
		{ axis: "row", line: r.top,    d: Math.abs(y - r.top) },
		{ axis: "row", line: r.bottom, d: Math.abs(y - r.bottom) }
	];
	cands.sort(function(a, b) { return a.d - b.d; });
	if (cands[0].d > HVP_TBL_ZONE) return null;
	return { axis: cands[0].axis, line: cands[0].line, table: table };
};

// 收集压在同一条线上的单元格（before = 线左上侧，after = 线右下侧）
HtmlRenderer.prototype._tblCollect = function(table, axis, line) {
	var all = [];
	try { all = table.querySelectorAll("td,th"); } catch (e) { all = []; }
	var before = [], after = [];
	for (var i = 0; i < all.length; i++) {
		var c = all[i];
		try { if (c.closest("table") !== table) continue; } catch (e) { continue; }
		// 跨行列（colspan / rowspan）的合并单元格不参与，交给浏览器自动分配
		if (axis === "col" && (c.colSpan || 1) !== 1) continue;
		if (axis === "row" && (c.rowSpan || 1) !== 1) continue;
		var r = c.getBoundingClientRect();
		if (axis === "col") {
			if (Math.abs(r.right - line) <= 1.5) before.push({ el: c, size: r.width });
			else if (Math.abs(r.left - line) <= 1.5) after.push({ el: c, size: r.width });
		} else {
			if (Math.abs(r.bottom - line) <= 1.5) before.push({ el: c, size: r.height });
			else if (Math.abs(r.top - line) <= 1.5) after.push({ el: c, size: r.height });
		}
	}
	return { before: before, after: after };
};

HtmlRenderer.prototype._tblBegin = function(hit, e) {
	var g = this._tblCollect(hit.table, hit.axis, hit.line);
	if (!g.before.length) return false;
	// 竖线两侧都要有单元格，否则是表格外边框，不拖
	if (hit.axis === "col" && !g.after.length) return false;
	var lim = hit.axis === "col" ? HVP_TBL_MIN_W : HVP_TBL_MIN_H;
	var lo = -Infinity, hi = Infinity, i;
	for (i = 0; i < g.before.length; i++) lo = Math.max(lo, lim - g.before[i].size);
	if (hit.axis === "col") {
		for (i = 0; i < g.after.length; i++) hi = Math.min(hi, g.after[i].size - lim);
	}
	this._tblDrag = {
		axis: hit.axis, table: hit.table,
		startX: e.clientX, startY: e.clientY,
		before: g.before, after: g.after,
		sizeB: g.before[0].size,
		sizeA: g.after.length ? g.after[0].size : 0,
		startLine: hit.line,
		min: lo, max: hi, moved: false
	};
	_hvpLog("table-resize start axis=" + hit.axis +
		" cells=" + g.before.length + "/" + g.after.length);
	return true;
};

// 写行内尺寸：只动这条线两侧的两列（或上方一行），其余交给浏览器
HtmlRenderer.prototype._tblPaint = function(d, wB, wA) {
	var i, b = Math.round(wB), a = Math.round(wA);
	for (i = 0; i < d.before.length; i++) {
		try {
			if (d.axis === "col") d.before[i].el.style.width = b + "px";
			else d.before[i].el.style.height = b + "px";
		} catch (e) {}
	}
	if (d.axis !== "col") return;
	for (i = 0; i < d.after.length; i++) {
		try { d.after[i].el.style.width = a + "px"; } catch (e) {}
	}
};

// 这条线当前的屏幕位置（视口坐标，和光标同一坐标系）
HtmlRenderer.prototype._tblLine = function(d) {
	try {
		var r = d.before[0].el.getBoundingClientRect();
		return d.axis === "col" ? r.right : r.bottom;
	} catch (e) { return d.startLine; }
};

HtmlRenderer.prototype._tblMove = function(x, y) {
	var d = this._tblDrag;
	if (!d) return;
	var delta = d.axis === "col" ? (x - d.startX) : (y - d.startY);
	if (delta < d.min) delta = d.min;
	if (delta > d.max) delta = d.max;
	if (!d.moved && Math.abs(delta) < HVP_TBL_START) return;
	var target = d.startLine + delta;     // 目标：这条线停在光标处
	var lim = d.axis === "col" ? HVP_TBL_MIN_W : HVP_TBL_MIN_H;
	var sum = d.sizeB + d.sizeA;
	var wB = d.moved ? d.wB : d.sizeB;
	var wA = d.moved ? d.wA : d.sizeA;
	// 自动表格布局会把行内宽度当「建议值」再分配一次，实测位移会被放大（拖 40px 走 65px），
	// 所以这里按实测误差做几步反馈逼近，让线与光标基本重合（通常 2 步收敛）。
	for (var it = 0; it < 4; it++) {
		this._tblPaint(d, wB, wA);
		var err = this._tblLine(d) - target;
		if (Math.abs(err) < 0.6) break;
		wB -= err * 0.6;
		if (d.axis === "col") wA = sum - wB;
		if (wB < lim) wB = lim;
		if (d.axis === "col" && wA < lim) { wA = lim; wB = sum - wA; }
	}
	this._tblPaint(d, wB, wA);
	d.wB = wB; d.wA = wA;
	d.moved = true;
	this._dirty = true;   // 拖动即算编辑，退出时照例询问是否保存
};

HtmlRenderer.prototype._tblFinish = function() {
	var d = this._tblDrag;
	this._tblDrag = null;
	if (!d) return;
	_hvpLog("table-resize end axis=" + d.axis + " moved=" + d.moved);
};

HtmlRenderer.prototype._showEditorBar = function() {
	var self = this;
	this._removeEditorBar();
	var bar = document.createElement("div");
	bar.className = "html-viewer-editor-bar";
	bar.style.cssText = "position:absolute;top:0;left:0;right:0;z-index:99999;display:flex;" +
		"align-items:center;gap:4px;flex-wrap:wrap;" +
		"background:var(--background-primary,#fff);color:var(--text-normal,#222);" +
		"border-bottom:1px solid var(--background-modifier-border,#ddd);" +
		"padding:6px 44px 6px 64px;box-shadow:0 2px 12px rgba(0,0,0,.16);" +
		"font-family:var(--font-interface,sans-serif);";
	try { this.containerEl.style.position = "relative"; } catch (e) {}

	// 通用小圆按钮
	function circle(icon, title, fn, opts) {
		opts = opts || {};
		var b = document.createElement("button");
		b.title = title;
		b.style.cssText = "cursor:pointer;border:1px solid var(--background-modifier-border,#ddd);" +
			"background:var(--background-secondary,#f5f5f5);color:inherit;border-radius:50%;" +
			"width:28px;height:28px;display:flex;align-items:center;justify-content:center;" +
			"padding:0;flex:none;";
		if (opts.danger) {
			b.style.background = "#e5484d";
			b.style.borderColor = "#e5484d";
			b.style.color = "#fff";
		}
		b.innerHTML = svgIcon(icon);
		b.addEventListener("mousedown", function(e) { e.preventDefault(); });
		b.addEventListener("click", function(e) { e.preventDefault(); e.stopPropagation(); fn(); });
		bar.appendChild(b);
		return b;
	}
	// 通用方块按钮（对齐、加粗等）
	function square(icon, title, fn, opts) {
		opts = opts || {};
		var sz = opts.size || 28;
		var b = document.createElement("button");
		b.title = title;
		b.style.cssText = "cursor:pointer;border:1px solid transparent;background:transparent;color:inherit;" +
			"border-radius:6px;width:" + sz + "px;height:" + sz + "px;display:flex;align-items:center;" +
			"justify-content:center;padding:0;flex:none;";
		b.innerHTML = svgIcon(icon);
		b.addEventListener("mouseenter", function() { b.style.background = "var(--background-modifier-hover,#eee)"; });
		b.addEventListener("mouseleave", function() { b.style.background = "transparent"; });
		b.addEventListener("mousedown", function(e) { e.preventDefault(); });
		b.addEventListener("click", function(e) { e.preventDefault(); e.stopPropagation(); fn(); });
		bar.appendChild(b);
		return b;
	}
	function sepline() {
		var s = document.createElement("span");
		s.style.cssText = "width:1px;height:18px;background:var(--background-modifier-border,#ddd);margin:0 4px;flex:none;";
		bar.appendChild(s);
	}
	function apply(cmd, val) {
		try {
			var d = self.iframe.contentDocument;
			d.body.focus();
			d.execCommand(cmd, false, val || null);
			self._dirty = true;
		} catch (e) {}
	}
	function bumpFont(delta) {
		try {
			var d = self.iframe.contentDocument;
			var sel = d.getSelection();
			if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
				new obsidian.Notice("请先选中要调整字号的文字");
				return;
			}
			var rng = sel.getRangeAt(0);
			// 取选中文字【当前实际】字号，而不是全局计数器 —— 否则连续点会一路上掉
			var btn = rng.startContainer;
			if (btn && btn.nodeType === 3) btn = btn.parentNode;
			var cur = 16;
			try {
				cur = Math.round(parseFloat(d.defaultView.getComputedStyle(btn).fontSize)) || 16;
			} catch (e) {}
			var next = Math.min(96, Math.max(8, cur + delta));
			var wrap = d.createElement("span");
			wrap.style.setProperty("font-size", next + "px", "important");
			try {
				wrap.appendChild(rng.extractContents());
				rng.insertNode(wrap);
				sel.removeAllRanges();
				var nr = d.createRange();
				nr.selectNodeContents(wrap);
				sel.addRange(nr);
			} catch (e) {}
			self._dirty = true;
		} catch (e) {}
	}

	// 左：关闭（22px 圆形；flex 内联居中对齐，随工具栏内边距一起右移）
	var closeBtn = document.createElement("button");
	closeBtn.title = "关闭编辑器（有未保存改动会先问）";
	closeBtn.style.cssText = "cursor:pointer;border:none;background:#e5484d;color:#fff;" +
		"width:18px;height:18px;min-width:18px;border-radius:50%;display:flex;" +
		"align-items:center;justify-content:center;padding:0;flex:none;";
	closeBtn.innerHTML = svgIcon("close", 10);
	closeBtn.addEventListener("mousedown", function(e) { e.preventDefault(); });
	closeBtn.addEventListener("click", function(e) { e.preventDefault(); e.stopPropagation(); self._exitEdit(); });
	bar.appendChild(closeBtn);
	sepline();

	// 字号
	square("fontDec", "减小字号（每次 1px）", function() { bumpFont(-1); });
	square("fontInc", "增大字号（每次 1px）", function() { bumpFont(1); });
	sepline();

	// 文字样式
	square("bold", "加粗 (Cmd+B)", function() { apply("bold"); });
	square("italic", "倾斜 (Cmd+I)", function() { apply("italic"); });
	square("underline", "下划线 (Cmd+U)", function() { apply("underline"); });
	self._colorBtnEl = square("color", "文字颜色（悬停展开）", function() { self._openColorPad(); });
	try {
		self._colorBtnEl.addEventListener("mouseenter", function() { self._openColorPad(); });
		self._colorBtnEl.addEventListener("mouseleave", function() { self._scheduleCloseColorPad(); });
	} catch (e) {}
	sepline();

	// 对齐
	square("alignLeft", "左对齐", function() { apply("justifyLeft"); });
	square("alignCenter", "居中", function() { apply("justifyCenter"); });
	square("alignRight", "右对齐", function() { apply("justifyRight"); });
	sepline();

	// 其它常用
	square("inlineCode", "行内代码", function() {
		try {
			var d = self.iframe.contentDocument;
			var sel = d.getSelection();
			var txt = sel && sel.rangeCount ? sel.toString() : "";
			d.body.focus();
			d.execCommand("insertHTML", false, "<code>" + (txt || "代码") + "</code>");
			self._dirty = true;
		} catch (e) {}
	});
	square("quote", "引用块", function() { apply("formatBlock", "<blockquote>"); });
	square("hr", "插入分隔线", function() {
		try {
			var d = self.iframe.contentDocument;
			d.body.focus();
			d.execCommand("insertHorizontalRule", false, null);
			self._dirty = true;
		} catch (e) {}
	});

	this.containerEl.appendChild(bar);
	this._editorBar = bar;
};

HtmlRenderer.prototype._removeEditorBar = function() {
	if (this._editorBar && this._editorBar.parentNode) this._editorBar.parentNode.removeChild(this._editorBar);
	this._editorBar = null;
};

// 图片小面板：点图片后出现
HtmlRenderer.prototype._showImagePanel = function(img) {
	var self = this;
	this._hideImagePanel();
	var panel = document.createElement("div");
	panel.className = "html-viewer-img-panel";
	panel.style.cssText = "position:fixed;z-index:100000;display:flex;align-items:center;gap:4px;" +
		"background:var(--background-primary,#fff);color:var(--text-normal,#222);" +
		"border:1px solid var(--background-modifier-border,#ddd);border-radius:8px;padding:5px 7px;" +
		"box-shadow:0 4px 16px rgba(0,0,0,.22);font-size:12.5px;font-family:var(--font-interface,sans-serif);";
	var r = img.getBoundingClientRect();
	var ifr = this.iframe.getBoundingClientRect();
	panel.style.top = Math.max(8, ifr.top + r.bottom + 6) + "px";
	panel.style.left = Math.max(8, ifr.left + r.left) + "px";

	function pb(label, title, fn) {
		var b = document.createElement("button");
		b.textContent = label;
		b.title = title;
		b.style.cssText = "cursor:pointer;border:1px solid var(--background-modifier-border,#ddd);" +
			"background:var(--background-secondary,#f5f5f5);color:inherit;border-radius:6px;" +
			"padding:3px 8px;font-size:12.5px;";
		b.addEventListener("mousedown", function(e) { e.preventDefault(); });
		b.addEventListener("click", function(e) { e.preventDefault(); e.stopPropagation(); fn(); });
		panel.appendChild(b);
		return b;
	}
	pb("换图", "替换这张图片（可填网址或库内相对路径）", function() { self._replaceImage(img); });
	pb("宽度", "按百分比调整宽度", function() { self._resizeImage(img); });
	pb("删除", "删除这张图片", function() { self._deleteImage(img); });
	var info = document.createElement("span");
	info.textContent = "图片";
	info.style.cssText = "opacity:.55;font-size:11.5px;margin-left:3px;";
	panel.appendChild(info);

	document.body.appendChild(panel);
	this._imgPanel = panel;
};

// 手动切换当前 HTML 的暗色/日间（2026-09-22）
// 内联调色板（不依赖 window.prompt —— Electron 里 prompt 可能被拦截）
// 打开文件时按 Obsidian 当前主题给默认模式（2026-09-22）
HtmlRenderer.prototype._setDefaultMode = function() {
	var doc = null;
	try { doc = this.iframe.contentDocument; } catch (e) { doc = null; }
	if (!doc || !doc.head) return;
	var pluginDark = doc.getElementById("hvp-plugin-dark");
	var manual = doc.getElementById("hvp-manual-dark");
	if (isDark()) {
		// Obsidian 深色 → 夜间：清掉插件的浅色覆盖，只留我的夜间规则
		if (pluginDark) pluginDark.remove();
		if (manual) manual.remove();
		this._darkManual = false;
		this._toggleDarkMode();   // false → 进入夜间
	} else {
		// Obsidian 浅色 → 日间
		if (pluginDark) pluginDark.remove();
		if (manual) manual.remove();
		this._darkManual = true;
		this._toggleDarkMode();   // true → 切回日间
	}
	// 注意：这里【不能】重置 _dirty —— iframe 重载时会把用户已做的编辑标记抹掉
	// 初始值在 _enterEditMode 里已设为 false，无需在这里处理
};

// Obsidian 原生对话框（window.confirm / prompt 在 Electron 里会被拦截）
// 关闭确认：用 Obsidian 原生 Modal（比手搓 DOM 覆盖层可靠，
// 自动处理层级、主题、键盘焦点；之前自建 overlay 会受主题 CSS 影响而不可见）
function HvpConfirmModal(app, onSave, onDiscard) {
	obsidian.Modal.call(this, app);
	this._onSave = onSave;
	this._onDiscard = onDiscard;
}
HvpConfirmModal.prototype = Object.create(obsidian.Modal.prototype);
HvpConfirmModal.prototype.constructor = HvpConfirmModal;

HvpConfirmModal.prototype.onOpen = function() {
	var self = this;
	_hvpLog("modal onOpen");
	var c = this.contentEl;
	c.empty();
	c.createEl("div", { text: "是否保存修改？", cls: "hvp-confirm-title" });
	var row = c.createDiv({ cls: "hvp-confirm-row" });

	var cancel = row.createEl("button", { text: "Cancel" });
	cancel.addEventListener("click", function() {
		_hvpLog("modal: Cancel clicked");
		try { self.close(); } catch (e) { _hvpLog("modal close failed: " + e.message); }
		if (self._onDiscard) self._onDiscard();
		_hvpLog("modal: Cancel handler done");
	});
	var save = row.createEl("button", { text: "Save", cls: "mod-cta" });
	save.addEventListener("click", function() {
		_hvpLog("modal: Save clicked");
		try { self.close(); } catch (e) { _hvpLog("modal close failed: " + e.message); }
		if (self._onSave) self._onSave();
		_hvpLog("modal: Save handler done");
	});
};

HvpConfirmModal.prototype.onClose = function() {
	_hvpLog("modal onClose");
	this.contentEl.empty();
};

HtmlRenderer.prototype._confirmClose = function() {
	var self = this;
	_hvpLog("confirmClose: about to open modal");
	try {
		new HvpConfirmModal(this.plugin.app,
			function() {           // Save
				self._saveEdit();
				self._exitEdit(true);
			},
			function() {           // Cancel → 撤销本次全部编辑，回到原文
				_hvpLog("cancel: restoring original content");
				self._restoreOriginal();
				self._exitEdit(true);
			}
		).open();
	} catch (e) {
		// 极端情况下退回到直接退出，避免卡住
		self._exitEdit(true);
	}
};

// 把颜色写到选中文字上（行内 !important —— 能压过夜间模式的样式表 !important）
HtmlRenderer.prototype._applyColorToSelection = function(hex) {
	if (!hex) return false;
	try {
		var d = this.iframe.contentDocument;
		var sel = d.getSelection();
		if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
			new obsidian.Notice("请先选中要改颜色的文字");
			return false;
		}
		var rng = sel.getRangeAt(0);
		var root = rng.commonAncestorContainer;
		if (root.nodeType === 3) root = root.parentNode;

		// 1) 清掉选区所在子树里的行内颜色（含 !important）
		//    否则内层旧色优先级更高，外层新色改不动
		function clearColor(el) {
			if (!el || el.nodeType !== 1) return;
			try { el.style.removeProperty("color"); } catch (e) {}
			try { el.removeAttribute("color"); } catch (e) {}
			if (el.getAttribute && !el.getAttribute("style")) el.removeAttribute("style");
		}
		try {
			clearColor(root);
			var all = root.querySelectorAll ? root.querySelectorAll("[style],[color],font") : [];
			for (var i = 0; i < all.length; i++) {
				var el = all[i];
				if (rng.intersectsNode && rng.intersectsNode(el)) clearColor(el);
			}
		} catch (e1) {}

		// 2) 包一层新 span，颜色用行内 !important（能压过夜间模式）
		var span = d.createElement("span");
		span.style.setProperty("color", hex, "important");
		try {
			var frag = rng.extractContents();
			// 抽取出的片段也要清一遍（跨节点选择时可能带出旧色）
			try {
				var fa = frag.querySelectorAll ? frag.querySelectorAll("[style],[color],font") : [];
				for (var k = 0; k < fa.length; k++) clearColor(fa[k]);
				clearColor(frag);
			} catch (e2) {}
			span.appendChild(frag);
			rng.insertNode(span);
			sel.removeAllRanges();
			var nr = d.createRange();
			nr.selectNodeContents(span);
			sel.addRange(nr);
		} catch (e3) {}

		this._dirty = true;
		return true;
	} catch (e) {
		return false;
	}
};

// 用系统吸管取色，并应用到选中文字（夜间模式下也能生效）
HtmlRenderer.prototype._pickColorWithEyedropper = function() {
	var self = this;
	function applyColor(hex) {
		if (!hex) return;
		self._lastColor = hex;
		self._applyColorToSelection(hex);
	}
	if (typeof window.EyeDropper === "function") {
		try {
			new window.EyeDropper().open().then(function(res) {
				applyColor(res && res.sRGBHex ? res.sRGBHex : null);
			}).catch(function(err) {
				_hvpLog("eyedropper cancelled/failed: " + (err && err.message ? err.message : err));
			});
		} catch (e) {
			new obsidian.Notice("吸管不可用（" + e.message + "）");
		}
	} else {
		_hvpLog("EyeDropper API not available in this environment");
		new obsidian.Notice("当前环境不支持系统吸管，请直接用上面的色块");
	}
};

HtmlRenderer.prototype._showColorPicker = function() {
	var self = this;
	// 真开关：开着就关掉并返回，不再重建
	// 悬停模式：面板由 _openColorPad / _scheduleCloseColorPad 管理
	// 不再用「点外部关闭」——那个监听器会在注册后立刻把面板判为外部点击而删掉
	var old = document.getElementById("hvp-color-pad");
	if (old) return;

	var pad = document.createElement("div");
	pad.id = "hvp-color-pad";
	pad.style.cssText = "position:fixed;z-index:100001;display:grid;" +
		"grid-template-columns:repeat(8,22px);gap:5px;background:var(--background-primary,#fff);" +
		"border:1px solid var(--background-modifier-border,#ddd);border-radius:8px;" +
		"padding:8px;box-shadow:0 6px 22px rgba(0,0,0,.28);";

	// 定位到颜色按钮下方
	try {
		var btn = this._colorBtnEl;
		var r = btn ? btn.getBoundingClientRect() : { bottom: 60, left: 60 };
		pad.style.top = Math.round(r.bottom + 6) + "px";
		pad.style.left = Math.round(r.left) + "px";
	} catch (e) {
		pad.style.top = "60px";
		pad.style.left = "60px";
	}

	var colors = ["#1f1c18", "#4a443c", "#7d7568", "#a3392c", "#c0392b", "#8a5a2b",
		"#b8863f", "#3f6b45", "#2f6f7f", "#2b5c8a", "#5b3a8a", "#a03a7a",
		"#000000", "#ffffff", "#f3eee5", "#fbf1ee"];
	colors.forEach(function(c) {
		var sw = document.createElement("button");
		sw.title = c;
		sw.style.cssText = "width:22px;height:22px;border-radius:4px;cursor:pointer;" +
			"border:1px solid rgba(0,0,0,.22);padding:0;background:" + c + ";";
		sw.addEventListener("mousedown", function(e) { e.preventDefault(); });
		sw.addEventListener("click", function(e) {
			e.preventDefault(); e.stopPropagation();
			self._lastColor = c;
			// 只上色，不关面板 —— 面板开关由工具栏的颜色图标控制
			self._applyColorToSelection(c);
		});
		pad.appendChild(sw);
	});
	// 自定义颜色
	var custom = document.createElement("button");
	custom.textContent = "🎨 吸管取色";
	custom.style.cssText = "grid-column:span 8;margin-top:4px;cursor:pointer;" +
		"border:1px solid var(--background-modifier-border,#ddd);border-radius:6px;" +
		"background:var(--background-secondary,#f5f5f5);color:inherit;padding:4px;font-size:12px;";
	custom.addEventListener("mousedown", function(e) { e.preventDefault(); });
	custom.addEventListener("click", function(e) {
		e.preventDefault(); e.stopPropagation();
		// 同样不关闭面板
		self._pickColorWithEyedropper();
	});
	pad.appendChild(custom);

	document.body.appendChild(pad);
	this._colorPadOpen = true;

	// 鼠标移到面板上不要关
	pad.addEventListener("mouseenter", function() {
		if (self._colorPadTimer) { clearTimeout(self._colorPadTimer); self._colorPadTimer = null; }
	});
	pad.addEventListener("mouseleave", function() { self._scheduleCloseColorPad(); });
};

// 打开颜色面板（幂等）
HtmlRenderer.prototype._openColorPad = function() {
	if (this._colorPadTimer) { clearTimeout(this._colorPadTimer); this._colorPadTimer = null; }
	if (document.getElementById("hvp-color-pad")) return;
	this._showColorPicker();
};

// 延时关闭（留出从按钮移到面板的时间）
HtmlRenderer.prototype._scheduleCloseColorPad = function() {
	var self = this;
	if (this._colorPadTimer) clearTimeout(this._colorPadTimer);
	this._colorPadTimer = setTimeout(function() {
		var pad = document.getElementById("hvp-color-pad");
		if (pad) pad.remove();
		self._colorPadOpen = false;
		self._colorPadTimer = null;
	}, 220);
};
HtmlRenderer.prototype._toggleDarkMode = function() {
	var doc = null;
	try { doc = this.iframe.contentDocument; } catch (e) { doc = null; }
	if (!doc || !doc.head) {
		new obsidian.Notice("内容尚未加载完成");
		return;
	}
	// 补丁注入不算用户编辑；用 try/finally 确保无论成败都复位，
	// 否则一旦中途抛错，_suppressMutation 卡在 true 会让后续编辑全部不被记录
	this._suppressMutation = true;
	try {
		var existing = doc.getElementById("hvp-manual-dark");
		if (existing) existing.remove();
		var st = doc.createElement("style");
		st.id = "hvp-manual-dark";
		if (this._darkManual) {
			// 切回日间：还原文件自己的浅色设计（写死颜色，不依赖 CSS 变量）
			this._darkManual = false;
			st.textContent =
				"html{background:#ffffff!important}" +
				"body{background:#faf7f2!important;color:#1f1c18!important}" +
				"pre,code{background:#f3eee5!important;color:#1f1c18!important}" +
				".lead{background:#f3eee5!important}" +
				".callout{background:#ffffff!important}" +
				".callout.warn{background:#fbf1ee!important}" +
				".callout.ok{background:#f0f5ef!important}" +
				"table{background:transparent!important}";
		} else {
			// 切到夜间：整页反转 + 图片二次反转（Gmail/Outlook 同款做法）
			this._darkManual = true;
			st.textContent =
				"html{filter:invert(1) hue-rotate(180deg)!important;background:#111!important}" +
				"img,video,svg,canvas,iframe{filter:invert(1) hue-rotate(180deg)!important}" +
				":root{--card:#f2f4f7;--line:#d8dce3}";
		}
		doc.head.appendChild(st);
		this._updateDarkBtn();
	} finally {
		this._suppressMutation = false;
	}
};

HtmlRenderer.prototype._updateDarkBtn = function() {
	if (!this.darkBtn) return;
	var on = !!this._darkManual;
	try {
		if (on) {
			this.darkBtn.innerHTML = svgIcon("sun");
			this.darkBtn.title = "切回日间模式";
			this.darkBtn.style.color = "var(--interactive-accent,#7c5cff)";
		} else {
			this.darkBtn.innerHTML = svgIcon("dark");
			this.darkBtn.title = "切到夜间模式（仅当前 HTML）";
			this.darkBtn.style.color = "";
		}
	} catch (e) {}
};

HtmlRenderer.prototype._hideImagePanel = function() {
	if (this._imgPanel && this._imgPanel.parentNode) this._imgPanel.parentNode.removeChild(this._imgPanel);
	this._imgPanel = null;
};

// 选图片来源：本地文件（转内嵌 base64）或 路径/网址
HtmlRenderer.prototype._pickImageSrc = function(cb) {
	if (!this._editFileInput) {
		var inp = document.createElement("input");
		inp.type = "file";
		inp.accept = "image/*";
		inp.style.display = "none";
		inp.addEventListener("change", function() {
			var f = inp.files && inp.files[0];
			if (!f) return;
			var fr = new FileReader();
			fr.onload = function() { cb(fr.result); };
			fr.readAsDataURL(f);
			inp.value = "";
		});
		document.body.appendChild(inp);
		this._editFileInput = inp;
	}
	var choice = window.prompt(
		"图片来源：\n\n输入 1 = 从电脑选图片（转成内嵌 base64，文件自包含）\n输入 2 = 手填路径或网址\n\n也可以直接填路径/网址",
		"1");
	if (choice === null) return;
	var c = choice.trim();
	if (c === "1") { this._editFileInput.click(); return; }
	if (c === "" ) return;
	if (c === "2") {
		var u = window.prompt("填图片路径或网址", "");
		if (!u) return;
		cb(u.trim());
		return;
	}
	cb(c);
};

HtmlRenderer.prototype._insertImage = function() {
	var self = this;
	this._pickImageSrc(function(src) {
		try {
			var d = self.iframe.contentDocument;
			d.body.focus();
			d.execCommand("insertHTML", false, '<img src="' + src + '" style="max-width:100%">');
		} catch (e) {
			new obsidian.Notice("插入图片失败：" + (e && e.message ? e.message : e));
		}
	});
};

HtmlRenderer.prototype._replaceImage = function(img) {
	var self = this;
	this._pickImageSrc(function(src) {
		try { img.setAttribute("src", src); } catch (e) {}
		self._hideImagePanel();
	});
};

HtmlRenderer.prototype._resizeImage = function(img) {
	var cur = img.style.width || "100%";
	var v = window.prompt("图片宽度（如 50% 或 320px）", cur);
	if (v === null) return;
	v = v.trim();
	if (!v) { img.style.width = ""; this._hideImagePanel(); return; }
	img.style.width = v;
	img.style.maxWidth = "100%";
	this._hideImagePanel();
};

HtmlRenderer.prototype._deleteImage = function(img) {
	try { if (img.parentNode) img.parentNode.removeChild(img); } catch (e) {}
	this._hideImagePanel();
};

HtmlRenderer.prototype._insertLink = function() {
	var self = this;
	var url = window.prompt("链接地址（https:// 开头，或相对路径）", "https://");
	if (!url) return;
	try {
		var d = self.iframe.contentDocument;
		d.body.focus();
		d.execCommand("createLink", false, url.trim());
	} catch (e) {}
};

// 保存：剥离预览期注入的 style/base，序列化后回写原 .html；首次保存会在文件内留一份原内容备份
HtmlRenderer.prototype._saveEdit = function() {
	var self = this;
	_hvpLog("saveEdit called file=" + (this.file ? this.file.name : "?"));
	try {
		var doc = this.iframe.contentDocument;
		if (!doc || !doc.body) {
			new obsidian.Notice("保存失败：内容未就绪");
			return;
		}

		// 1) 退出编辑态，避免 contenteditable 与提示边框写进文件
		doc.body.removeAttribute("contenteditable");
		var savedOutline = doc.body.style.outline;
		var savedOffset = doc.body.style.outlineOffset;
		doc.body.style.outline = "";
		doc.body.style.outlineOffset = "";

		// 2) 移掉预览期注入的 <style> 与 <base>
		var removedStyles = [];
		var styles = doc.head ? doc.head.querySelectorAll("style") : [];
		for (var i = 0; i < styles.length; i++) {
			var st = styles[i];
			var txt = st.textContent || "";
			if (st.id === "hvp-plugin-dark" || st.id === "hvp-manual-dark" ||
				st.id === "hvp-table-resize" ||
				txt.indexOf("html-viewer") !== -1 || txt.indexOf("overflow-x:hidden") !== -1 ||
				txt.indexOf("filter: invert") !== -1 ||
				txt.indexOf("hue-rotate") !== -1 ||
				(txt.indexOf("background-color") !== -1 && txt.indexOf("!important") !== -1)) {
				removedStyles.push(st);
				st.parentNode.removeChild(st);
			}
		}
		var baseEl = doc.head ? doc.head.querySelector("base") : null;
		var baseNext = null;
		if (baseEl) {
			baseNext = baseEl.nextSibling;
			baseEl.parentNode.removeChild(baseEl);
		}

		// 3) 序列化
		var dt = doc.doctype ? ("<!DOCTYPE " + doc.doctype.name + ">\n") : "<!DOCTYPE html>\n";
		var html = dt + doc.documentElement.outerHTML;

		// 4) 还原预览补丁，视图无需重载即可继续看
		if (baseEl) {
			if (baseNext && baseNext.parentNode) baseNext.parentNode.insertBefore(baseEl, baseNext);
			else doc.head.insertBefore(baseEl, doc.head.firstChild);
		}
		for (var j = 0; j < removedStyles.length; j++) doc.head.appendChild(removedStyles[j]);
		doc.body.style.outline = savedOutline;
		doc.body.style.outlineOffset = savedOffset;

		// 5) 旧文件先备份到 99·归档驿站/_编辑备份/，再写回新内容，最后退出编辑回到阅读界面
		var file = this.file;
		var v = this.plugin.app.vault;
		var orig = "";

		function nextFreePath(base) {
			var p = base, n = 2;
			while (v.getAbstractFileByPath(p)) {
				p = base.replace(/\.html?$/i, "") + "_" + n + ".html";
				n++;
				if (n > 50) break;
			}
			return p;
		}
		function two(n) { return (n < 10 ? "0" : "") + n; }
		var BACKUP_DIR = "99·归档驿站/_编辑备份";

		Promise.resolve(v.read(file)).then(function(current) {
			orig = current || "";
			// 时间戳文件名，避免覆盖已有备份
			var d = new Date();
			var stamp = d.getFullYear() + two(d.getMonth() + 1) + two(d.getDate()) + "_" +
				two(d.getHours()) + two(d.getMinutes()) + two(d.getSeconds());
			// 备份统一放到 99·归档驿站/_编辑备份/（按用户要求）
			var name = file.name.replace(/\.html?$/i, "") + "_" + stamp + ".html";
			var base = BACKUP_DIR + "/" + name;
			var path = nextFreePath(base);
			// 目录不存在就先建（递归）
			var dirReady = Promise.resolve();
			if (!v.getAbstractFileByPath(BACKUP_DIR)) {
				dirReady = v.createFolder(BACKUP_DIR, true).catch(function() {});
			}
			return dirReady.then(function() { return v.create(path, orig); }).then(function() {
				_hvpLog("backup created: " + path);
			}).catch(function(e) {
				_hvpLog("backup failed: " + (e && e.message ? e.message : e));
			});
		}).then(function() {
			return v.modify(file, html);
		}).then(function() {
			self._dirty = false;
			new obsidian.Notice("已保存 \u2192 备份在 99·归档驿站/_编辑备份/");
			self._exitEdit(true);   // 退出编辑，回到阅读界面
		}).catch(function(e) {
			new obsidian.Notice("保存失败：" + (e && e.message ? e.message : e));
		});
	} catch (e) {
		new obsidian.Notice("保存异常：" + (e && e.message ? e.message : e));
	}
};

// --- Search ---

HtmlRenderer.prototype._setupSearchShortcut = function() {
	var self = this;
	function handler(e) {
		var mod = e.ctrlKey || e.metaKey;
		if (!mod) return;
		// 搜索（按钮已移除，快捷键保留）
		if (e.key === "f") {
			e.preventDefault();
			e.stopPropagation();
			self._toggleSearch();
			return;
		}
		// 缩放快捷键（2026-09-22 新增，替代已移除的缩放按钮）
		if (e.key === "+" || e.key === "=" || e.key === "Add") {
			e.preventDefault();
			e.stopPropagation();
			self._zoomIn();
			return;
		}
		if (e.key === "-" || e.key === "_" || e.key === "Subtract") {
			e.preventDefault();
			e.stopPropagation();
			self._zoomOut();
			return;
		}
		if (e.key === "0") {
			e.preventDefault();
			e.stopPropagation();
			self._zoomReset();
			return;
		}
	}
	this.containerEl.addEventListener("keydown", handler);
	try {
		var doc = this.iframe.contentDocument;
		if (doc) doc.addEventListener("keydown", handler);
	} catch (e) {}
};

HtmlRenderer.prototype._toggleSearch = function() {
	var self = this;
	if (this.searchBar) {
		this.searchBar.remove();
		this.searchBar = null;
		this._clearHighlight();
		return;
	}
	this.searchBar = this.containerEl.createDiv({ cls: "html-viewer-search" });
	var input = this.searchBar.createEl("input", { attr: { type: "text", placeholder: "搜索...", spellcheck: "false" } });
	this.searchCount = this.searchBar.createSpan({ cls: "search-count", text: "" });
	makeBtn(this.searchBar, "▲", "上一个", "html-viewer-toolbar-btn", function() { self._gotoMatch(-1, input.value); });
	makeBtn(this.searchBar, "▼", "下一个", "html-viewer-toolbar-btn", function() { self._gotoMatch(1, input.value); });
	makeBtn(this.searchBar, "✕", "关闭", "html-viewer-toolbar-btn", function() { self._toggleSearch(); });
	input.addEventListener("keydown", function(e) {
		if (e.key === "Enter") { e.preventDefault(); self._gotoMatch(e.shiftKey ? -1 : 1, input.value); }
		if (e.key === "Escape") self._toggleSearch();
	});
	input.addEventListener("input", function() { self._doSearch(input.value); });
	input.focus();
};

HtmlRenderer.prototype._collectMatches = function(q) {
	var results = [];
	try {
		var doc = this.iframe.contentDocument;
		if (!doc || !q) return results;
		var lower = q.toLowerCase();
		var walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null, false);
		while (walker.nextNode()) {
			var node = walker.currentNode;
			var text = node.textContent.toLowerCase();
			var idx = 0;
			while (true) {
				var pos = text.indexOf(lower, idx);
				if (pos === -1) break;
				var range = doc.createRange();
				range.setStart(node, pos);
				range.setEnd(node, pos + q.length);
				results.push(range);
				idx = pos + 1;
			}
		}
	} catch (e) {}
	return results;
};

HtmlRenderer.prototype._doSearch = function(q) {
	this._clearHighlight();
	this._matchRanges = [];
	this._matchIdx = -1;
	if (!q) { if (this.searchCount) this.searchCount.textContent = ""; return; }
	this._matchRanges = this._collectMatches(q);
	if (this.searchCount) this.searchCount.textContent = this._matchRanges.length > 0 ? "0/" + this._matchRanges.length : "无结果";
	if (this._matchRanges.length > 0) this._gotoMatch(1, q);
};

HtmlRenderer.prototype._revealTabForNode = function(node) {
	try {
		var doc = this.iframe.contentDocument;
		var win = this.iframe.contentWindow;
		if (!doc || !win) return false;
		var el = (node.nodeType === 1) ? node : node.parentElement;
		// Walk up to find a hidden ancestor
		while (el && el !== doc.body) {
			var cs = win.getComputedStyle(el);
			if (cs.display === "none" || cs.visibility === "hidden") {
				// Found hidden container - try to activate its tab
				var panel = el;
				// Try common tab panel patterns
				var id = panel.id;
				if (id) {
					var trigger = doc.querySelector('[href="#' + id + '"], [data-target="#' + id + '"], [aria-controls="' + id + '"]');
					if (trigger) { trigger.click(); return true; }
				}
				// Try sibling buttons/links before the panel
				var parent = panel.parentElement;
				if (parent) {
					var children = parent.children;
					for (var j = 0; j < children.length; j++) {
						var sib = children[j];
						if (sib === panel) break;
						if (sib.tagName === "BUTTON" || sib.tagName === "A" || sib.getAttribute("role") === "tab") {
							sib.click();
							return true;
						}
					}
				}
				// Try nav/tabs container as previous sibling of parent
				var prev = parent.previousElementSibling;
				while (prev) {
					var btns = prev.querySelectorAll("button, a, [role=\"tab\"]");
					if (btns.length > 0) {
						// Find the button whose target matches the panel
						for (var k = 0; k < btns.length; k++) {
							var b = btns[k];
							var target = b.getAttribute("data-target") || b.getAttribute("href") || b.getAttribute("aria-controls");
							if (target && (target === "#" + id || target === id)) {
								b.click();
								return true;
							}
						}
						// Fallback: click all buttons to find the right one
						for (var m = 0; m < btns.length; m++) {
							var prevActive = btns[m].classList.contains("active");
							btns[m].click();
							var nowCs = win.getComputedStyle(panel);
							if (nowCs.display !== "none") return true;
							if (!prevActive) btns[m].classList.remove("active");
						}
					}
					prev = prev.previousElementSibling;
				}
				return false;
			}
			el = el.parentElement;
		}
	} catch (e) {}
	return false;
};

HtmlRenderer.prototype._gotoMatch = function(dir, q) {
	if (!this._matchRanges || this._matchRanges.length === 0) {
		if (q) this._doSearch(q);
		if (!this._matchRanges || this._matchRanges.length === 0) return;
	}
	var len = this._matchRanges.length;
	this._matchIdx += dir;
	if (this._matchIdx >= len) this._matchIdx = 0;
	if (this._matchIdx < 0) this._matchIdx = len - 1;
	var self = this;
	try {
		var doc = this.iframe.contentDocument;
		var win = this.iframe.contentWindow;
		if (!doc || !win) return;
		var range = this._matchRanges[this._matchIdx].cloneRange();
		var node = range.startContainer;
		// Try to reveal the tab containing this match
		var revealed = this._revealTabForNode(node);
		var doSelect = function() {
			try {
				var sel = win.getSelection();
				sel.removeAllRanges();
				sel.addRange(range);
				var targetEl = (node.nodeType === 1) ? node : node.parentElement;
				if (targetEl) targetEl.scrollIntoView({ block: "center", behavior: "smooth" });
			} catch (e) {}
			if (self.searchCount) self.searchCount.textContent = (self._matchIdx + 1) + "/" + self._matchRanges.length;
		};
		if (revealed) {
			setTimeout(doSelect, 200);
		} else {
			doSelect();
		}
	} catch (e) {
		if (this.searchCount) this.searchCount.textContent = (this._matchIdx + 1) + "/" + this._matchRanges.length;
	}
};

HtmlRenderer.prototype._clearHighlight = function() {
	try {
		var w = this.iframe.contentWindow;
		if (w) w.getSelection().removeAllRanges();
	} catch (e) {}
	this._matchRanges = [];
	this._matchIdx = -1;
};

// --- Fullscreen / External / Goto ---

HtmlRenderer.prototype._toggleFullscreen = function() {
		var self = this;
		if (document.fullscreenElement) { document.exitFullscreen(); return; }
		this.containerEl.requestFullscreen().catch(function() {});
		if (!this._fullscreenHandler) {
			this._fullscreenHandler = function() { self._onFullscreenChange(); };
			document.addEventListener("fullscreenchange", this._fullscreenHandler);
		}
	};

	HtmlRenderer.prototype._onFullscreenChange = function() {
		var isFS = !!document.fullscreenElement && document.fullscreenElement === this.containerEl;
		_hvpLog("fullscreen-change isFS=" + isFS);
		if (!isFS) {
			this.containerEl.style.background = "";
			if (!this.isFullView && this.iframe) {
				this.iframe.style.maxHeight = "";
				this.containerEl.style.height = "";
				this._updateSize();
			}
			return;
		}
		if (!this.isFullView && this.iframe) {
			try {
				var doc = this.iframe.contentDocument;
				if (doc) {
					var contentH = doc.documentElement.scrollHeight || doc.body.scrollHeight;
					var vh = window.innerHeight;
					// Read iframe body background and apply to container
					var bodyBg = doc.defaultView.getComputedStyle(doc.body).backgroundColor;
					if (bodyBg && bodyBg !== "rgba(0, 0, 0, 0)") {
						this.containerEl.style.background = bodyBg;
					}
					// Clear embed sizing, set to content height (capped at viewport)
					this.iframe.style.aspectRatio = "";
					this.iframe.style.minHeight = "";
					this.iframe.style.height = Math.min(contentH, vh) + "px";
					this.iframe.style.maxHeight = vh + "px";
					this.containerEl.style.height = "";
					_hvpLog("fullscreen: contentH=" + contentH + " vh=" + vh + " bg=" + bodyBg);
				}
			} catch(e) { _hvpLog("fullscreen error: " + e.message); }
		}
	};

HtmlRenderer.prototype._openExternally = function() {
	var basePath = this.plugin.app.vault.adapter.basePath;
	if (!basePath) return;
	try {
		var electron = require("electron");
		electron.shell.openPath(path.join(basePath, this.file.path));
	} catch (e) {
		new obsidian.Notice("无法在外部打开");
	}
};

HtmlRenderer.prototype._gotoFile = function() {
	this.plugin.app.workspace.openLinkText(this.file.path, "", false);
};

HtmlRenderer.prototype._toggleIdPicker = function() {
	if (this._idPicker) { this._closeIdPicker(); return; }
	try {
		var doc = this.iframe.contentDocument;
		if (!doc) return;
		var self = this;
		var SKIP_IDS = ["nav"];
		var SKIP_TAGS = ["marker", "defs", "lineargradient", "radialgradient", "clippath", "mask", "symbol", "use"];
		var allIds = doc.querySelectorAll("[id]");
		var items = [];
		for (var i = 0; i < allIds.length; i++) {
			var el = allIds[i];
			var id = el.id;
			if (!id || SKIP_IDS.indexOf(id) !== -1) continue;
			var tag = el.tagName.toLowerCase();
			if (SKIP_TAGS.indexOf(tag) !== -1) continue;
			var typeTag = "";
			if (el.classList && el.classList.contains("section")) typeTag = "section";
			else if (el.classList && el.classList.contains("card")) typeTag = "card";
			var label = "";
			var h = el.querySelector("h1, h2, h3, h4, h5, h6");
			if (h && h.textContent.trim()) {
				label = h.textContent.trim();
			} else if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") {
				label = el.textContent.trim();
			} else {
				var first = el.querySelector("b, strong, span:first-child, p:first-child");
				if (first && first.textContent.trim()) label = first.textContent.trim();
			}
			if (!label) {
				var raw = el.textContent.trim();
				if (raw) label = raw.length > 30 ? raw.substring(0, 30) + "..." : raw;
			}
			if (!label) label = id;
			items.push({ id: id, label: label.substring(0, 40), typeTag: typeTag });
		}
		if (items.length === 0) { new obsidian.Notice("此 HTML 中没有可用 ID"); return; }
		var picker = this.containerEl.createDiv({ cls: "html-viewer-id-picker" });
		picker.createEl("div", { cls: "html-viewer-id-picker-title", text: "点击复制嵌入语法" });
		var closeBtn = picker.createEl("button", { cls: "html-viewer-id-picker-close", text: "✕" });
		closeBtn.addEventListener("click", function() { self._closeIdPicker(); });
		var list = picker.createDiv({ cls: "html-viewer-id-picker-list" });
		for (var j = 0; j < items.length; j++) {
			var entry = items[j];
			var item = list.createDiv({ cls: "html-viewer-id-picker-item" });
			if (entry.typeTag) item.createEl("span", { cls: "html-viewer-id-picker-tag", text: entry.typeTag });
			item.createEl("span", { cls: "html-viewer-id-picker-label", text: entry.label });
			item.createEl("span", { cls: "html-viewer-id-picker-id", text: "#" + entry.id });
				item.addEventListener("mouseenter", (function(idVal) {
					return function() {
						var el = doc.getElementById(idVal);
						if (el) {
							el.style.boxShadow = "0 0 0 3px #38bdf8";
							el.scrollIntoView({ behavior: "smooth", block: "center" });
						}
					};
				})(entry.id));
				item.addEventListener("mouseleave", (function(idVal) {
					return function() {
						var el = doc.getElementById(idVal);
						if (el) el.style.boxShadow = "";
					};
				})(entry.id));
				item.addEventListener("click", (function(idVal) {
					return function() {
						var el = doc.getElementById(idVal);
						if (el) el.style.boxShadow = "";
						var syntax = "![[" + self.file.name + "#" + idVal + "]]";
						navigator.clipboard.writeText(syntax).then(function() {
							new obsidian.Notice("已复制: " + syntax);
						});
						self._closeIdPicker();
					};
				})(entry.id));
		}
		this._idPicker = picker;
	} catch (e) {}
};

HtmlRenderer.prototype._closeIdPicker = function() {
	if (this._idPicker) { this._idPicker.remove(); this._idPicker = null; }
};

HtmlRenderer.prototype.destroy = function() {
	_hvpLog("destroy file=" + (this.file ? this.file.name : "?"));
	// Blob URLs are shared via cache, not revoked per-instance
	this._blobUrl = null;
	if (this._lazyObs) { this._lazyObs.disconnect(); this._lazyObs = null; }
	if (this._resizeObs) { this._resizeObs.disconnect(); this._resizeObs = null; }
	if (this._scrollGuard) { this._scrollGuard.remove(); this._scrollGuard = null; }
	if (this._themeObs) { this._themeObs.disconnect(); this._themeObs = null; }
	if (this._fullscreenHandler) { document.removeEventListener("fullscreenchange", this._fullscreenHandler); this._fullscreenHandler = null; }
	if (this._idPicker) { this._idPicker.remove(); this._idPicker = null; }
	if (this.searchBar) { this.searchBar.remove(); this.searchBar = null; }
	// 2026-09-28：表格拖拽挂在宿主 window 上的两个监听
	if (this._tblWinBound) {
		window.removeEventListener("mousemove", this._tblWinMove, true);
		window.removeEventListener("mouseup", this._tblWinUp, true);
		this._tblWinBound = false;
		this._tblWinMove = null;
		this._tblWinUp = null;
	}
	this._teardownTableResize();   // 顺手摘掉编辑态注入的分隔线命中样式
};

// --- HtmlEmbedComponent ---

var HtmlEmbedComponent = (function(_super) {
	function HtmlEmbedComponent(plugin, containerEl, file, subpath) {
		_super.call(this);
		this.plugin = plugin;
		this.containerEl = containerEl;
		this.file = file;
		this.subpath = subpath || "";
		this.renderer = null;
		this._eid = ++_hvpId;
		_hvpLog("Embed#" + this._eid + " ctor file=" + (file ? file.name : "?") + " subpath=" + subpath);
	}
	HtmlEmbedComponent.prototype = Object.create(_super.prototype);
	HtmlEmbedComponent.prototype.constructor = HtmlEmbedComponent;

	HtmlEmbedComponent.prototype._render = function() {
		if (this.renderer) { this.renderer.destroy(); this.renderer = null; }
		this.renderer = new HtmlRenderer(this.plugin, this.containerEl, this.file, false);
		this.renderer.subpath = this.subpath;
		this.renderer.render();
	};

	HtmlEmbedComponent.prototype.onload = function() {
		_super.prototype.onload.call(this);
		_hvpLog("Embed#" + this._eid + " onload");
		var self = this;
		var obs = new MutationObserver(function() { if (self.renderer) self.renderer._updateSize(); });
		obs.observe(this.containerEl, { attributeFilter: ["width", "height"], attributes: true });
		this.register(function() { obs.disconnect(); });
	};

	HtmlEmbedComponent.prototype.loadFile = function(file) {
		_hvpLog("Embed#" + this._eid + " loadFile file=" + (file ? file.name : "null"));
		if (file) this.file = file;
		this._render();
	};

	HtmlEmbedComponent.prototype.onunload = function() {
		_hvpLog("Embed#" + this._eid + " onunload");
		_super.prototype.onunload.call(this);
		if (this.renderer) { this.renderer.destroy(); this.renderer = null; }
	};

	HtmlEmbedComponent.prototype.setSubpath = function(sp) {
		_hvpLog("Embed#" + this._eid + " setSubpath sp=" + sp);
		this.subpath = sp || "";
		if (this.renderer) {
			this.renderer.subpath = this.subpath;
			this.renderer._applySubpath();
		}
	};

	return HtmlEmbedComponent;
})(obsidian.Component);

// --- HtmlFileView ---

var HtmlFileView = (function(_super) {
	function HtmlFileView(leaf, plugin) {
		_super.call(this, leaf);
		this.plugin = plugin;
		this.renderer = null;
	}
	HtmlFileView.prototype = Object.create(_super.prototype);
	HtmlFileView.prototype.constructor = HtmlFileView;

	HtmlFileView.prototype.getViewType = function() { return VIEW_TYPE; };
	HtmlFileView.prototype.getDisplayText = function() { return this.file ? this.file.name : "HTML"; };
	HtmlFileView.prototype.getIcon = function() { return "globe"; };

	HtmlFileView.prototype.onLoadFile = function(file) {
		var self = this;
		return _super.prototype.onLoadFile.call(this, file).then(function() {
			self.contentEl.empty();
			self.contentEl.setAttribute("height", "100%");
			self.renderer = new HtmlRenderer(self.plugin, self.contentEl, file, true);
			self.renderer.render();
		});
	};

	HtmlFileView.prototype.onUnloadFile = function(file) {
		if (this.renderer) { this.renderer.destroy(); this.renderer = null; }
		return _super.prototype.onUnloadFile.call(this, file);
	};

	return HtmlFileView;
})(obsidian.FileView);

// --- Settings Tab (with Guide + Search) ---

var HtmlViewerSettingsTab = (function(_super) {
	function HtmlViewerSettingsTab(app, plugin) {
		_super.call(this, app, plugin);
		this.plugin = plugin;
		this._activeTab = "settings";
	}
	HtmlViewerSettingsTab.prototype = Object.create(_super.prototype);
	HtmlViewerSettingsTab.prototype.constructor = HtmlViewerSettingsTab;

	HtmlViewerSettingsTab.prototype.display = function() {
		var containerEl = this.containerEl;
		containerEl.empty();
		var s = this.plugin.settings;
		var plugin = this.plugin;
		var self = this;

		containerEl.createEl("h2", { text: "HTML Viewer Plus" });

		// Tab bar
		var tabBar = containerEl.createDiv({ cls: "html-viewer-tabs" });
		var tabSettings = tabBar.createDiv({ cls: "html-viewer-tab" + (this._activeTab === "settings" ? " active" : ""), text: "基本设置" });
		var tabGuide = tabBar.createDiv({ cls: "html-viewer-tab" + (this._activeTab === "guide" ? " active" : ""), text: "使用说明" });

		var settingsContent = containerEl.createDiv({ cls: "html-viewer-tab-content" });
		var guideContent = containerEl.createDiv({ cls: "html-viewer-tab-content" });

		function showSettings() {
			self._activeTab = "settings";
			tabSettings.className = "html-viewer-tab active";
			tabGuide.className = "html-viewer-tab";
			settingsContent.style.display = "";
			guideContent.style.display = "none";
		}
		function showGuide() {
			self._activeTab = "guide";
			tabSettings.className = "html-viewer-tab";
			tabGuide.className = "html-viewer-tab active";
			settingsContent.style.display = "none";
			guideContent.style.display = "";
		}

		tabSettings.addEventListener("click", showSettings);
		tabGuide.addEventListener("click", showGuide);

		if (this._activeTab === "guide") showGuide(); else showSettings();

		this._buildSettings(settingsContent, s, plugin);
		this._buildGuide(guideContent, tabBar, showSettings, showGuide);
	};

	HtmlViewerSettingsTab.prototype._buildSettings = function(containerEl, s, plugin) {
		containerEl.createEl("h3", { text: "嵌入尺寸" });

		new obsidian.Setting(containerEl)
			.setName("默认宽度")
			.setDesc("嵌入时的默认宽度，如 100%、600px")
			.addText(function(t) { t.setValue(s.defaultWidth).onChange(function(v) { s.defaultWidth = v; plugin.saveSettings(); }); });

		new obsidian.Setting(containerEl)
			.setName("宽高比")
			.setDesc("嵌入区域的宽高比。支持格式：4/3、16:9、1.33 等。宽度确定后高度按此比例自动计算。")
			.addText(function(t) { t.setValue(s.aspectRatio).onChange(function(v) { s.aspectRatio = v; plugin.saveSettings(); }); });

		containerEl.createEl("h3", { text: "工具栏" });

		new obsidian.Setting(containerEl)
			.setName("显示工具栏")
			.setDesc("在嵌入视图右下角显示操作按钮（全屏、外部打开、定位到文件）")
			.addToggle(function(t) { t.setValue(s.showToolbar).onChange(function(v) { s.showToolbar = v; plugin.saveSettings(); }); });

		containerEl.createEl("h3", { text: "直接打开模式" });

		new obsidian.Setting(containerEl)
			.setName("启用缩放")
			.setDesc("直接打开 HTML 文件时，使用 Ctrl + 鼠标滚轮缩放内容")
			.addToggle(function(t) { t.setValue(s.enableZoom).onChange(function(v) { s.enableZoom = v; plugin.saveSettings(); }); });

		new obsidian.Setting(containerEl)
			.setName("缩放步长")
			.setDesc("每次滚动的缩放比例（0.05 ~ 0.5）")
			.addText(function(t) { t.setValue(String(s.zoomStep)).onChange(function(v) { s.zoomStep = parseFloat(v) || 0.1; plugin.saveSettings(); }); });

		new obsidian.Setting(containerEl)
			.setName("启用搜索")
			.setDesc("直接打开 HTML 文件时，在工具栏中显示搜索按钮")
			.addToggle(function(t) { t.setValue(s.enableSearch).onChange(function(v) { s.enableSearch = v; plugin.saveSettings(); }); });

		containerEl.createEl("h3", { text: "主题" });

		new obsidian.Setting(containerEl)
			.setName("同步暗色主题")
			.setDesc("Obsidian 使用暗色主题时，自动向 HTML 注入暗色样式")
			.addToggle(function(t) { t.setValue(s.syncDarkTheme).onChange(function(v) { s.syncDarkTheme = v; plugin.saveSettings(); }); });

		new obsidian.Setting(containerEl)
			.setName("自定义暗色 CSS")
			.setDesc("追加到默认暗色样式后面的自定义 CSS")
			.addTextArea(function(t) { t.setPlaceholder("body { filter: invert(0.05); }").setValue(s.customDarkCSS).onChange(function(v) { s.customDarkCSS = v; plugin.saveSettings(); }); });

		new obsidian.Setting(containerEl)
			.setName("自定义背景色")
			.setDesc("开启后强制设置 HTML body 背景色")
			.addColorPicker(function(cp) { cp.setValue(s.bgColor).onChange(function(v) { s.bgColor = v; plugin.saveSettings(); }); })
			.addToggle(function(t) { t.setValue(s.bgColorEnabled).onChange(function(v) { s.bgColorEnabled = v; plugin.saveSettings(); }); });

		containerEl.createEl("h3", { text: "高级" });

		new obsidian.Setting(containerEl)
			.setName("热刷新")
			.setDesc("HTML 文件被修改时自动重新加载嵌入内容")
			.addToggle(function(t) { t.setValue(s.hotRefresh).onChange(function(v) { s.hotRefresh = v; plugin.saveSettings(); }); });

		new obsidian.Setting(containerEl)
			.setName("MHTML 支持")
			.setDesc("支持打开 .mht / .mhtml 网页存档文件（需要重启插件）")
			.addToggle(function(t) { t.setValue(s.mhtmlSupport).onChange(function(v) { s.mhtmlSupport = v; plugin.saveSettings(); }); });
	};

	HtmlViewerSettingsTab.prototype._buildGuide = function(containerEl, tabBar, showSettings, showGuide) {
		var guide = containerEl.createDiv({ cls: "html-viewer-guide" });

		// Guide search
		var searchWrap = guide.createDiv({ cls: "html-viewer-guide-search" });
		var searchInput = searchWrap.createEl("input", { attr: { type: "text", placeholder: "搜索说明...", spellcheck: "false" } });
		var searchResult = searchWrap.createSpan({ cls: "html-viewer-guide-search-result" });

		// Sections data for search
		var sections = [];

		function addSection(title, buildContent) {
			var h4 = guide.createEl("h4", { text: title });
			var wrap = guide.createDiv({ cls: "html-viewer-guide-section" });
			buildContent(wrap);
			sections.push({ title: title, h4: h4, wrap: wrap });
		}

			addSection("嵌入语法", function(wrap) {
				var list = wrap.createEl("ul");
					var items = [
						{ code: "![[file.html]]", desc: "嵌入 HTML，使用插件设置中的默认宽度和宽高比" },
						{ code: "![[file.html|400]]", desc: "嵌入 HTML，自定义宽度为 400px，高度按宽高比自动计算" },
						{ code: "![[file.html|400x300]]", desc: "嵌入 HTML，自定义宽度 400px、高度 300px（覆盖宽高比）" },
							{ code: "![[file.html#elementId]]", desc: "只提取显示指定 id 元素的内容，隐藏其他内容，高度自适应" },
					];
				for (var i = 0; i < items.length; i++) {
					var li = list.createEl("li");
					li.createEl("code", { text: items[i].code });
					li.createSpan({ text: " — " + items[i].desc });
				}
				list.createEl("li", { text: "提示：在 HTML 中为需要嵌入的元素添加 id 属性，即可通过 #id 精确定位" });
			});

		addSection("直接打开", function(wrap) {
			wrap.createEl("p", { text: "在文件管理器中点击 HTML 文件，会以独立视图打开，高度自动填满编辑区。" });
		});

			addSection("嵌入模式工具栏", function(wrap) {
				var list = wrap.createEl("ul");
				list.createEl("li", { text: "⛶ 全屏 — 全屏显示嵌入内容" });
				list.createEl("li", { text: "↗ 外部打开 — 用系统默认浏览器打开文件" });
				list.createEl("li", { text: "→ 定位到文件 — 在 Obsidian 中打开该 HTML 文件" });
				list.createEl("li", { text: "工具栏默认半透明，鼠标悬停时完全显示，不影响内容浏览" });
			});
		addSection("直接打开模式工具栏", function(wrap) {
			var list = wrap.createEl("ul");
			list.createEl("li", { text: "＋ / － — 放大 / 缩小（也可用 Ctrl + 鼠标滚轮）" });
			list.createEl("li", { text: "↺ — 重置缩放到 100%" });
			list.createEl("li", { text: "🔍 — 打开搜索栏，输入关键词后在 HTML 内查找文本（自动跳转到包含匹配内容的标签页）" });
			list.createEl("li", { text: "↻ — 手动刷新，重新加载 HTML 内容" });
			list.createEl("li", { text: "↗ — 用系统默认浏览器 / 程序在外部打开文件" });
		});

			addSection("右键菜单（嵌入/直接打开）", function(wrap) {
				var list = wrap.createEl("ul");
				list.createEl("li", { text: "在 HTML 内容区域右键点击，弹出可用元素菜单" });
				list.createEl("li", { text: "菜单显示鼠标所在位置所有带 id 的祖先元素" });
				list.createEl("li", { text: "每个元素提供两个操作：嵌入（![[file#id]]）、链接（[[file#id]]）" });
				list.createEl("li", { text: "鼠标悬停在菜单条目上，对应 HTML 元素会显示蓝色高亮边框" });
				list.createEl("li", { text: "左键点击 HTML 其他区域可关闭菜单" });
			});

			addSection("嵌入徽章与交互", function(wrap) {
				var list = wrap.createEl("ul");
				list.createEl("li", { text: "嵌入区域右上角显示 < > 徽章，hover 时可见，点击可定位到 Markdown 中对应的嵌入语法位置" });
				list.createEl("li", { text: "嵌入内容有滚动保护：首次需要点击内容区域后才能滚动，避免在笔记中误触滚动嵌入内容" });
			});

		addSection("搜索功能与标签页跳转", function(wrap) {
			wrap.createEl("p", { text: "点击搜索按钮后，在右上角输入框输入关键词。如果 HTML 内容使用了标签页（tab）组织，搜索会自动检测匹配内容所在的标签页并切换过去。按 Enter 或点击 ▼ 跳到下一个匹配，点击 ▲ 跳到上一个。按 Esc 或点击 ✕ 关闭搜索。" });
		});

		addSection("暗色主题同步", function(wrap) {
			wrap.createEl("p", { text: "开启后，当 Obsidian 切换到暗色主题时，会自动向 HTML 注入暗色 CSS 样式。可在「自定义暗色 CSS」中追加自己的样式覆盖。" });
		});

		addSection("热刷新", function(wrap) {
			wrap.createEl("p", { text: "开启后，当 HTML 文件在外部被修改并保存时，嵌入视图会自动重新加载。适合实时预览编辑中的 HTML 文件。" });
		});

		addSection("MHTML 支持", function(wrap) {
			wrap.createEl("p", { text: "开启后支持直接打开 .mht / .mhtml 网页存档文件，自动解析并渲染其中的 HTML 内容。" });
		});

		addSection("支持的文件格式", function(wrap) {
			var list = wrap.createEl("ul");
			list.createEl("li", { text: "HTML: .html, .htm, .shtml, .xht, .xhtml" });
			list.createEl("li", { text: "MHTML（需开启）: .mht, .mhtml" });
		});

		// Search logic
		searchInput.addEventListener("input", function() {
			var q = searchInput.value.trim().toLowerCase();
			if (!q) {
				searchResult.textContent = "";
				for (var i = 0; i < sections.length; i++) {
					sections[i].h4.style.background = "";
					sections[i].wrap.style.display = "";
				}
				return;
			}
			var matchCount = 0;
			var firstMatch = null;
			// If currently on settings tab, switch to guide
			// (searchInput is in guide, so user must be in guide to type)
			for (var j = 0; j < sections.length; j++) {
				var sec = sections[j];
				var text = (sec.title + " " + sec.wrap.textContent).toLowerCase();
				if (text.indexOf(q) !== -1) {
					sec.h4.style.background = "var(--text-selection)";
					sec.wrap.style.display = "";
					matchCount++;
					if (!firstMatch) firstMatch = sec;
				} else {
					sec.h4.style.background = "";
					sec.wrap.style.display = "none";
				}
			}
			searchResult.textContent = matchCount > 0 ? matchCount + " 个匹配" : "无匹配";
			if (firstMatch) firstMatch.h4.scrollIntoView({ behavior: "smooth", block: "nearest" });
		});

		searchInput.addEventListener("keydown", function(e) {
			if (e.key === "Escape") {
				searchInput.value = "";
				searchInput.dispatchEvent(new Event("input"));
				searchInput.blur();
			}
		});
	};

	return HtmlViewerSettingsTab;
})(obsidian.PluginSettingTab);

// --- Main Plugin ---

function HtmlViewerPlusPlugin(app, pluginId) {
	obsidian.Plugin.call(this, app, pluginId);
}
HtmlViewerPlusPlugin.prototype = Object.create(obsidian.Plugin.prototype);
HtmlViewerPlusPlugin.prototype.constructor = HtmlViewerPlusPlugin;

HtmlViewerPlusPlugin.prototype.onload = function() {
	var self = this;
	_hvpLogPath = path.join(self.app.vault.adapter.basePath, ".obsidian", "plugins", "html-editor-plus", "debug.log");
	try { require("fs").writeFileSync(_hvpLogPath, "=== HVP Debug Log " + new Date().toISOString() + " ===\n"); } catch(e) { console.log("[HVP] cannot write log: " + e.message); }
	return this.loadSettings().then(function() {
		var exts = HTML_EXT.slice();
		if (self.settings.mhtmlSupport) exts = exts.concat(MHTML_EXT);

		self.app.embedRegistry.registerExtensions(exts, function(embed, file, subpath) {
			var el = (embed && embed.containerEl) ? embed.containerEl : embed;
			return new HtmlEmbedComponent(self, el, file, subpath || "");
		});
		self.register(function() { self.app.embedRegistry.unregisterExtensions(exts); });

		self.app.viewRegistry.registerExtensions(exts, VIEW_TYPE);
		self.registerView(VIEW_TYPE, function(leaf) { return new HtmlFileView(leaf, self); });
		self.register(function() { self.app.viewRegistry.unregisterExtensions(exts); });

		self.addSettingTab(new HtmlViewerSettingsTab(self.app, self));

		if (self.app.plugins.getPlugin && self.app.plugins.getPlugin("embed-html")) {
			new obsidian.Notice("建议禁用 Embed HTML 插件，避免与 HTML Viewer Plus 冲突");
		}

		console.log("HTML Editor Plus loaded (based on HTML Viewer Plus)");
	});
};

HtmlViewerPlusPlugin.prototype.onunload = function() {
	_clearAllBlobs();
	console.log("HTML Viewer Plus unloaded");
};

HtmlViewerPlusPlugin.prototype.loadSettings = function() {
	var self = this;
	return this.loadData().then(function(data) {
		self.settings = Object.assign({}, DEFAULT_SETTINGS, data || {});
	});
};

HtmlViewerPlusPlugin.prototype.saveSettings = function() {
	return this.saveData(this.settings);
};

module.exports = HtmlViewerPlusPlugin;

/* nosourcemap */