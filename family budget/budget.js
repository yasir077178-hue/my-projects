/* =========================================================
   YASIR HUB — FAMILY FINANCE MANAGEMENT
   Premium Supabase Version
========================================================= */

const supabaseReadyWait = setInterval(async () => {
    if (!window.supabaseClient) return;

    clearInterval(supabaseReadyWait);
    await startFamilyFinanceApp();
}, 100);

/* =========================================================
   APP STATE
========================================================= */

async function startFamilyFinanceApp() {
    const supabase = window.supabaseClient;

    let currentUser = null;

    let transactions = [];
    let budgets = [];
    let savingsGoals = [];
    let assets = [];

    let assetHistory = [];
    let assetValuations = [];

    let selectedMonth = new Date().toISOString().slice(0, 7);
    let selectedAsset = "null";
    let selectedPeriod = "1m";
    let editingAssetId = null;

    const $ = id => document.getElementById(id);

    const money = value =>
        new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 2
        }).format(Number(value) || 0);

    const today = () => {
        const date = new Date();
        return new Date(
            date.getTime() - date.getTimezoneOffset() * 60000
        ).toISOString().slice(0, 10);
    };

    const monthStart = month => `${month}-01`;

    function message(id, text, isError = false) {
        const element = $(id);
        if (!element) return;

        element.textContent = text;
        element.classList.toggle("error", isError);
    }

    function safeNumber(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
    }

    function formatDateTime(value) {
        return new Date(value).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short"
        });
    }

    function createElement(tag, className, text) {
        const element = document.createElement(tag);

        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;

        return element;
    }

    /* =====================================================
       PAGE NAVIGATION
    ===================================================== */

    function showPage(page) {
        document.querySelectorAll("[data-page]").forEach(section => {
            section.hidden = section.dataset.page !== page;
            section.classList.toggle(
                "active",
                section.dataset.page === page
            );
        });

        document.querySelectorAll("[data-page-link]").forEach(link => {
            link.classList.toggle(
                "active",
                link.dataset.pageLink === page
            );
        });

        const titles = {
            dashboard: ["Dashboard", "Your family finance overview"],
            transactions: ["Transactions", "Track income and expenses"],
            budgets: ["Budget Planner", "Manage monthly spending"],
            savings: ["Savings Goals", "Track your savings progress"],
            assets: ["Assets", "Manage your family's assets"],
            liabilities: ["Liabilities", "Track outstanding liabilities"],
            reports: ["Reports", "Review your financial position"],
            settings: ["Settings", "Manage your account"]
        };

        const details = titles[page] || titles.dashboard;

        if ($("pageTitle")) $("pageTitle").textContent = details[0];
        if ($("pageSubtitle")) $("pageSubtitle").textContent = details[1];

        if (page === "assets") {
            renderAssets();
            renderAssetChart();
        }
    }

    document.querySelectorAll("[data-page-link]").forEach(link => {
        link.addEventListener("click", () => {
            showPage(link.dataset.pageLink);
        });
    });

    /* =====================================================
       MONTH FILTER
    ===================================================== */

    if ($("monthFilter")) {
        $("monthFilter").value = selectedMonth;

        $("monthFilter").addEventListener("change", () => {
            selectedMonth = $("monthFilter").value;
            renderEverything();
        });
    }

    /* =====================================================
       AUTHENTICATION AND DATABASE LOADING
    ===================================================== */

    async function loadAllData() {
        if (!currentUser) return;

        const results = await Promise.all([
            supabase.from("transactions")
                .select("*")
                .eq("user_id", currentUser.id)
                .order("transaction_date", { ascending: false }),

            supabase.from("budgets")
                .select("*")
                .eq("user_id", currentUser.id),

            supabase.from("savings_goals")
                .select("*")
                .eq("user_id", currentUser.id),

            supabase.from("assets")
                .select("*")
                .eq("user_id", currentUser.id)
                .order("created_at", { ascending: false }),

            supabase.from("asset_history")
                .select("*")
                .eq("user_id", currentUser.id)
                .order("changed_at", { ascending: false }),

            supabase.from("asset_valuations")
                .select("*")
                .eq("user_id", currentUser.id)
                .order("recorded_at", { ascending: true })
        ]);

        const [
            transactionResult,
            budgetResult,
            savingsResult,
            assetResult,
            historyResult,
            valuationResult
        ] = results;

        for (const result of results) {
            if (result.error) {
                console.error(result.error);
                alert("Database error: " + result.error.message);
                return;
            }
        }

        transactions = transactionResult.data || [];
        budgets = budgetResult.data || [];
        savingsGoals = savingsResult.data || [];
        assets = assetResult.data || [];
        assetHistory = historyResult.data || [];
        assetValuations = valuationResult.data || [];

        renderEverything();
    }

    async function initialiseUser() {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
            console.error(error);
            return;
        }

        currentUser = data.session?.user || null;

        if (currentUser) {
            await loadAllData();
        }
    }

    supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT" || !session) {
            currentUser = null;
            transactions = [];
            budgets = [];
            savingsGoals = [];
            assets = [];
            assetHistory = [];
            assetValuations = [];

            renderEverything();
            return;
        }

        if (event === "SIGNED_IN") {
            currentUser = session.user;
            loadAllData();
        }
    });

    await initialiseUser();

    /* =====================================================
       TRANSACTIONS
    ===================================================== */

    function monthTransactions() {
        return transactions.filter(item =>
            (item.transaction_date || "").slice(0, 7) === selectedMonth
        );
    }

    function calculateTotals() {
        const current = monthTransactions();

        const income = current
            .filter(item => item.transaction_type === "income")
            .reduce((sum, item) => sum + safeNumber(item.amount), 0);

        const expenses = current
            .filter(item => item.transaction_type === "expense")
            .reduce((sum, item) => sum + safeNumber(item.amount), 0);

        return {
            income,
            expenses,
            balance: income - expenses,
            savingsRate: income > 0
                ? ((income - expenses) / income) * 100
                : 0
        };
    }

    async function addTransaction(event) {
        event.preventDefault();

        if (!currentUser) return;

        const type = $("transactionType")?.value;
        const amount = safeNumber($("transactionAmount")?.value);
        const title = $("transactionTitle")?.value.trim();
        const category = $("transactionCategory")?.value;
        const date = $("transactionDate")?.value || today();

        if (!type || amount <= 0 || !title || !category) {
            message("formMessage", "Enter valid transaction details.", true);
            return;
        }

        const { data, error } = await supabase
            .from("transactions")
            .insert({
                user_id: currentUser.id,
                transaction_type: type,
                amount,
                category,
                note: title,
                transaction_date: date
            })
            .select()
            .single();

        if (error) {
            message("formMessage", error.message, true);
            return;
        }

        transactions.unshift(data);

        $("transactionForm").reset();

        if ($("transactionDate")) {
            $("transactionDate").value = today();
        }

        message("formMessage", "Transaction added successfully.");
        renderEverything();
    }

    async function deleteTransaction(id) {
        if (!confirm("Delete this transaction?")) return;

        const { error } = await supabase
            .from("transactions")
            .delete()
            .eq("id", id)
            .eq("user_id", currentUser.id);

        if (error) {
            alert(error.message);
            return;
        }

        transactions = transactions.filter(item => item.id !== id);
        renderEverything();
    }

    function renderTransactions() {
        const list = $("transactionList");
        if (!list) return;

        list.replaceChildren();

        const current = monthTransactions();

        if ($("transactionCount")) {
            $("transactionCount").textContent = current.length;
        }

        if ($("emptyTransactions")) {
            $("emptyTransactions").hidden = current.length !== 0;
        }

        current.forEach(item => {
            const row = createElement("div", "transaction-item");

            const details = createElement("div");
            details.append(
                createElement("strong", "", item.note || item.category),
                createElement(
                    "small",
                    "",
                    `${item.category} • ${item.transaction_date}`
                )
            );

            const amount = createElement(
                "strong",
                item.transaction_type === "income" ? "income" : "expense",
                `${item.transaction_type === "income" ? "+" : "-"}${money(item.amount)}`
            );

            const remove = createElement("button", "delete-button", "Delete");
            remove.type = "button";
            remove.addEventListener("click", () => deleteTransaction(item.id));

            row.append(details, amount, remove);
            list.appendChild(row);
        });
    }

    if ($("transactionForm")) {
        $("transactionForm").addEventListener("submit", addTransaction);
    }

    if ($("transactionDate")) {
        $("transactionDate").value = today();
    }
        /* =====================================================
       BUDGET PLANNER
    ===================================================== */

    function getCurrentBudget() {
        return budgets.find(item =>
            item.month_starts === monthStart(selectedMonth)
        );
    }

    async function saveBudget(event) {
        event.preventDefault();

        if (!currentUser) return;

        const limit = safeNumber($("budgetLimit")?.value);

        if (limit <= 0) {
            message("budgetMessage", "Enter a valid budget amount.", true);
            return;
        }

        const existing = getCurrentBudget();

        const query = existing
            ? supabase.from("budgets")
                .update({ limit_amount: limit })
                .eq("id", existing.id)
                .eq("user_id", currentUser.id)
            : supabase.from("budgets")
                .insert({
                    user_id: currentUser.id,
                    category: "Overall",
                    month_starts: monthStart(selectedMonth),
                    limit_amount: limit
                });

        const { data, error } = await query.select().single();

        if (error) {
            message("budgetMessage", error.message, true);
            return;
        }

        const index = budgets.findIndex(item => item.id === data.id);

        if (index >= 0) budgets[index] = data;
        else budgets.push(data);

        message("budgetMessage", "Budget saved successfully.");
        renderEverything();
    }

    function renderBudget() {
        const budget = getCurrentBudget();
        const limit = safeNumber(budget?.limit_amount);

        const spent = monthTransactions()
            .filter(item => item.transaction_type === "expense")
            .reduce((sum, item) => sum + safeNumber(item.amount), 0);

        const remaining = limit - spent;
        const percentage = limit > 0
            ? Math.min((spent / limit) * 100, 100)
            : 0;

        if ($("budgetSpent")) $("budgetSpent").value = spent.toFixed(2);
        if ($("budgetLimit") && budget) {
            $("budgetLimit").value = limit;
        }

        if ($("budgetRemaining")) {
            $("budgetRemaining").textContent = money(Math.abs(remaining));
        }

        if ($("budgetRemainingLabel")) {
            $("budgetRemainingLabel").textContent =
                remaining >= 0 ? "Remaining budget" : "Amount over budget";
        }

        if ($("budgetProgress")) {
            $("budgetProgress").style.width = `${percentage}%`;
            $("budgetProgress").classList.toggle("over-budget", remaining < 0);
        }
    }

    if ($("budgetForm")) {
        $("budgetForm").addEventListener("submit", saveBudget);
    }

    /* =====================================================
       SAVINGS GOALS
    ===================================================== */

    async function saveSavings(event) {
        event.preventDefault();

        if (!currentUser) return;

        const target = safeNumber($("savingsTarget")?.value);

        if (target <= 0) {
            message("savingsMessage", "Enter a valid savings target.", true);
            return;
        }

        const existing = savingsGoals[0];

        const query = existing
            ? supabase.from("savings_goals")
                .update({ targeted_amount: target })
                .eq("id", existing.id)
                .eq("user_id", currentUser.id)
            : supabase.from("savings_goals")
                .insert({
                    user_id: currentUser.id,
                    name: "Family Savings Goal",
                    targeted_amount: target,
                    current_amount: 0,
                    targeted_data: null
                });

        const { data, error } = await query.select().single();

        if (error) {
            message("savingsMessage", error.message, true);
            return;
        }

        if (existing) savingsGoals[0] = data;
        else savingsGoals.unshift(data);

        message("savingsMessage", "Savings goal saved successfully.");
        renderEverything();
    }

    function renderSavings() {
        const goal = savingsGoals[0];

        const target = safeNumber(goal?.targeted_amount);
        const current = safeNumber(goal?.current_amount);

        const percentage = target > 0
            ? Math.min((current / target) * 100, 100)
            : 0;

        if ($("savingsCurrent")) {
            $("savingsCurrent").textContent = money(current);
        }

        if ($("savingsTargetText")) {
            $("savingsTargetText").textContent = money(target);
        }

        if ($("savingsProgress")) {
            $("savingsProgress").textContent = `${percentage.toFixed(1)}%`;
        }

        if ($("savingsCircle")) {
            $("savingsCircle").style.background =
                `conic-gradient(var(--green) ${percentage}%, var(--border) 0)`;
        }

        if ($("savingsTarget")) {
            $("savingsTarget").value = target || "";
        }
    }

    if ($("savingsForm")) {
        $("savingsForm").addEventListener("submit", saveSavings);
    }

    /* =====================================================
       ASSET HELPERS
    ===================================================== */

    function getAssetValue(asset) {
        return safeNumber(asset.current_value);
    }

    function getPurchaseValue(asset) {
        return safeNumber(asset.purchase_price) *
            safeNumber(asset.quantity || 1);
    }

    function getAssetById(id) {
        return assets.find(asset => asset.id === id);
    }

    async function saveAssetHistory(action, assetId, oldValues, newValues) {
        const { data, error } = await supabase
            .from("asset_history")
            .insert({
                user_id: currentUser.id,
                asset_id: assetId,
                action,
                old_values: oldValues,
                new_values: newValues
            })
            .select()
            .single();

        if (error) {
            console.error("Asset history error:", error);
            return false;
        }

        assetHistory.unshift(data);
        return true;
    }

    async function saveAssetValuation(assetId, value, source = "manual") {
        const { data, error } = await supabase
            .from("asset_valuations")
            .insert({
                user_id: currentUser.id,
                asset_id: assetId,
                total_value: value,
                source
            })
            .select()
            .single();

        if (error) {
            console.error("Asset valuation error:", error);
            return false;
        }

        assetValuations.push(data);
        return true;
    }

    /* =====================================================
       ADD / EDIT ASSET
    ===================================================== */

    async function addAsset(event) {
        event.preventDefault();

        if (!currentUser) return;

        const name = $("assetName")?.value.trim();
        const type = $("assetType")?.value;
        const quantity = safeNumber($("assetQuantity")?.value || 1);
        const unit = $("assetUnit")?.value || "";
        const purchasePrice = safeNumber($("assetPurchasePrice")?.value);
        const currentValue = safeNumber($("assetCurrentValue")?.value);
        const currency = $("assetCurrency")?.value || "INR";

        const valuationMode = $("assetValuationMode")?.value || "manual";

        if (
            !name ||
            !type ||
            quantity <= 0 ||
            purchasePrice < 0 ||
            currentValue < 0
        ) {
            message("assetFormMessage", "Enter valid asset details.", true);
            return;
        }

        const assetData = {
            name,
            asset_type: type,
            quantity,
            unit,
            purchase_price: purchasePrice,
            current_value: currentValue,
            currency,
            valuation_mode: valuationMode === "market"
                ? "automatic"
                : valuationMode
        };

        let result;

        if (editingAssetId) {
            const oldAsset = getAssetById(editingAssetId);

            if (!oldAsset) return;

            result = await supabase
                .from("assets")
                .update(assetData)
                .eq("id", editingAssetId)
                .eq("user_id", currentUser.id)
                .select()
                .single();

            if (!result.error) {
                const updatedAsset = result.data;

                assets = assets.map(asset =>
                    asset.id === editingAssetId ? updatedAsset : asset
                );

                await saveAssetHistory(
                    "updated",
                    updatedAsset.id,
                    oldAsset,
                    updatedAsset
                );

                if (
                    safeNumber(oldAsset.current_value) !== currentValue
                ) {
                    await saveAssetValuation(
                        updatedAsset.id,
                        currentValue,
                        "manual"
                    );
                }
            }
        } else {
            result = await supabase
                .from("assets")
                .insert({
                    user_id: currentUser.id,
                    ...assetData
                })
                .select()
                .single();

            if (!result.error) {
                const newAsset = result.data;
                assets.unshift(newAsset);

                await saveAssetHistory(
                    "created",
                    newAsset.id,
                    null,
                    newAsset
                );

                await saveAssetValuation(
                    newAsset.id,
                    currentValue,
                    "manual"
                );
            }
        }

        if (result.error) {
            message("assetFormMessage", result.error.message, true);
            return;
        }

        editingAssetId = null;

        $("assetForm").reset();

        const submitButton = $("assetForm").querySelector(
            'button[type="submit"]'
        );

        if (submitButton) submitButton.textContent = "Add Asset";

        message(
            "assetFormMessage",
            "Asset saved successfully. Graph and history updated."
        );

        renderEverything();
    }

    function editAsset(id) {
        const asset = getAssetById(id);
        if (!asset) return;

        editingAssetId = id;

        $("assetName").value = asset.name;
        $("assetType").value = asset.asset_type;
        $("assetQuantity").value = asset.quantity;
        $("assetUnit").value = asset.unit || "";
        $("assetPurchasePrice").value = asset.purchase_price;
        $("assetCurrentValue").value = asset.current_value;
        $("assetCurrency").value = asset.currency || "INR";

        $("assetValuationMode").value =
            asset.valuation_mode === "automatic"
                ? "market"
                : asset.valuation_mode;

        const submitButton = $("assetForm").querySelector(
            'button[type="submit"]'
        );

        if (submitButton) submitButton.textContent = "Save Changes";

        $("assetForm").scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }

    /* =====================================================
       DELETE ASSET
    ===================================================== */

    async function deleteAsset(id) {
        const asset = getAssetById(id);
        if (!asset) return;

        if (!confirm(`Delete ${asset.name}? Its linked history will also be deleted.`)) {
            return;
        }

        // Preserve the deletion record before deleting the asset.
        await saveAssetHistory(
            "deleted",
            id,
            asset,
            null
        );

        const { error } = await supabase
            .from("assets")
            .delete()
            .eq("id", id)
            .eq("user_id", currentUser.id);

        if (error) {
            alert(error.message);
            return;
        }

        assets = assets.filter(item => item.id !== id);

        // The database's ON DELETE CASCADE removes linked history
        // and valuation records for this asset.
        assetHistory = assetHistory.filter(item => item.asset_id !== id);
        assetValuations = assetValuations.filter(item => item.asset_id !== id);

        renderEverything();
    }

    if ($("assetForm")) {
        $("assetForm").addEventListener("submit", addAsset);
    }// ==========================================
