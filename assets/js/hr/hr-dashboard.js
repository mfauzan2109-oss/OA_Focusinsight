document.addEventListener('DOMContentLoaded', async function() {
        const userId = sessionStorage.getItem('userId') || sessionStorage.getItem('user_id') || '';
        const username = sessionStorage.getItem('username') || '';
        const department = sessionStorage.getItem('department') || '';
        const position = sessionStorage.getItem('position') || '';

        const formattedUserId = userId.toUpperCase();

        // 1. Sidebar & Banner User Setup
        document.getElementById('sidebarName').textContent = username || '—';
        document.getElementById('sidebarMeta').textContent = (formattedUserId || department) ? `${formattedUserId} • ${department}` : '—';
        document.getElementById('bannerGreeting').textContent = username ? `Good Morning, ${username}` : 'Good Morning';

        const initials = username
            ? username.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
            : '';
        const topAvatarEl = document.getElementById('topAvatar');
        const sidebarAvatarEl = document.getElementById('sidebarAvatarContainer');

        if (topAvatarEl) topAvatarEl.textContent = initials || '—';

        // Profile Avatar Sync via localStorage
        const specificAvatarKey = `userAvatar_${formattedUserId}`;

        function updateAvatarDisplay(avatarBase64) {
            if (!avatarBase64) return;
            const imgHTML = `<img src="${avatarBase64}" alt="Profile Picture" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
            if (sidebarAvatarEl) sidebarAvatarEl.innerHTML = imgHTML;
            if (topAvatarEl) topAvatarEl.innerHTML = imgHTML;
        }

        const savedAvatar = localStorage.getItem(specificAvatarKey);
        updateAvatarDisplay(savedAvatar);

        window.addEventListener('storage', function(e) {
            if (e.key === specificAvatarKey) {
                updateAvatarDisplay(e.newValue);
            }
        });

        // Set live formatted date
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('liveBannerDate').textContent = new Date().toLocaleDateString('en-US', options);

        // 2. Dynamic Notifications Engine
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
                const response = await fetch(`/api/notifications?employee_id=${encodeURIComponent(formattedUserId)}&department=${encodeURIComponent(department)}&position=${encodeURIComponent(position)}`);
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

        // 3. Database Metrics & Table Loader
        async function fetchDashboardMetrics() {
            try {
                const res = await fetch(`/api/hr/dashboard-stats?user_id=${encodeURIComponent(formattedUserId)}`);
                const result = await res.json();

                if (result.success && result.data) {
                    document.getElementById('statTotalEmployees').textContent = result.data.total_employees || 0;
                    document.getElementById('statPendingRequests').textContent = result.data.pending_requests || 0;
                    document.getElementById('statApprovedMonth').textContent = result.data.approved_month || 0;
                    document.getElementById('statOnLeaveToday').textContent = result.data.on_leave_today || 0;
                    
                    const pendingCnt = result.data.pending_requests || 0;
                    document.getElementById('bannerPendingCount').textContent = `${pendingCnt} pending request${pendingCnt === 1 ? '' : 's'}`;
                }
            } catch (err) {
                console.error('Error loading HR dashboard metrics:', err);
            }
        }

        const tableBody = document.getElementById('activityTableBody');

        // --- PAGINATION STATE ---
        const ROWS_PER_PAGE = 7;
        let currentPage = 1;
        let allActivities = [];

        async function fetchRecentActivities() {
            try {
                const res = await fetch(`/api/hr/recent-activities?user_id=${encodeURIComponent(formattedUserId)}`);
                const result = await res.json();

                if (result.success && Array.isArray(result.data) && result.data.length > 0) {
                    allActivities = result.data;
                    currentPage = 1;
                    renderPage();
                } else {
                    tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 24px;">No recent request records found in database.</td></tr>`;
                    document.getElementById('showingCountText').textContent = 'Showing 0 records';
                    renderPagination(0);
                }
            } catch (err) {
                console.error('Error loading recent activity logs:', err);
                tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ef4444; padding: 24px;">Failed to load records from database.</td></tr>`;
            }
        }

        function renderPage() {
            tableBody.innerHTML = '';
            const start = (currentPage - 1) * ROWS_PER_PAGE;
            const end = start + ROWS_PER_PAGE;
            const pageData = allActivities.slice(start, end);

            pageData.forEach(item => {
                const tr = document.createElement('tr');
                const rawStatus = item.status || 'Pending';
                const statusLower = rawStatus.toLowerCase();

                let sClass = 'pending';
                if (statusLower.includes('approve') || statusLower === 'completed') sClass = 'approved';
                else if (statusLower.includes('reject')) sClass = 'rejected';
                else if (statusLower.includes('revision')) sClass = 'revision';

                const reqType = item.request_type || item.type || 'General';
                const amt = item.amount || item.total_amount || '—';

                tr.innerHTML = `
                    <td style="font-weight: 600;">REQ-${reqType.toUpperCase()}-${item.id}</td>
                    <td>${reqType}</td>
                    <td>${item.employee_name || 'Staff'}</td>
                    <td>${item.department || 'General'}</td>
                    <td>${amt}</td>
                    <td>${item.date_submitted || '—'}</td>
                    <td><span class="status-badge ${sClass}">${rawStatus}</span></td>
                `;
                tableBody.appendChild(tr);
            });

            const totalPages = Math.ceil(allActivities.length / ROWS_PER_PAGE);
            const startRecord = allActivities.length === 0 ? 0 : start + 1;
            const endRecord = Math.min(end, allActivities.length);
            document.getElementById('showingCountText').textContent =
                `Showing ${startRecord}–${endRecord} of ${allActivities.length} records`;

            renderPagination(totalPages);
        }

        function renderPagination(totalPages) {
            const paginationDiv = document.getElementById('paginationControls');
            paginationDiv.innerHTML = '';

            // Previous button
            const prevBtn = document.createElement('button');
            prevBtn.className = 'btn-page-nav';
            prevBtn.innerHTML = '&lt;';
            prevBtn.disabled = currentPage === 1;
            prevBtn.style.opacity = currentPage === 1 ? '0.4' : '1';
            prevBtn.style.cursor = currentPage === 1 ? 'not-allowed' : 'pointer';
            prevBtn.addEventListener('click', () => {
                if (currentPage > 1) { currentPage--; renderPage(); }
            });
            paginationDiv.appendChild(prevBtn);

            // Numbered page buttons (max 5 visible)
            let startPage = Math.max(1, currentPage - 2);
            let endPage   = Math.min(totalPages, startPage + 4);
            if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);

            for (let i = startPage; i <= endPage; i++) {
                const btn = document.createElement('button');
                btn.textContent = i;
                if (i === currentPage) btn.classList.add('active');
                btn.addEventListener('click', (function(page) {
                    return function() { currentPage = page; renderPage(); };
                })(i));
                paginationDiv.appendChild(btn);
            }

            // Next button
            const nextBtn = document.createElement('button');
            nextBtn.className = 'btn-page-nav';
            nextBtn.innerHTML = '&gt;';
            nextBtn.disabled = currentPage === totalPages || totalPages === 0;
            nextBtn.style.opacity = (currentPage === totalPages || totalPages === 0) ? '0.4' : '1';
            nextBtn.style.cursor = (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer';
            nextBtn.addEventListener('click', () => {
                if (currentPage < totalPages) { currentPage++; renderPage(); }
            });
            paginationDiv.appendChild(nextBtn);
        }

        // Legacy alias kept for any other callers
        function renderTable(dataList) {
            allActivities = dataList;
            currentPage = 1;
            renderPage();
        }

        fetchDashboardMetrics();
        fetchRecentActivities();

        // 4. Header Live Search Box
        const searchInput = document.getElementById('headerSearchInput');
        const searchDropdown = document.getElementById('searchResultsDropdown');

        if (searchInput && searchDropdown) {
            searchInput.addEventListener('input', async function(e) {
                const query = e.target.value.trim().toLowerCase();
                if (!query) {
                    searchDropdown.classList.remove('active');
                    return;
                }

                try {
                    const res = await fetch(`/api/hr/recent-activities?user_id=${encodeURIComponent(formattedUserId)}`);
                    const resData = await res.json();
                    const items = resData.data || [];

                    const filtered = items.filter(r => 
                        (r.request_type && r.request_type.toLowerCase().includes(query)) ||
                        (r.employee_name && r.employee_name.toLowerCase().includes(query)) ||
                        (r.status && r.status.toLowerCase().includes(query)) ||
                        (r.id && r.id.toString().includes(query))
                    );

                    if (filtered.length > 0) {
                        searchDropdown.innerHTML = '';
                        filtered.forEach(f => {
                            const reqType = f.request_type || 'General';
                            const div = document.createElement('a');
                            div.href = `request-details-hr.html?id=${f.id}&type=${encodeURIComponent(reqType)}`;
                            div.style.cssText = 'display: block; padding: 10px 14px; border-bottom: 1px solid #f1f5f9; text-decoration: none; color: inherit;';
                            div.innerHTML = `
                                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                    <div>
                                        <div style="font-size: 13px; font-weight: 700; color: #0f172a;">REQ-${reqType.toUpperCase()}-${f.id}</div>
                                        <div style="font-size: 12px; color: #64748b;">${reqType} • ${f.date_submitted || ''}</div>
                                    </div>
                                    <span class="status-badge ${(f.status || '').toLowerCase()}">${f.status || 'Pending'}</span>
                                </div>
                            `;
                            searchDropdown.appendChild(div);
                        });
                        searchDropdown.classList.add('active');
                    } else {
                        searchDropdown.innerHTML = '<div style="padding: 14px; text-align: center; color: #94a3b8; font-size: 13px;">No matching requests found</div>';
                        searchDropdown.classList.add('active');
                    }
                } catch (err) {
                    console.error('Search error:', err);
                }
            });

            document.addEventListener('click', (e) => {
                if (!searchDropdown.contains(e.target) && !searchInput.contains(e.target)) {
                    searchDropdown.classList.remove('active');
                }
            });
        }
    });
