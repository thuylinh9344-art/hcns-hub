/* Lớp kết nối cho bản chạy độc lập (GitHub Pages / Firebase Hosting).
   Cung cấp window.claude.use(name) với cùng giao diện mà ứng dụng đang dùng:
   db → Cloud Firestore, user → quyền, downloads → tải file, mcp → Google Sheets API. */
(function () {
  'use strict';
  var cfg = window.HUB_FIREBASE_CONFIG;
  var ROOT = (window.HUB_DATA_ROOT || 'hcns_hub/main').replace(/\/+$/, '');
  var SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
  window.HUB_STANDALONE = true;

  if (!cfg || !cfg.apiKey || /^DIEN_/.test(cfg.apiKey)) {
    var warn = document.createElement('div');
    warn.style.cssText = 'position:fixed;inset:0;z-index:100;display:grid;place-items:center;background:var(--bg);padding:16px';
    warn.innerHTML = '<div class="panel" style="max-width:440px"><h2>Chưa cấu hình Firebase</h2><p class="note">Mở file <b>firebase-config.js</b> trong repo, dán cấu hình web của dự án Firebase (Project settings → Your apps → Config), rồi đẩy lại lên GitHub. Hướng dẫn chi tiết trong README.</p></div>';
    document.body.appendChild(warn);
    window.claude = { use: function () { return new Promise(function () {}); } };
    return;
  }

  firebase.initializeApp(cfg);
  var auth = firebase.auth();
  var fs = firebase.firestore();
  try { fs.settings({ ignoreUndefinedProperties: true, merge: true }); } catch (e) {}

  var provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope(SHEETS_SCOPE);
  provider.setCustomParameters({ prompt: 'select_account' });
  var sheetToken = null, sheetTokenAt = 0;
  try { var _t = JSON.parse(sessionStorage.getItem('hubSheetTok') || 'null'); if (_t && _t.k && Date.now() - _t.at < 50 * 60 * 1000) { sheetToken = _t.k; sheetTokenAt = _t.at; } } catch (e) {}
  function keepTok() { try { sessionStorage.setItem('hubSheetTok', JSON.stringify({ k: sheetToken, at: sheetTokenAt })); } catch (e) {} }

  /* ---------- Đăng nhập ---------- */
  var css = document.createElement('style');
  css.textContent =
    '#hubLogin{position:fixed;inset:0;z-index:100;display:grid;place-items:center;background:var(--bg);padding:16px}' +
    '#hubLogin .box{max-width:380px;width:100%;background:var(--surface);border:1px solid var(--line);border-top:4px solid var(--accent);border-radius:10px;padding:28px;display:grid;gap:12px;text-align:center}' +
    '#hubLogin h1{margin:0;font-size:20px}#hubLogin p{margin:0;color:var(--muted)}' +
    '#hubUser{font-size:12px;color:var(--muted);padding:0 8px;display:grid;gap:6px}' +
    '#hubUser button{justify-self:start}';
  document.head.appendChild(css);

  var overlay = document.createElement('div');
  overlay.id = 'hubLogin';
  overlay.innerHTML = '<div class="box"><img src="logo.png" alt="UPharma" style="width:150px;height:auto;margin:0 auto 4px"><h1>Bàn điều hành HCNS</h1><p>Phòng Tổ chức Hành chính</p>' +
    '<button class="btn pri" id="hubSignIn" type="button">Đăng nhập bằng Google</button>' +
    '<p id="hubLoginMsg" style="font-size:12.5px"></p></div>';
  document.body.appendChild(overlay);
  document.getElementById('hubSignIn').addEventListener('click', function () {
    var msg = document.getElementById('hubLoginMsg');
    msg.textContent = 'Đang mở cửa sổ đăng nhập…';
    auth.signInWithPopup(provider).then(function (res) {
      if (res.credential && res.credential.accessToken) { sheetToken = res.credential.accessToken; sheetTokenAt = Date.now(); keepTok(); }
    }).catch(function (e) {
      msg.textContent = e && e.code === 'auth/unauthorized-domain'
        ? 'Tên miền này chưa được thêm vào Firebase Authentication → Settings → Authorized domains.'
        : e && e.code === 'auth/popup-blocked' ? 'Trình duyệt chặn cửa sổ đăng nhập. Hãy cho phép popup rồi thử lại.'
        : 'Chưa đăng nhập được (' + (e && e.code || 'lỗi') + ').';
    });
  });

  var resolveUser;
  var userReady = new Promise(function (r) { resolveUser = r; });
  auth.onAuthStateChanged(function (u) {
    if (u) {
      overlay.hidden = true;
      window.HUB_USER_EMAIL = u.email || '';
      var nav = document.querySelector('nav.side');
      var box = document.getElementById('hubUser');
      if (nav && !box) { box = document.createElement('div'); box.id = 'hubUser'; nav.appendChild(box); }
      if (box) {
        box.innerHTML = '';
        var t = document.createElement('span'); t.textContent = u.email || u.displayName || ''; box.appendChild(t);
        var b = document.createElement('button'); b.className = 'btn sm'; b.type = 'button'; b.textContent = 'Đăng xuất';
        b.onclick = function () { auth.signOut().then(function () { location.reload(); }); };
        box.appendChild(b);
      }
      resolveUser(u);
    } else {
      overlay.hidden = false;
    }
  });

  /* ---------- db: Firestore với cùng giao diện ---------- */
  function mapErr(e) {
    var c = e && e.code;
    var code = c === 'permission-denied' ? 'invalid_argument' : c === 'resource-exhausted' ? 'quota_exceeded'
      : c === 'unavailable' ? 'unavailable' : c === 'unauthenticated' ? 'revoked' : 'unavailable';
    return { code: code, message: (e && e.message) || String(e), firestoreCode: c };
  }
  function wrapDoc(ref) {
    return {
      id: ref.id, path: ref.path,
      get: function () { return ref.get().catch(function (e) { throw mapErr(e); }); },
      set: function (b) { return ref.set(b).catch(function (e) { throw mapErr(e); }); },
      update: function (b) { return ref.update(b).catch(function (e) { throw mapErr(e); }); },
      delete: function () { return ref.delete().catch(function (e) { throw mapErr(e); }); },
      onSnapshot: function (next, err) {
        return ref.onSnapshot(next, function (e) { window.HUB_LAST_ERROR = e; if (err) err(mapErr(e)); });
      },
      collection: function (p) { return wrapCol(ref.collection(p)); }
    };
  }
  function wrapCol(col) {
    return {
      path: col.path,
      doc: function (id) { return wrapDoc(id ? col.doc(id) : col.doc()); },
      add: function (b) { var r = col.doc(); return r.set(b).then(function () { return wrapDoc(r); }); },
      get: function () { return col.get(); },
      onSnapshot: function (next, err) {
        return col.onSnapshot(next, function (e) { window.HUB_LAST_ERROR = e; if (err) err(mapErr(e)); });
      }
    };
  }
  var db = {
    doc: function (p) { return wrapDoc(fs.doc(ROOT + '/' + p)); },
    collection: function (p) { return wrapCol(fs.collection(ROOT + '/' + p)); }
  };

  /* ---------- user ---------- */
  var user = {
    isOwner: function () { return Promise.resolve(false); },
    canEdit: function () { return Promise.resolve(true); },
    can: function () { return Promise.resolve(null); },
    id: function () { return Promise.resolve(auth.currentUser ? auth.currentUser.uid : null); },
    me: function () { var u = auth.currentUser; return Promise.resolve({ id: u ? u.uid : null, name: u ? (u.displayName || '') : '', email: u ? u.email : null }); }
  };

  /* ---------- downloads: tải file trực tiếp ---------- */
  var downloads = {
    save: function (req) {
      return new Promise(function (resolve) {
        var blob = req.data instanceof Blob ? req.data : new Blob([req.data], { type: /\.csv$/i.test(req.filename) ? 'text/csv;charset=utf-8' : /\.html?$/i.test(req.filename) ? 'text/html;charset=utf-8' : 'application/octet-stream' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = req.filename;
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        resolve({ status: 'saved' });
      });
    }
  };

  /* ---------- mcp: Google Sheets API (chỉ đọc) ---------- */
  function getSheetToken(silent) {
    if (sheetToken && Date.now() - sheetTokenAt < 50 * 60 * 1000) return Promise.resolve(sheetToken);
    if (silent) return Promise.reject({ code: 'needs_reauth', message: 'Cần đăng nhập lại để đọc Google Sheets' });
    var u = auth.currentUser;
    if (!u) return Promise.reject({ code: 'needs_reauth', message: 'Chưa đăng nhập' });
    return u.reauthenticateWithPopup(provider).then(function (res) {
      if (!res.credential || !res.credential.accessToken) throw { code: 'needs_reauth', message: 'Không nhận được quyền đọc Google Sheets' };
      sheetToken = res.credential.accessToken; sheetTokenAt = Date.now(); keepTok(); return sheetToken;
    }).catch(function (e) {
      if (e && e.code && String(e.code).indexOf('auth/') === 0) throw { code: e.code === 'auth/popup-blocked' ? 'approval_required' : 'needs_reauth', message: e.message };
      throw e;
    });
  }
  var mcp = {
    callTool: function (server, tool, input, opts) {
      if (server !== 'Google Sheets' || tool !== 'get_values') return Promise.reject({ code: 'not_in_manifest', message: 'Chỉ hỗ trợ đọc Google Sheets' });
      return getSheetToken(opts && opts.silent).then(function (tok) {
        var url = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(input.spreadsheetId) + '/values/' + encodeURIComponent(input.range);
        return fetch(url, { headers: { Authorization: 'Bearer ' + tok } }).then(function (r) {
          if (r.status === 401) { sheetToken = null; throw { code: 'needs_reauth', message: 'Phiên Google hết hạn' }; }
          if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { throw { code: 'tool_error', message: (j.error && j.error.message) || ('HTTP ' + r.status) }; });
          return r.json().then(function (j) { return { content: [], payload: j }; });
        });
      });
    },
    listTools: function () { return Promise.resolve({ servers: [{ server: 'Google Sheets', authStatus: 'connected', tools: [{ name: 'get_values', description: '' }] }] }); }
  };

  /* ---------- Nhập / sao lưu dữ liệu ---------- */
  window.hubImport = function (file) {
    var KNOWN = ['staff', 'tasks', 'logs', 'effort', 'okrs', 'config', 'catalog', 'assign', 'sys'];
    if (/\.zip$/i.test(file.name)) return Promise.reject(new Error('Bạn đang chọn file .zip (mã nguồn). Hãy chọn file dữ liệu HCNS-HUB_DU-LIEU-BAN-DAU_2026-10-20.json'));
    return file.text().then(function (txt) {
      txt = txt.replace(/^\uFEFF/, '').trim();
      var j;
      try { j = JSON.parse(txt); } catch (e) { throw new Error('File "' + file.name + '" không phải JSON hợp lệ (có thể tải về chưa xong hoặc đã bị mở bằng ứng dụng khác)'); }
      if (j && j.data && j.data.collections) j = j.data;
      var cols = j && j.collections ? j.collections : j;
      if (!cols || typeof cols !== 'object' || !Object.keys(cols).some(function (k) { return KNOWN.indexOf(k) >= 0; }))
        throw new Error('File "' + file.name + '" không chứa dữ liệu Bàn điều hành (cần có staff, logs, tasks…)');
      j = { collections: {} };
      Object.keys(cols).forEach(function (k) { if (KNOWN.indexOf(k) >= 0 && cols[k] && typeof cols[k] === 'object') j.collections[k] = cols[k]; });
      /* Firestore không lưu được mảng lồng mảng: chuyển danh sách DSNS U sang chuỗi JSON. */
      var sys = j.collections.sys;
      if (sys) Object.keys(sys).forEach(function (id) {
        var d = sys[id];
        if (d && Array.isArray(d.rows)) { var c = {}; Object.keys(d).forEach(function (k) { if (k !== 'rows') c[k] = d[k]; }); c.rowsJson = JSON.stringify(d.rows); sys[id] = c; }
      });
      var ops = [];
      Object.keys(j.collections).forEach(function (col) {
        var docs = j.collections[col];
        Object.keys(docs).forEach(function (id) { ops.push([col + '/' + id, docs[id]]); });
      });
      var chunks = [];
      for (var i = 0; i < ops.length; i += 400) chunks.push(ops.slice(i, i + 400));
      return chunks.reduce(function (p, ch) {
        return p.then(function () { var b = fs.batch(); ch.forEach(function (o) { b.set(fs.doc(ROOT + '/' + o[0]), o[1]); }); return b.commit(); });
      }, Promise.resolve()).then(function () { return ops.length; });
    });
  };
  var COLS = ['staff', 'tasks', 'logs', 'effort', 'okrs', 'config', 'catalog', 'assign', 'sys'];
  window.hubExport = function () {
    var out = {};
    return Promise.all(COLS.map(function (c) {
      return fs.collection(ROOT + '/' + c).get().then(function (s) { out[c] = {}; s.forEach(function (d) { out[c][d.id] = d.data(); }); });
    })).then(function () {
      return JSON.stringify({ format: 'hcns-hub-export', exportedAt: new Date().toISOString(), collections: out });
    });
  };

  /* ---------- window.claude.use ---------- */
  var caps = { db: db, user: user, downloads: downloads, mcp: mcp };
  window.claude = {
    use: function (name) {
      if (!(name in caps)) return Promise.resolve(null);
      return userReady.then(function () { return caps[name]; });
    }
  };
})();