// PART 3: ASSETS DISPLAY
// ==========================================

function renderAssets() {
    const list = $("assetList");
    const empty = $("emptyAssets");

    if (!list) return;

    list.replaceChildren();

    const totalValue = assets.reduce(
        (sum, asset) => sum + getAssetValue(asset),
        0
    );

    const totalPurchase = assets.reduce(
        (sum, asset) => sum + getPurchaseValue(asset),
        0
    );

    const profitLoss = totalValue - totalPurchase;

    if ($("totalAssetValue")) {
        $("totalAssetValue").textContent = money(totalValue);
    }

    if ($("totalAssetPurchase")) {
        $("totalAssetPurchase").textContent = money(totalPurchase);
    }

    if ($("assetProfitLoss")) {
        $("assetProfitLoss").textContent = money(profitLoss);
        $("assetProfitLoss").style.color =
            profitLoss >= 0 ? "var(--green)" : "var(--red)";
    }

    if (empty) {
        empty.hidden = assets.length > 0;
    }

    assets.forEach(asset => {
        const row = document.createElement("tr");

        const values = [
            asset.name,
            String(asset.asset_type || "Other").replaceAll("_", " "),
            `${safeNumber(asset.quantity)} ${asset.unit || ""}`,
            money(asset.purchase_price),
            money(asset.current_value),
            money(getAssetValue(asset))
        ];

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        const actions = document.createElement("td");

        const editButton = document.createElement("button");
        editButton.textContent = "Edit";
        editButton.type = "button";
        editButton.className = "edit-button";
        editButton.addEventListener("click", () => {
            editAsset(asset.id);
        });

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.type = "button";
        deleteButton.className = "delete-button";
        deleteButton.addEventListener("click", () => {
            deleteAsset(asset.id);
        });

        actions.append(editButton, deleteButton);
        row.appendChild(actions);

        list.appendChild(row);
    });

    renderAssetChart();
}


