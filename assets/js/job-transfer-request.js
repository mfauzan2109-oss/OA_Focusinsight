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
    // 1.2 DYNAMIC NOTIFICATION SYSTEM
    // ==========================================
    const notiBellBtn = document.getElementById('notiBellBtn');
    const notiDropdown = document.getElementById('notiDropdown');
    const notiList = document.getElementById('notiList');
    const notiBadge = document.getElementById('notiBadge');

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
                const unreadCount = data.notifications.filter(item =>
                    item.is_reminder || (item.status || '').toLowerCase().includes('pending')
                ).length;

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

                        const notiItem = document.createElement('a');
                        notiItem.href = `request-details.html?id=${item.id}&type=${encodeURIComponent(item.type || '')}`;
                        notiItem.className = `noti-card ${cardClass}`;
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
                }

                if (notiBadge) {
                    if (unreadCount > 0) {
                        notiBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                        notiBadge.style.display = 'flex';
                    } else {
                        notiBadge.style.display = 'none';
                        notiBadge.textContent = '0';
                    }
                }
            } else {
                if (notiBadge) notiBadge.style.display = 'none';
                if (notiList) {
                    notiList.innerHTML = `<div style="padding: 16px; text-align: center; color: #94a3b8; font-size: 13px;">No requested forms found.</div>`;
                }
            }
        } catch (err) {
            console.error('Error fetching notifications:', err);
        }
    }

    fetchNotifications();

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
    const currentSalaryInput = document.getElementById('current-salary');

    if (empIdInput) empIdInput.value = formattedUserId;
    if (empNameInput) empNameInput.value = username || '';

    try {
        const response = await fetch(`http://localhost:3000/api/profile/${encodeURIComponent(formattedUserId)}`);
        const result = await response.json();

        if (result.success && result.data) {
            const basicSalary = parseFloat(result.data.salary) || 0.00;
            if (currentSalaryInput) currentSalaryInput.value = basicSalary.toFixed(2);
        }
    } catch (err) {
        console.error('Failed to fetch user profile salary:', err);
    }

    // ==========================================
    // 3. DYNAMIC TRANSFER-TYPE FIELDS
    // ==========================================
    const transferTypeSelect = document.getElementById('transfer-type');
    const fieldGroups = {
        Department: document.getElementById('departmentFields'),
        Position: document.getElementById('positionFields'),
        Location: document.getElementById('locationFields')
    };
    const dynamicInputs = {
        Department: ['current-department', 'new-department'],
        Position: ['current-position', 'new-position'],
        Location: ['current-location', 'new-location']
    };

    function updateTransferTypeFields() {
        const selected = transferTypeSelect.value;

        Object.keys(fieldGroups).forEach(type => {
            const group = fieldGroups[type];
            const isActive = type === selected;
            group.style.display = isActive ? 'grid' : 'none';

            dynamicInputs[type].forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                if (isActive) {
                    el.setAttribute('required', 'required');
                } else {
                    el.removeAttribute('required');
                    el.value = '';
                }
            });
        });
    }

    transferTypeSelect.addEventListener('change', updateTransferTypeFields);

    // ==========================================
    // 4. JOB SCOPE CHANGE TOGGLE
    // ==========================================
    const jobScopeSelect = document.getElementById('job-scope-change');
    const jobDescriptionGroup = document.getElementById('jobDescriptionGroup');
    const jobDescriptionInput = document.getElementById('job-description');

    jobScopeSelect.addEventListener('change', () => {
        if (jobScopeSelect.value === 'Yes') {
            jobDescriptionGroup.style.display = 'block';
            jobDescriptionInput.setAttribute('required', 'required');
        } else {
            jobDescriptionGroup.style.display = 'none';
            jobDescriptionInput.removeAttribute('required');
            jobDescriptionInput.value = '';
        }
    });

    // ==========================================
    // 5. FILE UPLOAD DROPZONE LOGIC
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
    // 6. FORM SUBMISSION TO API
    // ==========================================
    const jobTransferForm = document.getElementById('jobTransferForm');
    const errorBanner = document.getElementById('errorBanner');
    const acknowledgementCheckbox = document.getElementById('acknowledgement');

    function showError(msg) {
        if (errorBanner) {
            errorBanner.textContent = msg;
            errorBanner.style.display = 'block';
        } else {
            alert(msg);
        }
    }

    jobTransferForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (errorBanner) errorBanner.style.display = 'none';

        const transferType = transferTypeSelect.value;
        if (!transferType) { showError('Please select a Transfer Type.'); return; }

        if (!document.getElementById('current-supervisor').value.trim() || !document.getElementById('new-supervisor').value.trim()) {
            showError('Please provide Current and New Supervisor.'); return;
        }
        if (!document.getElementById('proposed-transfer-date').value) { showError('Please provide the Proposed Transfer Date.'); return; }
        if (!document.getElementById('reason-for-transfer').value.trim()) { showError('Please provide the Reason for Transfer.'); return; }

        const jobScopeChange = jobScopeSelect.value;
        if (!jobScopeChange) { showError('Please select whether Job Scope will change.'); return; }
        if (jobScopeChange === 'Yes' && !jobDescriptionInput.value.trim()) {
            showError('Please provide the Job Description since Job Scope Change is Yes.'); return;
        }
        if (!acknowledgementCheckbox.checked) {
            showError('Please check the acknowledgement box before submitting.'); return;
        }

        const formData = new FormData();
        formData.append('employee_id', formattedUserId);
        formData.append('employee_name', username || '');
        formData.append('transfer_type', transferType);
        formData.append('current_department', document.getElementById('current-department').value.trim());
        formData.append('new_department', document.getElementById('new-department').value.trim());
        formData.append('current_position', document.getElementById('current-position').value.trim());
        formData.append('new_position', document.getElementById('new-position').value.trim());
        formData.append('current_location', document.getElementById('current-location').value.trim());
        formData.append('new_location', document.getElementById('new-location').value.trim());
        formData.append('current_supervisor', document.getElementById('current-supervisor').value.trim());
        formData.append('new_supervisor', document.getElementById('new-supervisor').value.trim());
        formData.append('proposed_transfer_date', document.getElementById('proposed-transfer-date').value);
        formData.append('reason_for_transfer', document.getElementById('reason-for-transfer').value.trim());
        formData.append('current_salary', currentSalaryInput.value || '0.00');
        formData.append('proposed_salary', document.getElementById('proposed-salary').value || '');
        formData.append('job_scope_change', jobScopeChange);
        formData.append('job_description', jobDescriptionInput.value.trim());

        if (fileInput && fileInput.files.length > 0) {
            formData.append('attachment', fileInput.files[0]);
        }

        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        try {
            const response = await fetch('http://localhost:3000/api/submit-job-transfer', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                alert('Job transfer request submitted successfully!');
                window.location.href = 'my-request.html';
            } else {
                showError(result.message || 'Failed to submit job transfer request.');
            }
        } catch (err) {
            console.error('Submission error:', err);
            showError('Server connection error. Please ensure Node.js server is running.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit';
        }
    });

    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to cancel? Unsaved changes will be cleared.')) {
                window.location.href = 'application-center.html';
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
                        badge.textContent = pendingCount;
                        badge.style.display = 'inline-block';
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