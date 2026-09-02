const API_BASE_URL = 'http://localhost:3000/api';
    let reportData = [];
    let currentPage = 1;
    const recordsPerPage = 6;

    document.addEventListener("DOMContentLoaded", function() {
        const userId = sessionStorage.getItem('userId') || sessionStorage.getItem('user_id') || '';
        const username = sessionStorage.getItem('username') || '';
        const department = sessionStorage.getItem('department') || '';
        const position = sessionStorage.getItem('position') || '';

        const sidebarName = document.getElementById('sidebarName');
        const sidebarMeta = document.getElementById('sidebarMeta');
        if (sidebarName) sidebarName.textContent = username || '—';
        if (sidebarMeta) sidebarMeta.textContent = (userId || department) ? `${userId} . ${department}` : '—';

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

        loadReports();

        // --- NOTIFICATIONS (matches hr-dashboard.html) ---
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
            if (!userId) return;
            try {
                const response = await fetch(`${API_BASE_URL}/notifications?employee_id=${encodeURIComponent(userId)}&department=${encodeURIComponent(department)}&position=${encodeURIComponent(position)}`);
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
    });

    async function loadReports() {
        const type = document.getElementById('filterType').value;
        const dept = document.getElementById('filterDept').value;
        const dateFrom = document.getElementById('filterDateFrom').value;
        const dateTo = document.getElementById('filterDateTo').value;

        const url = `/api/reports?request_type=${encodeURIComponent(type)}&department=${encodeURIComponent(dept)}&date_from=${dateFrom}&date_to=${dateTo}`;

        try {
            const response = await fetch(url);
            const result = await response.json();

            if (result.success) {
                reportData = result.data;
                currentPage = 1;
                renderTable();
            } else {
                document.getElementById('reportsTableBody').innerHTML = `<tr><td colspan="6">Error loading data.</td></tr>`;
            }
        } catch (err) {
            console.error('Fetch error:', err);
            document.getElementById('reportsTableBody').innerHTML = `<tr><td colspan="6">Failed to connect to Node server.</td></tr>`;
        }
    }

    function renderTable() {
        const tbody = document.getElementById('reportsTableBody');
        const searchKeyword = document.getElementById('searchInput').value.toLowerCase();

        const filtered = reportData.filter(item => 
            item.request_id.toLowerCase().includes(searchKeyword) ||
            item.request_type.toLowerCase().includes(searchKeyword) ||
            item.employee_name.toLowerCase().includes(searchKeyword) ||
            item.employee_id.toLowerCase().includes(searchKeyword) ||
            (item.department || '').toLowerCase().includes(searchKeyword)
        );

        const totalRecords = filtered.length;
        const totalPages = Math.ceil(totalRecords / recordsPerPage) || 1;

        const startIdx = (currentPage - 1) * recordsPerPage;
        const pageItems = filtered.slice(startIdx, startIdx + recordsPerPage);

        if (pageItems.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6">No matching records found.</td></tr>`;
        } else {
            tbody.innerHTML = pageItems.map(item => `
                <tr>
                    <td><span class="req-link" onclick="openDetail('${item.id}', '${item.request_type}')">${item.request_id}</span></td>
                    <td>${item.request_type}</td>
                    <td>${item.employee_name}</td>
                    <td>${item.employee_id}</td>
                    <td>${item.department || 'General'}</td>
                    <td>${item.formatted_date}</td>
                </tr>
            `).join('');
        }

        const showingCount = pageItems.length;
        document.getElementById('recordCountText').innerText = `Showing ${showingCount} of ${totalRecords} records`;

        // Sliding pagination: Maximum 4 visible page buttons
        const maxVisible = 4;
        let startPage = 1;
        let endPage = Math.min(totalPages, maxVisible);

        if (totalPages > maxVisible) {
            if (currentPage <= 2) {
                startPage = 1;
                endPage = maxVisible;
            } else if (currentPage + 1 >= totalPages) {
                endPage = totalPages;
                startPage = totalPages - maxVisible + 1;
            } else {
                startPage = currentPage - 1;
                endPage = currentPage + 2;
                if (endPage > totalPages) {
                    endPage = totalPages;
                    startPage = endPage - maxVisible + 1;
                }
            }
        }

        let pagHTML = `<button class="page-btn" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>&lt;</button>`;
        for (let i = startPage; i <= endPage; i++) {
            pagHTML += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
        }
        pagHTML += `<button class="page-btn" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>&gt;</button>`;
        
        document.getElementById('paginationControls').innerHTML = pagHTML;
    }

    function filterTable() {
        currentPage = 1;
        renderTable();
    }

    function changePage(page) {
        const searchKeyword = document.getElementById('searchInput').value.toLowerCase();
        const filtered = reportData.filter(item => 
            item.request_id.toLowerCase().includes(searchKeyword) ||
            item.request_type.toLowerCase().includes(searchKeyword) ||
            item.employee_name.toLowerCase().includes(searchKeyword) ||
            item.employee_id.toLowerCase().includes(searchKeyword) ||
            (item.department || '').toLowerCase().includes(searchKeyword)
        );

        const totalPages = Math.ceil(filtered.length / recordsPerPage) || 1;
        if (page < 1 || page > totalPages) return;
        currentPage = page;
        renderTable();
    }

    function openDetail(id, type) {
        window.location.href = `request-details-hr.html?id=${id}&type=${encodeURIComponent(type)}`;
    }