// ==========================================
// ASSET HISTORY PANEL
// ==========================================

function readableValues(values) {
    if (!values) return "No previous information";

    const labels = {
        name: "Name",
        asset_type: "Type",
        quantity: "Quantity",
        unit: "Unit",
        purchase_price: "Purchase price",
        current_value: "Current value",
        currency: "Currency",
        valuation_mode: "Valuation method"
    };

    return Object.entries(values)
        .map(([key, value]) => {
            const label = labels[key] || key;
            return `${label}: ${value}`;
        })
        .join(" | ");
}


function renderAssetHistory() {
    const container = $("assetHistoryList");

    if (!container) return;

    container.replaceChildren();

    let records = [...assetHistory];

    if (selectedAsset) {
        records = records.filter(
            item => item.asset_id === selectedAsset
        );
    }

    records.sort(
        (a, b) =>
            new Date(b.changed_at) - new Date(a.changed_at)
    );

    if (records.length === 0) {
        const messageElement = document.createElement("p");
        messageElement.textContent = "No history available yet.";
        container.appendChild(messageElement);
        return;
    }

    records.forEach(record => {
        const card = document.createElement("div");
        card.className = "history-card";

        const heading = document.createElement("h4");
        heading.textContent =
            `${record.action || "Updated"} – ${
                formatDateTime(record.changed_at)
            }`;

        const oldValues = document.createElement("p");
        oldValues.textContent =
            "Previous: " + readableValues(record.old_values);

        const newValues = document.createElement("p");
        newValues.textContent =
            "New: " + readableValues(record.new_values);

        card.append(heading, oldValues, newValues);
        container.appendChild(card);
    });
}


