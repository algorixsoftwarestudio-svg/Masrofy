import { Transaction } from "./models/transaction.js";
import { save, load } from "./utils/storage.js";
import { expensesManager } from "./models/ExpensesManager.js";
import { createSettings } from "./utils/settingsproxy.js";

/* ==========================================================================
   1. Constants
   ========================================================================== */
const STORAGE_KEYS = {
  transactions: "transactions",
  budget: "budget",
};

// Emoji icon per transaction kind (no external image files).
const KIND_ICONS = new Map([
  ["ايجار", "🏠"],
  ["مواصلات", "🚌"],
  ["اكل", "🍽️"],
  ["مصروفات دراسيه", "📚"],
  ["اخرى", "🧾"],
]);
const DEFAULT_ICON = "🧾";

/* ==========================================================================
   2. Small helpers
   ========================================================================== */
const byId = (id) => document.getElementById(id);

// Latin digits with plain thousands separators, so amounts read the same
// everywhere regardless of the runtime's ICU data.
const numberFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const dateFormat = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const money = (value) => `${numberFormat.format(Number(value) || 0)} ج.م`;

// Users can type either "دراسية" or "دراسيه", so icons are matched loosely.
const normalizeKind = (kind) =>
  String(kind ?? "")
    .replace(/[\u064B-\u0652\u0640]/g, "") // diacritics + tatweel
    .replace(/ة/g, "ه")
    .replace(/[أإآ]/g, "ا")
    .trim();

const kindIcon = (kind) => KIND_ICONS.get(normalizeKind(kind)) ?? DEFAULT_ICON;

const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );

/** Formats a Date as yyyy-mm-dd using local date parts (no UTC shift). */
const toInputDate = (date) => {
  const d =
    date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
};

/** Parses yyyy-mm-dd as a local date (new Date(str) would be UTC). */
const parseInputDate = (value) => {
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return new Date(NaN);
  return new Date(year, month - 1, day);
};

const timeOf = (transaction) => {
  const day = transaction.day;
  const time = day instanceof Date ? day.getTime() : new Date(day).getTime();
  return Number.isNaN(time) ? 0 : time;
};

/* ==========================================================================
   3. DOM references
   ========================================================================== */
const form = byId("transactionForm");
const nameInput = byId("name");
const valueInput = byId("val");
const salaryInput = byId("sal");
const dateInput = byId("date");
const noteInput = byId("note");
const clearBtn = byId("btn2");

const balanceEl = byId("balance");
const totalIncomeEl = byId("totalIncome");
const totalExpensesEl = byId("totalExpenses");
const perKindEl = byId("perKind");

const budgetInput = byId("budget");
const saveBudgetBtn = byId("saveBudget");
const budgetWarning = byId("budgetWarning");
const budgetProgress = byId("budgetProgress");
const budgetBar = byId("budgetBar");
const budgetText = byId("budgetText");

const allTransactionsBtn = byId("allTransactions");
const monthBtn = byId("TransactionsofMonth");
const searchBtn = byId("search");
const filterInput = byId("filter");
const sortSelect = byId("sort");
const list = byId("list");
const listMeta = byId("listMeta");

/* ==========================================================================
   4. State
   ========================================================================== */
const manager = new expensesManager([]);

// Budget lives behind the Proxy so every write is validated.
const settings = createSettings({
  value: Number(load(STORAGE_KEYS.budget, 0)) || 0,
});

const state = {
  view: "all", // "all" | "month"
  query: "",
  sort: "newest",
};

/* ==========================================================================
   5. Loading
   ========================================================================== */
const saved = load(STORAGE_KEYS.transactions);

if (Array.isArray(saved)) {
  saved.forEach((element) => {
    if (!element || typeof element !== "object") return;
    // Required by the project spec: rebuild each row through the constructor.
    manager.add(new Transaction({ ...element, date: new Date(element.day) }));
  });
}

/* ==========================================================================
   6. Filtering + sorting
   ========================================================================== */
function previousMonth() {
  const now = new Date();
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { month: previous.getMonth() + 1, year: previous.getFullYear() };
}

function isSameMonth(date, month, year) {
  const day = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(day.getTime())) return false;
  return day.getMonth() + 1 === month && day.getFullYear() === year;
}

const transactionText = (t) =>
  [t.name, t.kind, t.category, t.notes]
    .map((field) => String(field ?? "").toLowerCase())
    .join(" ");

