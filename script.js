/**
 * FinFlow — Glassmorphic Expense Tracker
 * Modular Vanilla JS Architecture
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Application State ---
    let transactions = JSON.parse(localStorage.getItem('finflow_transactions')) || [];
    let isEditing = false;

    // Preset Categories mapping with FontAwesome icons
    const CATEGORIES = {
        expense: [
            { id: 'food', name: 'Food & Dining', icon: 'fa-utensils' },
            { id: 'shopping', name: 'Shopping', icon: 'fa-bag-shopping' },
            { id: 'transport', name: 'Transportation', icon: 'fa-car' },
            { id: 'bills', name: 'Bills & Utilities', icon: 'fa-file-invoice-dollar' },
            { id: 'entertainment', name: 'Entertainment', icon: 'fa-film' },
            { id: 'other_expense', name: 'Other Expense', icon: 'fa-ellipsis' }
        ],
        income: [
            { id: 'salary', name: 'Salary', icon: 'fa-money-bill-wave' },
            { id: 'freelance', name: 'Freelance Work', icon: 'fa-laptop-code' },
            { id: 'investments', name: 'Investments', icon: 'fa-chart-line' },
            { id: 'other_income', name: 'Other Income', icon: 'fa-wallet' }
        ]
    };

    // --- DOM Elements ---
    const elements = {
        loadingOverlay: document.getElementById('loading-overlay'),
        form: document.getElementById('transaction-form'),
        formTitle: document.getElementById('form-title'),
        idInput: document.getElementById('transaction-id'),
        descriptionInput: document.getElementById('description'),
        amountInput: document.getElementById('amount'),
        dateInput: document.getElementById('date'),
        categorySelect: document.getElementById('category'),
        submitBtn: document.getElementById('submit-btn'),
        cancelEditBtn: document.getElementById('cancel-edit-btn'),
        
        // Summary Displays
        totalBalance: document.getElementById('total-balance'),
        totalIncome: document.getElementById('total-income'),
        totalExpenses: document.getElementById('total-expenses'),
        
        // History List & Filters
        transactionList: document.getElementById('transaction-list'),
        filterCategory: document.getElementById('filter-category'),
        emptyState: document.getElementById('empty-state'),
        toastContainer: document.getElementById('toast-container')
    };

    // --- Core Functions ---

    /** Initialize application defaults & event listeners */
    function init() {
        // Set default date to today's date in YYYY-MM-DD
        elements.dateInput.value = new Date().toISOString().split('T')[0];
        
        populateCategoryDropdowns();
        render();
        setupEventListeners();

        // Remove loading overlay smoothly
        setTimeout(() => {
            elements.loadingOverlay.classList.add('fade-out');
        }, 300);
    }

    /** Set up form validation listeners & button bindings */
    function setupEventListeners() {
        // Form submission
        elements.form.addEventListener('submit', handleFormSubmit);

        // Dynamic category updates on Type Toggle
        document.querySelectorAll('input[name="type"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const selectedType = document.querySelector('input[name="type"]:checked').value;
                updateCategorySelect(selectedType);
            });
        });

        // Cancel Edit Mode
        elements.cancelEditBtn.addEventListener('click', resetForm);

        // History Category Filter
        elements.filterCategory.addEventListener('change', renderTransactionList);
    }

    /** Populates the form category dropdown and historical filter dropdown */
    function populateCategoryDropdowns() {
        const allCategories = [...CATEGORIES.expense, ...CATEGORIES.income];
        
        // Render filter options
        elements.filterCategory.innerHTML = '<option value="all">All Categories</option>';
        allCategories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = cat.name;
            elements.filterCategory.appendChild(opt);
        });

        // Default category select options (Expense)
        updateCategorySelect('expense');
    }

    /** Updates form category select dynamically based on Expense or Income */
    function updateCategorySelect(type) {
        elements.categorySelect.innerHTML = '<option value="" disabled selected>Select category</option>';
        CATEGORIES[type].forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = cat.name;
            elements.categorySelect.appendChild(opt);
        });
    }

    /** Handles new submission or editing existing record */
    function handleFormSubmit(e) {
        e.preventDefault();

        if (!validateForm()) return;

        const type = document.querySelector('input[name="type"]:checked').value;
        const description = elements.descriptionInput.value.trim();
        const amount = parseFloat(elements.amountInput.value);
        const date = elements.dateInput.value;
        const category = elements.categorySelect.value;

        if (isEditing) {
            const id = elements.idInput.value;
            transactions = transactions.map(item => 
                item.id === id ? { id, type, description, amount, date, category } : item
            );
            showToast('Transaction updated successfully', 'success');
        } else {
            const newTransaction = {
                id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
                type,
                description,
                amount,
                date,
                category
            };
            transactions.unshift(newTransaction);
            showToast('Transaction added successfully', 'success');
        }

        saveToLocalStorage();
        resetForm();
        render();
    }

    /** Performs complete validation on input fields */
    function validateForm() {
        let isValid = true;

        // Reset errors
        document.querySelectorAll('.form-group').forEach(group => group.classList.remove('invalid'));

        // Validate Description
        if (elements.descriptionInput.value.trim() === '') {
            showFieldError(elements.descriptionInput);
            isValid = false;
        }

        // Validate Amount
        const amountVal = parseFloat(elements.amountInput.value);
        if (isNaN(amountVal) || amountVal <= 0) {
            showFieldError(elements.amountInput);
            isValid = false;
        }

        // Validate Date
        if (!elements.dateInput.value) {
            showFieldError(elements.dateInput);
            isValid = false;
        }

        // Validate Category selection
        if (!elements.categorySelect.value) {
            showFieldError(elements.categorySelect);
            isValid = false;
        }

        return isValid;
    }

    function showFieldError(inputElement) {
        inputElement.closest('.form-group').classList.add('invalid');
    }

    /** Calculate Totals and refresh application view */
    function render() {
        calculateSummary();
        renderTransactionList();
    }

    /** Calculates Balance, Total Income, and Total Expense */
    function calculateSummary() {
        const income = transactions
            .filter(t => t.type === 'income')
            .reduce((acc, t) => acc + t.amount, 0);

        const expense = transactions
            .filter(t => t.type === 'expense')
            .reduce((acc, t) => acc + t.amount, 0);

        const balance = income - expense;

        elements.totalBalance.textContent = formatCurrency(balance);
        elements.totalIncome.textContent = `+${formatCurrency(income)}`;
        elements.totalExpenses.textContent = `-${formatCurrency(expense)}`;
    }

    /** Renders the transaction history with active filter */
    function renderTransactionList() {
        const selectedFilter = elements.filterCategory.value;
        const filteredList = selectedFilter === 'all' 
            ? transactions 
            : transactions.filter(t => t.category === selectedFilter);

        elements.transactionList.innerHTML = '';

        if (filteredList.length === 0) {
            elements.emptyState.classList.add('visible');
        } else {
            elements.emptyState.classList.remove('visible');

            filteredList.forEach(item => {
                const li = document.createElement('li');
                li.className = `item ${item.type}`;
                
                const catObj = getCategoryMeta(item.category);
                
                li.innerHTML = `
                    <div class="item-info">
                        <div class="item-icon">
                            <i class="fa-solid ${catObj.icon}"></i>
                        </div>
                        <div class="item-details">
                            <h4>${escapeHTML(item.description)}</h4>
                            <span>
                                <span>${catObj.name}</span> • 
                                <span>${formatDate(item.date)}</span>
                            </span>
                        </div>
                    </div>
                    <div class="item-right">
                        <span class="item-amount ${item.type === 'income' ? 'text-success' : 'text-danger'}">
                            ${item.type === 'income' ? '+' : '-'}${formatCurrency(item.amount)}
                        </span>
                        <div class="item-actions">
                            <button class="action-btn edit-btn" onclick="editTransaction('${item.id}')" title="Edit">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button class="action-btn delete-btn" onclick="deleteTransaction('${item.id}')" title="Delete">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </div>
                `;
                elements.transactionList.appendChild(li);
            });
        }
    }

    /** Populate edit mode with existing item values */
    window.editTransaction = function(id) {
        const target = transactions.find(t => t.id === id);
        if (!target) return;

        isEditing = true;
        elements.idInput.value = target.id;
        
        // Set type toggle
        document.querySelector(`input[name="type"][value="${target.type}"]`).checked = true;
        updateCategorySelect(target.type);

        elements.descriptionInput.value = target.description;
        elements.amountInput.value = target.amount;
        elements.dateInput.value = target.date;
        elements.categorySelect.value = target.category;

        // UI Adjustments for Edit Mode
        elements.formTitle.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Transaction';
        elements.submitBtn.innerHTML = '<i class="fa-solid fa-check-circle"></i> Update Transaction';
        elements.cancelEditBtn.classList.remove('hidden');

        elements.descriptionInput.focus();
    };

    /** Deletes transaction item by ID */
    window.deleteTransaction = function(id) {
        if (confirm('Are you sure you want to delete this transaction?')) {
            transactions = transactions.filter(t => t.id !== id);
            saveToLocalStorage();
            render();
            showToast('Transaction deleted', 'danger');

            if (isEditing && elements.idInput.value === id) {
                resetForm();
            }
        }
    };

    /** Reset form back to default state */
    function resetForm() {
        isEditing = false;
        elements.form.reset();
        elements.idInput.value = '';
        
        // Reset category select to expense default
        document.getElementById('type-expense').checked = true;
        updateCategorySelect('expense');

        elements.dateInput.value = new Date().toISOString().split('T')[0];
        
        elements.formTitle.innerHTML = '<i class="fa-solid fa-circle-plus"></i> Add Transaction';
        elements.submitBtn.innerHTML = '<i class="fa-solid fa-plus-circle"></i> Save Transaction';
        elements.cancelEditBtn.classList.add('hidden');

        document.querySelectorAll('.form-group').forEach(group => group.classList.remove('invalid'));
    }

    // --- Helper Utilities ---

    function getCategoryMeta(categoryId) {
        const allCategories = [...CATEGORIES.expense, ...CATEGORIES.income];
        return allCategories.find(c => c.id === categoryId) || { name: 'General', icon: 'fa-receipt' };
    }

    function formatCurrency(num) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(num);
    }

    function formatDate(dateStr) {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateStr).toLocaleDateString(undefined, options);
    }

    function saveToLocalStorage() {
        localStorage.setItem('finflow_transactions', JSON.stringify(transactions));
    }

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i>
            <span>${message}</span>
        `;
        
        elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }

    // Initialize App
    init();
});