$("assetHistoryButton")?.addEventListener("click", () => {
    const panel = $("assetHistoryPanel");

    if (panel) {
        panel.hidden = !panel.hidden;
        renderAssetHistory();
    }
});


$("closeAssetHistory")?.addEventListener("click", () => {
    if ($("assetHistoryPanel")) {
        $("assetHistoryPanel").hidden = true;
    }
});


// ==========================================
// ASSET VALUE GRAPH
// ==========================================

function getPeriodStart(period) {
    const date = new Date();

    if (period === "1m") {
        date.setMonth(date.getMonth() - 1);
    } else if (period === "6m") {
        date.setMonth(date.getMonth() - 6);
    } else if (period === "1y") {
        date.setFullYear(date.getFullYear() - 1);
    } else {
        return null;
    }

    return date;
}


function getAssetGraphData() {
    const records = [...assetValuations].sort(
        (a, b) =>
            new Date(a.recorded_at) - new Date(b.recorded_at)
    );

    if (selectedAsset) {
        return records
            .filter(item => item.asset_id === selectedAsset)
            .map(item => ({
                date: new Date(item.recorded_at),
                value: safeNumber(item.total_value)
            }));
    }

    const latestValues = {};
    const points = [];

    records.forEach(record => {
        latestValues[record.asset_id] =
            safeNumber(record.total_value);

        const total = Object.values(latestValues).reduce(
            (sum, value) => sum + value,
            0
        );

        points.push({
            date: new Date(record.recorded_at),
            value: total
        });
    });

    return points;
}


