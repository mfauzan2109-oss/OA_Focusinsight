document.addEventListener('DOMContentLoaded', async function() {
        let allUserRequests = []; 

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
        document.getElementById('sidebarMeta').textContent = `${userId ? userId.toUpperCase() : ''} . ${department}`;
        document.getElementById('bannerName').textContent = username;
        
        const isManager = (userId && userId.toUpperCase().startsWith('MGR')) || 
                          (position && position.toLowerCase().includes('manager'));
        
        if (isManager) {
            const approvalQueueItem = document.getElementById('approvalQueueItem');
            if (approvalQueueItem) {
                approvalQueueItem.style.display = 'flex';
            }
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
        const specificAvatarKey = `userAvatar_${formattedUserId}`;
        const savedAvatar = localStorage.getItem(specificAvatarKey);
        updateAvatarDisplay(savedAvatar);

        window.addEventListener('storage', function(e) {
            if (e.key === specificAvatarKey) {
                updateAvatarDisplay(e.newValue);
            }
        });

        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('currentDateDisplay').textContent = new Date().toLocaleDateString('en-US', dateOptions);

        const searchInput = document.getElementById('searchInput');
        const searchResults = document.getElementById('searchResults');

        if (searchInput && searchResults) {
            searchInput.addEventListener('input', function() {
                const query = this.value.trim().toLowerCase();

                if (!query) {
                    searchResults.innerHTML = '';
                    searchResults.classList.remove('active');
                    return;
                }

                const matches = allUserRequests.filter(item => {
                    const reqType = (item.request_type || 'Travel').toLowerCase();
                    const reqId = `req-${reqType}-${item.id}`.toLowerCase();
                    const status = (item.status || '').toLowerCase();
                    const details = (item.details || item.allowance_type || '').toLowerCase();

                    return reqId.includes(query) || 
                           reqType.includes(query) || 
                           status.includes(query) || 
                           details.includes(query);
                });

                if (matches.length > 0) {
                    let html = '';
                    matches.slice(0, 6).forEach(item => {
                        const reqType = item.request_type || 'Travel';
                        const formattedReqId = `REQ-${reqType.toUpperCase()}-${item.id}`;
                        const cleanStatus = (item.status || '').trim().toLowerCase();
                        const sClass = cleanStatus.includes('approve') ? 'approved' : cleanStatus;

                        html += `
                            <a href="request-details.html?id=${item.id}&type=${encodeURIComponent(reqType)}" class="search-result-item">
                                <div>
                                    <div class="search-result-title">${formattedReqId} - ${reqType}</div>
                                    <div class="search-result-sub">${item.date_submitted || item.created_at || '—'}</div>
                                </div>
                                <span class="status-badge ${sClass}">${item.status}</span>
                            </a>
                        `;
                    });
                    searchResults.innerHTML = html;
                    searchResults.classList.add('active');
                } else {
                    searchResults.innerHTML = `<div style="padding: 12px; text-align: center; color: #64748b; font-size: 12px;">No matching requests found</div>`;
                    searchResults.classList.add('active');
                }
            });

            document.addEventListener('click', function(e) {
                if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                    searchResults.classList.remove('active');
                }
            });
        }

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

        async function fetchMetricsAndQueue() {
            try {
                if (isManager) {
                    const response = await fetch(`http://localhost:3000/api/approval-queue?user_id=${encodeURIComponent(userId)}&department=${encodeURIComponent(department)}&position=${encodeURIComponent(position)}`);
                    const result = await response.json();
                    
                    if (result.success && Array.isArray(result.data)) {
                        const queueData = result.data;
                        const pendingCount = queueData.filter(item => {
                            const s = (item.status || '').trim().toLowerCase();
                            return s === 'pending' || s === 'in review' || s === 'submitted';
                        }).length;

                        const approvedCount = queueData.filter(item => {
                            const s = (item.status || '').trim().toLowerCase();
                            return s.includes('approve') || s === 'completed' || s === 'processed';
                        }).length;

                        const rejectedCount = queueData.filter(item => {
                            const s = (item.status || '').trim().toLowerCase();
                            return s.includes('reject');
                        }).length;

                        document.getElementById('pendingCounter').textContent = `${pendingCount} pending requests`;
                        document.getElementById('metricPending').textContent = pendingCount;
                        document.getElementById('metricApproved').textContent = approvedCount;
                        document.getElementById('metricRejected').textContent = rejectedCount;
                        document.getElementById('metricTotal').textContent = queueData.length;

                        const queueBadge = document.getElementById('approvalQueueBadge');
                        if (queueBadge) {
                            const wasHidden = queueBadge.style.display === 'none' || queueBadge.style.display === '';
                            const prevCount = queueBadge.textContent;
                            queueBadge.textContent = pendingCount;
                            queueBadge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
                            if (pendingCount > 0 && (wasHidden || prevCount !== String(pendingCount))) {
                                queueBadge.classList.remove('noti-badge-pop');
                                void queueBadge.offsetWidth;
                                queueBadge.classList.add('noti-badge-pop');
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("Error fetching approval metrics:", err);
            }
        }

        async function loadRecentActivity() {
            try {
                const response = await fetch(`http://localhost:3000/api/my-requests?employee_id=${encodeURIComponent(userId)}`);
                const result = await response.json();

                if (result.success && Array.isArray(result.data)) {
                    const tbody = document.querySelector('.activity-table tbody');
                    tbody.innerHTML = ''; 

                    const userOnlyRequests = result.data.filter(row => 
                        row.employee_id && row.employee_id.toString().trim().toLowerCase() === userId.toString().trim().toLowerCase()
                    );

                    allUserRequests = userOnlyRequests;

                    if (!isManager) {
                        let pendingCount = 0, approvedCount = 0, rejectedCount = 0;
                        userOnlyRequests.forEach(row => {
                            const s = (row.status || '').trim().toLowerCase();
                            if (s === 'pending') pendingCount++;
                            else if (s.includes('approve')) approvedCount++;
                            else if (s.includes('reject')) rejectedCount++;
                        });

                        document.getElementById('pendingCounter').textContent = `${pendingCount} pending requests`;
                        document.getElementById('metricPending').textContent = pendingCount;
                        document.getElementById('metricApproved').textContent = approvedCount;
                        document.getElementById('metricRejected').textContent = rejectedCount;
                        document.getElementById('metricTotal').textContent = userOnlyRequests.length;
                    }

                    if (userOnlyRequests.length > 0) {
                        const recentData = userOnlyRequests.slice(0, 5);

                        recentData.forEach((row) => {
                            const tr = document.createElement('tr');
                            const cleanStatus = (row.status || '').trim().toLowerCase();
                            const sClass = cleanStatus.includes('approve') ? 'approved' : cleanStatus;
                            const reqType = row.request_type || 'Travel';
                            const formattedAmount = formatRequestAmount(row);

                            tr.innerHTML = `
                                <td>REQ-${reqType.toUpperCase()}-${row.id}</td>
                                <td><strong>${row.employee_name}</strong> <small style="color:#64748b;">(${row.employee_id})</small></td>
                                <td>${reqType} (${row.details || row.allowance_type || 'N/A'})</td>
                                <td>${row.date_submitted || row.claim_month || row.created_at || '—'}</td>
                                <td>${formattedAmount}</td>
                                <td><span class="status-badge ${sClass}">${row.status}</span></td>
                                <td><a href="request-details.html?id=${row.id}&type=${encodeURIComponent(reqType)}" class="view-action-link">View</a></td>
                            `;
                            tbody.appendChild(tr);
                        });
                    } else {
                        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 24px;">No submitted requests found.</td></tr>`;
                    }
                }
            } catch (error) {
                console.error("Error loading recent activity:", error);
                document.querySelector('.activity-table tbody').innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ef4444; padding: 24px;">Failed to load activities.</td></tr>`;
            }
        }

        await fetchMetricsAndQueue();
        await loadRecentActivity();
        await fetchNotifications();

        setInterval(async () => {
            await fetchMetricsAndQueue();
            await loadRecentActivity();
            await fetchNotifications();
        }, 5000);
    });
