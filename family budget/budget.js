
"use strict";

const STORAGE_KEY = "familyBudgetDataV1";

const transactionForm = document.getElementById("transactionForm");
const budgetForm = document.getElementById("budgetForm");
const savingsForm = document.getElementById("savingsForm");
const monthFilter = document.getElementById("monthFilter");
const transactionList = document.getElementById("transactionList");
const emptyTransactions = document.getElementById("emptyTransactions");
const transactionCount = document.getElementById("transactionCount");
const formMessage = document.getElementById("formMessage");

const categoryColors = [
  "#74e0a4", "#85c8ff", "#c6a6ff", "#ffbf75",
  "#ff8585", "#65d6d0", "#e6e878", "#f29bc5"
];

const defaultData = {
  transactions: [],
  budgets: {},
  savingsTarget: 0
};

let appData = loadData();

function getToday() {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getCurrentMonth() {
  return getToday().slice(0, 7);
}

function formatMoney(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(amount);
}

function formatDate(dateString) {
  if (!dateString) return "-";

  const parts = dateString.split("-");

  if (parts.length !== 3) return dateString;

  return new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2])
  ).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

/* LOCAL STORAGE */

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return structuredClone(defaultData);
    }

    const parsed = JSON.parse(saved);

    if (
      !parsed ||
      !Array.isArray(parsed.transactions) ||
      typeof parsed.budgets !== "object" ||
      parsed.budgets === null ||
      typeof parsed.savingsTarget !== "number" ||
      !Number.isFinite(parsed.savingsTarget)
    ) {
      throw new Error("Invalid saved data");
    }

    parsed.transactions = parsed.transactions.filter(item =>
      item &&
      typeof item.id === "string" &&
      typeof item.title === "string" &&
      typeof item.category === "string" &&
      (item.type === "income" || item.type === "expense") &&
      typeof item.amount === "number" &&
      Number.isFinite(item.amount) &&
      item.amount > 0 &&
      item.amount <= 1000000000000 &&
      typeof item.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(item.date)
    );

    for (const key of Object.keys(parsed.budgets)) {
      const value = parsed.budgets[key];

      if (
        !/^\d{4}-\d{2}$/.test(key) ||
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 1000000000000
      ) {
        delete parsed.budgets[key];
      }
    }

    if (
      parsed.savingsTarget < 0 ||
      parsed.savingsTarget > 1000000000000
    ) {
      parsed.savingsTarget = 0;
    }

    return parsed;

  } catch (error) {
    console.error("Could not load saved budget data:", error);
    return structuredClone(defaultData);
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    return true;
  } catch (error) {
    console.error("Could not save budget data:", error);
    return false;
  }
}

/* MONTHLY CALCULATIONS */

function getSelectedTransactions() {
  const month = monthFilter.value;

  return appData.transactions.filter(transaction =>
    transaction.date.startsWith(month)
  );
}

function calculateTotals(transactions) {
  let income = 0;
  let expenses = 0;

  transactions.forEach(transaction => {
    if (transaction.type === "income") {
      income += transaction.amount;
    } else {
      expenses += transaction.amount;
    }
  });

  return {
    income,
    expenses,
    balance: income - expenses
  };
}

/* DASHBOARD */

function updateDashboard() {
  const transactions = getSelectedTransactions();
  const totals = calculateTotals(transactions);

  document.getElementById("totalIncome").textContent =
    formatMoney(totals.income);

  document.getElementById("totalExpenses").textContent =
    formatMoney(totals.expenses);

  const balanceElement =
    document.getElementById("remainingBalance");

  balanceElement.textContent = formatMoney(totals.balance);

  balanceElement.style.color =
    totals.balance < 0 ? "var(--red)" : "var(--green)";

  const savingsRate = totals.income > 0
    ? totals.balance / totals.income * 100
    : 0;

  document.getElementById("savingsRate").textContent =
    `${savingsRate.toFixed(1)}%`;

  updateBudget(totals);
  updateSavings(totals);
  updateExpenseChart(transactions);
  updateTransactionHistory(transactions);
}

/* BUDGET PLANNER */

function updateBudget(totals) {
  const month = monthFilter.value;
  const budget = appData.budgets[month] ?? 0;

  document.getElementById("budgetLimit").value =
    budget > 0 ? budget : "";

  document.getElementById("budgetSpent").textContent =
    formatMoney(totals.expenses);

  const remaining = budget - totals.expenses;

  document.getElementById("budgetRemaining").textContent =
    formatMoney(remaining);

  document.getElementById("budgetRemainingLabel").textContent =
    remaining < 0 ? "Over budget by" : "Budget remaining";

  const progress = budget > 0
    ? totals.expenses / budget * 100
    : 0;

  const progressElement =
    document.getElementById("budgetProgress");

  progressElement.style.width =
    `${Math.min(progress, 100)}%`;

  progressElement.classList.toggle(
    "over-budget",
    budget > 0 && totals.expenses > budget
  );

  const message = document.getElementById("budgetMessage");

  if (budget === 0) {
    message.textContent =
      "Set a monthly spending limit to track your budget.";
  } else if (totals.expenses > budget) {
    message.textContent =
      `Budget exceeded by ${formatMoney(totals.expenses - budget)}. Review your spending.`;
  } else if (progress >= 80) {
    message.textContent =
      "Warning: You have used at least 80% of your budget.";
  } else {
    message.textContent =
      `${progress.toFixed(1)}% of your monthly budget used.`;
  }
}

