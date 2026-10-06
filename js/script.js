/* =========================================================
   Java–MySQL Database App — demo site
   ---------------------------------------------------------
   1) Put your links below.
   2) Everything else works as-is. Open index.html to run.
   ========================================================= */
(() => {
  "use strict";

  /* ---------- EDIT THESE ---------- */
  const CONFIG = {
    repoUrl: "",   // e.g. "https://github.com/your-name/java-mysql-app"
    demoUrl: ""    // e.g. "https://your-name.github.io/java-mysql-app/" (leave empty to jump to the demo on this page)
  };
  /* -------------------------------- */

  const STORAGE_KEY = "javaMysqlDemo.v1";
  const DEPARTMENTS = ["Engineering", "Finance", "HR", "Marketing", "Sales"];
  const SEED = [
    { id: 1, name: "Priya Raman",     email: "priya.raman@example.com",  department: "Engineering", salary: 82000 },
    { id: 2, name: "Arjun Mehta",     email: "arjun.mehta@example.com",  department: "Finance",     salary: 64000 },
    { id: 3, name: "Kavya Nair",      email: "kavya.nair@example.com",   department: "Marketing",   salary: 58000 },
    { id: 4, name: "Rahul Das",       email: "rahul.das@example.com",    department: "Sales",       salary: 52000 },
    { id: 5, name: "Meena Subramani", email: "meena.s@example.com",      department: "HR",          salary: 61000 },
    { id: 6, name: "Dev Patel",       email: "dev.patel@example.com",    department: "Engineering", salary: 91000 }
  ];

  /* ---------- Helpers ---------- */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => new Intl.NumberFormat("en-IN").format(Math.round(n));
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- State ---------- */
  let db = loadDb();
  const state = { search: "", dept: "", sortKey: "id", sortDir: "asc", editingId: null, history: [], lastSql: "" };

  function loadDb() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (raw && Array.isArray(raw.rows) && Number.isInteger(raw.nextId)) return raw;
    } catch (e) { /* storage blocked or corrupted: fall back to seed data */ }
    return freshDb();
  }
  function freshDb() {
    return { rows: SEED.map((r) => ({ ...r })), nextId: SEED.length + 1 };
  }
  function saveDb() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch (e) { /* ignore */ }
  }

  /* ---------- SQL building & console ---------- */
  const sqlVal = (v) => (typeof v === "number" ? String(v) : "'" + String(v).replace(/'/g, "''") + "'");

  function selectSql() {
    const where = [];
    if (state.search) {
      const q = state.search.replace(/'/g, "''");
      where.push(`(name LIKE '%${q}%' OR email LIKE '%${q}%')`);
    }
    if (state.dept) where.push(`department = ${sqlVal(state.dept)}`);
    let sql = "SELECT id, name, email, department, salary\nFROM employees";
    if (where.length) sql += "\nWHERE " + where.join("\n  AND ");
    sql += `\nORDER BY ${state.sortKey} ${state.sortDir.toUpperCase()};`;
    return sql;
  }

  const SQL_KEYWORDS = /\b(SELECT|FROM|WHERE|AND|OR|LIKE|ORDER BY|ASC|DESC|INSERT INTO|VALUES|UPDATE|SET|DELETE FROM|ERROR)\b/gi;
  function highlight(sql) {
    const token = new RegExp("('(?:[^']|'')*')|" + SQL_KEYWORDS.source + "|\\b(\\d+(?:\\.\\d+)?)\\b", "gi");
    let out = "", last = 0, m;
    while ((m = token.exec(sql))) {
      out += esc(sql.slice(last, m.index));
      if (m[1])      out += `<span class="tok-s">${esc(m[1])}</span>`;
      else if (m[2]) out += `<span class="tok-k">${esc(m[2])}</span>`;
      else           out += `<span class="tok-n">${esc(m[3])}</span>`;
      last = token.lastIndex;
    }
    return out + esc(sql.slice(last));
  }

  function showSql(sql, status, { isError = false, pushHistory = false } = {}) {
    state.lastSql = sql;
    $("#sqlNow").innerHTML = highlight(sql);
    const st = $("#sqlStatus");
    st.textContent = status || "";
    st.classList.toggle("is-error", isError);
    if (pushHistory) {
      const flat = sql.replace(/\s+/g, " ");
      if (state.history[0] !== flat) state.history.unshift(flat);
      state.history = state.history.slice(0, 5);
      $("#history").innerHTML = state.history.map((h) => `<li title="${esc(h)}">${esc(h)}</li>`).join("");
    }
  }

  /* ---------- Reading (SELECT) ---------- */
  function visibleRows() {
    const q = state.search.toLowerCase();
    const rows = db.rows.filter((r) =>
      (!q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)) &&
      (!state.dept || r.department === state.dept)
    );
    const dir = state.sortDir === "asc" ? 1 : -1;
    const key = state.sortKey;
    rows.sort((a, b) => {
      const x = a[key], y = b[key];
      const cmp = typeof x === "number" ? x - y : String(x).localeCompare(String(y));
      return cmp * dir || a.id - b.id;
    });
    return rows;
  }

  function renderTable({ log = false } = {}) {
    const rows = visibleRows();
    const body = $("#rows");

    if (!rows.length) {
      body.innerHTML = `<tr><td class="empty" colspan="5">No records match. Clear the search or add an employee.</td></tr>`;
    } else {
      body.innerHTML = rows.map((r) => `
        <tr class="${r.id === state.editingId ? "is-editing" : ""}">
          <td>${r.id}</td>
          <td class="cell-name"><strong>${esc(r.name)}</strong><span>${esc(r.email)}</span></td>
          <td><span class="dept">${esc(r.department)}</span></td>
          <td class="num">${money(r.salary)}</td>
          <td>
            <div class="row-actions">
              <button class="mini" type="button" data-action="edit" data-id="${r.id}" aria-label="Edit ${esc(r.name)}">Edit</button>
              <button class="mini danger" type="button" data-action="delete" data-id="${r.id}" aria-label="Delete ${esc(r.name)}">Delete</button>
            </div>
          </td>
        </tr>`).join("");
    }

    const avg = rows.length ? rows.reduce((s, r) => s + r.salary, 0) / rows.length : 0;
    $("#summary").textContent = rows.length
      ? `${rows.length} ${rows.length === 1 ? "row" : "rows"} · average salary ₹${money(avg)}`
      : "0 rows";

    // sort indicators
    $$("thead th").forEach((th) => {
      const btn = $(".sort", th);
      if (!btn) return;
      th.setAttribute("aria-sort", btn.dataset.key === state.sortKey ? (state.sortDir === "asc" ? "ascending" : "descending") : "none");
    });

    showSql(selectSql(), `${rows.length} ${rows.length === 1 ? "row" : "rows"} in set (0.00 sec)`, { pushHistory: log });
  }

  /* ---------- Form helpers ---------- */
  const form = $("#recordForm");
  const fields = { name: $("#name"), email: $("#email"), department: $("#department"), salary: $("#salary") };

  function fillSelect(el, withAll) {
    el.innerHTML = (withAll ? `<option value="">All departments</option>` : "") +
      DEPARTMENTS.map((d) => `<option value="${esc(d)}">${esc(d)}</option>`).join("");
  }

  function setError(name, msg) {
    const el = $(`#${name}Error`);
    if (el) el.textContent = msg || "";
    fields[name].setAttribute("aria-invalid", msg ? "true" : "false");
  }
  function clearErrors() { ["name", "email", "salary"].forEach((n) => setError(n, "")); }

  function validate(values) {
    clearErrors();
    let firstBad = null;
    const fail = (field, msg) => { setError(field, msg); firstBad = firstBad || fields[field]; };

    if (values.name.length < 2) fail("name", "Enter the employee's full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) fail("email", "Enter a valid email, like name@company.com.");
    if (!Number.isFinite(values.salary) || values.salary < 0) fail("salary", "Enter a salary of 0 or more.");

    if (firstBad) { firstBad.focus(); return false; }
    return true;
  }

  function readForm() {
    return {
      name: fields.name.value.trim().replace(/\s+/g, " "),
      email: fields.email.value.trim().toLowerCase(),
      department: fields.department.value,
      salary: Number(fields.salary.value)
    };
  }

  function enterEditMode(id) {
    const rec = db.rows.find((r) => r.id === id);
    if (!rec) return;
    state.editingId = id;
    fields.name.value = rec.name;
    fields.email.value = rec.email;
    fields.department.value = rec.department;
    fields.salary.value = rec.salary;
    $("#formTitle").textContent = `Edit employee #${id}`;
    $("#submitBtn").textContent = "Save changes";
    $("#cancelBtn").hidden = false;
    form.classList.add("is-editing");
    clearErrors();
    renderTable();
    if (window.matchMedia("(max-width: 960px)").matches) form.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
    fields.name.focus();
  }

  function leaveEditMode() {
    state.editingId = null;
    form.reset();
    fields.department.value = DEPARTMENTS[0];
    $("#formTitle").textContent = "Add an employee";
    $("#submitBtn").textContent = "Add employee";
    $("#cancelBtn").hidden = true;
    form.classList.remove("is-editing");
    clearErrors();
  }

  /* ---------- Create & Update ---------- */
  function emailTaken(email, exceptId) {
    return db.rows.some((r) => r.email === email && r.id !== exceptId);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = readForm();
    if (!validate(v)) return;

    if (emailTaken(v.email, state.editingId)) {
      setError("email", "That email is already in use. Each employee needs a unique email.");
      fields.email.focus();
      const sql = state.editingId
        ? `UPDATE employees SET email = ${sqlVal(v.email)} WHERE id = ${state.editingId};`
        : `INSERT INTO employees (name, email, department, salary)\nVALUES (${sqlVal(v.name)}, ${sqlVal(v.email)}, ${sqlVal(v.department)}, ${v.salary});`;
      showSql(sql, `ERROR 1062 (23000): Duplicate entry '${v.email}' for key 'employees.email'`, { isError: true, pushHistory: true });
      return;
    }

    if (state.editingId) {
      const rec = db.rows.find((r) => r.id === state.editingId);
      Object.assign(rec, v);
      saveDb();
      const sql = `UPDATE employees\nSET name = ${sqlVal(v.name)}, email = ${sqlVal(v.email)},\n    department = ${sqlVal(v.department)}, salary = ${v.salary}\nWHERE id = ${rec.id};`;
      leaveEditMode();
      renderTable();
      showSql(sql, "Query OK, 1 row affected (0.01 sec)", { pushHistory: true });
      toast("Changes saved");
    } else {
      const rec = { id: db.nextId++, ...v };
      db.rows.push(rec);
      saveDb();
      const sql = `INSERT INTO employees (name, email, department, salary)\nVALUES (${sqlVal(v.name)}, ${sqlVal(v.email)}, ${sqlVal(v.department)}, ${v.salary});`;
      leaveEditMode();
      renderTable();
      showSql(sql, `Query OK, 1 row affected (0.01 sec) — new id ${rec.id}`, { pushHistory: true });
      toast("Employee added");
    }
  });

  $("#cancelBtn").addEventListener("click", () => { leaveEditMode(); renderTable(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.editingId && !$("#confirmDialog").open) { leaveEditMode(); renderTable(); }
  });

  /* ---------- Delete ---------- */
  const dialog = $("#confirmDialog");
  let pendingDeleteId = null;

  function askDelete(id) {
    const rec = db.rows.find((r) => r.id === id);
    if (!rec) return;
    pendingDeleteId = id;
    $("#confirmText").textContent = `${rec.name} (${rec.email}) will be removed from the table.`;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else if (window.confirm(`Delete ${rec.name}?`)) doDelete(id);
  }

  function doDelete(id) {
    const rec = db.rows.find((r) => r.id === id);
    if (!rec) return;
    db.rows = db.rows.filter((r) => r.id !== id);
    saveDb();
    if (state.editingId === id) leaveEditMode();
    renderTable();
    showSql(`DELETE FROM employees\nWHERE id = ${id};`, "Query OK, 1 row affected (0.01 sec)", { pushHistory: true });
    toast("Employee deleted");
  }

  dialog.addEventListener("close", () => {
    if (dialog.returnValue === "yes" && pendingDeleteId !== null) doDelete(pendingDeleteId);
    pendingDeleteId = null;
    dialog.returnValue = "";
  });

  /* ---------- Table events ---------- */
  $("#rows").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (btn.dataset.action === "edit") enterEditMode(id);
    if (btn.dataset.action === "delete") askDelete(id);
  });

  $$(".sort").forEach((btn) => btn.addEventListener("click", () => {
    const key = btn.dataset.key;
    if (state.sortKey === key) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
    else { state.sortKey = key; state.sortDir = "asc"; }
    renderTable({ log: true });
  }));

  let searchTimer;
  $("#search").addEventListener("input", (e) => {
    state.search = e.target.value.trim();
    renderTable();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { if (state.search) renderTable({ log: true }); }, 500);
  });

  $("#deptFilter").addEventListener("change", (e) => {
    state.dept = e.target.value;
    renderTable({ log: true });
  });

  $("#resetBtn").addEventListener("click", () => {
    db = freshDb();
    saveDb();
    state.search = ""; state.dept = ""; state.sortKey = "id"; state.sortDir = "asc";
    $("#search").value = ""; $("#deptFilter").value = "";
    leaveEditMode();
    renderTable({ log: true });
    toast("Demo data reset");
  });

  $("#copyBtn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(state.lastSql);
      toast("SQL copied");
    } catch (e) {
      toast("Copy is not available here. Select the text and copy it.");
    }
  });

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
  }

  /* ---------- Java code tabs ---------- */
  const JAVA = {
    create:
`public void insert(Employee e) throws SQLException {
    String sql = "INSERT INTO employees (name, email, department, salary) "
               + "VALUES (?, ?, ?, ?)";

    try (Connection con = Database.connect();
         PreparedStatement ps = con.prepareStatement(sql)) {

        ps.setString(1, e.getName());
        ps.setString(2, e.getEmail());
        ps.setString(3, e.getDepartment());
        ps.setDouble(4, e.getSalary());
        ps.executeUpdate();
    }
}`,
    read:
`public List<Employee> search(String keyword) throws SQLException {
    String sql = "SELECT id, name, email, department, salary "
               + "FROM employees "
               + "WHERE name LIKE ? OR email LIKE ? "
               + "ORDER BY name ASC";

    List<Employee> result = new ArrayList<>();
    try (Connection con = Database.connect();
         PreparedStatement ps = con.prepareStatement(sql)) {

        ps.setString(1, "%" + keyword + "%");
        ps.setString(2, "%" + keyword + "%");

        try (ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                result.add(new Employee(
                    rs.getInt("id"),
                    rs.getString("name"),
                    rs.getString("email"),
                    rs.getString("department"),
                    rs.getDouble("salary")));
            }
        }
    }
    return result;
}`,
    update:
`public boolean update(Employee e) throws SQLException {
    String sql = "UPDATE employees "
               + "SET name = ?, email = ?, department = ?, salary = ? "
               + "WHERE id = ?";

    try (Connection con = Database.connect();
         PreparedStatement ps = con.prepareStatement(sql)) {

        ps.setString(1, e.getName());
        ps.setString(2, e.getEmail());
        ps.setString(3, e.getDepartment());
        ps.setDouble(4, e.getSalary());
        ps.setInt(5, e.getId());

        return ps.executeUpdate() == 1;
    }
}`,
    delete:
`public boolean delete(int id) throws SQLException {
    String sql = "DELETE FROM employees WHERE id = ?";

    try (Connection con = Database.connect();
         PreparedStatement ps = con.prepareStatement(sql)) {

        ps.setInt(1, id);
        return ps.executeUpdate() == 1;
    }
}`
  };

  const tabs = $$('[role="tab"]');
  function selectTab(tab, focus) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
    });
    $("#javaCode").textContent = JAVA[tab.dataset.op];
    $("#codePanel").setAttribute("aria-labelledby", tab.id);
    if (focus) tab.focus();
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", (e) => {
      let next = null;
      if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
      if (e.key === "ArrowLeft")  next = tabs[(i - 1 + tabs.length) % tabs.length];
      if (e.key === "Home") next = tabs[0];
      if (e.key === "End")  next = tabs[tabs.length - 1];
      if (next) { e.preventDefault(); selectTab(next, true); }
    });
  });

  /* ---------- Links ---------- */
  function setupLinks() {
    const code = $("#codeLink");
    const demo = $("#demoLink");
    if (CONFIG.repoUrl) {
      code.href = CONFIG.repoUrl;
    } else {
      code.addEventListener("click", (e) => {
        e.preventDefault();
        toast("Add your GitHub URL in js/script.js (CONFIG.repoUrl)");
      });
    }
    if (CONFIG.demoUrl) {
      demo.href = CONFIG.demoUrl;
      demo.target = "_blank";
      demo.rel = "noopener";
    }
  }

  /* ---------- Opening moment: the first query types itself ---------- */
  function typeFirstQuery() {
    const sql = selectSql();
    if (prefersReduced) return;
    const out = $("#sqlNow");
    let i = 0;
    out.textContent = "";
    const timer = setInterval(() => {
      i += 3;
      out.textContent = sql.slice(0, i);
      if (i >= sql.length) { clearInterval(timer); out.innerHTML = highlight(sql); }
    }, 22);
  }

  /* ---------- Init ---------- */
  function init() {
    fillSelect($("#deptFilter"), true);
    fillSelect(fields.department, false);
    setupLinks();
    selectTab(tabs[0]);
    renderTable({ log: true });
    typeFirstQuery();
  }
  init();
})();