function renderAssetChart() {
    const container = $("assetChart");

    if (!container) return;

    container.replaceChildren();

    // Controls
    const controls = document.createElement("div");
    controls.className = "asset-chart-controls";

    const selector = document.createElement("select");
    selector.setAttribute("aria-label", "Select asset");

    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = "All Assets";
    selector.appendChild(allOption);

    assets.forEach(asset => {
        const option = document.createElement("option");
        option.value = asset.id;
        option.textContent = asset.name;
        selector.appendChild(option);
    });

    selector.value = selectedAsset || "";

    selector.addEventListener("change", () => {
        selectedAsset = selector.value || null;
        renderAssetChart();
        renderAssetHistory();
    });

    controls.appendChild(selector);

    const periods = [
        ["1m", "1 Month"],
        ["6m", "6 Months"],
        ["1y", "1 Year"],
        ["all", "All Time"]
    ];

    periods.forEach(([value, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.className =
            selectedPeriod === value ? "active" : "";

        button.addEventListener("click", () => {
            selectedPeriod = value;
            renderAssetChart();
        });

        controls.appendChild(button);
    });

    container.appendChild(controls);

    // Graph data
    let data = getAssetGraphData();

    const startDate = getPeriodStart(selectedPeriod);

    if (startDate) {
        data = data.filter(
            point => point.date >= startDate
        );
    }

    if (data.length === 0) {
        const messageElement = document.createElement("p");
        messageElement.textContent =
            "Asset value history will appear here after valuation records are created.";

        container.appendChild(messageElement);
        return;
    }

    const width = 700;
    const height = 260;
    const padding = 45;

    const values = data.map(point => point.value);

    const minimum = Math.min(...values);
    const maximum = Math.max(...values);

    const range = maximum - minimum || 1;

    const xPosition = index => {
        if (data.length === 1) return width / 2;

        return padding +
            (index / (data.length - 1)) *
            (width - padding * 2);
    };

    const yPosition = value => {
        return height - padding -
            ((value - minimum) / range) *
            (height - padding * 2);
    };

    const svg = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
    );

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("role", "img");
    svg.setAttribute(
        "aria-label",
        selectedAsset
            ? "Selected asset value history"
            : "Total asset value history"
    );

    const points = data.map((point, index) => {
        return `${xPosition(index)},${yPosition(point.value)}`;
    }).join(" ");

    const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "polyline"
    );

    line.setAttribute("points", points);
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", "#74e0a4");
    line.setAttribute("stroke-width", "3");
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("stroke-linejoin", "round");

    svg.appendChild(line);

    data.forEach((point, index) => {
        const circle = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "circle"
        );

        circle.setAttribute("cx", xPosition(index));
        circle.setAttribute("cy", yPosition(point.value));
        circle.setAttribute("r", "5");
        circle.setAttribute("fill", "#74e0a4");

        const previousValue =
            index > 0 ? data[index - 1].value : null;

        const difference = previousValue === null
            ? "First recorded value"
            : money(point.value - previousValue);

        const tooltip = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "title"
        );

        tooltip.textContent =
            `${formatDateTime(point.date)}\n` +
            `Value: ${money(point.value)}\n` +
            `Difference: ${difference}`;

        circle.appendChild(tooltip);
        svg.appendChild(circle);
    });

    container.appendChild(svg);

    const latest = data[data.length - 1];

    const summary = document.createElement("p");
    summary.textContent =
        `Latest recorded value: ${money(latest.value)} – ` +
        `${formatDateTime(latest.date)}`;

    container.appendChild(summary);
}


