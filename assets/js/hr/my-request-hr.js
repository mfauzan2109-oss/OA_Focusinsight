document.addEventListener('DOMContentLoaded', function () {

        /* ==============================================================
           0. CONFIG & SESSION
           ============================================================== */
        // When the page is served by Express (port 3000) relative calls work.
        // When opened through Live Server / file://, fall back to the API host.
        const API_BASE = (window.location.port === '3000') ? '' : 'http://localhost:3000';

        const userId     = sessionStorage.getItem('userId') || 'HR4001';
        const username   = sessionStorage.getItem('username') || 'Chen Jun';
        const department = sessionStorage.getItem('department') || 'Human Resources';
        const position   = sessionStorage.getItem('position') || sessionStorage.getItem('userPosition') || '';

        document.getElementById('sidebarName').textContent = username;
        document.getElementById('sidebarMeta').textContent = `${userId} . ${department}`;

        const initials = username.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        document.getElementById('topAvatar').textContent = initials || 'CS';

        /* Load profile picture set on profile-hr.html into the sidebar and top bar */
        (function loadSidebarAvatar() {
            const formattedUserId = (userId || '').toUpperCase();
            const avatarKey = `userAvatar_${formattedUserId}`;
            const sidebarAvatar = document.getElementById('sidebarAvatarContainer');
            const topAvatar = document.getElementById('topAvatar');

            function renderSavedAvatar(base64Image) {
                const imgHtml = `<img src="${base64Image}" alt="Profile Picture" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
                if (sidebarAvatar) sidebarAvatar.innerHTML = imgHtml;
                if (topAvatar) topAvatar.innerHTML = imgHtml;
            }

            const savedAvatar = localStorage.getItem(avatarKey);
            if (savedAvatar) renderSavedAvatar(savedAvatar);

            window.addEventListener('storage', (e) => {
                if (e.key === avatarKey && e.newValue) renderSavedAvatar(e.newValue);
            });
        })();

        let allRequests = [];
        let allNotifications = [];

        /* ==============================================================
           1. SMALL HELPERS
           ============================================================== */
        const el = id => document.getElementById(id);

        function escapeHtml(value) {
            return String(value === null || value === undefined ? '' : value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function normStatus(status) {
            const s = (status || 'Pending').toString().trim().toLowerCase();
            if (s.includes('approve')) return 'approved';
            if (s.includes('reject')) return 'rejected';
            return 'pending';
        }

        function prettyStatus(status) {
            const s = normStatus(status);
            return s.charAt(0).toUpperCase() + s.slice(1);
        }

        function showToast(message, isError) {
            const toast = el('appToast');
            toast.textContent = message;
            toast.className = isError ? 'error' : '';
            toast.style.display = 'block';
            clearTimeout(toast._timer);
            toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 3800);
        }



        /* ==============================================================
           2. NOTIFICATIONS -> GET /api/notifications
              (Card-based design — matches hr-dashboard.html)
           ============================================================== */
        const notiDropdown = el('notiDropdown');
        const notiList     = el('notiList');
        const notiBadge    = el('notiBadge');
        const notiBellBtn  = el('notiBellBtn');
        const refreshNotiBtn = el('refreshNotiBtn');

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
                const response = await fetch(`${API_BASE}/api/notifications?employee_id=${encodeURIComponent(userId)}&department=${encodeURIComponent(department)}&position=${encodeURIComponent(position)}`);
                const data = await response.json();

                if (data.success && data.notifications && data.notifications.length > 0) {
                    allNotifications = data.notifications;

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
                            notiItem.href = `request-details-hr.html?id=${item.id}&type=${encodeURIComponent(item.type || '')}`;
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
                        } else {
                            notiBadge.style.display = 'none';
                        }
                    }
                } else {
                    allNotifications = [];
                    if (notiBadge) notiBadge.style.display = 'none';
                    if (notiList) {
                        notiList.innerHTML = `<div style="padding: 16px; text-align: center; color: #94a3b8; font-size: 13px;">No notifications found.</div>`;
                    }
                }
            } catch (err) {
                console.error('Error fetching notifications:', err);
                if (notiList) {
                    notiList.innerHTML = `<div style="padding: 16px; text-align: center; color: #94a3b8; font-size: 13px;">Unable to load notifications.</div>`;
                }
            }
        }

        if (refreshNotiBtn) {
            refreshNotiBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                fetchNotifications();
            });
        }

        el('notiViewAllBtn').addEventListener('click', function (e) {
            e.preventDefault();
            notiDropdown.classList.remove('active');
            el('headerSearchInput').value = '';
            renderTable(allRequests);
            document.querySelector('.activity-card').scrollIntoView({ behavior: 'smooth' });
        });

        /* ==============================================================
           3. MY REQUESTS -> GET /api/my-requests
           ============================================================== */
        const tableBody   = el('requestTableBody');
        const searchInput = el('headerSearchInput');

        function updateStats(rows) {
            let pending = 0, approved = 0, rejected = 0;
            rows.forEach(r => {
                const s = normStatus(r.status);
                if (s === 'approved') approved++;
                else if (s === 'rejected') rejected++;
                else pending++;
            });

            el('pendingCount').textContent  = pending;
            el('approvedCount').textContent = approved;
            el('rejectedCount').textContent = rejected;
            el('totalCount').textContent    = rows.length;
        }

        function renderTable(rows) {
            tableBody.innerHTML = '';

            if (!rows.length) {
                tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#94a3b8;">No matching requests found</td></tr>';
                return;
            }

            rows.forEach(req => {
                const statusClass = normStatus(req.status);
                const typeKey = (req.request_type || '').toLowerCase();
                const detailUrl = `request-details-hr.html?id=${encodeURIComponent(req.id)}&type=${encodeURIComponent(typeKey)}`;

                const reminderCell = statusClass === 'pending'
                    ? `<button class="remind-btn" data-id="${escapeHtml(req.id)}" data-type="${escapeHtml(typeKey)}">Remind</button>`
                    : '<span style="color:#cbd5e1;">—</span>';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="req-id">${escapeHtml(req.form_no)}</td>
                    <td>${escapeHtml(req.request_type)}</td>
                    <td>${escapeHtml(req.date_submitted)}</td>
                    <td>${escapeHtml(req.amount)}</td>
                    <td><span class="badge-status ${statusClass}">${escapeHtml(prettyStatus(req.status))}</span></td>
                    <td><a href="${detailUrl}" class="action-view-link">View</a></td>
                    <td>${reminderCell}</td>
                `;
                tableBody.appendChild(tr);
            });
        }

        function loadMyRequests() {
            const url = `${API_BASE}/api/my-requests?employee_id=${encodeURIComponent(userId)}`;

            return fetch(url)
                .then(r => r.json())
                .then(result => {
                    if (!result.success) throw new Error(result.message || 'Failed to load requests');

                    allRequests = (result.data || []).map(row => ({
                        ...row,
                        // Same numbering convention the notification API uses,
                        // so a notification and its table row match by eye.
                        form_no: `REQ-${(row.request_type || '').toUpperCase()}-${row.id}`
                    }));

                    updateStats(allRequests);
                    applySearch();
                })
                .catch(err => {
                    console.error('My requests load error:', err);
                    tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#b91c1c;">Unable to reach the server. Make sure node server.js is running on port 3000.</td></tr>';
                });
        }

        function applySearch() {
            const query = searchInput.value.toLowerCase().trim();
            if (!query) {
                renderTable(allRequests);
                return;
            }

            const filtered = allRequests.filter(req =>
                (req.form_no || '').toLowerCase().includes(query) ||
                (req.request_type || '').toLowerCase().includes(query) ||
                (req.details || '').toLowerCase().includes(query) ||
                prettyStatus(req.status).toLowerCase().includes(query) ||
                (req.date_submitted || '').toLowerCase().includes(query)
            );
            renderTable(filtered);
        }

        searchInput.addEventListener('input', applySearch);

        el('resetFilterBtn').addEventListener('click', function (e) {
            e.preventDefault();
            searchInput.value = '';
            renderTable(allRequests);
        });

        /* ==============================================================
           4. SEND REMINDER -> POST /api/send-reminder
           A reminder writes last_reminder_sent in the database, which is
           exactly what /api/notifications reads back as a notification.
           ============================================================== */
        tableBody.addEventListener('click', function (e) {
            const btn = e.target.closest('.remind-btn');
            if (!btn) return;

            btn.disabled = true;
            btn.textContent = 'Sending...';

            fetch(`${API_BASE}/api/send-reminder`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: btn.dataset.id, type: btn.dataset.type })
            })
                .then(r => r.json())
                .then(result => {
                    showToast(result.message, !result.success);
                    btn.disabled = false;
                    btn.textContent = 'Remind';
                    if (result.success) {
                        loadMyRequests();
                        fetchNotifications();
                    }
                })
                .catch(err => {
                    console.error('Send reminder error:', err);
                    showToast('Unable to send the reminder. Please check the server connection.', true);
                    btn.disabled = false;
                    btn.textContent = 'Remind';
                });
        });

        /* ==============================================================
           5. INITIAL LOAD + LIGHT POLLING
           ============================================================== */
        loadMyRequests();
        fetchNotifications();

        // Refresh the badge every 5 seconds to match hr-dashboard.html polling
        setInterval(fetchNotifications, 5000);
    });
