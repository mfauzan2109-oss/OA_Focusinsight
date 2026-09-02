document.addEventListener('DOMContentLoaded', async () => {
            let userRequests = [];
            
            const username = sessionStorage.getItem('username') || 'Muhammad Razali';
            const userId = sessionStorage.getItem('userId') || 'emp001';
            const department = sessionStorage.getItem('department') || 'Engineering';

            const formattedUserId = userId.toUpperCase();

            document.getElementById('sidebarName').textContent = username;
            document.getElementById('sidebarMeta').textContent = `${formattedUserId} • ${department}`;

            const specificAvatarKey = `userAvatar_${formattedUserId}`;
            function updateAvatarDisplay(avatarBase64) {
                const sidebarAvatar = document.getElementById('sidebarAvatarContainer');
                const topAvatar = document.getElementById('topAvatarContainer');
                if (avatarBase64) {
                    const imgHTML = `<img src="${avatarBase64}" alt="Profile Picture" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
                    if (sidebarAvatar) sidebarAvatar.innerHTML = imgHTML;
                    if (topAvatar) topAvatar.innerHTML = imgHTML;
                } else {
                    const initials = username.split(' ').map(n => n.charAt(0)).join('').substring(0, 2).toUpperCase();
                    if (topAvatar) topAvatar.textContent = initials;
                }
            }

            const savedAvatar = localStorage.getItem(specificAvatarKey);
            updateAvatarDisplay(savedAvatar);

            window.addEventListener('storage', function(e) {
                if (e.key === specificAvatarKey) {
                    updateAvatarDisplay(e.newValue);
                }
            });

            const position = sessionStorage.getItem('position') || '';
            checkApprovalQueueAccess(formattedUserId, department, position);

            // ---- Notification Bell Setup (matching approval-queue) ----
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

            if (refreshNotiBtn) {
                refreshNotiBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    fetchNotifications();
                });
            }

            fetchNotifications();
            setInterval(fetchNotifications, 5000);

            try {
                const reqRes = await fetch(`http://localhost:3000/api/my-requests?employee_id=${encodeURIComponent(userId)}`);
                const reqData = await reqRes.json();
                if (reqData.success && Array.isArray(reqData.data)) {
                    userRequests = reqData.data;
                }
            } catch (err) {
                console.error("Error loading requests for search bar:", err);
            }

            const searchInput = document.getElementById('headerSearchInput');
            const searchResults = document.getElementById('searchResults');

            if (searchInput && searchResults) {
                searchInput.addEventListener('input', function() {
                    const query = this.value.trim().toLowerCase();

                    if (!query) {
                        searchResults.innerHTML = '';
                        searchResults.classList.remove('active');
                        return;
                    }

                    const matches = userRequests.filter(item => {
                        const reqType = (item.request_type || 'Leave').toLowerCase();
                        const reqId = `req-${reqType}-${item.id}`.toLowerCase();
                        const status = (item.status || '').toLowerCase();
                        const details = (item.details || item.allowance_type || item.reason || '').toLowerCase();

                        return reqId.includes(query) || 
                               reqType.includes(query) || 
                               status.includes(query) || 
                               details.includes(query);
                    });

                    if (matches.length > 0) {
                        let html = '';
                        matches.slice(0, 6).forEach(item => {
                            const reqType = item.request_type || 'Leave';
                            const formattedReqId = `REQ-${reqType.toUpperCase().slice(0,3)}-${item.id}`;
                            const cleanStatus = (item.status || 'pending').trim().toLowerCase();

                            html += `
                                <a href="request-details.html?id=${item.id}&type=${encodeURIComponent(reqType)}" class="search-result-item">
                                    <div>
                                        <div class="search-result-title">${formattedReqId} - ${reqType}</div>
                                        <div class="search-result-sub">${item.date_submitted || item.created_at || '—'}</div>
                                    </div>
                                    <span class="status-badge status-${cleanStatus}">${item.status || 'Pending'}</span>
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
            }

            document.addEventListener('click', function(e) {
                const searchBox = document.querySelector('.search-box');
                if (searchBox && !searchBox.contains(e.target)) {
                    const sr = document.getElementById('searchResults');
                    if (sr) sr.classList.remove('active');
                }
            });

            const urlParams = new URLSearchParams(window.location.search);
            const reqId = urlParams.get('id');
            const reqType = urlParams.get('type') || 'Leave';

            if (!reqId) {
                alert('No Request ID specified in URL. Returning to request list.');
                window.location.href = 'my-request.html';
                return;
            }

            try {
                const response = await fetch(`http://localhost:3000/api/request-details?id=${encodeURIComponent(reqId)}&type=${encodeURIComponent(reqType)}`);
                const result = await response.json();

                if (result.success && result.data) {
                    populateDetails(result.data, reqType);
                } else {
                    alert('Failed to fetch details: ' + (result.message || 'Record not found in system database.'));
                }
            } catch (err) {
                console.error('API Fetch Error:', err);
                alert('Error connecting to Node server at http://localhost:3000');
            }
        });

        async function fetchNotifications() {
            const notiBellBtn = document.getElementById('notiBellBtn');
            const notiList    = document.getElementById('notiList');
            const notiBadge   = document.getElementById('notiBadge');
            const formattedUserId = (sessionStorage.getItem('userId') || '').toUpperCase();
            const department      = sessionStorage.getItem('department') || '';
            const position        = sessionStorage.getItem('position')   || '';

            try {
                const response = await fetch(`http://localhost:3000/api/notifications?employee_id=${encodeURIComponent(formattedUserId)}&department=${encodeURIComponent(department)}&position=${encodeURIComponent(position)}`);
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
                                cardClass = 'status-reminder'; pillClass = 'reminder';
                            } else if (statusLower.includes('approve') || statusLower === 'completed') {
                                cardClass = 'status-approved'; pillClass = 'approved';
                            } else if (statusLower.includes('reject')) {
                                cardClass = 'status-rejected'; pillClass = 'rejected';
                            } else if (statusLower.includes('revision') || statusLower.includes('review')) {
                                cardClass = 'status-review'; pillClass = 'review';
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
                                </div>`;
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
                    if (notiList) notiList.innerHTML = `<div style="padding: 16px; text-align: center; color: #94a3b8; font-size: 13px;">No notifications found.</div>`;
                }
            } catch (err) {
                console.error('Error fetching notifications:', err);
                if (notiList) notiList.innerHTML = `<div style="padding: 16px; text-align: center; color: #94a3b8; font-size: 13px;">Could not load notifications.</div>`;
            }
        }

        function populateDetails(data, type) {
            const displayId = data.id || data.ID || '0';
            document.getElementById('req-id-header').innerText = `REQ-${type.toUpperCase().slice(0, 3)}-${displayId}`;
            document.getElementById('req-type-badge').innerText = type;

            document.getElementById('emp-name').innerText = data.employee_name || data['Employee Name'] || '—';
            document.getElementById('emp-id').innerText = data.employee_id || data['Employee ID'] || '—';
            document.getElementById('emp-dept').innerText = data.department || data['Department'] || '—';

            document.getElementById('summary-type').innerText = type;
            const rawDate = data.created_at || data['Created At'] || data['Start Date'] || '';
            document.getElementById('summary-date').innerText = rawDate ? new Date(rawDate).toISOString().split('T')[0] : '—';
            
            let amountDisplay = 'N/A';
            if (data.total_amount) amountDisplay = `RM ${parseFloat(data.total_amount).toFixed(2)}`;
            else if (data.total_claim) amountDisplay = `RM ${parseFloat(data.total_claim).toFixed(2)}`;
            else if (data.amount_requested) amountDisplay = `RM ${parseFloat(data.amount_requested).toFixed(2)}`;
            document.getElementById('summary-amount').innerText = amountDisplay;

            const statusRaw = (data.status || data['Status'] || 'PENDING').toUpperCase();
            const statusElem = document.getElementById('status-badge');
            statusElem.innerText = statusRaw;
            statusElem.className = `status-badge status-${statusRaw}`;

            const btnReminder = document.getElementById('btnSendReminder');
            if (btnReminder) {
                if (statusRaw === 'PENDING') {
                    btnReminder.style.display = 'inline-flex';

                    const now = new Date();
                    const createdDate = new Date(data.created_at || data['Created At'] || now);
                    const lastReminder = data.last_reminder_sent ? new Date(data.last_reminder_sent) : createdDate;
                    
                    const hoursPassed = (now - lastReminder) / (1000 * 60 * 60);

                    if (hoursPassed >= 24) {
                        btnReminder.disabled = false;
                        btnReminder.style.opacity = '1';
                        btnReminder.style.cursor = 'pointer';
                        btnReminder.innerHTML = `<i class="fa-solid fa-bell"></i> Send Reminder`;
                    } else {
                        const hoursLeft = Math.ceil(24 - hoursPassed);
                        btnReminder.disabled = true;
                        btnReminder.style.opacity = '0.6';
                        btnReminder.style.cursor = 'not-allowed';
                        btnReminder.innerHTML = `<i class="fa-solid fa-clock"></i> Reminder Available (${hoursLeft}h)`;
                    }

                    btnReminder.onclick = async function() {
                        if (confirm('Do you want to send a reminder notification to the assigned approver?')) {
                            try {
                                btnReminder.disabled = true;
                                btnReminder.innerText = 'Sending...';

                                const res = await fetch('http://localhost:3000/api/send-reminder', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ id: data.id || data.ID, type: type })
                                });

                                const resData = await res.json();
                                alert(resData.message);

                                if (resData.success) {
                                    window.location.reload();
                                } else {
                                    btnReminder.disabled = false;
                                    btnReminder.innerHTML = `<i class="fa-solid fa-bell"></i> Send Reminder`;
                                }
                            } catch (err) {
                                console.error('Reminder error:', err);
                                alert('Error sending reminder to server.');
                                btnReminder.disabled = false;
                            }
                        }
                    };
                } else {
                    btnReminder.style.display = 'none';
                }
            }

            const timelineStage1 = document.getElementById('timeline-stage1');
            if (statusRaw === 'APPROVED' || statusRaw === 'APPROVE') {
                timelineStage1.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #16a34a;"></i> <strong>Stage 1 Approval:</strong> Approved`;
            } else if (statusRaw === 'REJECTED' || statusRaw === 'REJECT') {
                timelineStage1.innerHTML = `<i class="fa-solid fa-circle-xmark" style="color: #dc2626;"></i> <strong>Stage 1 Approval:</strong> Rejected`;
            } else {
                timelineStage1.innerHTML = `<i class="fa-solid fa-user-clock" style="color: #d97706;"></i> <strong>Stage 1 Approval:</strong> Pending Review`;
            }

            document.getElementById('req-reason').innerText = data.reason || data['Reason'] || 'No description provided.';

            const docPath = data.supporting_document || data['Supporting Documen'] || data.attachment_path || data.attachment;
            const attachmentLink = document.getElementById('attachment-link');
            const attachmentName = document.getElementById('attachment-name');
            const attachmentSubtext = document.getElementById('attachment-subtext');
            const attachmentIcon = document.getElementById('attachment-icon');

            if (docPath && docPath.trim() !== '' && docPath !== 'null') {
                const cleanFileName = docPath.split('/').pop().split('\\').pop();
                const fileExt = cleanFileName.split('.').pop().toLowerCase();

                const fullFileUrl = docPath.startsWith('http') ? docPath : `http://localhost:3000/${docPath}`;

                attachmentLink.href = fullFileUrl;
                attachmentLink.style.pointerEvents = 'auto';
                attachmentLink.style.opacity = '1';
                attachmentName.innerText = cleanFileName;
                attachmentSubtext.innerText = 'Click to open/download document in new tab';

                if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(fileExt)) {
                    attachmentIcon.className = 'fa-solid fa-file-image fa-2x';
                    attachmentIcon.style.color = '#2563eb';
                } else if (['doc', 'docx'].includes(fileExt)) {
                    attachmentIcon.className = 'fa-solid fa-file-word fa-2x';
                    attachmentIcon.style.color = '#1d4ed8';
                } else {
                    attachmentIcon.className = 'fa-solid fa-file-pdf fa-2x';
                    attachmentIcon.style.color = '#ef4444';
                }
            } else {
                attachmentName.innerText = 'No file attached';
                attachmentSubtext.innerText = 'No supporting documents provided';
                attachmentLink.removeAttribute('href');
                attachmentLink.style.pointerEvents = 'none';
                attachmentLink.style.opacity = '0.6';
                attachmentIcon.className = 'fa-solid fa-file-excel fa-2x';
                attachmentIcon.style.color = '#94a3b8';
            }

            document.getElementById('timeline-created').innerText = rawDate ? new Date(rawDate).toLocaleString() : '—';

            const container = document.getElementById('dynamic-fields-container');
            const calcBlock = document.getElementById('calculation-block');
            container.innerHTML = '';
            let fieldsHTML = '';

            const lowerType = type.toLowerCase();

            if (lowerType.includes('leave')) {
                calcBlock.style.display = 'none';
                fieldsHTML = `
                    <div class="form-group"><label>Leave Type</label><div class="form-control-static">${data['Leave Type'] || data.leave_type || '—'}</div></div>
                    <div class="form-group"><label>Day Type</label><div class="form-control-static">${data['Day type'] || data.day_type || 'Full Day'}</div></div>
                    <div class="form-group"><label>Start Date</label><div class="form-control-static">${data['Start Date'] ? new Date(data['Start Date']).toISOString().split('T')[0] : '—'}</div></div>
                    <div class="form-group"><label>End Date</label><div class="form-control-static">${data['End Date'] ? new Date(data['End Date']).toISOString().split('T')[0] : '—'}</div></div>
                    <div class="form-group"><label>Total Days</label><div class="form-control-static">${data['No of Days'] || data.total_days || '1'} Day(s)</div></div>
                `;
            } else if (lowerType.includes('overtime')) {
                calcBlock.style.display = 'block';
                document.getElementById('calc-hours').innerText = data.period || '0h';
                document.getElementById('calc-rate').innerText = `1.5x (Rate: ${data.ot_rate || 'Standard'})`;
                document.getElementById('calc-total').innerText = amountDisplay;

                fieldsHTML = `
                    <div class="form-group"><label>OT Date</label><div class="form-control-static">${data.ot_date || '—'}</div></div>
                    <div class="form-group"><label>Day Type</label><div class="form-control-static">${data.day_type || 'Normal Workday'}</div></div>
                    <div class="form-group"><label>Start Time</label><div class="form-control-static">${data.start_time || '—'}</div></div>
                    <div class="form-group"><label>End Time</label><div class="form-control-static">${data.end_time || '—'}</div></div>
                    <div class="form-group"><label>Night Allowance</label><div class="form-control-static">${data.night_allowance ? 'Yes' : 'No'}</div></div>
                    <div class="form-group"><label>Meal Allowance</label><div class="form-control-static">${data.meal_allowance ? 'Yes' : 'No'}</div></div>
                `;
            } else if (lowerType.includes('travel')) {
                calcBlock.style.display = 'none';
                fieldsHTML = `
                    <div class="form-group"><label>Allowance Type</label><div class="form-control-static">${data.allowance_type || '—'}</div></div>
                    <div class="form-group"><label>Claim Month</label><div class="form-control-static">${data.claim_month || '—'}</div></div>
                    <div class="form-group"><label>Total Claim Amount</label><div class="form-control-static">${amountDisplay}</div></div>
                `;
            } else if (lowerType.includes('loan')) {
                calcBlock.style.display = 'none';
                fieldsHTML = `
                    <div class="form-group"><label>Loan Type</label><div class="form-control-static">${data.loan_type || '—'}</div></div>
                    <div class="form-group"><label>Repayment Period</label><div class="form-control-static">${data.repayment_period || '—'} Months</div></div>
                    <div class="form-group"><label>Monthly Salary</label><div class="form-control-static">RM ${parseFloat(data.monthly_salary || 0).toFixed(2)}</div></div>
                    <div class="form-group"><label>Disbursement Method</label><div class="form-control-static">${data.disbursement_method || 'Bank Transfer'}</div></div>
                    <div class="form-group"><label>Account Holder</label><div class="form-control-static">${data.account_holder || '—'}</div></div>
                    <div class="form-group"><label>Account Number</label><div class="form-control-static">${data.account_number || '—'}</div></div>
                `;
            } else if (lowerType.includes('disbursement')) {
                calcBlock.style.display = 'none';
                fieldsHTML = `
                    <div class="form-group"><label>Claim Type</label><div class="form-control-static">General Disbursement</div></div>
                    <div class="form-group"><label>Total Disbursement Amount</label><div class="form-control-static">${amountDisplay}</div></div>
                `;
            }

            container.innerHTML = fieldsHTML;
        }

        async function checkApprovalQueueAccess(userId, department, position) {
            const queueItem = document.getElementById('approvalQueueItem');
            const pos = (position || '').toLowerCase();
            const dept = (department || '').toLowerCase();

            if (pos.includes('manager') || pos.includes('ceo') || pos.includes('supervisor') || dept === 'management' || userId.toUpperCase().startsWith('MGR')) {
                if (queueItem) queueItem.style.display = 'flex';
                try {
                    const res = await fetch(`http://localhost:3000/api/approval-queue?user_id=${userId}&department=${department}&position=${position}`);
                    const data = await res.json();
                    if (data.success && data.data) {
                        const pendingCount = data.data.filter(i => (i.status || '').toLowerCase() === 'pending').length;
                        const badge = document.getElementById('approvalQueueBadge');
                        if (badge && pendingCount > 0) {
                            badge.textContent = pendingCount;
                            badge.style.display = 'inline-block';
                        }
                    }
                } catch (e) {
                    console.error('Approval queue badge check failed:', e);
                }
            }
        }
