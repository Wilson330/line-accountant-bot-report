const liffId = "2008934186-4iqcSgi7"; // 在 LINE Developers 拿到後貼進來
const apiUrl = "https://untestifying-flora-coquettishly.ngrok-free.dev/webhook/reports";

let chartInstance = null;

const START_YEAR = 1911;
const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH = now.getMonth() + 1; // 1-12

let selectedYear = CURRENT_YEAR;
let selectedMonth = CURRENT_MONTH; // 1-12

// ---- 月份選擇器 UI ----
function initMonthPicker() {
  const yearLabel = document.getElementById("yearLabel");
  const monthGrid = document.getElementById("monthGrid");
  const monthDisplayText = document.getElementById("monthDisplayText");
  const monthPanel = document.getElementById("monthPanel");
  const monthToggleBtn = document.getElementById("monthToggleBtn");
  const yearPrevBtn = document.getElementById("yearPrevBtn");
  const yearNextBtn = document.getElementById("yearNextBtn");

  // 產生 12 個月份按鈕
  monthGrid.innerHTML = "";
  for (let m = 1; m <= 12; m++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "month-btn";
    btn.dataset.month = m;
    btn.textContent = m + "月";
    monthGrid.appendChild(btn);
  }

  function updateYearLabel() {
    yearLabel.textContent = selectedYear;
  }

  function updateMonthHighlight() {
    const buttons = monthGrid.querySelectorAll(".month-btn");
    buttons.forEach((btn) => {
      const m = Number(btn.dataset.month);
      btn.classList.toggle(
        "active",
        m === selectedMonth && selectedYear === getSelectedYear(),
      );
    });
  }

  function getSelectedYear() {
    return selectedYear;
  }

  function updateDisplayText() {
    monthDisplayText.textContent =
      selectedYear + " 年 " + selectedMonth + " 月";
  }

  // 點按展開/收起
  monthToggleBtn.addEventListener("click", () => {
    monthPanel.classList.toggle("open");
  });

  // 年份導航
  yearPrevBtn.addEventListener("click", () => {
    if (selectedYear > START_YEAR) {
      selectedYear--;
      updateYearLabel();
      updateMonthHighlight();
    }
  });

  yearNextBtn.addEventListener("click", () => {
    if (selectedYear < CURRENT_YEAR) {
      selectedYear++;
      updateYearLabel();
      updateMonthHighlight();
    }
  });

  // 點選月份
  monthGrid.addEventListener("click", (e) => {
    const btn = e.target.closest(".month-btn");
    if (!btn) return;
    const m = Number(btn.dataset.month);

    // 若是未來年月就不給選
    if (
      selectedYear > CURRENT_YEAR ||
      (selectedYear === CURRENT_YEAR && m > CURRENT_MONTH)
    ) {
      return;
    }

    selectedMonth = m;
    updateMonthHighlight();
    updateDisplayText();
    monthPanel.classList.remove("open");
    updateLedgerOptions();
  });

  // 初始化
  updateYearLabel();
  updateDisplayText();
  updateMonthHighlight();

  // 若點擊外面關閉面板
  document.addEventListener("click", (e) => {
    const picker = document.querySelector(".month-picker");
    if (!picker.contains(e.target)) {
      monthPanel.classList.remove("open");
    }
  });
}

function getSelectedMonthValue() {
  // 回傳 YYYY-MM 字串
  const ym = selectedYear + "-" + String(selectedMonth).padStart(2, "0");
  return ym;
}

// ---- 資料載入與主流程 ----
async function main() {
  try {
    // 初始化 LIFF
    await liff.init({ liffId });

    // 確保登入
    if (!liff.isLoggedIn()) {
      liff.login();
      return;
    }

    // 取得使用者資訊（之後也可以把 userId 傳給 n8n 用來做個人化查詢）
    const profile = await liff.getProfile();

    // 呼叫 n8n 的報表 API

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // 可以先傳一些基本資訊過去，之後要區分 user 時會用到
        userId: profile.userId,
        source: "liff-demo",
      }),
    });

    if (!res.ok) {
      console.log(`n8n API error: ${res.status} ${res.statusText}`);
      return;
    }

    data = await res.json();
    records = data.records; // 假設 API 回傳的 JSON 裡有個 records 陣列
    console.log("Fetched data:", records);
    initMonthPicker();
    initUI();
  } catch (err) {
    console.error(err);
  }
}

