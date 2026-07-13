// Customer segmentation — vanilla JS. CSV via PapaParse, charts via Chart.js (CDN).

const PAPA_URL =
  "https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js";
const CHART_URL =
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js";

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = res;
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

const SEGMENT_META = {
  Premium: {
    color: "#6ce6a2",
    desc: "Bought recently, often, and spend the most. Reward them.",
  },
  Loyal: {
    color: "#6fd8e6",
    desc: "Consistently spend. Upsell higher value products.",
  },
  "Potential Loyalist": {
    color: "#7eb6ff",
    desc: "Recent customers with average frequency. Offer membership.",
  },
  "New Customers": {
    color: "#f0d569",
    desc: "Bought very recently but not often. Onboard them.",
  },
  Promising: {
    color: "#f0b06b",
    desc: "Recent shoppers with low spend. Build awareness.",
  },
  "Needs Attention": {
    color: "#ff9d6b",
    desc: "Above average recency & frequency. Limited offers.",
  },
  "At Risk": {
    color: "#ff6b7a",
    desc: "Spent big and often, but a long time ago. Win them back.",
  },
  Hibernating: {
    color: "#d77be8",
    desc: "Last purchase long ago, low spend. Recreate value.",
  },
  Lost: {
    color: "#7d809b",
    desc: "Lowest scores. Revive interest with reach-out campaigns.",
  },
};
const SEGMENT_ORDER = Object.keys(SEGMENT_META);

const HEADER_MAP = {
  id: ["id", "customer_id", "customerid", "user_id"],
  name: ["name", "customer", "customer_name", "full_name"],
  email: ["email", "mail"],
  spend: [
    "total_spend",
    "spend",
    "total",
    "amount",
    "revenue",
    "monetary",
    "ltv",
  ],
  orders: ["orders", "frequency", "order_count", "num_orders", "purchases"],
  date: ["last_order_date", "last_order", "last_purchase", "last_date", "date"],
};

function findKey(row, candidates) {
  const keys = Object.keys(row).map((k) => [
    k,
    k.toLowerCase().trim().replace(/\s+/g, "_"),
  ]);
  for (const c of candidates) {
    const hit = keys.find(([, n]) => n === c);
    if (hit) return hit[0];
  }
  for (const c of candidates) {
    const hit = keys.find(([, n]) => n.includes(c));
    if (hit) return hit[0];
  }
  return null;
}

function parseCustomers(rows) {
  if (!rows.length) return [];
  const sample = rows[0];
  const idK = findKey(sample, HEADER_MAP.id);
  const nameK = findKey(sample, HEADER_MAP.name);
  const emailK = findKey(sample, HEADER_MAP.email);
  const spendK = findKey(sample, HEADER_MAP.spend);
  const ordersK = findKey(sample, HEADER_MAP.orders);
  const dateK = findKey(sample, HEADER_MAP.date);
  if (!spendK || !dateK)
    throw new Error(
      "CSV must include a spend column and a last order date column.",
    );

  const now = Date.now();
  const out = [];
  rows.forEach((r, i) => {
    const spendRaw = r[spendK];
    const spend =
      typeof spendRaw === "number"
        ? spendRaw
        : parseFloat(String(spendRaw ?? "").replace(/[^0-9.\-]/g, ""));
    const date = new Date(r[dateK]);
    if (!isFinite(spend) || isNaN(date.getTime())) return;
    const orders = ordersK ? Math.max(1, parseInt(r[ordersK], 10) || 1) : 1;
    out.push({
      id: idK ? String(r[idK]) : `C-${i + 1}`,
      name: nameK ? String(r[nameK] ?? "") : "",
      email: emailK ? String(r[emailK] ?? "") : "",
      totalSpend: spend,
      orders,
      lastOrderDate: date,
      recencyDays: Math.max(0, Math.floor((now - date.getTime()) / 86400000)),
    });
  });
  return out;
}

function quintile(sorted, v, invert = false) {
  let lo = 0,
    hi = sorted.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    sorted[m] < v ? (lo = m + 1) : (hi = m);
  }
  const pct = sorted.length ? lo / sorted.length : 0;
  const score = Math.min(5, Math.max(1, Math.ceil(pct * 5) || 1));
  return invert ? 6 - score : score;
}

function classify(r, f, m) {
  const fm = (f + m) / 2;
  if (r >= 4 && fm >= 4) return "Premium";
  if (r >= 3 && fm >= 4) return "Loyal";
  if (r >= 4 && fm >= 3) return "Potential Loyalist";
  if (r >= 4 && fm <= 2) return "New Customers";
  if (r >= 3 && fm <= 2) return "Promising";
  if (r >= 2 && fm >= 3) return "Needs Attention";
  if (r <= 2 && fm >= 4) return "At Risk";
  if (r <= 2 && fm >= 2) return "Hibernating";
  return "Lost";
}

