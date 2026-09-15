let allUsers = [];
    let previousNotiState = {};

    document.addEventListener('DOMContentLoaded', function() {
        const username = sessionStorage.getItem('username') || '';
        const userId = sessionStorage.getItem('userId') || '';
        const department = sessionStorage.getItem('department') || '';
        const position = sessionStorage.getItem('position') || '';

        document.getElementById('sidebarName').textContent = username || '—';
        document.getElementById('sidebarMeta').textContent = (userId || department) ? `${userId} . ${department}` : '—';

        const initials = username
            ? username.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
            : '';
        document.getElementById('topAvatar').textContent = initials || '—';

        // Show the profile picture the user set in profile-hr.html, if any
        (function loadSavedProfileAvatar() {
            if (!userId) return;
            const formattedUserId = userId.toUpperCase();
            const savedAvatar = localStorage.getItem(`userAvatar_${formattedUserId}`);
            if (!savedAvatar) return;

            const avatarImgHtml = `<img src="${savedAvatar}" alt="Profile Picture" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;

            const sidebarAvatar = document.getElementById('sidebarAvatarContainer');
            if (sidebarAvatar) sidebarAvatar.innerHTML = avatarImgHtml;

            const topAvatar = document.getElementById('topAvatar');
            if (topAvatar) topAvatar.innerHTML = avatarImgHtml;
        })();

        // Load users from backend API
        fetchUsers();

        // Live search filtering listener
        document.getElementById('userSearchInput').addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase().trim();
            const filteredUsers = allUsers.filter(u => 
                (u.user_id || '').toLowerCase().includes(searchTerm) ||
                (u.name || '').toLowerCase().includes(searchTerm) ||
                (u.department || '').toLowerCase().includes(searchTerm) ||
                (u.position || '').toLowerCase().includes(searchTerm) ||
                (u.employment_type || '').toLowerCase().includes(searchTerm)
            );
            renderUserTable(filteredUsers);
        });

        // --- NOTIFICATIONS ---
        if (userId) {
            fetchNotifications(userId, department, position);
            setInterval(() => fetchNotifications(userId, department, position), 15000);
        } else {
            document.getElementById('notiListBody').innerHTML = `<div style="padding: 12px; text-align: center; color: #64748b; font-size: 13px;">Log in to see notifications</div>`;
        }

        const notiBellBtn = document.getElementById('notiBellBtn');
        const notiDropdown = document.getElementById('notiDropdown');

        notiBellBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            notiDropdown.classList.toggle('open');
        });

        document.addEventListener('click', function(e) {
            if (!notiDropdown.contains(e.target) && e.target !== notiBellBtn) {
                notiDropdown.classList.remove('open');
            }
        });
    });

    async function fetchNotifications(userId, department, position) {
        try {
            const response = await fetch(`http://localhost:3000/api/notifications?employee_id=${encodeURIComponent(userId)}&department=${encodeURIComponent(department || '')}&position=${encodeURIComponent(position || '')}`);
            const result = await response.json();

            if (result.success && Array.isArray(result.notifications)) {
                renderNotifications(result.notifications);
            } else {
                document.getElementById('notiListBody').innerHTML = `<div style="padding: 12px; text-align: center; color: #ef4444; font-size: 13px;">Failed to load notifications</div>`;
            }
        } catch (err) {
            console.error('Error fetching notifications:', err);
            document.getElementById('notiListBody').innerHTML = `<div style="padding: 12px; text-align: center; color: #ef4444; font-size: 13px;">Server connection error</div>`;
        }
    }

    function renderNotifications(notifications) {
        const notiListBody = document.getElementById('notiListBody');
        const notiBadge = document.getElementById('notiBadge');
        const notiBellBtn = document.getElementById('notiBellBtn');

        const pendingCount = notifications.filter(n => (n.status || '').toLowerCase() === 'pending').length;
        const wasHidden = notiBadge.style.display === 'none' || notiBadge.style.display === '';

        if (pendingCount > 0) {
            notiBadge.textContent = pendingCount;
            notiBadge.style.display = 'flex';
        } else {
            notiBadge.style.display = 'none';
        }

        if (notifications.length === 0) {
            notiListBody.innerHTML = `<div style="padding: 12px; text-align: center; color: #64748b; font-size: 13px;">No notifications found</div>`;
            previousNotiState = {};
            return;
        }

        const nextState = {};
        let hasNewOrChanged = false;
        let html = '';

        notifications.forEach(item => {
            const statusLower = (item.status || 'pending').toLowerCase();
            let cardClass = 'status-pending';
            let pillClass = 'pending';

            if (statusLower.includes('approve')) { cardClass = 'status-approved'; pillClass = 'approved'; }
            else if (statusLower.includes('reject')) { cardClass = 'status-rejected'; pillClass = 'rejected'; }
            else if (statusLower.includes('revision') || statusLower.includes('review')) { cardClass = 'status-review'; pillClass = 'review'; }

            const title = item.is_reminder
                ? `🔔 ${item.message || (item.employee_name || 'Someone') + ': Reminder sent'}`
                : `${item.type || 'Form'} ${statusLower.charAt(0).toUpperCase() + statusLower.slice(1)}`;

            const itemKey = `${item.is_reminder ? 'reminder' : 'status'}-${item.type || 'Form'}-${item.form_no || item.id}`;
            const isChanged = previousNotiState[itemKey] !== undefined && previousNotiState[itemKey] !== statusLower;
            const isBrandNew = previousNotiState[itemKey] === undefined && Object.keys(previousNotiState).length > 0;
            if (isChanged || isBrandNew) hasNewOrChanged = true;
            nextState[itemKey] = statusLower;

            html += `
                <div class="noti-card ${cardClass}">
                    <div>
                        <p class="noti-card-title">${title}</p>
                        <p class="noti-card-formno">Form No: ${item.form_no || ''}</p>
                        <p class="noti-card-date">${item.time || ''}</p>
                    </div>
                    <span class="noti-status-pill ${pillClass}">${(item.status || 'Pending').toUpperCase()}</span>
                </div>
            `;
        });

        notiListBody.innerHTML = html;
        previousNotiState = nextState;

        if (hasNewOrChanged) {
            notiBadge.classList.remove('noti-badge-pop');
            void notiBadge.offsetWidth;
            notiBadge.classList.add('noti-badge-pop');

            notiBellBtn.classList.remove('noti-bell-shake');
            void notiBellBtn.offsetWidth;
            notiBellBtn.classList.add('noti-bell-shake');
        } else if (wasHidden && pendingCount > 0) {
            notiBadge.classList.remove('noti-badge-pop');
            void notiBadge.offsetWidth;
            notiBadge.classList.add('noti-badge-pop');
        }
    }

    async function fetchUsers() {
        try {
            const response = await fetch('http://localhost:3000/api/users');
            const result = await response.json();

            if (result.success) {
                allUsers = result.data;
                renderUserTable(allUsers);
            } else {
                document.getElementById('userTableBody').innerHTML = `<tr><td colspan="6" style="color:red; padding:20px;">Error loading data: ${result.message}</td></tr>`;
            }
        } catch (err) {
            console.error("Error fetching users:", err);
            document.getElementById('userTableBody').innerHTML = '<tr><td colspan="6" style="color:red; padding:20px;">Server connection failed. Ensure Express server is running.</td></tr>';
        }
    }

    function renderUserTable(users) {
        const tbody = document.getElementById('userTableBody');
        const countText = document.getElementById('showingCountText');

        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="padding:20px; color:#64748b;">No employees found.</td></tr>';
            countText.textContent = `Showing 0 of ${allUsers.length} records`;
            return;
        }

        tbody.innerHTML = users.map(user => `
            <tr>
                <td><a href="employee-profile-edit.html?id=${encodeURIComponent(user.user_id)}" class="emp-id-link">${user.user_id}</a></td>
                <td>${user.name || '-'}</td>
                <td>${user.department || '-'}</td>
                <td>${user.position || '-'}</td>
                <td>${user.employment_type || 'Full Time'}</td>
                <td><span class="badge-status-pill active">Active</span></td>
            </tr>
        `).join('');

        countText.textContent = `Showing ${users.length} of ${allUsers.length} records`;
    }