// async function loadData() {
//   const res = await fetch(DATA_URL);
//   records = await res.json();
//   initMonthPicker();
//   initUI();
// }

function initUI() {
  // 不再使用原本的 select#monthSelect，只用自訂月份選擇器
  updateLedgerOptions();
}

// 根據選到的年月，算出有哪些帳本
function updateLedgerOptions() {
  const ym = getSelectedMonthValue();
  const ledgerSelect = document.getElementById("ledgerSelect");

  const monthRecords = records.filter((r) => r.date.startsWith(ym));
  const ledgers = Array.from(new Set(monthRecords.map((r) => r.ledger)));

  ledgerSelect.innerHTML = "";

  if (ledgers.length === 0) {
    document.getElementById("monthBalance").textContent = 0;
    document.getElementById("monthOut").textContent = 0;
    document.getElementById("monthIn").textContent = 0;
    document.getElementById("summaryHint").textContent = `${ym} 無紀錄`;
    document.getElementById("detailList").innerHTML = "";
    if (chartInstance) chartInstance.destroy();
    document.getElementById("chartTitle").textContent = "帳本支出分析";
    return;
  }

  ledgers.forEach((l) => {
    const opt = document.createElement("option");
    opt.value = l;
    opt.textContent = l;
    ledgerSelect.appendChild(opt);
  });

  ledgerSelect.removeEventListener("change", updateView);
  ledgerSelect.addEventListener("change", updateView);
  ledgerSelect.value = ledgers[0];
  updateView();
}

function updateView() {
  const ym = getSelectedMonthValue();
  const ledger = document.getElementById("ledgerSelect").value;

  const data = records.filter(
    (r) => r.date.startsWith(ym) && r.ledger === ledger,
  );

  updateSummary(data, ym, ledger);
  updateChart(data, ledger);
  updateDetails(data);
}

function updateSummary(data, ym, ledger) {
  let income = 0;
  let expense = 0;

  data.forEach((r) => {
    const amt = Number(r.amount);  // 這裡假設 amount 全部都是正數

    if (r.type === "收入") {
      income += amt;
    } else if (r.type === "支出") {
      expense += amt;
    }
  });

  document.getElementById("monthIn").textContent = income;
  document.getElementById("monthOut").textContent = expense;
  document.getElementById("monthBalance").textContent = income - expense;
  document.getElementById("summaryHint").textContent = `${ym}・${ledger} 帳本`;
}

// function updateSummary(data, ym, ledger) {
//   let income = 0,
//     expense = 0;
//   data.forEach((r) => {
//     const amt = Number(r.amount);
//     if (amt > 0) income += amt;
//     else expense += Math.abs(amt);
//   });

//   document.getElementById("monthIn").textContent = income;
//   document.getElementById("monthOut").textContent = expense;
//   document.getElementById("monthBalance").textContent = income - expense;
//   document.getElementById("summaryHint").textContent = `${ym}・${ledger} 帳本`;
// }

