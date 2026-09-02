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

        // Manager Check for Sidebar Menu (matches leave.html)
        const isManager = (userId && formattedUserId.startsWith('MGR')) || 
                          (position && position.toLowerCase().includes('manager'));
        if (isManager) {
            const approvalQueueItem = document.getElementById('approvalQueueItem');
            if (approvalQueueItem) {
                approvalQueueItem.style.display = 'flex';
            }
        }

        // Indicator badge next to "Approval Queue" - display pending count & auto refresh (matches leave.html)
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

        // Populate Sidebar & Top Avatar Details
        const profileName = document.getElementById('profileName');
        const profileMeta = document.getElementById('profileMeta');
        if (profileName) profileName.textContent = username;
        if (profileMeta) profileMeta.textContent = `${formattedUserId} • ${department || 'General'}`;

        const initials = username.split(' ').map(n => n.charAt(0)).join('').substring(0, 2).toUpperCase();
        const topAvatarEl = document.getElementById('topAvatar');
        if (topAvatarEl) topAvatarEl.textContent = initials;

        const specificAvatarKey = `userAvatar_${formattedUserId}`;
        function updateAvatarDisplay(avatarBase64) {
            if (!avatarBase64) return;
            const sidebarAvatar = document.getElementById('sidebarAvatarContainer');
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

        // Populate Form Inputs
        const empIdInput = document.getElementById('employee-id');
        const empNameInput = document.getElementById('employee-name');
        const deptInput = document.getElementById('department');
        if (empIdInput) empIdInput.value = formattedUserId;
        if (empNameInput) empNameInput.value = username;
        if (deptInput) deptInput.value = department || '';

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
        // NOTIFICATION SYSTEM (matches leave.html)
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
