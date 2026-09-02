document.addEventListener('DOMContentLoaded', function() {
        const username = sessionStorage.getItem('username');
        const userId = sessionStorage.getItem('userId');
        const position = sessionStorage.getItem('position');
        const department = sessionStorage.getItem('department');

        if (!username || !position) {
            alert("Access Denied! Please log in first.");
            window.location.href = "index.html";
            return;
        }

        document.getElementById('sidebarName').textContent = username;
        document.getElementById('sidebarMeta').textContent = `${userId ? userId.toUpperCase() : ''} . ${department || ''}`;

        const isManager = (userId && userId.toUpperCase().startsWith('MGR')) ||
                          (position && position.toLowerCase().includes('manager'));
        if (isManager) {
            const approvalQueueItem = document.getElementById('approvalQueueItem');
            if (approvalQueueItem) approvalQueueItem.style.display = 'flex';
        }

        const initials = username.split(' ').map(name => name.charAt(0)).join('').substring(0, 2).toUpperCase();
        const topAvatarEl = document.getElementById('topAvatar');
        const sidebarAvatarEl = document.getElementById('sidebarAvatarContainer');
        if (topAvatarEl) topAvatarEl.textContent = initials;

        function updateAvatarDisplay(avatarBase64) {
            if (avatarBase64) {
                const imgHTML = `<img src="${avatarBase64}" alt="Profile Picture" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
                if (sidebarAvatarEl) sidebarAvatarEl.innerHTML = imgHTML;
                if (topAvatarEl) topAvatarEl.innerHTML = imgHTML;
            }
        }
        const formattedUserId = (userId || '').toUpperCase();
        const savedAvatar = localStorage.getItem(`userAvatar_${formattedUserId}`);
        updateAvatarDisplay(savedAvatar);

        // ==========================================
        // SEARCH
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
                                const itemLink = document.createElement('a');
                                itemLink.href = `request-details.html?id=${row.id}&type=${encodeURIComponent(reqType)}`;
                                itemLink.style.cssText = 'display: block; padding: 10px 14px; border-bottom: 1px solid #f1f5f9; text-decoration: none; color: inherit;';
                                itemLink.innerHTML = `
                                    <div style="font-size: 13px; font-weight: 700; color: #0f172a;">REQ-${reqType.toUpperCase()}-${row.id}</div>
                                    <div style="font-size: 12px; color: #64748b; margin-top: 1px;">${reqType} (${row.details || row.reason || 'N/A'}) - ${row.status || 'Pending'}</div>
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
        // NOTIFICATIONS
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
                if (notiDropdown.classList.contains('active')) fetchNotifications();
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
                            if (item.is_reminder) { cardClass = 'status-reminder'; pillClass = 'reminder'; }
                            else if (statusLower.includes('approve') || statusLower === 'completed') { cardClass = 'status-approved'; pillClass = 'approved'; }
                            else if (statusLower.includes('reject')) { cardClass = 'status-rejected'; pillClass = 'rejected'; }
                            else if (statusLower.includes('revision') || statusLower.includes('review')) { cardClass = 'status-review'; pillClass = 'review'; }

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

                    if (notiBadge && unreadCount > 0) {
                        notiBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                        notiBadge.style.display = 'flex';
                    }
                } else {
                    if (notiBadge) notiBadge.style.display = 'none';
                    if (notiList) notiList.innerHTML = `<div style="padding: 16px; text-align: center; color: #94a3b8; font-size: 13px;">No notifications found.</div>`;
                }
            } catch (err) {
                console.error('Error fetching notifications:', err);
            }
        }

        if (refreshNotiBtn) {
            refreshNotiBtn.addEventListener('click', (e) => { e.stopPropagation(); fetchNotifications(); });
        }

        fetchNotifications();
        setInterval(fetchNotifications, 30000);

        // Favorite star toggle (visual only, not persisted)
        document.querySelectorAll('.ac-card-favorite').forEach(star => {
            star.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                star.classList.toggle('bx-star');
                star.classList.toggle('bxs-star');
                star.style.color = star.classList.contains('bxs-star') ? '#f59e0b' : '#cbd5e1';
            });
        });
    });
