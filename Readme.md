# Masrofy (مصروفي) — Expense Tracker

A lightweight, Arabic-first (RTL) expense tracker built with vanilla HTML, CSS, and JavaScript (ES Modules). No frameworks, no libraries, and no build step required. Track your income and expenses, set a monthly budget, and monitor your balance in real time—with full local persistence in your browser.

🔗 **[Live Demo](https://algorixsoftwarestudio-svg.github.io/Masrofy/)** · **[Source Code](https://github.com/algorixsoftwarestudio-svg/Masrofy)**

---

## Preview

<div align="center">
  <img src="screenshots/desktop.png" alt="Desktop screenshot" width="700">
  <br><br>
  <img src="screenshots/mobile.png" alt="Mobile screenshot" width="280">
</div>

*(Note: Add your screenshots inside a `screenshots/` folder, or remove this section until they are ready.)*

---

## Features

- **Transaction Management:** Add and delete transactions with name, kind (`rent`, `transport`, `food`, `study expenses`, `other`), type (`income` or `expense`), amount, and custom notes.
- **Persistent Storage:** Powered by `localStorage`, ensuring all records and settings survive page reloads.
- **Summary Dashboard:** Real-time calculation of total balance, total income, total expenses, and a per-category breakdown.
- **Budget Monitoring:** Set a monthly spending limit, track progress visually via a progress bar, and receive instant warnings when exceeding the budget.
- **Search & Filtering:** Instant search by transaction name or category, plus quick filters (all transactions vs. last month's).
- **Flexible Sorting:** Sort records by newest, oldest, highest value, lowest value, or alphabetically by name.
- **Form Validation:** Clean client-side validation with inline error feedback.
- **Responsive UI:** Adaptive two-column layout on desktop and a streamlined single-column view on mobile, styled with a warm brown design system using CSS variables and custom radio chips.

---

## Architecture & JavaScript Concepts

Engineered with clean, modular vanilla JavaScript following modern ECMAScript standards:

| Concept | Implementation |
| :--- | :--- |
| **ES Modules (`import` / `export`)** | Modular architecture across all JS files |
| **Classes, Private Fields (`#`) & Static Members** | `Transaction` & `ExpensesManager` models |
| **Getters & Custom Serialization (`toJSON`)** | `models/transaction.js` (`get signedAmount`) |
| **Generators & `Symbol.iterator`** | `transactionPerMonth` & iterable manager |
| **ES6 `Proxy` for Validation** | `utils/settingsproxy.js` (validates budget values) |
| **`Map` and `Set` Data Structures** | Aggregating per-kind totals & unique categories |
| **Functional Array Methods** | `map`, `filter`, `reduce` for state & rendering |
| **Modern Syntax** | Destructuring, spread, optional chaining, template literals (`main.js`) |
| **Client-Side Persistence** | JSON serialization helpers in `utils/storage.js` |

---

## Project Structure

```text
.
├── index.html
├── style/
│   └── styling.css
├── js/
│   ├── main.js                  # UI wiring, DOM rendering, event listeners
│   ├── models/
│   │   ├── transaction.js       # Transaction class (auto ID, signed amount, JSON)
│   │   └── ExpensesManager.js   # State management, filtering, totals, generators
│   └── utils/
│       ├── storage.js           # save() / load() helpers for localStorage
│       └── settingsproxy.js     # Proxy trap for budget validation
└── screenshots/