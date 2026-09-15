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

        // Profile Avatar Setup
        const specificAvatarKey = `userAvatar_${formattedUserId}`;
        const sidebarAvatarEl = document.getElementById('sidebarAvatarContainer');
        const topAvatarEl = document.getElementById('topAvatar');

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

        // Manager Approval Queue Check
        const isManager = (userId && formattedUserId.startsWith('MGR')) || 
                          (position && position.toLowerCase().includes('manager'));
        if (isManager) {
            const approvalQueueItem = document.getElementById('approvalQueueItem');
            if (approvalQueueItem) {
                approvalQueueItem.style.display = 'flex';
            }
        }

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
        if (topAvatarEl && !savedAvatar) topAvatarEl.textContent = initials;

        // Notification Engine
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
                            notiItem.href = `request-details.html?id=${item.id || item.form_id || item.form_no}&type=${encodeURIComponent(item.type || '')}`;
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
                if (notiBadge) notiBadge.style.display = 'none';
                if (notiList) {
                    notiList.innerHTML = `<div style="padding: 16px; text-align: center; color: #ef4444; font-size: 13px;">Error fetching notifications.</div>`;
                }
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

        function formatRequestAmount(row) {
            let rawVal = row.amount_requested ?? 
                         row.amount ?? 
                         row.loan_amount ?? 
                         row.total_amount ?? 
                         row.amountRequested ?? 
                         row.claim_amount;

            if (rawVal === undefined || rawVal === null || rawVal === '' || rawVal === 'NaN') {
                return '—';
            }

            if (typeof rawVal === 'string') {
                rawVal = rawVal.replace(/[^0-9.-]+/g, '');
            }

            const num = parseFloat(rawVal);
            if (isNaN(num)) {
                return '—';
            }

            return `RM ${num.toFixed(2)}`;
        }

        async function fetchUserRequests() {
            try {
                const response = await fetch(`http://localhost:3000/api/my-requests?employee_id=${encodeURIComponent(userId)}`);
                const result = await response.json();

                if (result.success && Array.isArray(result.data)) {
                    const tbody = document.querySelector('#requestsTable tbody');
                    tbody.innerHTML = '';

                    const userOnlyRequests = result.data.filter(row => 
                        row.employee_id && row.employee_id.toString().trim().toLowerCase() === userId.toString().trim().toLowerCase()
                    );

                    let pending = 0, approved = 0, rejected = 0;
                    
                    userOnlyRequests.forEach(row => {
                        const s = (row.status || '').toString().trim().toLowerCase();
                        if (s.includes('pending') || s === 'in review' || s === 'submitted') {
                            pending++;
                        } else if (s.includes('approve') || s === 'completed' || s === 'processed') {
                            approved++;
                        } else if (s.includes('reject')) {
                            rejected++;
                        }
                    });

                    document.getElementById('countPending').textContent = pending;
                    document.getElementById('countApproved').textContent = approved;
                    document.getElementById('countRejected').textContent = rejected;
                    document.getElementById('countTotal').textContent = userOnlyRequests.length;

                    if (userOnlyRequests.length > 0) {
                        userOnlyRequests.forEach(row => {
                            const tr = document.createElement('tr');
                            const reqType = row.request_type || 'General';
                            const rawStatus = (row.status || '').toString().trim().toLowerCase();
                            
                            let sClass = 'pending';
                            if (rawStatus.includes('approve') || rawStatus === 'completed') sClass = 'approved';
                            else if (rawStatus.includes('reject')) sClass = 'rejected';
                            else if (rawStatus.includes('revision')) sClass = 'revision';

                            const detailsText = row.details || row.allowance_type || 'N/A';
                            const dateSubmitted = row.date_submitted || row.claim_month || row.created_at || '—';
                            const formattedAmount = formatRequestAmount(row);

                            const bellIconHTML = row.last_reminder_sent 
                                ? `<i class='bx bxs-bell-ring' style='color:#ef4444; font-size:16px; margin-left:6px;' title='Reminder sent to approver'></i>` 
                                : '';

                            tr.innerHTML = `
                                <td>REQ-${reqType.toUpperCase()}-${row.id}</td>
                                <td><strong>${row.employee_name}</strong> <small style="color:#64748b;">(${row.employee_id})</small></td>
                                <td>${reqType} (${detailsText})</td>
                                <td>${dateSubmitted}</td>
                                <td>${formattedAmount}</td>
                                <td><span class="status-badge ${sClass}">${row.status}</span>${bellIconHTML}</td>
                                <td><a href="request-details.html?id=${row.id}&type=${encodeURIComponent(reqType)}" class="view-action-link">View</a></td>
                            `;
                            tbody.appendChild(tr);
                        });
                    } else {
                        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: #64748b;">No applications submitted yet by you.</td></tr>`;
                    }
                } else {
                    document.querySelector('#requestsTable tbody').innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: #64748b;">No request records found.</td></tr>`;
                }
            } catch (err) {
                console.error("Error fetching user request logs:", err);
                document.querySelector('#requestsTable tbody').innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: red;">Failed to retrieve records from server.</td></tr>`;
            }
        }

        document.getElementById('searchInput')?.addEventListener('input', function(e) {
            const query = e.target.value.toLowerCase();
            document.querySelectorAll('#requestsTable tbody tr').forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(query) ? '' : 'none';
            });
        });

        await fetchUserRequests();
    });