// ==========================================
// DASHBOARD
// ==========================================

function renderExpenseChart() {
    const chart = $("expenseChart");

    if (!chart) return;

    chart.replaceChildren();

    const expenses = getMonthTransactions().filter(
        item => item.transaction_type === "expense"
    );

    const categories = {};

    expenses.forEach(item => {
        const category = item.category || "Other";

        categories[category] =
            (categories[category] || 0) +
            safeNumber(item.amount);
    });

    const sorted = Object.entries(categories).sort(
        (a, b) => b[1] - a[1]
    );

    const maximum = Math.max(
        ...sorted.map(item => item[1]),
        1
    );

    if (sorted.length === 0) {
        const messageElement = document.createElement("p");
        messageElement.textContent =
            "No expenses recorded for this month.";
        chart.appendChild(messageElement);
        return;
    }

    sorted.forEach(([category, amount]) => {
        const row = document.createElement("div");
        row.className = "chart-row";

        const label = document.createElement("span");
        label.className = "chart-label";
        label.textContent = category;

        const track = document.createElement("div");
        track.className = "chart-track";

        const fill = document.createElement("div");
        fill.className = "chart-fill";

        fill.style.width =
            `${(amount / maximum) * 100}%`;

        track.appendChild(fill);

        const value = document.createElement("span");
        value.className = "chart-value";
        value.textContent = money(amount);

        row.append(label, track, value);
        chart.appendChild(row);
    });
}


