document.addEventListener('DOMContentLoaded', async function () {
    // ==========================================
    // 1. GET LOGGED-IN USER SESSION
    // ==========================================
    const userId = sessionStorage.getItem('userId');
    const username = sessionStorage.getItem('username');
    const department = sessionStorage.getItem('department');
    const position = sessionStorage.getItem('position');

    if (!userId) {
        window.location.href = 'index.html';
        return;
    }

    const formattedUserId = userId.toUpperCase();

    // Populate Sidebar & Top Header Profile Info
    const profileName = document.getElementById('profileName');
    const profileMeta = document.getElementById('profileMeta');
    const topAvatar = document.getElementById('topAvatar');

    if (profileName) profileName.textContent = username || formattedUserId;
    if (profileMeta) profileMeta.textContent = `${position || 'Employee'} • ${department || ''}`;
    if (topAvatar) topAvatar.textContent = (username || formattedUserId).charAt(0).toUpperCase();

    const sidebarAvatarEl = document.getElementById('sidebarAvatarContainer');
    const specificAvatarKey = `userAvatar_${formattedUserId}`;

    function updateAvatarDisplay(avatarBase64) {
        if (!avatarBase64) return;
        const imgHTML = `<img src="${avatarBase64}" alt="Profile Picture" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        if (sidebarAvatarEl) sidebarAvatarEl.innerHTML = imgHTML;
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
    // 1.1 LIVE SEARCH BAR (MY REQUESTS / STATUS LIST)
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
                    let badgeBg = '#fef3c7';
                    let badgeColor = '#d97706';
                    const statusLower = (item.status || '').toLowerCase();

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

                    const searchItem = document.createElement('a');
                    searchItem.href = `request-details.html?id=${item.id}&type=${encodeURIComponent(item.type || '')}`;
                    searchItem.style.cssText = 'display: block; padding: 10px 16px; border-bottom: 1px solid #f1f5f9; text-decoration: none; color: inherit; transition: background 0.2s;';
                    searchItem.onmouseover = () => searchItem.style.background = '#f8fafc';
                    searchItem.onmouseout = () => searchItem.style.background = 'transparent';

                    searchItem.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div>
                                <div style="font-size: 13px; font-weight: 700; color: #0f172a;">${item.type || 'Request'}</div>
                                <div style="font-size: 12px; font-weight: 500; color: #64748b;">${item.form_no || ''}</div>
                                <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">${item.time || ''}</div>
                            </div>
                            <span style="font-size: 10px; padding: 2px 8px; border-radius: 10px; background: ${badgeBg}; color: ${badgeColor}; font-weight: 600; text-transform: uppercase;">
                                ${item.status || 'Pending'}
                            </span>
                        </div>
                    `;
                    searchDropdown.appendChild(searchItem);
                });
            } else {
                searchDropdown.innerHTML = `<div style="padding: 16px; text-align: center; color: #94a3b8; font-size: 13px;">No matching requests found.</div>`;
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
    // 1.2 DYNAMIC NOTIFICATION & REMINDER SYSTEM
    // ==========================================
    const notiBellBtn = document.getElementById('notificationBell');
    const notiDropdown = document.getElementById('notificationDropdown');
    const notiList = document.getElementById('notificationList');
    const notiBadge = document.getElementById('notificationBadge');

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

    let previousNotiState = {};

    function getStatusInfo(item) {
        if (item.is_reminder) {
            return { cardClass: 'status-reminder', badgeBg: '#fee2e2', badgeColor: '#b91c1c' };
        }
        const s = (item.status || '').toLowerCase();
        if (s.includes('approve') || s === 'completed' || s === 'processed') {
            return { cardClass: 'status-approved', badgeBg: '#dcfce7', badgeColor: '#15803d' };
        }
        if (s.includes('reject')) {
            return { cardClass: 'status-rejected', badgeBg: '#fee2e2', badgeColor: '#b91c1c' };
        }
        if (s.includes('revision') || s.includes('review')) {
            return { cardClass: 'status-review', badgeBg: '#dbeafe', badgeColor: '#1d4ed8' };
        }
        return { cardClass: 'status-pending', badgeBg: '#fef3c7', badgeColor: '#b45309' };
    }

    async function fetchNotifications() {
        const currentUserId = formattedUserId || 'EMP001';
        try {
            const response = await fetch(`http://localhost:3000/api/notifications?employee_id=${encodeURIComponent(currentUserId)}&department=${encodeURIComponent(department || '')}&position=${encodeURIComponent(position || '')}`);
            const data = await response.json();

            if (data.success && data.notifications && data.notifications.length > 0) {
                const unreadNotifications = data.notifications.filter(item => 
                    item.is_reminder || (item.status || '').toLowerCase().includes('pending')
                );
                const unreadCount = unreadNotifications.length;

                let hasNewOrChanged = false;
                const nextState = {};

                if (notiList) {
                    notiList.innerHTML = '';

                    data.notifications.forEach(item => {
                        const statusLower = (item.status || '').toLowerCase();
                        const { cardClass, badgeBg, badgeColor } = getStatusInfo(item);

                        let statusTitle = `${item.type || 'Form'} Pending Review`;
                        if (item.is_reminder) {
                            statusTitle = item.message || `🔔 Reminder: ${item.type || 'Form'} Pending`;
                        } else if (statusLower.includes('approve') || statusLower === 'completed') {
                            statusTitle = `${item.type || 'Form'} Approved`;
                        } else if (statusLower.includes('reject')) {
                            statusTitle = `${item.type || 'Form'} Rejected`;
                        } else if (statusLower.includes('revision')) {
                            statusTitle = `${item.type || 'Form'} Needs Revision`;
                        }

                        const itemKey = `${item.type || 'Form'}-${item.form_no || item.id}-${item.is_reminder ? 'rem' : statusLower}`;
                        const isChanged = previousNotiState[itemKey] !== undefined && previousNotiState[itemKey] !== statusLower;
                        const isBrandNew = previousNotiState[itemKey] === undefined && Object.keys(previousNotiState).length > 0;
                        
                        if (isChanged || isBrandNew) hasNewOrChanged = true;
                        nextState[itemKey] = statusLower;

                        const notiItem = document.createElement('a');
                        notiItem.href = `request-details.html?id=${item.id}&type=${encodeURIComponent(item.type || '')}`;
                        notiItem.className = `noti-card ${cardClass} ${(isChanged || isBrandNew) ? 'noti-new' : ''}`;

                        notiItem.innerHTML = `
                            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                <div>
                                    <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">${statusTitle}</div>
                                    <div style="font-size: 13px; font-weight: 500; color: #64748b;">${item.form_no || ''}</div>
                                    <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">${item.time || ''}</div>
                                </div>
                                <span style="font-size: 11px; padding: 3px 10px; border-radius: 12px; background: ${badgeBg}; color: ${badgeColor}; font-weight: 700; text-transform: uppercase;">
                                    ${item.is_reminder ? 'Reminder' : (item.status || 'Pending')}
                                </span>
                            </div>
                        `;
                        notiList.appendChild(notiItem);
                    });

                    previousNotiState = nextState;
                }

                if (notiBadge) {
                    if (unreadCount > 0) {
                        notiBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                        notiBadge.style.display = 'flex';
                        notiBadge.classList.add('has-unread');
                    } else {
                        notiBadge.style.display = 'none';
                        notiBadge.textContent = '0';
                        notiBadge.classList.remove('has-unread');
                    }

                    if (hasNewOrChanged) {
                        notiBadge.classList.remove('noti-badge-pop');
                        void notiBadge.offsetWidth;
                        notiBadge.classList.add('noti-badge-pop');
                        if (notiBellBtn) {
                            notiBellBtn.classList.remove('noti-bell-shake');
                            void notiBellBtn.offsetWidth;
                            notiBellBtn.classList.add('noti-bell-shake');
                        }
                    }
                }
            } else {
                if (notiBadge) notiBadge.style.display = 'none';
                if (notiList) {
                    notiList.innerHTML = `<div style="padding: 16px; text-align: center; color: #94a3b8; font-size: 13px;">No requested forms found.</div>`;
                }
                previousNotiState = {};
            }
        } catch (err) {
            console.error('Error fetching notifications:', err);
        }
    }

    fetchNotifications();
    setInterval(fetchNotifications, 5000);

    const refreshNotiBtn = document.getElementById('refreshNotiBtn');
    if (refreshNotiBtn) {
        refreshNotiBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            fetchNotifications();
        });
    }

    // ==========================================
    // 2. AUTO-FILL EMPLOYEE & SALARY DATA
    // ==========================================
    const empIdInput = document.getElementById('employee-id');
    const empNameInput = document.getElementById('employee-name');
    const deptInput = document.getElementById('department');
    const salaryInput = document.getElementById('monthly-salary');

    if (empIdInput) empIdInput.value = formattedUserId;
    if (empNameInput) empNameInput.value = username || '';
    if (deptInput) deptInput.value = department || '';

    try {
        const response = await fetch(`http://localhost:3000/api/profile/${encodeURIComponent(formattedUserId)}`);
        const result = await response.json();

        if (result.success && result.data) {
            const basicSalary = parseFloat(result.data.salary) || 0.00;
            if (salaryInput) {
                salaryInput.value = basicSalary.toFixed(2);
                salaryInput.readOnly = true;
            }
        }
    } catch (err) {
        console.error('Failed to fetch user profile salary:', err);
    }

    // ==========================================
    // 3. DYNAMIC INSTALLMENT CALCULATOR
    // ==========================================
    const repaymentPeriodSelect = document.getElementById('repayment-period');
    const amountRequestedInput = document.getElementById('amount-requested');
    const installmentDisplay = document.getElementById('estimatedInstallmentDisplay');

    function calculateInstallment() {
        const months = parseInt(repaymentPeriodSelect.value, 10) || 0;
        const amount = parseFloat(amountRequestedInput.value) || 0;

        if (months > 0 && amount > 0) {
            const monthlyPayment = amount / months;
            installmentDisplay.textContent = `RM ${monthlyPayment.toFixed(2)}`;
        } else {
            installmentDisplay.textContent = 'RM 0.00';
        }
    }

    if (repaymentPeriodSelect) repaymentPeriodSelect.addEventListener('change', calculateInstallment);
    if (amountRequestedInput) amountRequestedInput.addEventListener('input', calculateInstallment);

    // ==========================================
    // 4. FILE UPLOAD DROPZONE LOGIC
    // ==========================================
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const browseLink = document.getElementById('browse-link');
    const fileNameDisplay = document.getElementById('file-name');

    if (browseLink && fileInput) {
        browseLink.addEventListener('click', (e) => {
            e.preventDefault();
            fileInput.click();
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                fileNameDisplay.textContent = `Attached: ${fileInput.files[0].name}`;
            } else {
                fileNameDisplay.textContent = '';
            }
        });
    }

    if (dropzone) {
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = '#0284c7';
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.style.borderColor = '#cbd5e1';
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = '#cbd5e1';
            if (e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
                fileNameDisplay.textContent = `Attached: ${fileInput.files[0].name}`;
            }
        });
    }

    // ==========================================
    // 5. DRAFT RESTORATION & AUTO-SAVE
    // ==========================================
    const loanForm = document.getElementById('loanForm');
    const draftNotice = document.getElementById('draftNotice');
    const DRAFT_KEY = `loan_draft_${formattedUserId}`;

    function saveDraft() {
        const draftData = {
            loanType: document.getElementById('loan-type').value,
            repaymentPeriod: document.getElementById('repayment-period').value,
            amountRequested: document.getElementById('amount-requested').value,
            disbursementMethod: document.getElementById('disbursement-method').value,
            accountHolder: document.getElementById('account-holder').value,
            accountNumber: document.getElementById('account-number').value,
            bankDetails: document.getElementById('bank-details').value
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
    }

    function restoreDraft() {
        const savedDraft = localStorage.getItem(DRAFT_KEY);
        if (savedDraft) {
            try {
                const draft = JSON.parse(savedDraft);
                if (draft.loanType) document.getElementById('loan-type').value = draft.loanType;
                if (draft.repaymentPeriod) document.getElementById('repayment-period').value = draft.repaymentPeriod;
                if (draft.amountRequested) document.getElementById('amount-requested').value = draft.amountRequested;
                if (draft.disbursementMethod) document.getElementById('disbursement-method').value = draft.disbursementMethod;
                if (draft.accountHolder) document.getElementById('account-holder').value = draft.accountHolder;
                if (draft.accountNumber) document.getElementById('account-number').value = draft.accountNumber;
                if (draft.bankDetails) document.getElementById('bank-details').value = draft.bankDetails;

                calculateInstallment();
                if (draftNotice) draftNotice.style.display = 'block';
            } catch (e) {
                console.error('Error parsing draft data:', e);
            }
        }
    }

    restoreDraft();

    loanForm.querySelectorAll('input, select').forEach(element => {
        if (!element.readOnly) {
            element.addEventListener('change', saveDraft);
            element.addEventListener('input', saveDraft);
        }
    });

    // ==========================================
    // 6. FORM SUBMISSION TO API
    // ==========================================
    const errorBanner = document.getElementById('errorBanner');

    loanForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (errorBanner) errorBanner.style.display = 'none';

        const formData = new FormData();
        formData.append('employee_id', formattedUserId);
        formData.append('employee_name', username || '');
        formData.append('department', department || '');
        formData.append('loan_type', document.getElementById('loan-type').value);
        formData.append('repayment_period', document.getElementById('repayment-period').value);
        formData.append('monthly_salary', salaryInput.value || '0.00');
        formData.append('amount_requested', document.getElementById('amount-requested').value);
        formData.append('disbursement_method', document.getElementById('disbursement-method').value);
        formData.append('account_holder', document.getElementById('account-holder').value);
        formData.append('account_number', document.getElementById('account-number').value);
        formData.append('bank_details', document.getElementById('bank-details').value);

        if (fileInput && fileInput.files.length > 0) {
            formData.append('attachment', fileInput.files[0]);
        }

        try {
            const response = await fetch('http://localhost:3000/api/submit-loan', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                localStorage.removeItem(DRAFT_KEY);
                alert('Loan application submitted successfully!');
                fetchNotifications();
                window.location.href = 'my-request.html';
            } else {
                showError(result.message || 'Failed to submit loan application.');
            }
        } catch (err) {
            console.error('Submission error:', err);
            showError('Server connection error. Please ensure Node.js server is running.');
        }
    });

    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to cancel? Unsaved changes will be cleared.')) {
                localStorage.removeItem(DRAFT_KEY);
                window.location.href = 'dashboard.html';
            }
        });
    }

    function showError(msg) {
        if (errorBanner) {
            errorBanner.textContent = msg;
            errorBanner.style.display = 'block';
        } else {
            alert(msg);
        }
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