function scoreCustomers(customers) {
  if (!customers.length) return customers;
  const rs = [...customers.map((c) => c.recencyDays)].sort((a, b) => a - b);
  const fs = [...customers.map((c) => c.orders)].sort((a, b) => a - b);
  const ms = [...customers.map((c) => c.totalSpend)].sort((a, b) => a - b);
  return customers.map((c) => {
    const rScore = quintile(rs, c.recencyDays, true);
    const fScore = quintile(fs, c.orders);
    const mScore = quintile(ms, c.totalSpend);
    return {
      ...c,
      rScore,
      fScore,
      mScore,
      segment: classify(rScore, fScore, mScore),
    };
  });
}

function generateDemo(n = 240) {
  const first = [
    "Ava",
    "Liam",
    "Noah",
    "Mia",
    "Zoe",
    "Kai",
    "Ivy",
    "Owen",
    "Maya",
    "Leo",
    "Nora",
    "Eli",
    "Aria",
    "Ezra",
    "Luna",
    "Theo",
    "Sage",
    "Rio",
    "June",
    "Asa",
  ];
  const last = [
    "Chen",
    "Patel",
    "Garcia",
    "Kim",
    "Singh",
    "Rossi",
    "Diallo",
    "Nguyen",
    "Silva",
    "Khan",
    "Cohen",
    "Park",
    "Lopez",
    "Mueller",
    "Tanaka",
  ];
  const rows = [];
  for (let i = 0; i < n; i++) {
    const b = Math.random();
    let rec, orders, aov;
    if (b < 0.15) {
      rec = Math.floor(Math.random() * 30);
      orders = 8 + Math.floor(Math.random() * 25);
      aov = 90 + Math.random() * 220;
    } else if (b < 0.35) {
      rec = 20 + Math.floor(Math.random() * 80);
      orders = 4 + Math.floor(Math.random() * 10);
      aov = 50 + Math.random() * 120;
    } else if (b < 0.55) {
      rec = Math.floor(Math.random() * 60);
      orders = 1 + Math.floor(Math.random() * 3);
      aov = 20 + Math.random() * 80;
    } else if (b < 0.78) {
      rec = 120 + Math.floor(Math.random() * 200);
      orders = 5 + Math.floor(Math.random() * 18);
      aov = 80 + Math.random() * 200;
    } else {
      rec = 200 + Math.floor(Math.random() * 500);
      orders = 1 + Math.floor(Math.random() * 4);
      aov = 15 + Math.random() * 60;
    }
    const d = new Date(Date.now() - rec * 86400000);
    const fn = first[Math.floor(Math.random() * first.length)];
    const ln = last[Math.floor(Math.random() * last.length)];
    rows.push({
      customer_id: `C-${1000 + i}`,
      name: `${fn} ${ln}`,
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}@example.com`,
      orders,
      total_spend: Math.round(orders * aov * 100) / 100,
      last_order_date: d.toISOString().slice(0, 10),
    });
  }
  return rows;
}

const fmt = (n) =>
  n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

// ---------- App state ----------
const state = {
  scored: [],
  activeSegment: "All",
  query: "",
  barChart: null,
  scatterChart: null,
};

function setData(rows) {
  try {
    const parsed = parseCustomers(rows);
    state.scored = scoreCustomers(parsed);
    state.activeSegment = "All";
    state.query = "";
    document.getElementById("search").value = "";
    hideError();
    render();
  } catch (e) {
    showError(e.message);
  }
}

function showError(msg) {
  const el = document.getElementById("error");
  el.textContent = msg;
  el.hidden = false;
}
function hideError() {
  document.getElementById("error").hidden = true;
}

function render() {
  const s = state.scored;
  const totalRev = s.reduce((a, c) => a + c.totalSpend, 0);
  const totalOrders = s.reduce((a, c) => a + c.orders, 0);

  document.getElementById("kpi-customers").textContent =
    s.length.toLocaleString();
  document.getElementById("kpi-revenue").textContent = fmt(totalRev);
  document.getElementById("kpi-orders").textContent =
    totalOrders.toLocaleString();
  document.getElementById("kpi-aov").textContent = fmt(
    totalOrders ? totalRev / totalOrders : 0,
  );
  document.getElementById("allCount").textContent = s.length;

  // Segment summary
  const counts = {};
  SEGMENT_ORDER.forEach((seg) => (counts[seg] = { count: 0, revenue: 0 }));
  s.forEach((c) => {
    counts[c.segment].count++;
    counts[c.segment].revenue += c.totalSpend;
  });
  const segArr = SEGMENT_ORDER.map((seg) => ({ seg, ...counts[seg] })).filter(
    (x) => x.count > 0,
  );

  renderSegments(segArr, totalRev);
  renderBarChart(segArr);
  renderScatter(s);
  renderTable();
  document
    .getElementById("allBtn")
    .classList.toggle("active", state.activeSegment === "All");
}

function renderSegments(segArr, totalRev) {
  const wrap = document.getElementById("segments");
  wrap.innerHTML = "";
  segArr.forEach(({ seg, count, revenue }) => {
    const meta = SEGMENT_META[seg];
    const share = totalRev ? ((revenue / totalRev) * 100).toFixed(1) : "0.0";
    const active = state.activeSegment === seg;
    const btn = document.createElement("button");
    btn.className = "seg" + (active ? " active" : "");
    btn.innerHTML = `
      <div class="blob" style="background:${meta.color}"></div>
      <div class="seg-head">
        <span class="seg-name" style="color:${meta.color}">
          <span class="dot" style="background:${meta.color}"></span>${seg}
        </span>
        <span class="seg-share">${share}%</span>
      </div>
      <div class="seg-count">${count}<small>customers</small></div>
      <div class="seg-rev">${fmt(revenue)} in revenue</div>
      <p class="seg-desc">${meta.desc}</p>
    `;
    btn.onclick = () => {
      state.activeSegment = active ? "All" : seg;
      render();
    };
    wrap.appendChild(btn);
  });
}

function renderBarChart(segArr) {
  const ctx = document.getElementById("barChart");
  if (state.barChart) state.barChart.destroy();
  state.barChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: segArr.map((s) => s.seg),
      datasets: [
        {
          label: "Customers",
          data: segArr.map((s) => s.count),
          backgroundColor: segArr.map((s) => SEGMENT_META[s.seg].color),
          borderRadius: 8,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      onClick: (_, els) => {
        if (els.length) {
          state.activeSegment = segArr[els[0].index].seg;
          render();
        }
      },
      plugins: { legend: { display: false }, tooltip: tooltipStyle() },
      scales: {
        x: {
          ticks: {
            color: "#a4a8c8",
            font: { size: 10 },
            maxRotation: 35,
            minRotation: 25,
          },
          grid: { display: false },
        },
        y: {
          ticks: { color: "#a4a8c8" },
          grid: { color: "rgba(255,255,255,0.06)" },
        },
      },
    },
  });
}

function renderScatter(customers) {
  const ctx = document.getElementById("scatter");
  if (state.scatterChart) state.scatterChart.destroy();
  const grouped = {};
  customers.forEach((c) => {
    (grouped[c.segment] = grouped[c.segment] || []).push({
      x: c.recencyDays,
      y: c.totalSpend,
      r: 3 + Math.sqrt(c.orders) * 1.5,
    });
  });
  state.scatterChart = new Chart(ctx, {
    type: "bubble",
    data: {
      datasets: Object.keys(grouped).map((seg) => ({
        label: seg,
        data: grouped[seg],
        backgroundColor: SEGMENT_META[seg].color + "cc",
        borderColor: SEGMENT_META[seg].color,
        borderWidth: 1,
      })),
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipStyle(),
          callbacks: {
            label: (ctx) =>
              `${ctx.dataset.label}: ${fmt(ctx.raw.y)} · ${ctx.raw.x}d ago`,
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "Days since last order",
            color: "#a4a8c8",
          },
          ticks: { color: "#a4a8c8" },
          grid: { color: "rgba(255,255,255,0.06)" },
        },
        y: {
          title: { display: true, text: "Spend ($)", color: "#a4a8c8" },
          ticks: {
            color: "#a4a8c8",
            callback: (v) => "$" + (v / 1000).toFixed(0) + "k",
          },
          grid: { color: "rgba(255,255,255,0.06)" },
        },
      },
    },
  });
}

function tooltipStyle() {
  return {
    backgroundColor: "rgba(20,24,50,0.95)",
    borderColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    titleColor: "#fff",
    bodyColor: "#fff",
    padding: 10,
    cornerRadius: 10,
  };
}

function renderTable() {
  const { scored, activeSegment, query } = state;
  let list =
    activeSegment === "All"
      ? scored
      : scored.filter((c) => c.segment === activeSegment);
  if (query.trim()) {
    const q = query.toLowerCase();
    list = list.filter(
      (c) =>
        c.id.toLowerCase().includes(q) ||
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)),
    );
  }
  list = [...list].sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 200);

  document.getElementById("tableTitle").textContent =
    activeSegment === "All" ? "Top customers" : activeSegment;
  document.getElementById("tableSub").textContent =
    `Showing ${list.length} customer${list.length === 1 ? "" : "s"}${activeSegment !== "All" ? ` in ${activeSegment}` : ""}`;

  const tbody = document.getElementById("rows");
  tbody.innerHTML = "";
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">No customers match the current filters.</td></tr>`;
    return;
  }
  list.forEach((c) => {
    const meta = SEGMENT_META[c.segment];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="cust-name">${escapeHtml(c.name || c.id)}</div>
        <div class="cust-meta">${escapeHtml(c.email || c.id)}</div>
      </td>
      <td><span class="seg-tag" style="color:${meta.color}"><span class="dot" style="background:${meta.color}"></span>${c.segment}</span></td>
      <td class="num">${fmt(c.totalSpend)}</td>
      <td class="num">${c.orders}</td>
      <td class="num" style="color:#a4a8c8">${c.recencyDays}d</td>
      <td class="num" style="font-family:ui-monospace,monospace;color:#a4a8c8">${c.rScore}-${c.fScore}-${c.mScore}</td>
    `;
    tbody.appendChild(tr);
  });
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
}

function exportCsv() {
  const list =
    state.activeSegment === "All"
      ? state.scored
      : state.scored.filter((c) => c.segment === state.activeSegment);
  const csv = Papa.unparse(
    list.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      total_spend: c.totalSpend.toFixed(2),
      orders: c.orders,
      last_order_date: c.lastOrderDate.toISOString().slice(0, 10),
      recency_days: c.recencyDays,
      r_score: c.rScore,
      f_score: c.fScore,
      m_score: c.mScore,
      segment: c.segment,
    })),
  );
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `segment-${state.activeSegment.toLowerCase().replace(/\s+/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

const themeBtn = document.getElementById("themeToggle");

themeBtn.addEventListener("click", () => {
  document.body.classList.toggle("light-mode");

  const isLight = document.body.classList.contains("light-mode");

  themeBtn.innerHTML = isLight ? "☀️" : "🌙";

  localStorage.setItem("theme", isLight ? "light" : "dark");
});

window.addEventListener("load", () => {
  const savedTheme = localStorage.getItem("theme");

  if (savedTheme === "light") {
    document.body.classList.add("light-mode");
    themeBtn.innerHTML = "☀️";
  }
});

// ---------- Boot ----------
// ---------- Backend Loader ----------
async function loadBackendData() {

  try {

    const response = await fetch(
      "http://127.0.0.1:5000/segments"
    );

    if (!response.ok) {
      throw new Error("Failed to load segments");
    }

    const data = await response.json();

    const transformed = data.map(c => ({

      customer_id:
        c.CustomerID,

      name:
        `Customer ${c.CustomerID}`,

      email:
        `customer${c.CustomerID}@company.com`,

      orders:
        Math.max(
          1,
          Math.round(
            Math.exp(c.Frequency) - 1
          )
        ),

      total_spend:
        Math.max(
          0,
          Math.round(
            Math.exp(c.Monetary) - 1
          )
        ),

      last_order_date:
        new Date(
          Date.now() -
          c.Recency * 86400000
        )
        .toISOString()
        .slice(0, 10)

    }));

    setData(transformed);

    loadMetrics();

  } catch (err) {

    console.error(err);

    showError(
      "Backend not connected. Loading demo data."
    );

    setData(generateDemo());

  }
}

// ---------- Metrics ----------
async function loadMetrics() {

  try {

    const response = await fetch(
      "http://127.0.0.1:5000/metrics"
    );

    const metrics =
      await response.json();

    console.log(
      "Model Metrics",
      metrics
    );

  } catch (err) {

    console.error(
      "Metrics Error",
      err
    );

  }
}

// ---------- Boot ----------
async function init() {

  await Promise.all([
    loadScript(PAPA_URL),
    loadScript(CHART_URL)
  ]);

  document.getElementById(
    "uploadBtn"
  ).onclick = () =>
    document.getElementById(
      "file"
    ).click();

  document.getElementById(
    "file"
  ).onchange = (e) => {

    const f = e.target.files[0];

    if (!f) return;

    Papa.parse(f, {

      header: true,

      skipEmptyLines: true,

      dynamicTyping: true,

      transformHeader: (h) =>
        h.trim()
         .toLowerCase()
         .replace(/\s+/g, "_"),

      complete: (res) => {

        if (!res.data.length) {
          return showError(
            "No rows found in CSV."
          );
        }

        setData(res.data);

      },

      error: (err) =>
        showError(err.message)

    });

  };

  document.getElementById(
    "demoBtn"
  ).onclick = () =>
    setData(generateDemo());

  document.getElementById(
    "exportBtn"
  ).onclick = exportCsv;

  document.getElementById(
    "allBtn"
  ).onclick = () => {

    state.activeSegment = "All";

    render();

  };

  document.getElementById(
    "search"
  ).oninput = (e) => {

    state.query = e.target.value;

    renderTable();

  };

  // Load ML Results From Flask
  loadBackendData();
}

init();