function renderDashboard() {
    const monthTransactions = getMonthTransactions();

    const income = monthTransactions
        .filter(item => item.transaction_type === "income")
        .reduce((sum, item) => sum + safeNumber(item.amount), 0);

    const expenses = monthTransactions
        .filter(item => item.transaction_type === "expense")
        .reduce((sum, item) => sum + safeNumber(item.amount), 0);

    const balance = income - expenses;

    const savingsRate = income > 0
        ? (balance / income) * 100
        : 0;

    if ($("totalIncome")) {
        $("totalIncome").textContent = money(income);
    }

    if ($("totalExpenses")) {
        $("totalExpenses").textContent = money(expenses);
    }

    if ($("remainingBalance")) {
        $("remainingBalance").textContent = money(balance);
    }

    if ($("savingsRate")) {
        $("savingsRate").textContent =
            `${Math.max(0, savingsRate).toFixed(1)}%`;
    }

    renderExpenseChart();
}


// ==========================================
// REPORTS
// ==========================================

function renderReports() {
    const totalAssets = assets.reduce(
        (sum, asset) => sum + getAssetValue(asset),
        0
    );

    const totalLiabilities = 0;

    const netWorth = totalAssets - totalLiabilities;

    if ($("reportAssets")) {
        $("reportAssets").textContent = money(totalAssets);
    }

    if ($("reportLiabilities")) {
        $("reportLiabilities").textContent =
            money(totalLiabilities);
    }

    if ($("reportNetWorth")) {
        $("reportNetWorth").textContent = money(netWorth);
    }

    if ($("reportSummary")) {
        $("reportSummary").textContent =
            "This report uses your recorded assets. " +
            "Liabilities are not included because a liabilities " +
            "database table has not been connected yet.";
    }

    if ($("reportChart")) {
        $("reportChart").replaceChildren();

        const summary = document.createElement("p");
        summary.textContent =
            `Total recorded asset value: ${money(totalAssets)}`;

        $("reportChart").appendChild(summary);
    }
}


// ==========================================
// SETTINGS
// ==========================================

function renderSettings() {
    if ($("accountInformation")) {
        $("accountInformation").textContent =
            currentUser?.email || "Not signed in";
    }
}


async function signOutUser() {
    if (!window.supabaseClient) return;

    const { error } =
        await window.supabaseClient.auth.signOut();

    if (error) {
        message("authMessage", error.message);
    }
}


$("settingsSignOut")?.addEventListener(
    "click",
    signOutUser
);


// ==========================================
// RENDER EVERYTHING
// ==========================================

function renderEverything() {
    renderTransactions();
    renderBudget();
    renderSavings();
    renderAssets();
    renderDashboard();
    renderReports();
    renderSettings();
}


// ==========================================
// APP STARTUP
// ==========================================

renderEverything();

showPage("dashboard");

console.log("YASIR HUB Family Finance loaded successfully.");

}