budgetForm.addEventListener("submit", function(event) {
  event.preventDefault();

  const input = document.getElementById("budgetLimit");
  const amount = input.valueAsNumber;

  if (
    input.value.trim() === "" ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    amount > 1000000000000
  ) {
    alert("Enter a valid monthly budget.");
    return;
  }

  const month = monthFilter.value;
  const previous = appData.budgets[month];

  appData.budgets[month] = amount;

  if (!saveData()) {
    if (previous === undefined) {
      delete appData.budgets[month];
    } else {
      appData.budgets[month] = previous;
    }

    alert("Could not save your budget.");
    return;
  }

  updateDashboard();
});

/* SAVINGS GOALS */

function updateSavings(totals) {
  const target = appData.savingsTarget;

  document.getElementById("savingsTarget").value =
    target > 0 ? target : "";

  document.getElementById("savingsCurrent").textContent =
    formatMoney(totals.balance);

  document.getElementById("savingsTargetText").textContent =
    formatMoney(target);

  const percentage = target > 0
    ? Math.max(0, totals.balance / target * 100)
    : 0;

  const displayedPercentage = Math.min(percentage, 100);

  document.getElementById("savingsProgress").textContent =
    `${Math.round(displayedPercentage)}%`;

  document.getElementById("savingsCircle").style.background =
    `conic-gradient(var(--green) ${displayedPercentage}%, #293730 ${displayedPercentage}%)`;

  const message = document.getElementById("savingsMessage");

  if (target === 0) {
    message.textContent =
      "Set a savings target to begin tracking your progress.";
  } else if (totals.balance < 0) {
    message.textContent =
      "Your expenses exceed your income. Review your budget.";
  } else if (totals.balance >= target) {
    message.textContent =
      "Congratulations! Your savings target has been reached.";
  } else {
    message.textContent =
      `${formatMoney(target - totals.balance)} more needed to reach your target.`;
  }
}

savingsForm.addEventListener("submit", function(event) {
  event.preventDefault();

  const input = document.getElementById("savingsTarget");
  const target = input.valueAsNumber;

  if (
    input.value.trim() === "" ||
    !Number.isFinite(target) ||
    target < 0 ||
    target > 1000000000000
  ) {
    alert("Enter a valid savings target.");
    return;
  }

  const previous = appData.savingsTarget;
  appData.savingsTarget = target;

  if (!saveData()) {
    appData.savingsTarget = previous;
    alert("Could not save your savings target.");
    return;
  }

  updateDashboard();
});

/* ADD TRANSACTION */

transactionForm.addEventListener("submit", function(event) {
  event.preventDefault();

  const type = document.getElementById("transactionType").value;
  const amountInput = document.getElementById("transactionAmount");
  const titleInput = document.getElementById("transactionTitle");
  const category = document.getElementById("transactionCategory").value;
  const date = document.getElementById("transactionDate").value;

  const amount = amountInput.valueAsNumber;
  const title = titleInput.value.trim();

  if (type !== "income" && type !== "expense") {
    showFormMessage("Choose a valid transaction type.", true);
    return;
  }

  if (
    amountInput.value.trim() === "" ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 1000000000000
  ) {
    showFormMessage("Enter a valid amount greater than zero.", true);
    return;
  }

  if (!title || title.length > 80) {
    showFormMessage("Enter a description of up to 80 characters.", true);
    return;
  }

  if (
    !date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(`${date}T00:00:00`))
  ) {
    showFormMessage("Choose a valid transaction date.", true);
    return;
  }

  if (!category) {
    showFormMessage("Choose a category.", true);
    return;
  }

  const transaction = {
    id: createId(),
    type,
    amount,
    title,
    category,
    date
  };

  appData.transactions.push(transaction);

  if (!saveData()) {
    appData.transactions.pop();
    showFormMessage("Could not save data. Check browser storage settings.", true);
    return;
  }

  monthFilter.value = date.slice(0, 7);

  transactionForm.reset();
  document.getElementById("transactionDate").value = getToday();

  showFormMessage("Transaction added and saved successfully.");
  updateDashboard();
});

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function showFormMessage(message, isError = false) {
  formMessage.textContent = message;
  formMessage.classList.toggle("error", isError);
}

/* TRANSACTION HISTORY */