const SORTERS = {
  newest: (a, b) => timeOf(b) - timeOf(a),
  oldest: (a, b) => timeOf(a) - timeOf(b),
  highest: (a, b) => (Number(b.value) || 0) - (Number(a.value) || 0),
  lowest: (a, b) => (Number(a.value) || 0) - (Number(b.value) || 0),
  name: (a, b) =>
    String(a.name ?? "").localeCompare(String(b.name ?? ""), "ar"),
};

function visibleTransactions() {
  let items = manager.makeCopy();

  // Month filter (combined with the search query and the sort order).
  if (state.view === "month") {
    const { month, year } = previousMonth();
    items = items.filter((t) => isSameMonth(t.day, month, year));
  }

  // Search filter.
  const query = state.query.trim().toLowerCase();
  if (query) {
    items = items.filter((t) => transactionText(t).includes(query));
  }

  const sorter = SORTERS[state.sort] ?? SORTERS.newest;
  return items.sort(sorter);
}

/* ==========================================================================
   7. Rendering
   ========================================================================== */
function render() {
  const items = visibleTransactions();
  renderList(items);
  renderSummary();
  renderBudget();
  renderFilterState();
}

function renderFilterState() {
  allTransactionsBtn.classList.toggle("is-active", state.view === "all");
  monthBtn.classList.toggle("is-active", state.view === "month");
}

function renderList(items) {
  if (manager.count() === 0) {
    list.innerHTML = emptyState(
      "مفيش معاملات لسه",
      "أضف أول معاملة من النموذج وهتلاقيها هنا.",
    );
  } else if (items.length === 0) {
    list.innerHTML = emptyState(
      "مفيش نتائج مطابقة",
      "جرّب كلمة بحث تانية أو ارجع لعرض كل المعاملات.",
    );
  } else {
    list.innerHTML = items.map(transactionCard).join("");
  }

  listMeta.textContent = listMetaText(items);
}

function listMetaText(items) {
  if (manager.count() === 0) return "مفيش معاملات لسه";
  const parts = [`المعاملات المعروضة: ${items.length}`];
  if (state.view === "month") parts.push("عرض معاملات الشهر الماضي");
  const query = state.query.trim();
  if (query) parts.push(`بحث: «${query}»`);
  return parts.join(" • ");
}

function transactionCard(t) {
  const isExpense = t.isExpense;
  const amount = Number(t.value) || 0;
  const sign = isExpense ? "-" : "+";
  const date = t.day instanceof Date ? t.day : new Date(t.day);
  const note = t.notes && t.notes !== "لا يوجد" ? t.notes : "";

  return `
    <article class="txn ${isExpense ? "txn--expense" : "txn--income"}">
      <span class="txn__icon" aria-hidden="true">${escapeHtml(kindIcon(t.kind))}</span>
      <div class="txn__body">
        <div class="txn__top">
          <h3 class="txn__name">${escapeHtml(t.name)}</h3>
          <span class="txn__amount">${sign}${escapeHtml(money(amount))}</span>
        </div>
        <div class="txn__meta">
          <span class="tag"><span class="tag__icon" aria-hidden="true">${escapeHtml(kindIcon(t.kind))}</span>${escapeHtml(t.kind)}</span>
          <span class="tag ${isExpense ? "tag--expense" : "tag--income"}">${escapeHtml(t.category)}</span>
          <time datetime="${toInputDate(date)}">${escapeHtml(dateFormat.format(date))}</time>
        </div>
        ${note ? `<p class="txn__note">${escapeHtml(note)}</p>` : ""}
      </div>
      <button
        class="txn__delete"
        type="button"
        data-id="${escapeHtml(t.id)}"
        title="حذف المعاملة"
        aria-label="حذف معاملة ${escapeHtml(t.name)}"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 7h16" />
          <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
          <path d="M10 11v6M14 11v6" />
        </svg>
      </button>
    </article>
  `;
}

function emptyState(title, text) {
  return `
    <div class="empty">
      <svg class="empty__art" viewBox="0 0 160 120" fill="none"
           xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="32" y="16" width="92" height="86" rx="14"
              fill="#fdf1e4" stroke="#d9bfa0" stroke-width="2" />
        <path d="M50 40h56M50 56h40M50 72h48" stroke="#e2cbb0"
              stroke-width="3" stroke-linecap="round" />
        <circle cx="112" cy="84" r="17" fill="#fff8f0" stroke="#c68b59" stroke-width="2.5" />
        <path d="M124 96l10 10" stroke="#c68b59" stroke-width="3" stroke-linecap="round" />
        <path d="M104 84h16" stroke="#c68b59" stroke-width="3" stroke-linecap="round" />
        <circle cx="44" cy="22" r="6" fill="#c68b59" />
        <circle cx="134" cy="32" r="4" fill="#e2cbb0" />
      </svg>
      <p class="empty__title">${escapeHtml(title)}</p>
      <p class="empty__text">${escapeHtml(text)}</p>
    </div>
  `;
}

