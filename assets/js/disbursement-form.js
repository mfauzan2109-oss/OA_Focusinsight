document.addEventListener('DOMContentLoaded', async function () {
            const userId = sessionStorage.getItem('userId');
            const username = sessionStorage.getItem('username');
            const department = sessionStorage.getItem('department');
            const position = sessionStorage.getItem('position');

            if (!userId) {
                alert("Please log in first.");
                window.location.href = 'index.html';
                return;
            }

            const formattedUserId = userId.toUpperCase();

            const profileName = document.getElementById('sidebarName');
            const profileMeta = document.getElementById('sidebarMeta');
            const topAvatar = document.getElementById('topAvatar');
            const empIdInput = document.getElementById('empIdInput');
            const empNameInput = document.getElementById('empNameInput');
            const empDeptInput = document.getElementById('empDeptInput');

            if (profileName) profileName.textContent = username || formattedUserId;
            if (profileMeta) profileMeta.textContent = `${formattedUserId} • ${department || 'General'}`;
            
            if (topAvatar) {
                const initials = (username || formattedUserId).split(' ').map(n => n.charAt(0)).join('').substring(0, 2).toUpperCase();
                topAvatar.textContent = initials;
            }
            if (empIdInput) empIdInput.value = formattedUserId;
            if (empNameInput) empNameInput.value = username || '';
            if (empDeptInput) empDeptInput.value = department || 'General';

            const specificAvatarKey = `userAvatar_${formattedUserId}`;

            function updateAvatarDisplay(avatarBase64) {
                if (!avatarBase64) return;
                const imgHTML = `<img src="${avatarBase64}" alt="Profile Picture" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
                const sidebarAvatar = document.getElementById('sidebarAvatarContainer');
                if (sidebarAvatar) sidebarAvatar.innerHTML = imgHTML;
                if (topAvatar) topAvatar.innerHTML = imgHTML;
            }

            const savedAvatar = localStorage.getItem(specificAvatarKey);
            updateAvatarDisplay(savedAvatar);

            window.addEventListener('storage', function(e) {
                if (e.key === specificAvatarKey) {
                    updateAvatarDisplay(e.newValue);
                }
            });

            checkApprovalQueueAccess(formattedUserId, department, position);

            // ==========================================
            // SEARCH BAR LOGIC
            // ==========================================
            const searchInput = document.getElementById('searchInput');
            const searchDropdown = document.getElementById('searchDropdown');
            let userRequestsCache = [];

            async function fetchUserRequestsForSearch() {
                try {
                    const response = await fetch(`http://localhost:3000/api/notifications?employee_id=${encodeURIComponent(formattedUserId)}&department=${encodeURIComponent(department || '')}&position=${encodeURIComponent(position || '')}`);
                    const data = await response.json();
                    if (data.success && data.notifications) {
                        userRequestsCache = data.notifications;
                    }
                } catch (err) {
                    console.error('Error fetching requests for search:', err);
                }
            }

            fetchUserRequestsForSearch();

            if (searchInput && searchDropdown) {
                searchInput.addEventListener('input', (e) => {
                    const query = e.target.value.toLowerCase().trim();

                    if (query === '') {
                        searchDropdown.classList.remove('active');
                        return;
                    }

                    const filtered = userRequestsCache.filter(item => {
                        const type = (item.type || '').toLowerCase();
                        const formNo = (item.form_no || '').toLowerCase();
                        const status = (item.status || '').toLowerCase();
                        return type.includes(query) || formNo.includes(query) || status.includes(query);
                    });

                    searchDropdown.innerHTML = '';

                    if (filtered.length > 0) {
                        filtered.forEach(item => {
                            const statusLower = (item.status || '').toLowerCase();
                            let badgeBg = '#fef3c7';
                            let badgeColor = '#d97706';

                            if (statusLower.includes('approve') || statusLower === 'completed') {
                                badgeBg = '#dcfce7';
                                badgeColor = '#15803d';
                            } else if (statusLower.includes('reject')) {
                                badgeBg = '#fee2e2';
                                badgeColor = '#b91c1c';
                            } else if (statusLower.includes('revision')) {
                                badgeBg = '#e0f2fe';
                                badgeColor = '#0284c7';
                            }

                            const searchItem = document.createElement('div');
                            searchItem.className = 'noti-card status-pending';
                            searchItem.style.marginBottom = '6px';

                            searchItem.innerHTML = `
                                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                    <div>
                                        <div style="font-size: 13px; font-weight: 700; color: #0f172a;">${item.type || 'Request'} Form</div>
                                        <div style="font-size: 12px; font-weight: 600; color: #334155;">Form No: ${item.form_no || ''}</div>
                                        <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${item.time || ''}</div>
                                    </div>
                                    <span style="font-size: 10px; padding: 2px 8px; border-radius: 10px; background: ${badgeBg}; color: ${badgeColor}; font-weight: 700; text-transform: uppercase;">
                                        ${item.status || 'Pending'}
                                    </span>
                                </div>
                            `;

                            searchItem.addEventListener('click', () => {
                                searchDropdown.classList.remove('active');
                                const reqId = item.id || item.form_id || item.form_no;
                                const reqType = item.type || 'Disbursement';
                                window.location.href = `request-details.html?id=${encodeURIComponent(reqId)}&type=${encodeURIComponent(reqType)}`;
                            });

                            searchDropdown.appendChild(searchItem);
                        });
                    } else {
                        searchDropdown.innerHTML = `<div style="padding: 16px; text-align: center; color: #94a3b8; font-size: 13px;">No matching forms found.</div>`;
                    }

                    searchDropdown.classList.add('active');
                });

                document.addEventListener('click', (e) => {
                    if (!searchDropdown.contains(e.target) && !searchInput.contains(e.target)) {
                        searchDropdown.classList.remove('active');
                    }
                });
            }

            // ==========================================
            // NOTIFICATION SYSTEM — matched to leave.html
            // ==========================================
            const notiBellBtn = document.getElementById('notiBellBtn');
            const notiDropdown = document.getElementById('notiDropdown');
            const notiList = document.getElementById('notiList');
            const notiBadge = document.getElementById('notiBadge');
            const refreshNotiBtn = document.getElementById('refreshNotiBtn');

            if (notiBellBtn && notiDropdown) {
                notiBellBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    notiDropdown.classList.toggle('active');
                    if (notiDropdown.classList.contains('active')) {
                        fetchNotifications();
                    }
                });

                document.addEventListener('click', (e) => {
                    if (!notiDropdown.contains(e.target) && !notiBellBtn.contains(e.target)) {
                        notiDropdown.classList.remove('active');
                    }
                });

                notiDropdown.addEventListener('click', (e) => e.stopPropagation());
            }

            async function fetchNotifications() {
                try {
                    const response = await fetch(`http://localhost:3000/api/notifications?employee_id=${encodeURIComponent(formattedUserId)}&department=${encodeURIComponent(department || '')}&position=${encodeURIComponent(position || '')}`);
                    const data = await response.json();

                    if (data.success && data.notifications && data.notifications.length > 0) {
                        const unreadCount = data.notifications.filter(item => 
                            item.is_reminder || (item.status || '').toLowerCase().includes('pending')
                        ).length;

                        if (notiList) {
                            notiList.innerHTML = '';
                            data.notifications.forEach(item => {
                                const statusLower = (item.status || '').toLowerCase();
                                let cardClass = 'status-pending';
                                let pillClass = 'pending';

                                if (item.is_reminder) {
                                    cardClass = 'status-reminder';
                                    pillClass = 'reminder';
                                } else if (statusLower.includes('approve') || statusLower === 'completed') {
                                    cardClass = 'status-approved';
                                    pillClass = 'approved';
                                } else if (statusLower.includes('reject')) {
                                    cardClass = 'status-rejected';
                                    pillClass = 'rejected';
                                } else if (statusLower.includes('revision') || statusLower.includes('review')) {
                                    cardClass = 'status-review';
                                    pillClass = 'review';
                                }

                                const title = item.is_reminder
                                    ? `🔔 ${item.message || (item.employee_name || 'Someone') + ': Reminder sent'}`
                                    : `${item.type || 'Form'} (${item.form_no || ''})`;

                                const notiItem = document.createElement('a');
                                notiItem.href = `request-details.html?id=${encodeURIComponent(item.id || item.form_id || item.form_no)}&type=${encodeURIComponent(item.type || '')}`;
                                notiItem.className = `noti-card ${cardClass}`;

                                notiItem.innerHTML = `
                                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                                        <div>
                                            <p class="noti-card-title">${title}</p>
                                            <p class="noti-card-formno">${item.message && !item.is_reminder ? item.message : 'Form No: ' + (item.form_no || '')}</p>
                                            <p class="noti-card-date">${item.time || ''}</p>
                                        </div>
                                        <span class="noti-status-pill ${pillClass}">${item.is_reminder ? 'Reminder' : (item.status || 'Pending').toUpperCase()}</span>
                                    </div>
                                `;
                                notiList.appendChild(notiItem);
                            });
                        }

                        if (notiBadge) {
                            if (unreadCount > 0) {
                                notiBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                                notiBadge.style.display = 'flex';
                                notiBadge.classList.remove('noti-badge-pop');
                                void notiBadge.offsetWidth;
                                notiBadge.classList.add('noti-badge-pop');
                                if (notiBellBtn) {
                                    notiBellBtn.classList.remove('noti-bell-shake');
                                    void notiBellBtn.offsetWidth;
                                    notiBellBtn.classList.add('noti-bell-shake');
                                }
                            } else {
                                notiBadge.style.display = 'none';
                            }
                        }

                    } else {
                        if (notiBadge) notiBadge.style.display = 'none';
                        if (notiList) {
                            notiList.innerHTML = `<div style="padding: 16px; text-align: center; color: #94a3b8; font-size: 13px;">No notifications found.</div>`;
                        }
                    }
                } catch (err) {
                    console.error('Error fetching notifications:', err);
                    if (notiBadge) notiBadge.style.display = 'none';
                    if (notiList) {
                        notiList.innerHTML = `<div style="padding: 16px; text-align: center; color: #ef4444; font-size: 13px;">Error fetching notifications.</div>`;
                    }
                }
            }

            if (refreshNotiBtn) {
                refreshNotiBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    fetchNotifications();
                });
            }

            fetchNotifications();
            setInterval(fetchNotifications, 5000);

            // ==========================================
            // FORM TABLE & DRAFT LOGIC
            // ==========================================
            const tableBody = document.querySelector('#expensesTable tbody');
            const addRowBtn = document.getElementById('addRowBtn');
            const totalClaimInput = document.getElementById('totalClaimAmount');
            const form = document.getElementById('disbursementForm');

            function calculateTotal() {
                let total = 0;
                const amountFields = document.querySelectorAll('.amount-field');
                amountFields.forEach(field => {
                    const val = parseFloat(field.value);
                    if (!isNaN(val)) total += val;
                });
                totalClaimInput.value = total.toFixed(2);
            }

            function reindexRows() {
                const rows = tableBody.querySelectorAll('tr');
                rows.forEach((row, index) => {
                    const numCell = row.querySelector('.row-num');
                    if (numCell) numCell.textContent = index + 1;
                });
            }

            function addExpenseRow(rowNumber, data = {}) {
                const newRow = document.createElement('tr');
                newRow.innerHTML = `
                    <td class="center-align row-num">${rowNumber}</td>
                    <td><input type="date" class="inv-date" value="${data.invoice_date || ''}" required></td>
                    <td><input type="text" class="inv-no" placeholder="e.g. INV-1022" value="${data.invoice_no || ''}" required></td>
                    <td><input type="text" class="sup-name" placeholder="Supplier Ltd" value="${data.supplier_name || ''}" required></td>
                    <td><input type="text" class="exp-desc" placeholder="Describe the item or service" value="${data.description || ''}" required></td>
                    <td><input type="number" step="0.01" class="amount-field" placeholder="0.00" value="${data.amount || ''}" required></td>
                    <td><input type="text" class="exp-remark" placeholder="Optional remark" value="${data.remark || ''}"></td>
                    <td class="center-align">
                        <button type="button" class="btn-delete-row" title="Delete Row"><i class='bx bx-trash'></i></button>
                    </td>
                `;
                tableBody.appendChild(newRow);
            }

            const DRAFT_KEY = `draft_${formattedUserId}_disbursementForm`;
            const draftNotice = document.getElementById('draftNotice');

            function saveFormDraft() {
                const draftData = { fields: {}, items: [] };

                const inputs = form.querySelectorAll('input:not(.expenses-table input), select, textarea');
                inputs.forEach(input => {
                    if (input.id || input.name) {
                        const key = input.id || input.name;
                        if (input.type === 'checkbox') {
                            draftData.fields[key] = input.checked;
                        } else if (input.type !== 'file' && input.type !== 'password') {
                            draftData.fields[key] = input.value;
                        }
                    }
                });

                const tableRows = form.querySelectorAll('#expensesTable tbody tr');
                tableRows.forEach(row => {
                    const item = {
                        invoice_date: row.querySelector('.inv-date')?.value || '',
                        invoice_no: row.querySelector('.inv-no')?.value || '',
                        supplier_name: row.querySelector('.sup-name')?.value || '',
                        description: row.querySelector('.exp-desc')?.value || '',
                        amount: row.querySelector('.amount-field')?.value || '',
                        remark: row.querySelector('.exp-remark')?.value || ''
                    };
                    draftData.items.push(item);
                });

                localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
            }

            function loadFormDraft() {
                const rawData = localStorage.getItem(DRAFT_KEY);
                if (!rawData) {
                    addExpenseRow(1);
                    return false;
                }

                try {
                    const draftData = JSON.parse(rawData);
                    let restored = false;

                    if (draftData.fields) {
                        Object.keys(draftData.fields).forEach(key => {
                            const element = document.getElementById(key) || document.querySelector(`[name="${key}"]`);
                            if (element && element.type !== 'file' && element.type !== 'password' && !element.readOnly) {
                                element.value = draftData.fields[key];
                                restored = true;
                            }
                        });
                    }

                    if (draftData.items && draftData.items.length > 0) {
                        tableBody.innerHTML = '';
                        draftData.items.forEach((item, idx) => {
                            addExpenseRow(idx + 1, item);
                        });
                        restored = true;
                    } else {
                        addExpenseRow(1);
                    }

                    if (restored && draftNotice) {
                        draftNotice.style.display = 'block';
                    }
                    calculateTotal();
                    return restored;
                } catch (e) {
                    console.error("Failed to load form draft:", e);
                    addExpenseRow(1);
                    return false;
                }
            }

            loadFormDraft();

            form.addEventListener('input', saveFormDraft);
            form.addEventListener('change', saveFormDraft);

            tableBody.addEventListener('input', function(e) {
                if (e.target.classList.contains('amount-field')) {
                    calculateTotal();
                }
            });

            tableBody.addEventListener('click', function(e) {
                const deleteBtn = e.target.closest('.btn-delete-row');
                if (deleteBtn) {
                    const rows = tableBody.querySelectorAll('tr');
                    if (rows.length > 1) {
                        const row = deleteBtn.closest('tr');
                        row.remove();
                        reindexRows();
                        calculateTotal();
                        saveFormDraft();
                    } else {
                        alert("The table must have at least one expense entry.");
                    }
                }
            });

            if (addRowBtn) {
                addRowBtn.addEventListener('click', function() {
                    const rowCount = tableBody.querySelectorAll('tr').length + 1;
                    addExpenseRow(rowCount);
                    saveFormDraft();
                });
            }

            const dropzone = document.getElementById('dropzone');
            const fileInput = document.getElementById('fileInput');
            const browseLink = document.getElementById('browseLink');
            const fileNameDisplay = document.getElementById('fileNameDisplay');

            if (browseLink && fileInput) {
                browseLink.addEventListener('click', function(e) {
                    e.preventDefault();
                    fileInput.click();
                });
            }

            if (dropzone && fileInput) {
                dropzone.addEventListener('click', function(e) {
                    if (e.target === dropzone || e.target.tagName === 'I' || e.target.tagName === 'P') {
                        fileInput.click();
                    }
                });

                fileInput.addEventListener('change', function() {
                    if (this.files.length > 0) {
                        fileNameDisplay.textContent = `Selected: ${this.files[0].name}`;
                    }
                });

                dropzone.addEventListener('dragover', function(e) { 
                    e.preventDefault(); 
                    this.classList.add('dragover'); 
                });
                dropzone.addEventListener('dragleave', function() { 
                    this.classList.remove('dragover'); 
                });
                dropzone.addEventListener('drop', function(e) {
                    e.preventDefault();
                    this.classList.remove('dragover');
                    if (e.dataTransfer.files.length > 0) {
                        fileInput.files = e.dataTransfer.files;
                        fileNameDisplay.textContent = `Selected: ${e.dataTransfer.files[0].name}`;
                    }
                });
            }

            form.addEventListener('submit', async function(e) {
                e.preventDefault();

                const formData = new FormData();
                formData.append('employee_id', formattedUserId);
                formData.append('employee_name', username || '');
                formData.append('department', department || 'General');
                formData.append('total_amount', totalClaimInput.value);

                if (fileInput && fileInput.files.length > 0) {
                    formData.append('attachment', fileInput.files[0]);
                }

                const itemsArray = [];
                const rows = tableBody.querySelectorAll('tr');
                
                rows.forEach(row => {
                    const dateVal = row.querySelector('.inv-date')?.value || '';
                    const noVal = row.querySelector('.inv-no')?.value || '';
                    const supVal = row.querySelector('.sup-name')?.value || '';
                    const descVal = row.querySelector('.exp-desc')?.value || '';
                    const amtVal = row.querySelector('.amount-field')?.value || '';
                    const remVal = row.querySelector('.exp-remark')?.value || '';

                    if (dateVal || noVal || supVal || descVal || amtVal) {
                        itemsArray.push({
                            invoice_date: dateVal,
                            invoice_no: noVal,
                            supplier_name: supVal,
                            description: descVal,
                            amount: amtVal,
                            remark: remVal
                        });
                    }
                });

                formData.append('items', JSON.stringify(itemsArray));

                try {
                    const response = await fetch('http://localhost:3000/api/submit-disbursement', {
                        method: 'POST',
                        body: formData
                    });
                    const result = await response.json();

                    if (result.success) {
                        localStorage.removeItem(DRAFT_KEY);
                        alert(result.message || 'Disbursement form submitted successfully!');
                        fetchNotifications();
                        window.location.href = 'my-request.html';
                    } else {
                        alert("Error: " + (result.message || 'Failed to submit disbursement form.'));
                    }
                } catch (err) {
                    console.error("Submission Error:", err);
                    alert("Failed to connect to Node.js server.");
                }
            });

            const cancelBtn = document.getElementById('cancelBtn');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', function() {
                    if (confirm('Are you sure you want to cancel? Unsaved changes will be cleared.')) {
                        localStorage.removeItem(DRAFT_KEY);
                        window.location.href = 'dashboard.html';
                    }
                });
            }
        });

        async function checkApprovalQueueAccess(userId, department, position) {
            const queueItem = document.getElementById('approvalQueueItem');
            const pos = (position || '').toLowerCase();
            const dept = (department || '').toLowerCase();

            if (pos.includes('manager') || pos.includes('ceo') || pos.includes('supervisor') || dept === 'management' || (userId || '').toUpperCase().startsWith('MGR')) {
                if (queueItem) queueItem.style.display = 'flex';
                try {
                    const res = await fetch(`http://localhost:3000/api/approval-queue?user_id=${encodeURIComponent(userId)}&department=${encodeURIComponent(department)}&position=${encodeURIComponent(position)}`);
                    const data = await res.json();
                    if (data.success && data.data) {
                        const pendingCount = data.data.filter(i => (i.status || '').toLowerCase().includes('pending')).length;
                        const badge = document.getElementById('approvalQueueBadge');
                        if (badge) {
                            if (pendingCount > 0) {
                                const wasHidden = badge.style.display === 'none' || badge.style.display === '';
                                const prevCount = badge.textContent;
                                badge.textContent = pendingCount;
                                badge.style.display = 'inline-block';
                                if (wasHidden || prevCount !== String(pendingCount)) {
                                    badge.classList.remove('noti-badge-pop');
                                    void badge.offsetWidth;
                                    badge.classList.add('noti-badge-pop');
                                }
                            } else {
                                badge.style.display = 'none';
                            }
                        }
                    }
                } catch (e) {
                    console.error('Approval queue badge check failed:', e);
                }
            }
        }