function updateChart(data, ledger) {
  const categoryTotals = {};

  data.forEach((r) => {
    const amt = Number(r.amount);
    // 只統計「支出」類型，排除 CATEGORY_LIST / 空 type 等雜訊
    if (r.type === "支出") {
      const key = r.category || "未分類";
      categoryTotals[key] = (categoryTotals[key] || 0) + amt;
    }
  });

  const labels = Object.keys(categoryTotals);
  const values = Object.values(categoryTotals);

  const ctx = document.getElementById("doughnutChart").getContext("2d");
  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: [
            "#22c55e",
            "#0ea5e9",
            "#f97316",
            "#e11d48",
            "#8b5cf6",
            "#14b8a6",
          ],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#334155",
            boxWidth: 10,
            font: { size: 11 },
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${ctx.parsed} 元`,
          },
        },
      },
    },
  });

  document.getElementById("chartTitle").textContent = `${ledger} 帳本支出分析`;
}

// function updateChart(data, ledger) {
//   const categoryTotals = {};
//   data.forEach((r) => {
//     const amt = Number(r.amount);
//     if (amt < 0) {
//       const key = r.category || "未分類";
//       categoryTotals[key] = (categoryTotals[key] || 0) + Math.abs(amt);
//     }
//   });

//   const labels = Object.keys(categoryTotals);
//   const values = Object.values(categoryTotals);

//   const ctx = document.getElementById("doughnutChart").getContext("2d");
//   if (chartInstance) chartInstance.destroy();

//   chartInstance = new Chart(ctx, {
//     type: "doughnut",
//     data: {
//       labels,
//       datasets: [
//         {
//           data: values,
//           backgroundColor: [
//             "#22c55e",
//             "#0ea5e9",
//             "#f97316",
//             "#e11d48",
//             "#8b5cf6",
//             "#14b8a6",
//           ],
//           borderWidth: 0,
//         },
//       ],
//     },
//     options: {
//       responsive: true,
//       maintainAspectRatio: false,
//       cutout: "70%",
//       plugins: {
//         legend: {
//           position: "bottom",
//           labels: {
//             color: "#334155",
//             boxWidth: 10,
//             font: { size: 11 },
//           },
//         },
//         tooltip: {
//           callbacks: {
//             label: (ctx) => `${ctx.label}: ${ctx.parsed} 元`,
//           },
//         },
//       },
//     },
//   });

//   document.getElementById("chartTitle").textContent = `${ledger} 帳本支出分析`;
// }

function updateDetails(data) {
  const list = document.getElementById("detailList");
  list.innerHTML = "";

  const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date));

  sorted.forEach((r) => {
    const wrap = document.createElement("div");
    wrap.className = "detail-item";

    const main = document.createElement("div");
    main.className = "detail-main";

    const date = document.createElement("div");
    date.className = "detail-date";
    date.textContent = r.date;

    const tag = document.createElement("div");
    tag.className = "detail-tag";
    tag.textContent = r.category || "未分類";

    const note = document.createElement("div");
    note.className = "detail-note";
    note.textContent = r.note || "";

    main.appendChild(date);
    main.appendChild(tag);
    if (note.textContent) main.appendChild(note);

    const amt = document.createElement("div");
    amt.className = "detail-amount";

    const value = Number(r.amount);

    if (r.type === "收入") {
      amt.textContent = `+${value}`;
      amt.style.color = "#16a34a"; // 收入：綠色
    } else if (r.type === "支出") {
      amt.textContent = `-${value}`;
      // 支出：沿用原本 CSS 的紅色 .detail-amount
    } else {
      // 例如 CATEGORY_LIST 或其他輔助資料，不加正負號
      amt.textContent = value;
    }

    wrap.appendChild(main);
    wrap.appendChild(amt);
    list.appendChild(wrap);
  });
}

// function updateDetails(data) {
//   const list = document.getElementById("detailList");
//   list.innerHTML = "";

//   const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date));

//   sorted.forEach((r) => {
//     const wrap = document.createElement("div");
//     wrap.className = "detail-item";

//     const main = document.createElement("div");
//     main.className = "detail-main";

//     const date = document.createElement("div");
//     date.className = "detail-date";
//     date.textContent = r.date;

//     const tag = document.createElement("div");
//     tag.className = "detail-tag";
//     tag.textContent = r.category || "未分類";

//     const note = document.createElement("div");
//     note.className = "detail-note";
//     note.textContent = r.note || "";

//     main.appendChild(date);
//     main.appendChild(tag);
//     if (note.textContent) main.appendChild(note);

//     const amt = document.createElement("div");
//     amt.className = "detail-amount";
//     amt.textContent = Number(r.amount) > 0 ? `+${r.amount}` : r.amount;

//     wrap.appendChild(main);
//     wrap.appendChild(amt);
//     list.appendChild(wrap);
//   });
// }

main();
// loadData();
