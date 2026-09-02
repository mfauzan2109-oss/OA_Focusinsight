document.addEventListener('DOMContentLoaded', async () => {

            const CONFIG = {
                apiBaseUrl: window.APP_CONFIG?.apiBaseUrl || (window.location.origin.includes('localhost') 
                    ? 'http://localhost:3000/api' 
                    : '/api'),
                loginPage: window.APP_CONFIG?.loginPage || 'login.html',
                dashboardPage: window.APP_CONFIG?.dashboardPage || 'dashboard.html',
                endpoints: {
                    allowanceRates: '/allowance-rates',
                    submitAllowance: '/submit-travel',
                    notifications: '/notifications'
                }
            };

            const userSession = JSON.parse(localStorage.getItem('user')) || JSON.parse(sessionStorage.getItem('user')) || {};

            const currentEmployeeId = sessionStorage.getItem('userId') || localStorage.getItem('userId') || userSession.user_id || userSession.employee_id || '';
            const currentEmployeeName = sessionStorage.getItem('username') || localStorage.getItem('username') || userSession.name || userSession.username || 'Pengguna';
            const currentDepartment = sessionStorage.getItem('department') || localStorage.getItem('department') || userSession.department || 'General Department';
            
            const currentPosition = sessionStorage.getItem('position') || localStorage.getItem('position') || userSession.position || '';
            const userRole = (sessionStorage.getItem('role') || localStorage.getItem('role') || userSession.role || '').toLowerCase();

            const formattedEmployeeId = (currentEmployeeId || '').toUpperCase();

            const isManager = (currentEmployeeId && formattedEmployeeId.startsWith('MGR')) ||
                              (currentPosition && currentPosition.toLowerCase().includes('manager')) ||
                              userRole.includes('manager') ||
                              userRole.includes('admin') ||
                              userRole.includes('supervisor');

            if (!currentEmployeeId) {
                alert('Session expired or unauthorized. Please log in.');
                window.location.href = CONFIG.loginPage;
                return;
            }

            // AUTO-FILL COMPANY NAME DIRECTLY FROM DATABASE
            const companyInput = document.getElementById('company');

            async function loadUserCompany() {
                if (!currentEmployeeId) return;

                const storedCompany = sessionStorage.getItem('company_name') || localStorage.getItem('company_name') || userSession.company_name;
                
                if (storedCompany) {
                    companyInput.value = storedCompany;
                    return;
                }

                try {
                    const response = await fetch(`${CONFIG.apiBaseUrl}/profile/${encodeURIComponent(currentEmployeeId)}`);
                    const resData = await response.json();

                    if (resData.success && resData.data && resData.data.company_name) {
                        companyInput.value = resData.data.company_name;
                        sessionStorage.setItem('company_name', resData.data.company_name);
                    } else {
                        companyInput.value = 'FocusInsight'; 
                    }
                } catch (err) {
                    console.error('Failed to fetch user company from DB:', err);
                    companyInput.value = 'FocusInsight';
                }
            }

            loadUserCompany();

            // ROLE-BASED VISIBILITY FOR APPROVAL QUEUE
            const approvalQueueItem = document.getElementById('approvalQueueItem');
            if (approvalQueueItem) {
                if (isManager) {
                    approvalQueueItem.classList.remove('hidden-nav');
                } else {
                    approvalQueueItem.classList.add('hidden-nav');
                }
            }

            async function checkApprovalQueueAccess(userId, department, position) {
                const pos = (position || '').toLowerCase();
                const dept = (department || '').toLowerCase();

                if (!(pos.includes('manager') || pos.includes('ceo') || pos.includes('supervisor') || dept === 'management' || (userId || '').toUpperCase().startsWith('MGR'))) {
                    return;
                }
                try {
                    const res = await fetch(`${CONFIG.apiBaseUrl}/approval-queue?user_id=${encodeURIComponent(userId)}&department=${encodeURIComponent(department)}&position=${encodeURIComponent(position)}`);
                    const data = await res.json();
                    if (data.success && data.data) {
                        const pendingApprovalCount = data.data.filter(i => (i.status || '').toLowerCase().includes('pending')).length;
                        const badge = document.getElementById('approvalQueueBadge');
                        if (badge) {
                            if (pendingApprovalCount > 0) {
                                const wasHidden = badge.style.display === 'none' || badge.style.display === '' || badge.classList.contains('hidden-nav');
                                const prevCount = badge.textContent;
                                badge.classList.remove('hidden-nav');
                                badge.textContent = pendingApprovalCount;
                                badge.style.display = 'inline-block';
                                if (wasHidden || prevCount !== String(pendingApprovalCount)) {
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

            checkApprovalQueueAccess(currentEmployeeId, currentDepartment, currentPosition);
            setInterval(() => checkApprovalQueueAccess(currentEmployeeId, currentDepartment, currentPosition), 5000);

            const sidebarNameEl = document.getElementById('sidebarName');
            const sidebarMetaEl = document.getElementById('sidebarMeta');
            const topAvatarEl = document.getElementById('topAvatar');

            if (sidebarNameEl) sidebarNameEl.textContent = currentEmployeeName;
            if (sidebarMetaEl) sidebarMetaEl.textContent = `${formattedEmployeeId} • ${currentDepartment}`;
            
            const sidebarAvatarEl = document.getElementById('sidebarAvatarContainer');

            if (topAvatarEl) {
                const initials = currentEmployeeName
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase();
                topAvatarEl.textContent = initials || 'US';
            }

            function updateAvatarDisplay(avatarBase64) {
                if (avatarBase64) {
                    const imgHTML = `<img src="${avatarBase64}" alt="Profile Picture" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
                    if (sidebarAvatarEl) sidebarAvatarEl.innerHTML = imgHTML;
                    if (topAvatarEl) topAvatarEl.innerHTML = imgHTML;
                }
            }

            const specificAvatarKey = `userAvatar_${formattedEmployeeId}`;
            const savedAvatar = localStorage.getItem(specificAvatarKey);
            updateAvatarDisplay(savedAvatar);

            window.addEventListener('storage', function(e) {
                if (e.key === specificAvatarKey) {
                    updateAvatarDisplay(e.newValue);
                }
            });

            let currentGrandTotalAllowance = 0;
            let rates = {}; 
            let allFetchedRequests = [];

            async function fetchAllowanceRates() {
                try {
                    const response = await fetch(`${CONFIG.apiBaseUrl}${CONFIG.endpoints.allowanceRates}`);
                    if (response.ok) {
                        const data = await response.json();
                        rates = Object.keys(data).reduce((acc, key) => {
                            acc[key] = parseFloat(data[key]) || 0;
                            return acc;
                        }, {});
                        
                        if(rates.travel !== undefined) document.getElementById('rate-travel').textContent = `RM${rates.travel}`;

                        calculateAllowance();
                    } else {
                        rates = { travel: 150 };
                    }
                } catch (error) {
                    console.error('Error fetching allowance rates:', error);
                    rates = { travel: 150 };
                }
            }

            await fetchAllowanceRates();

            // AUTO-SAVE DRAFT LOGIC
            const AUTOSAVE_KEY = `travel_request_draft_${currentEmployeeId}`;
            const autosaveStatus = document.getElementById('autosaveStatus');
            const travelForm = document.getElementById('travelForm');

            function loadDraft() {
                const savedDraft = localStorage.getItem(AUTOSAVE_KEY);
                if (!savedDraft) return;

                try {
                    const draftData = JSON.parse(savedDraft);
                    for (const [key, value] of Object.entries(draftData)) {
                        if (key === 'attachment' || key === 'company') continue;
                        const field = travelForm.elements[key];
                        if (field) {
                            if (field.type === 'checkbox' || field.type === 'radio') {
                                field.checked = (field.value === value);
                            } else {
                                field.value = value;
                            }
                            field.dispatchEvent(new Event('change'));
                            field.dispatchEvent(new Event('input'));
                        }
                    }
                    calculateAllowance();
                } catch (err) {
                    console.error('Gagal memuatkan draft:', err);
                }
            }

            function saveCurrentFormDraft() {
                if (!travelForm) return;
                const formDataObj = {};
                const formData = new FormData(travelForm);
                
                formData.forEach((value, key) => {
                    if (typeof value !== 'string') return;
                    formDataObj[key] = value;
                });

                localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(formDataObj));
            }

            let autosaveTimer;
            if (travelForm) {
                travelForm.addEventListener('input', () => {
                    clearTimeout(autosaveTimer);
                    autosaveTimer = setTimeout(() => {
                        saveCurrentFormDraft();

                        if (autosaveStatus) {
                            autosaveStatus.style.display = 'flex';
                            autosaveStatus.style.opacity = '1';
                            setTimeout(() => {
                                autosaveStatus.style.opacity = '0';
                            }, 2000);
                        }
                    }, 1000);
                });

                window.addEventListener('beforeunload', () => {
                    saveCurrentFormDraft();
                });

                document.querySelectorAll('a').forEach(link => {
                    link.addEventListener('click', () => {
                        const href = link.getAttribute('href');
                        if (href && href !== '#' && !href.startsWith('javascript')) {
                            saveCurrentFormDraft();
                        }
                    });
                });
            }

            loadDraft();

            const addEmployeeBtn = document.getElementById('addEmployeeBtn');
            const employeeTableBody = document.getElementById('employeeTableBody');
            const employeeEmptyHint = document.getElementById('employeeEmptyHint');

            if (addEmployeeBtn && employeeTableBody) {
                addEmployeeBtn.addEventListener('click', () => {
                    if (employeeEmptyHint) {
                        employeeEmptyHint.style.display = 'none';
                    }

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><input type="text" class="table-input emp-id" name="emp_id[]" placeholder="Employee ID" required></td>
                        <td><input type="text" class="table-input emp-name" name="emp_name[]" placeholder="Full Name" required></td>
                        <td><input type="tel" class="table-input emp-phone" name="emp_phone[]" placeholder="Phone Number" required></td>
                        <td><input type="email" class="table-input emp-email" name="emp_email[]" placeholder="Email Address" required></td>
                        <td>
                            <select class="table-input emp-purpose" name="emp_purpose[]" required>
                                <option value="" selected disabled>Select Purpose</option>
                                <option value="Business">Business</option>
                                <option value="Training">Training</option>
                                <option value="Event">Event</option>
                            </select>
                        </td>
                        <td style="text-align: center;">
                            <button type="button" class="btn-remove-row" aria-label="Remove Row">
                                <i class='bx bx-trash'></i>
                            </button>
                        </td>
                    `;

                    tr.querySelector('.btn-remove-row').addEventListener('click', () => {
                        tr.remove();
                        if (employeeTableBody.children.length === 0 && employeeEmptyHint) {
                            employeeEmptyHint.style.display = 'block';
                        }
                        calculateAllowance();
                    });

                    employeeTableBody.appendChild(tr);
                    calculateAllowance();
                });
            }

            const travelModeSelect = document.getElementById('travel-mode');
            const travelModeOthersInput = document.getElementById('travel-mode-others');
            const contactSectionTitle = document.getElementById('contact-section-title');
            const flightDepSection = document.getElementById('flight-dep-section');
            const flightRetSection = document.getElementById('flight-ret-section');
            const hotelSection = document.getElementById('hotel-section');

            if (travelModeSelect && travelModeOthersInput) {
                travelModeSelect.addEventListener('change', () => {
                    const mode = travelModeSelect.value.toLowerCase();
                    const isOthers = mode === 'others';
                    
                    travelModeOthersInput.disabled = !isOthers;
                    travelModeOthersInput.required = isOthers;
                    
                    if (!isOthers) {
                        travelModeOthersInput.value = '';
                    } else {
                        travelModeOthersInput.focus();
                    }

                    const flightHotelSections = [flightDepSection, flightRetSection, hotelSection];

                    if (mode === 'car' || mode === 'others') {
                        if (contactSectionTitle) contactSectionTitle.textContent = 'Contact Details';
                        flightHotelSections.forEach(section => {
                            if (section) {
                                section.style.display = 'none';
                                section.querySelectorAll('input, select, textarea').forEach(input => {
                                    input.removeAttribute('required');
                                });
                            }
                        });
                    } else {
                        if (contactSectionTitle) contactSectionTitle.textContent = 'Oversea Contact Details';
                        flightHotelSections.forEach(section => {
                            if (section) {
                                section.style.display = 'block';
                                section.querySelectorAll('input, select, textarea').forEach(input => {
                                    input.setAttribute('required', 'required');
                                });
                            }
                        });
                    }
                });
            }

            const departureDateInput = document.getElementById('expected-departure');
            const returnDateInput = document.getElementById('return-date');
            const hotelNightsInput = document.getElementById('hotel-nights');

            function calculateAllowance() {
                const depDateVal = departureDateInput ? departureDateInput.value : '';
                const retDateVal = returnDateInput ? returnDateInput.value : '';
                const travellerCount = Math.max(1, employeeTableBody ? employeeTableBody.children.length : 1);
                const nights = parseInt(hotelNightsInput ? hotelNightsInput.value : 0) || 0;

                let diffDays = 0;
                if (depDateVal && retDateVal) {
                    const depDate = new Date(depDateVal);
                    const retDate = new Date(retDateVal);
                    if (retDate >= depDate) {
                        diffDays = Math.ceil((retDate - depDate) / (1000 * 60 * 60 * 24)) + 1;
                    }
                }

                if (diffDays > 0) {
                    const travelRate = rates.travel || 150;
                    const travelTotal = diffDays * travelRate * travellerCount;

                    updateMetricDisplay('travel', diffDays, travelRate * diffDays, travelTotal);

                    currentGrandTotalAllowance = travelTotal;
                } else {
                    resetAllowanceDisplay();
                    currentGrandTotalAllowance = 0;
                }
            }

            function updateMetricDisplay(prefix, daysCount, singleTotal, groupTotal) {
                const daysEl = document.getElementById(`${prefix}-days`);
                const allowEl = document.getElementById(`${prefix}-allowance`);
                const totalEl = document.getElementById(`${prefix}-total`);

                if (daysEl) daysEl.textContent = daysCount;
                if (allowEl) allowEl.textContent = `RM ${singleTotal.toFixed(2)}`;
                if (totalEl) totalEl.textContent = `RM ${groupTotal.toFixed(2)}`;
            }

            function resetAllowanceDisplay() {
                ['travel'].forEach(prefix => {
                    const daysEl = document.getElementById(`${prefix}-days`);
                    const allowEl = document.getElementById(`${prefix}-allowance`);
                    const totalEl = document.getElementById(`${prefix}-total`);

                    if (daysEl) daysEl.textContent = '0';
                    if (allowEl) allowEl.textContent = 'RM 0.00';
                    if (totalEl) totalEl.textContent = 'RM 0.00';
                });
            }

            if (departureDateInput) departureDateInput.addEventListener('change', calculateAllowance);
            if (returnDateInput) returnDateInput.addEventListener('change', calculateAllowance);
            if (hotelNightsInput) hotelNightsInput.addEventListener('input', calculateAllowance);

            const errorBanner = document.getElementById('errorBanner');
            const submitBtn = document.getElementById('submitBtn');

            if (travelForm) {
                travelForm.addEventListener('submit', async (e) => {
                    e.preventDefault();

                    if (errorBanner) {
                        errorBanner.style.display = 'none';
                        errorBanner.textContent = '';
                    }

                    if (submitBtn) {
                        submitBtn.disabled = true;
                        submitBtn.textContent = 'Submitting...';
                    }

                    try {
                        const formData = new FormData(travelForm);

                        formData.append('applicant_id', currentEmployeeId);
                        formData.append('employee_id', currentEmployeeId);
                        formData.append('employee_name', currentEmployeeName);
                        formData.append('department', currentDepartment);
                        formData.append('total_amount', currentGrandTotalAllowance.toFixed(2));

                        let travelMode = travelModeSelect?.value || '';
                        if (travelMode.toLowerCase() === 'others') {
                            travelMode = travelModeOthersInput?.value || 'Others';
                        }
                        formData.set('travel_mode', travelMode);

                        const accompanyingEmployees = [];
                        const rows = employeeTableBody ? employeeTableBody.querySelectorAll('tr') : [];

                        rows.forEach(row => {
                            const empIdVal = row.querySelector('.emp-id')?.value || '';
                            if (empIdVal) {
                                accompanyingEmployees.push({
                                    employee_id: empIdVal,
                                    name: row.querySelector('.emp-name')?.value || '',
                                    contact: row.querySelector('.emp-phone')?.value || '',
                                    email: row.querySelector('.emp-email')?.value || '',
                                    purpose: row.querySelector('.emp-purpose')?.value || 'Business trip'
                                });
                            }
                        });

                        if (accompanyingEmployees.length === 0) {
                            accompanyingEmployees.push({
                                employee_id: currentEmployeeId,
                                name: currentEmployeeName,
                                contact: document.getElementById('phone-number')?.value || '—',
                                email: '—',
                                purpose: 'Business trip'
                            });
                        }

                        formData.append('assigned_employees', JSON.stringify(accompanyingEmployees));

                        const response = await fetch(`${CONFIG.apiBaseUrl}${CONFIG.endpoints.submitAllowance}`, {
                            method: 'POST',
                            body: formData
                        });

                        const result = await response.json();

                        if (response.ok && result.success) {
                            localStorage.removeItem(AUTOSAVE_KEY);
                            alert(result.message || 'Travel Request submitted successfully!');
                            window.location.href = CONFIG.dashboardPage;
                        } else {
                            const message = result.message || 'Submission failed. Please check form inputs.';
                            if (errorBanner) {
                                errorBanner.textContent = `Error: ${message}`;
                                errorBanner.style.display = 'block';
                            } else {
                                alert(`Error: ${message}`);
                            }
                        }
                    } catch (error) {
                        console.error('Submission error:', error);
                        const networkErrorMsg = 'Failed to connect to backend server. Please verify your connection.';
                        if (errorBanner) {
                            errorBanner.textContent = networkErrorMsg;
                            errorBanner.style.display = 'block';
                        } else {
                            alert(networkErrorMsg);
                        }
                    } finally {
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.textContent = 'Submit';
                        }
                    }
                });
            }

            // ==========================================
            // REAL-TIME NOTIFICATION & REMINDER SYSTEM
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
                    const fetchUrl = `${CONFIG.apiBaseUrl}${CONFIG.endpoints.notifications}?employee_id=${encodeURIComponent(formattedEmployeeId)}&department=${encodeURIComponent(currentDepartment)}&position=${encodeURIComponent(currentPosition)}`;

                    const response = await fetch(fetchUrl);
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
                                } else if (statusLower.includes('approve') || statusLower === 'completed' || statusLower === 'processed') {
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
                                    : `${item.type || 'Travel'} (${item.form_no || ''})`;

                                const notiItem = document.createElement('a');
                                notiItem.href = `request-details.html?id=${item.id}&type=${encodeURIComponent(item.type || 'Travel')}`;
                                notiItem.className = `noti-card ${cardClass}`;

                                notiItem.innerHTML = `
                                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                                        <div>
                                            <p class="noti-card-title">${title}</p>
                                            <p class="noti-card-formno">${item.message && !item.is_reminder ? item.message : 'Form No: ' + (item.form_no || '')}</p>
                                            <p class="noti-card-date">${item.time || item.created_at || ''}</p>
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
                    if (notiList) {
                        notiList.innerHTML = `<div style="padding: 16px; text-align: center; color: #ef4444; font-size: 13px;">Unable to load notifications.</div>`;
                    }
                }
            }

            if (refreshNotiBtn) {
                refreshNotiBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    fetchNotifications();
                });
            }

            // Initial call and periodic background refresh
            fetchNotifications();
            setInterval(fetchNotifications, 5000);

            // SEARCH BAR LOGIC
            const searchBarInput = document.getElementById('searchInput');
            const searchDropdown = document.getElementById('searchDropdown');

            if (searchBarInput && searchDropdown) {
                searchBarInput.addEventListener('input', async function(e) {
                    const query = e.target.value.toLowerCase().trim();
                    if (query.length === 0) {
                        searchDropdown.style.display = 'none';
                        return;
                    }

                    searchDropdown.innerHTML = `<div style="padding: 12px; text-align: center; color: #94a3b8; font-size: 13px;">Searching requests...</div>`;
                    searchDropdown.style.display = 'block';

                    try {
                        const searchUrl = `${CONFIG.apiBaseUrl}/my-requests?employee_id=${encodeURIComponent(currentEmployeeId)}`;

                        const response = await fetch(searchUrl);
                        if (!response.ok) {
                            searchDropdown.innerHTML = `<div style="padding: 14px; text-align: center; color: #ef4444; font-size: 13px;">Unable to load search results (Error ${response.status}).</div>`;
                            return;
                        }
                        const result = await response.json();

                        const reqData = result.requests || result.data || result;
                        if (Array.isArray(reqData)) {
                            allFetchedRequests = reqData;
                            const filtered = allFetchedRequests.filter(row => {
                                const matchUser = (row.employee_id && row.employee_id.toString().trim().toLowerCase() === currentEmployeeId.toString().trim().toLowerCase());
                                const rowText = `${row.request_type || ''} REQ-${(row.request_type || '').toUpperCase()}-${row.id} ${row.status || ''} ${row.employee_name || ''} ${row.details || ''} ${row.reason || ''}`.toLowerCase();
                                return matchUser && rowText.includes(query);
                            });

                            if (filtered.length > 0) {
                                searchDropdown.innerHTML = '';
                                filtered.forEach(row => {
                                    const reqType = row.request_type || 'General';
                                    const rawStatus = (row.status || '').toString().trim().toLowerCase();

                                    let badgeBg = '#fef3c7';
                                    let badgeColor = '#d97706';
                                    
                                    if (rawStatus.includes('approve') || rawStatus === 'completed' || rawStatus === 'processed') {
                                        badgeBg = '#dcfce7';
                                        badgeColor = '#15803d';
                                    } else if (rawStatus.includes('reject')) {
                                        badgeBg = '#fee2e2';
                                        badgeColor = '#b91c1c';
                                    } else if (rawStatus.includes('revision') || rawStatus === 'in review') {
                                        badgeBg = '#fef3c7';
                                        badgeColor = '#b45309';
                                    }

                                    const itemLink = document.createElement('a');
                                    itemLink.href = `request-details.html?id=${row.id}&type=${encodeURIComponent(reqType)}`;
                                    itemLink.style.cssText = 'display: block; padding: 12px 16px; border-bottom: 1px solid #f1f5f9; text-decoration: none; color: inherit; transition: background 0.2s;';
                                    itemLink.onmouseover = () => itemLink.style.background = '#f8fafc';
                                    itemLink.onmouseout = () => itemLink.style.background = 'transparent';

                                    const displayTitle = `REQ-${reqType.toUpperCase()}-${row.id}`;
                                    const displaySubtext = `${reqType} (${row.details || row.reason || row.form_name || 'No description'})`;

                                    itemLink.innerHTML = `
                                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                            <div>
                                                <div style="font-size: 13px; font-weight: 700; color: #0f172a;">${displayTitle}</div>
                                                <div style="font-size: 12px; font-weight: 500; color: #64748b; margin-top: 2px;">${displaySubtext}</div>
                                            </div>
                                            <span style="font-size: 10px; padding: 2px 8px; border-radius: 10px; background: ${badgeBg}; color: ${badgeColor}; font-weight: 700; text-transform: uppercase;">
                                                ${row.status || 'Pending'}
                                            </span>
                                        </div>
                                    `;
                                    searchDropdown.appendChild(itemLink);
                                });
                            } else {
                                searchDropdown.innerHTML = `<div style="padding: 14px; text-align: center; color: #94a3b8; font-size: 13px;">No matching requests found.</div>`;
                            }
                        } else {
                            searchDropdown.innerHTML = `<div style="padding: 14px; text-align: center; color: #94a3b8; font-size: 13px;">No requests available.</div>`;
                        }
                    } catch (err) {
                        console.error('Search error:', err);
                        searchDropdown.innerHTML = `<div style="padding: 14px; text-align: center; color: #ef4444; font-size: 13px;">Error loading search results.</div>`;
                    }
                });

                document.addEventListener('click', (e) => {
                    if (!searchDropdown.contains(e.target) && !searchBarInput.contains(e.target)) {
                        searchDropdown.style.display = 'none';
                    }
                });

                searchDropdown.addEventListener('click', (e) => e.stopPropagation());
            }

        });