function renderSummary() {
  const balance = manager.totalBalance();

  balanceEl.textContent = money(balance);
  balanceEl.dataset.sign =
    balance > 0 ? "income" : balance < 0 ? "expense" : "zero";
  totalIncomeEl.textContent = money(manager.totalIncome());
  totalExpensesEl.textContent = money(manager.totalExpenses());

  // Total per kind, highest first.
  const perKind = [...manager.totalPerCategory().entries()].sort(
    (a, b) => b[1] - a[1],
  );

  perKindEl.innerHTML = perKind.length
    ? perKind
        .map(
          ([kind, total]) => `
            <li class="kind-row">
              <span class="kind-row__label">
                <span aria-hidden="true">${escapeHtml(kindIcon(kind))}</span>
                ${escapeHtml(kind)}
              </span>
              <span class="kind-row__value">${escapeHtml(money(total))}</span>
            </li>
          `,
        )
        .join("")
    : '<li class="kind-list__empty">لسه مفيش بيانات</li>';
}

function renderBudget() {
  const budget = Number(settings.value) || 0; // validated by the Proxy on write
  const spent = manager.totalExpenses();
  const ratio = budget > 0 ? spent / budget : 0;
  const percent = Math.round(ratio * 100);
  const overBudget = budget > 0 && spent > budget;

  budgetBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  budgetProgress.setAttribute(
    "aria-valuenow",
    String(Math.min(100, Math.max(0, percent))),
  );
  budgetProgress.classList.toggle(
    "progress--warn",
    ratio >= 0.8 && !overBudget,
  );
  budgetProgress.classList.toggle("progress--danger", overBudget);

  if (budget <= 0) {
    budgetText.textContent = "لم تحدد ميزانية بعد — اكتب الميزانية واضغط حفظ";
  } else {
    const remaining = budget - spent;
    const rest =
      remaining >= 0
        ? `الباقي ${money(remaining)}`
        : `تجاوزت بـ ${money(Math.abs(remaining))}`;
    budgetText.textContent = `صرفت ${money(spent)} من ${money(budget)} (${percent}%) — ${rest}`;
  }

  // Warning banner: shown only while spending is above the budget.
  budgetWarning.hidden = !overBudget;
  budgetWarning.textContent = `تحذير: مصروفاتك (${money(spent)}) تجاوزت الميزانية (${money(budget)}) بـ ${money(spent - budget)}!`;
}

/* ==========================================================================
   8. Budget
   ========================================================================== */
function saveBudgetFromInput() {
  const raw = budgetInput.value.trim();

  if (!raw) {
    setError("budget", "اكتب قيمة الميزانية الأول");
    return;
  }

  const parsed = Number(raw);

  // Positive number only; the Proxy validates again on assignment.
  if (!Number.isFinite(parsed) || parsed <= 0) {
    setError("budget", "الميزانية لازم تكون رقم موجب أكبر من صفر");
    return;
  }

  try {
    settings.value = parsed;
  } catch (error) {
    setError("budget", error?.message ?? "قيمة الميزانية غير صحيحة");
    return;
  }

  save(STORAGE_KEYS.budget, parsed);
  setError("budget", "");
  budgetInput.value = String(parsed);
  render();
}

function syncBudgetInput() {
  const budget = Number(settings.value) || 0;
  budgetInput.value = budget > 0 ? String(budget) : "";
}

/* ==========================================================================
   9. Form validation
   ========================================================================== */
function setError(key, message = "") {
  const node = document.querySelector(`[data-error-for="${key}"]`);
  if (!node) return;
  node.textContent = message;
  const field = node.closest(".field");
  if (field) field.classList.toggle("has-error", Boolean(message));
}

function clearErrors() {
  document
    .querySelectorAll("[data-error-for]")
    .forEach((node) => setError(node.dataset.errorFor, ""));
}