function updateTransactionHistory(transactions) {
  transactionList.replaceChildren();

  const sorted = [...transactions].sort((a, b) =>
    b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
  );

  transactionCount.textContent =
    `${transactions.length} record${transactions.length === 1 ? "" : "s"}`;

  emptyTransactions.hidden = sorted.length > 0;

  sorted.forEach(transaction => {
    const row = document.createElement("tr");

    const titleCell = document.createElement("td");
    titleCell.textContent = transaction.title;

    const categoryCell = document.createElement("td");
    categoryCell.textContent = transaction.category;

    const dateCell = document.createElement("td");
    dateCell.textContent = formatDate(transaction.date);

    const typeCell = document.createElement("td");
    const tag = document.createElement("span");

    tag.className = `type-tag type-${transaction.type}`;
    tag.textContent = transaction.type === "income" ? "Income" : "Expense";
    typeCell.appendChild(tag);

    const amountCell = document.createElement("td");
    amountCell.className = "amount-column";

    amountCell.textContent =
      `${transaction.type === "income" ? "+" : "-"}${formatMoney(transaction.amount)}`;

    amountCell.style.color =
      transaction.type === "income" ? "var(--green)" : "var(--red)";

    const actionCell = document.createElement("td");
    const deleteButton = document.createElement("button");

    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "Delete";

    deleteButton.setAttribute(
      "aria-label",
      `Delete transaction: ${transaction.title}`
    );

    deleteButton.addEventListener("click", function() {
      deleteTransaction(transaction.id);
    });

    actionCell.appendChild(deleteButton);

    row.append(
      titleCell,
      categoryCell,
      dateCell,
      typeCell,
      amountCell,
      actionCell
    );

    transactionList.appendChild(row);
  });
}

function deleteTransaction(id) {
  const transaction = appData.transactions.find(item => item.id === id);

  if (!transaction) return;

  const confirmed = window.confirm(
    `Delete "${transaction.title}"? This cannot be undone.`
  );

  if (!confirmed) return;

  const previousTransactions = appData.transactions;

  appData.transactions = previousTransactions.filter(
    item => item.id !== id
  );

  if (!saveData()) {
    appData.transactions = previousTransactions;
    alert("Could not save the change. The transaction was not deleted.");
    return;
  }

  updateDashboard();
}

/* EXPENSE BREAKDOWN */

function updateExpenseChart(transactions) {
  const chart = document.getElementById("expenseChart");
  chart.replaceChildren();

  const totals = {};

  transactions
    .filter(transaction => transaction.type === "expense")
    .forEach(transaction => {
      totals[transaction.category] =
        (totals[transaction.category] || 0) + transaction.amount;
    });

  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  const totalExpenses = entries.reduce(
    (sum, entry) => sum + entry[1],
    0
  );

  if (entries.length === 0) {
    const message = document.createElement("p");
    message.className = "empty-message";
    message.textContent = "Add expenses to see your breakdown.";
    chart.appendChild(message);
    return;
  }

  entries.forEach(([category, amount], index) => {
    const percentage = totalExpenses > 0
      ? amount / totalExpenses * 100
      : 0;

    const row = document.createElement("div");
    row.className = "chart-row";

    const label = document.createElement("span");
    label.className = "chart-label";
    label.textContent = category;

    const value = document.createElement("span");
    value.className = "chart-value";
    value.textContent = formatMoney(amount);

    const track = document.createElement("div");
    track.className = "chart-track";

    const fill = document.createElement("div");
    fill.className = "chart-fill";
    fill.style.width = `${percentage}%`;
    fill.style.background = categoryColors[index % categoryColors.length];
    fill.title = `${percentage.toFixed(1)}% of expenses`;

    track.appendChild(fill);
    row.append(label, value, track);
    chart.appendChild(row);
  });
}

/* MONTH FILTER */

monthFilter.addEventListener("change", function() {
  if (!monthFilter.value) {
    monthFilter.value = getCurrentMonth();
  }

  updateDashboard();
});

/* INTERNAL PAGE NAVIGATION */

const pageDetails = {
  dashboard: [
    "Family Dashboard",
    "Plan wisely. Save consistently. Live confidently."
  ],
  transactions: [
    "Transactions",
    "Add, review and manage your income and expenses."
  ],
  budgets: [
    "Budget Planner",
    "Set a monthly spending limit and monitor expenses."
  ],
  savings: [
    "Savings Goals",
    "Track progress towards your savings target."
  ]
};

function showPage(pageName) {
  if (!pageDetails[pageName]) {
    pageName = "dashboard";
  }

  document.querySelectorAll(".page-section").forEach(section => {
    const selected = section.dataset.page === pageName;

    section.hidden = !selected;
    section.classList.toggle("active", selected);
  });

  document.querySelectorAll("[data-page-link]").forEach(link => {
    const selected = link.dataset.pageLink === pageName;

    link.classList.toggle("active", selected);

    if (link.tagName === "BUTTON") {
      link.setAttribute("aria-current", selected ? "page" : "false");
    }
  });

  document.getElementById("pageTitle").textContent =
    pageDetails[pageName][0];

  document.getElementById("pageSubtitle").textContent =
    pageDetails[pageName][1];
}

document.querySelectorAll("[data-page-link]").forEach(link => {
  link.addEventListener("click", function(event) {
    event.preventDefault();
    showPage(link.dataset.pageLink);
  });
});

/* START APPLICATION */

monthFilter.value = getCurrentMonth();
document.getElementById("transactionDate").value = getToday();

showPage("dashboard");
updateDashboard();
