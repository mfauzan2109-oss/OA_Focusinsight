document.addEventListener('DOMContentLoaded', async function() {
        const username = sessionStorage.getItem('username');
        const userId = sessionStorage.getItem('userId');
        const department = sessionStorage.getItem('department');
        const position = sessionStorage.getItem('position');

        if (!username || !userId) {
            window.location.href = "index.html";
            return;
        }

        const formattedUserId = userId.toUpperCase();

        // Manager Check for Sidebar Menu
        const isManager = (userId && formattedUserId.startsWith('MGR')) || 
                          (position && position.toLowerCase().includes('manager'));
        if (isManager) {
            const approvalQueueItem = document.getElementById('approvalQueueItem');
            if (approvalQueueItem) {
                approvalQueueItem.style.display = 'flex';
            }
        }

        // Indicator badge di sebelah "Approval Queue" - papar bilangan pending & auto refresh
        async function checkApprovalQueueAccess(userIdParam, departmentParam, positionParam) {
            const pos = (positionParam || '').toLowerCase();
            const dept = (departmentParam || '').toLowerCase();

            if (!(pos.includes('manager') || pos.includes('ceo') || pos.includes('supervisor') || dept === 'management' || (userIdParam || '').toUpperCase().startsWith('MGR'))) {
                return;
            }
            try {
                const res = await fetch(`http://localhost:3000/api/approval-queue?user_id=${encodeURIComponent(userIdParam)}&department=${encodeURIComponent(departmentParam)}&position=${encodeURIComponent(positionParam)}`);
                const data = await res.json();
                if (data.success && data.data) {
                    const pendingApprovalCount = data.data.filter(i => (i.status || '').toLowerCase().includes('pending')).length;
                    const badge = document.getElementById('approvalQueueBadge');
                    if (badge) {
                        if (pendingApprovalCount > 0) {
                            const wasHidden = badge.style.display === 'none' || badge.style.display === '';
                            const prevCount = badge.textContent;
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

        checkApprovalQueueAccess(userId, department, position);
        setInterval(() => checkApprovalQueueAccess(userId, department, position), 5000);

        document.getElementById('sidebarName').textContent = username;
        document.getElementById('sidebarMeta').textContent = `${formattedUserId} • ${department || 'General'}`;
        
        const initials = username.split(' ').map(n => n.charAt(0)).join('').substring(0, 2).toUpperCase();
        document.getElementById('topAvatar').textContent = initials;

        const specificAvatarKey = `userAvatar_${formattedUserId}`;
        function updateAvatarDisplay(avatarBase64) {
            if (!avatarBase64) return;
            const sidebarAvatar = document.getElementById('sidebarAvatarContainer');
            const topAvatarEl = document.getElementById('topAvatar');
            const imgHTML = `<img src="${avatarBase64}" alt="Profile Picture" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;

            if (sidebarAvatar) sidebarAvatar.innerHTML = imgHTML;
            if (topAvatarEl) topAvatarEl.innerHTML = imgHTML;
        }

        const savedAvatar = localStorage.getItem(specificAvatarKey);
        updateAvatarDisplay(savedAvatar);

        window.addEventListener('storage', function(e) {
            if (e.key === specificAvatarKey) {
                updateAvatarDisplay(e.newValue);
            }
        });

        document.getElementById('employee-id').value = formattedUserId;
        document.getElementById('employee-name').value = username;
        document.getElementById('department').value = department || '';

        // ==========================================
        // SEARCH BAR WITH POPUP SCROLLABLE RESULTS
        // ==========================================
        const searchInput = document.getElementById('searchInput');
        const searchDropdown = document.getElementById('searchDropdown');

        if (searchInput && searchDropdown) {
            searchInput.addEventListener('input', async function() {
                const query = searchInput.value.trim().toLowerCase();
                if (query.length === 0) {
                    searchDropdown.classList.remove('active');
                    return;
                }

                searchDropdown.innerHTML = `<div style="padding: 12px; text-align: center; color: #94a3b8; font-size: 13px;">Searching requests...</div>`;
                searchDropdown.classList.add('active');

                try {
                    const response = await fetch(`http://localhost:3000/api/my-requests?employee_id=${encodeURIComponent(userId)}`);
                    const result = await response.json();

                    if (result.success && Array.isArray(result.data)) {
                        const filtered = result.data.filter(row => {
                            const matchUser = row.employee_id && row.employee_id.toString().trim().toLowerCase() === userId.toString().trim().toLowerCase();
                            const rowText = `${row.request_type || ''} REQ-${(row.request_type || '').toUpperCase()}-${row.id} ${row.status || ''} ${row.details || ''} ${row.reason || ''}`.toLowerCase();
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
                                itemLink.style.cssText = 'display: block; padding: 10px 14px; border-bottom: 1px solid #f1f5f9; text-decoration: none; color: inherit; transition: background 0.2s;';
                                itemLink.onmouseover = () => itemLink.style.background = '#f8fafc';
                                itemLink.onmouseout = () => itemLink.style.background = 'transparent';

                                itemLink.innerHTML = `
                                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                        <div>
                                            <div style="font-size: 13px; font-weight: 700; color: #0f172a;">REQ-${reqType.toUpperCase()}-${row.id}</div>
                                            <div style="font-size: 12px; color: #64748b; margin-top: 1px;">${reqType} (${row.details || row.reason || 'N/A'})</div>
                                        </div>
                                        <span style="font-size: 10px; padding: 2px 8px; border-radius: 10px; background: ${badgeBg}; color: ${badgeColor}; font-weight: 600; text-transform: capitalize;">
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
                if (!searchDropdown.contains(e.target) && !searchInput.contains(e.target)) {
                    searchDropdown.classList.remove('active');
                }
            });

            searchDropdown.addEventListener('click', (e) => e.stopPropagation());
        }

        // ==========================================
        // NOTIFICATION SYSTEM
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
                const response = await fetch(`http://localhost:3000/api/notifications?employee_id=${encodeURIComponent(userId)}&department=${encodeURIComponent(department || '')}&position=${encodeURIComponent(position || '')}`);
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
                            notiItem.href = `request-details.html?id=${item.id}&type=${encodeURIComponent(item.type || '')}`;
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

        // Draft and Form logic
        function saveFormDraft() {
            const form = document.getElementById('leaveForm');
            if (!form) return;
            const draftData = {};
            form.querySelectorAll('input, select, textarea').forEach(input => {
                if (input.id && input.type !== 'file' && input.type !== 'password') {
                    draftData[input.id] = input.value;
                }
            });
            localStorage.setItem(`draft_${formattedUserId}_leaveForm`, JSON.stringify(draftData));
        }

        function loadFormDraft() {
            const rawData = localStorage.getItem(`draft_${formattedUserId}_leaveForm`);
            if (!rawData) return false;
            try {
                const draftData = JSON.parse(rawData);
                Object.keys(draftData).forEach(key => {
                    const el = document.getElementById(key);
                    if (el && !el.readOnly) {
                        el.value = draftData[key];
                    }
                });
                return true;
            } catch (e) {
                return false;
            }
        }

        if (loadFormDraft()) {
            document.getElementById('draftNotice').style.display = 'block';
        }

        document.querySelectorAll('#leaveForm input, #leaveForm select, #leaveForm textarea').forEach(el => {
            el.addEventListener('input', saveFormDraft);
            el.addEventListener('change', saveFormDraft);
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            localStorage.removeItem(`draft_${formattedUserId}_leaveForm`);
            window.location.href = 'dashboard.html';
        });

        const leaveTypeSelect = document.getElementById('leave-type');
        const othersGroup = document.getElementById('others-group');
        const othersInput = document.getElementById('leave-type-others');
        const annualNote = document.getElementById('annual-leave-note');

        leaveTypeSelect.addEventListener('change', () => {
            if (leaveTypeSelect.value === 'others') {
                othersGroup.style.display = 'block';
                othersInput.required = true;
            } else {
                othersGroup.style.display = 'none';
                othersInput.required = false;
            }

            if (leaveTypeSelect.value === 'annual') {
                annualNote.style.display = 'block';
            } else {
                annualNote.style.display = 'none';
            }
        });

        const dropzone = document.getElementById('dropzone');
        const fileInput = document.getElementById('file-input');
        const browseLink = document.getElementById('browse-link');
        const fileNameDisplay = document.getElementById('file-name');

        browseLink.addEventListener('click', (e) => {
            e.preventDefault();
            fileInput.click();
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                fileNameDisplay.textContent = "Selected: " + fileInput.files[0].name;
            }
        });

        const startDateInput = document.getElementById('start-date');
        const endDateInput = document.getElementById('end-date');
        const numDaysInput = document.getElementById('num-days');

        // Sekat calendar picker daripada pilih tarikh kurang dari 3 hari notis (UX level)
        (function setMinStartDate() {
            const minDate = new Date();
            minDate.setDate(minDate.getDate() + 3);
            const yyyy = minDate.getFullYear();
            const mm = String(minDate.getMonth() + 1).padStart(2, '0');
            const dd = String(minDate.getDate()).padStart(2, '0');
            startDateInput.min = `${yyyy}-${mm}-${dd}`;
        })();

        // Weekends excluded: Saturday (6) and Sunday (0) don't count as leave days
        function isWeekend(date) {
            const day = date.getDay();
            return day === 0 || day === 6;
        }

        function countBusinessDays(start, end) {
            let count = 0;
            const cursor = new Date(start);
            cursor.setHours(0, 0, 0, 0);
            const endClamped = new Date(end);
            endClamped.setHours(0, 0, 0, 0);
            while (cursor <= endClamped) {
                if (!isWeekend(cursor)) count++;
                cursor.setDate(cursor.getDate() + 1);
            }
            return count;
        }

        startDateInput.addEventListener('change', () => {
            if (startDateInput.value) {
                const start = new Date(startDateInput.value);
                if (isWeekend(start)) {
                    alert('Weekends are excluded from leave. Please choose a Start Date that falls on a weekday (Mon–Fri).');
                    startDateInput.value = '';
                    numDaysInput.value = '';
                    return;
                }
            }
            endDateInput.min = startDateInput.value;
            calculateDays();
        });

        endDateInput.addEventListener('change', () => {
            if (endDateInput.value) {
                const end = new Date(endDateInput.value);
                if (isWeekend(end)) {
                    alert('Weekends are excluded from leave. Please choose an End Date that falls on a weekday (Mon–Fri).');
                    endDateInput.value = '';
                    numDaysInput.value = '';
                    return;
                }
            }
            calculateDays();
        });

        function calculateDays() {
            if (startDateInput.value && endDateInput.value) {
                const start = new Date(startDateInput.value);
                const end = new Date(endDateInput.value);
                if (end >= start) {
                    const businessDays = countBusinessDays(start, end);
                    numDaysInput.value = businessDays;
                } else {
                    numDaysInput.value = 0;
                }
            }
        }

        function day_type_is_half() {
            const dt = document.getElementById('day-type').value;
            return dt === 'half-am' || dt === 'half-pm';
        }

        document.getElementById('day-type').addEventListener('change', () => {
            if (day_type_is_half() && startDateInput.value && startDateInput.value === endDateInput.value) {
                numDaysInput.value = 0.5;
            } else {
                calculateDays();
            }
        });

        // --- 3 HARI NOTIS MINIMUM VALIDATION ---
        function isAtLeast3DaysAdvance(startDateValue) {
            if (!startDateValue) return false;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const start = new Date(startDateValue);
            start.setHours(0, 0, 0, 0);
            const diffDays = Math.round((start - today) / (1000 * 60 * 60 * 24));
            return diffDays >= 3;
        }

        async function hasOverlappingLeave(startVal, endVal) {
            try {
                const response = await fetch(`http://localhost:3000/api/my-requests?employee_id=${encodeURIComponent(userId)}`);
                const result = await response.json();
                if (!result.success || !Array.isArray(result.data)) return false;

                const newStart = new Date(startVal);
                const newEnd = new Date(endVal);

                return result.data.some(row => {
                    const sameUser = row.employee_id && row.employee_id.toString().trim().toLowerCase() === userId.toString().trim().toLowerCase();
                    const isLeave = (row.request_type || '').toLowerCase() === 'leave';
                    const status = (row.status || '').toLowerCase();
                    const isActive = status.includes('pending') || status === 'approved';
                    if (!sameUser || !isLeave || !isActive || !row.start_date || !row.end_date) return false;

                    const existingStart = new Date(row.start_date);
                    const existingEnd = new Date(row.end_date);
                    return newStart <= existingEnd && newEnd >= existingStart;
                });
            } catch (err) {
                console.error('Overlap pre-check failed:', err);
                return false;
            }
        }

        document.getElementById('leaveForm').addEventListener('submit', async function(e) {
            e.preventDefault();

            if (!isAtLeast3DaysAdvance(startDateInput.value)) {
                alert('Leave must be submitted at least 3 days in advance. Sila pilih Start Date yang sekurang-kurangnya 3 hari dari hari ini.');
                return;
            }

            if (isWeekend(new Date(startDateInput.value)) || isWeekend(new Date(endDateInput.value))) {
                alert('Weekends are excluded from leave. Please select weekday dates only.');
                return;
            }

            if (await hasOverlappingLeave(startDateInput.value, endDateInput.value)) {
                alert('You already have a pending or approved leave request that overlaps with these dates. Duplicate leave applications are not allowed.');
                return;
            }

            const formData = new FormData(this);

            try {
                const response = await fetch('http://localhost:3000/api/submit-leave', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                if (result.success) {
                    localStorage.removeItem(`draft_${formattedUserId}_leaveForm`);
                    alert(result.message || "Leave application submitted successfully!");
                    window.location.href = "my-request.html";
                } else {
                    alert("Submission error: " + result.message);
                }
            } catch (err) {
                console.error("Submission failed:", err);
                alert("Submission failed. Please check your network connection.");
            }
        });
    });