function focusFirstError() {
  const node = document.querySelector("[data-error-for]:not(:empty)");
  if (!node) return;
  const key = node.dataset.errorFor;
  const target = byId(key) ?? document.querySelector(`input[name="${key}"]`);
  target?.focus();
}

/**
 * Reads and validates the form.
 * @returns {object|null} a Transaction-ready payload, or null when invalid.
 */
function readForm() {
  clearErrors();
  let valid = true;

  // Name: required.
  const name = nameInput.value.trim();
  if (!name) {
    setError("name", "اكتب اسم المستخدم");
    valid = false;
  }

  // Value: required, numeric, greater than zero.
  const valueRaw = valueInput.value.trim();
  const value = Number(valueRaw);
  if (!valueRaw) {
    setError("val", "اكتب قيمة المعاملة");
    valid = false;
  } else if (!Number.isFinite(value)) {
    setError("val", "القيمة لازم تكون رقم");
    valid = false;
  } else if (value <= 0) {
    setError("val", "القيمة لازم تكون أكبر من صفر");
    valid = false;
  }

  // Salary: optional, but must be a valid non-negative number when provided.
  const salaryRaw = salaryInput.value.trim();
  let salary = 0;
  if (salaryRaw) {
    salary = Number(salaryRaw);
    if (!Number.isFinite(salary) || salary < 0) {
      setError("sal", "إجمالي الراتب لازم يكون رقم موجب");
      valid = false;
      salary = 0;
    }
  }

  // Date: optional (defaults to today), but must be valid when provided.
  let date = new Date();
  if (dateInput.value) {
    date = parseInputDate(dateInput.value);
    if (Number.isNaN(date.getTime())) {
      setError("date", "التاريخ غير صحيح");
      valid = false;
      date = new Date();
    }
  }

  // Category: exactly one radio must be selected.
  const category =
    document.querySelector('input[name="category"]:checked')?.value ?? "";
  if (!category) {
    setError("category", "اختر نوع العملية: صرف أو دخل");
    valid = false;
  }

  // Kind: exactly one radio must be selected.
  const kind =
    document.querySelector('input[name="kind"]:checked')?.value ?? "";
  if (!kind) {
    setError("kind", "اختر نوع المعاملة");
    valid = false;
  }

  if (!valid) return null;

  return {
    name,
    kind,
    category,
    notes: noteInput.value.trim() || "لا يوجد",
    salary,
    value,
    date,
  };
}

function resetForm() {
  form.reset();
  clearErrors();
  dateInput.value = toInputDate(new Date());
}

/* ==========================================================================
   10. Persistence
   ========================================================================== */
const persistTransactions = () =>
  save(STORAGE_KEYS.transactions, manager.makeCopy());

/* ==========================================================================
   11. Events
   ========================================================================== */
form.addEventListener("submit", (event) => {
  event.preventDefault();

  const payload = readForm();
  if (!payload) {
    focusFirstError();
    return;
  }

  manager.add(new Transaction(payload));
  persistTransactions();
  render();
  resetForm();
});

clearBtn.addEventListener("click", resetForm);

// Clear a field's error as soon as the user edits it.
[nameInput, valueInput, salaryInput, dateInput, noteInput].forEach((input) => {
  input.addEventListener("input", () => setError(input.id, ""));
});

document
  .querySelectorAll('input[name="category"], input[name="kind"]')
  .forEach((radio) => {
    radio.addEventListener("change", () => setError(radio.name, ""));
  });

// --- Budget ---
saveBudgetBtn.addEventListener("click", saveBudgetFromInput);

budgetInput.addEventListener("input", () => setError("budget", ""));
budgetInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    saveBudgetFromInput();
  }
});

// --- Views / search / sort ---
allTransactionsBtn.addEventListener("click", () => {
  state.view = "all";
  render();
});

monthBtn.addEventListener("click", () => {
  state.view = "month";
  render();
});

// Live search: the button stays for explicit searches.
filterInput.addEventListener("input", () => {
  state.query = filterInput.value;
  render();
});

searchBtn.addEventListener("click", () => {
  state.query = filterInput.value;
  render();
});

sortSelect.addEventListener("change", () => {
  state.sort = sortSelect.value;
  render();
});

// --- Delete (event delegation) ---
list.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-id]");
  if (!button) return;

  const removed = manager.remove(Number(button.dataset.id));
  if (!removed) return;

  persistTransactions();
  render();
});

/* ==========================================================================
   12. Init
   ========================================================================== */
dateInput.value = toInputDate(new Date());
syncBudgetInput();
render();
