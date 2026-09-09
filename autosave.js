/**
 * Generic Auto-Save utility for forms, including dynamic tables like Disbursement Forms.
 */

// Function to save form and dynamic table data
function saveFormDraft(formId, userId, tableBodySelector) {
    if (!userId) return;
    const storageKey = `draft_${userId}_${formId}`;
    const form = document.getElementById(formId);
    if (!form) return;

    const draftData = {
        fields: {},
        items: []
    };

    // 1. Save standard inputs/selects/textareas
    const inputs = form.querySelectorAll('input:not(.expenses-table input), select, textarea');
    inputs.forEach(input => {
        if (input.name || input.id) {
            const key = input.id || input.name;
            if (input.type === 'checkbox') {
                draftData.fields[key] = input.checked;
            } else if (input.type === 'radio') {
                if (input.checked) draftData.fields[key] = input.value;
            } else if (input.type !== 'file' && input.type !== 'password') {
                draftData.fields[key] = input.value;
            }
        }
    });

    // 2. Save dynamic table rows if selector provided
    if (tableBodySelector) {
        const tableBody = document.querySelector(tableBodySelector);
        if (tableBody) {
            const rows = tableBody.querySelectorAll('tr');
            rows.forEach(row => {
                const dateVal = row.querySelector('.inv-date')?.value || '';
                const noVal = row.querySelector('.inv-no')?.value || '';
                const supVal = row.querySelector('.sup-name')?.value || '';
                const descVal = row.querySelector('.exp-desc')?.value || '';
                const amtVal = row.querySelector('.amount-field')?.value || '';
                const remVal = row.querySelector('.exp-remark')?.value || '';

                draftData.items.push({
                    invoice_date: dateVal,
                    invoice_no: noVal,
                    supplier_name: supVal,
                    description: descVal,
                    amount: amtVal,
                    remark: remVal
                });
            });
        }
    }

    localStorage.setItem(storageKey, JSON.stringify(draftData));
}

// Function to restore form and dynamic table data
function loadFormDraft(formId, userId, tableBodySelector, createRowCallback, calculateTotalCallback) {
    if (!userId) return;
    const storageKey = `draft_${userId}_${formId}`;
    const rawData = localStorage.getItem(storageKey);
    if (!rawData) return;

    try {
        const draftData = JSON.parse(rawData);

        // 1. Restore standard inputs
        if (draftData.fields) {
            Object.keys(draftData.fields).forEach(key => {
                const element = document.getElementById(key) || document.querySelector(`[name="${key}"]`);
                if (element && element.type !== 'file' && element.type !== 'password') {
                    if (element.type === 'checkbox') {
                        element.checked = draftData.fields[key];
                    } else {
                        element.value = draftData.fields[key];
                    }
                }
            });
        }

        // 2. Restore dynamic table rows
        if (tableBodySelector && Array.isArray(draftData.items) && draftData.items.length > 0) {
            const tableBody = document.querySelector(tableBodySelector);
            if (tableBody) {
                tableBody.innerHTML = ''; // Clear default initial row
                
                draftData.items.forEach((item, index) => {
                    if (typeof createRowCallback === 'function') {
                        createRowCallback(index + 1, item);
                    }
                });

                if (typeof calculateTotalCallback === 'function') {
                    calculateTotalCallback();
                }
            }
        }
    } catch (e) {
        console.error("Failed to load form draft:", e);
    }
}

// Function to clear saved draft
function clearFormDraft(formId, userId) {
    if (!userId) return;
    const storageKey = `draft_${userId}_${formId}`;
    localStorage.removeItem(storageKey);
}