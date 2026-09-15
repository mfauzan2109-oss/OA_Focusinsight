document.addEventListener('DOMContentLoaded', async function() {
        const urlParams = new URLSearchParams(window.location.search);
        const reqId = urlParams.get('id');
        const reqType = (urlParams.get('type') || '').toLowerCase().trim();

        // 1. Session & Avatar Setup
        const userId = sessionStorage.getItem('userId') || sessionStorage.getItem('user_id') || '';
        const username = sessionStorage.getItem('username') || 'HR User';
        const department = sessionStorage.getItem('department') || 'Human Resources';
        const position = sessionStorage.getItem('position') || 'HR Staff';

        const formattedUserId = userId.toUpperCase();

        document.getElementById('sidebarName').textContent = username;
        document.getElementById('sidebarMeta').textContent = `${formattedUserId} • ${department}`;

        const initials = username.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        const topAvatarEl = document.getElementById('topAvatar');
        const sidebarAvatarEl = document.getElementById('sidebarAvatarContainer');

        if (topAvatarEl) topAvatarEl.textContent = initials || 'HR';

        const specificAvatarKey = `userAvatar_${formattedUserId}`;
        function updateAvatarDisplay(avatarBase64) {
            if (!avatarBase64) return;
            const imgHTML = `<img src="${avatarBase64}" alt="Profile Picture" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
            if (sidebarAvatarEl) sidebarAvatarEl.innerHTML = imgHTML;
            if (topAvatarEl) topAvatarEl.innerHTML = imgHTML;
        }
        updateAvatarDisplay(localStorage.getItem(specificAvatarKey));

        // 2. DATABASE-LINKED NOTIFICATION ENGINE
        const notiBellBtn = document.getElementById('notiBellBtn');
        const notiDropdown = document.getElementById('notiDropdown');
        const notiList = document.getElementById('notiList');
        const notiBadge = document.getElementById('notiBadge');
        const markAllReadBtn = document.getElementById('markAllReadBtn');

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
            if (!formattedUserId) return;
            try {
                const res = await fetch(`/api/notifications?employee_id=${encodeURIComponent(formattedUserId)}&department=${encodeURIComponent(department)}&position=${encodeURIComponent(position)}`);
                const data = await res.json();

                if (data.success && data.notifications && data.notifications.length > 0) {
                    const unreadCount = data.notifications.filter(item => 
                        item.is_reminder || (item.status || '').toLowerCase().includes('pending')
                    ).length;

                    if (notiBadge) {
                        if (unreadCount > 0) {
                            notiBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                            notiBadge.style.display = 'block';
                        } else {
                            notiBadge.style.display = 'none';
                        }
                    }

                    if (notiList) {
                        notiList.innerHTML = '';
                        data.notifications.forEach(item => {
                            const statusLower = (item.status || '').toLowerCase();
                            let badgeBg = '#fef3c7';
                            let badgeColor = '#b45309';

                            if (item.is_reminder) {
                                badgeBg = '#fee2e2';
                                badgeColor = '#b91c1c';
                            } else if (statusLower.includes('approve') || statusLower === 'completed') {
                                badgeBg = '#dcfce7';
                                badgeColor = '#15803d';
                            } else if (statusLower.includes('reject')) {
                                badgeBg = '#fee2e2';
                                badgeColor = '#b91c1c';
                            }

                            const notiCard = document.createElement('a');
                            notiCard.className = 'noti-item';
                            notiCard.href = `request-details-hr.html?id=${item.id}&type=${encodeURIComponent(item.type || '')}`;
                            notiCard.innerHTML = `
                                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                    <div>
                                        <div class="noti-title">${item.is_reminder ? '🔔 Reminder' : item.type} (${item.form_no})</div>
                                        <div class="noti-msg">${item.message || 'Status: ' + item.status}</div>
                                        <div class="noti-time">${item.time || ''}</div>
                                    </div>
                                    <span style="font-size: 10px; padding: 2px 6px; border-radius: 10px; background: ${badgeBg}; color: ${badgeColor}; font-weight: 700; text-transform: uppercase;">
                                        ${item.is_reminder ? 'Reminder' : item.status}
                                    </span>
                                </div>
                            `;
                            notiList.appendChild(notiCard);
                        });
                    }
                } else {
                    if (notiBadge) notiBadge.style.display = 'none';
                    if (notiList) notiList.innerHTML = '<div class="noti-body-empty">No notifications found</div>';
                }
            } catch (err) {
                console.error('Notifications fetch error:', err);
                if (notiList) notiList.innerHTML = '<div class="noti-body-empty">Failed to load notifications</div>';
            }
        }

        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                fetchNotifications();
            });
        }

        fetchNotifications();
        setInterval(fetchNotifications, 10000); // Polling every 10 seconds for real-time updates

        // 3. Fetch Real Record Details from MySQL Database
        if (!reqId || !reqType) {
            document.getElementById('dynamicFormContainer').innerHTML = `<div style="text-align: center; color: #ef4444; padding: 24px; font-weight: 600;">Error: Invalid request parameters specified in URL.</div>`;
            return;
        }

        try {
            const res = await fetch(`/api/request-details?id=${encodeURIComponent(reqId)}&type=${encodeURIComponent(reqType)}`);
            const result = await res.json();

            if (result.success && result.data) {
                populatePage(result.data, reqType);
            } else {
                document.getElementById('dynamicFormContainer').innerHTML = `<div style="text-align: center; color: #ef4444; padding: 24px; font-weight: 600;">Record not found in database.</div>`;
            }
        } catch (err) {
            console.error('Database API error:', err);
            document.getElementById('dynamicFormContainer').innerHTML = `<div style="text-align: center; color: #ef4444; padding: 24px; font-weight: 600;">Failed to connect to the database server.</div>`;
        }

        function populatePage(data, type) {
            const rawId = data.id || data.ID || reqId;
            const displayId = `REQ-${type.toUpperCase()}-${String(rawId).padStart(3, '0')}`;
            
            document.getElementById('reqTitleId').textContent = displayId;
            document.getElementById('reqTypePill').textContent = type.toUpperCase();

            // Employee Meta
            const empName = data.employee_name || data['Employee Name'] || '—';
            const empId = data.employee_id || data['Employee ID'] || '—';
            const empDept = data.department || data.Department || '—';
            const empPos = data.position || 'Employee';
            
            document.getElementById('infoEmpName').textContent = empName;
            document.getElementById('infoEmpId').textContent = empId;
            document.getElementById('infoDeptPos').textContent = `${empDept} • ${empPos}`;

            // Request Summary
            document.getElementById('infoReqType').textContent = type.charAt(0).toUpperCase() + type.slice(1);
            
            const rawCreated = data.created_at || data['Created At'] || data['Start Date'];
            let formattedCreated = '—';
            if (rawCreated) {
                try { formattedCreated = new Date(rawCreated).toISOString().split('T')[0]; } catch(e) {}
            }
            document.getElementById('infoSubmittedDate').textContent = formattedCreated;

            // Total Amount Calculation
            let amountVal = 'Not Applicable';
            if (data.total_amount !== undefined && data.total_amount !== null) amountVal = `RM ${parseFloat(data.total_amount).toFixed(2)}`;
            else if (data.total_claim !== undefined && data.total_claim !== null) amountVal = `RM ${parseFloat(data.total_claim).toFixed(2)}`;
            else if (data.amount_requested !== undefined && data.amount_requested !== null) amountVal = `RM ${parseFloat(data.amount_requested).toFixed(2)}`;
            
            document.getElementById('infoTotalAmount').textContent = amountVal;

            // Status Badge Formatting
            const status = (data.status || data.Status || 'PENDING').trim().toUpperCase();
            const statusPill = document.getElementById('statusPillLg');
            statusPill.textContent = status;

            let sClass = 'pending';
            if (status.includes('APPROVE') || status === 'COMPLETED') sClass = 'approved';
            else if (status.includes('REJECT')) sClass = 'rejected';
            else if (status.includes('REVISION')) sClass = 'revision';

            statusPill.className = `status-badge-lg ${sClass}`;
            document.getElementById('statusSubText').textContent = status === 'APPROVED' ? 'All levels approved' : 'Current database status';

            // Attachment Files
            const attachmentDoc = data.supporting_document || data['Supporting Documen'] || data.attachment_path;
            if (attachmentDoc) {
                const link = document.getElementById('attachmentLink');
                const cleanPath = attachmentDoc.startsWith('/') ? attachmentDoc.substring(1) : attachmentDoc;
                link.href = `../${cleanPath}`;
                link.style.display = 'flex';
                document.getElementById('attachmentName').textContent = cleanPath.split('/').pop();
                document.getElementById('noAttachmentMsg').style.display = 'none';
            } else {
                document.getElementById('attachmentLink').style.display = 'none';
                document.getElementById('noAttachmentMsg').style.display = 'block';
            }

            // Timeline Info
            document.getElementById('timelineSubmittedBy').textContent = empName;
            document.getElementById('timelineSubmittedDate').textContent = formattedCreated;

            // Render Form Body
            renderDynamicForm(data, type);
        }

        function renderDynamicForm(data, type) {
            const container = document.getElementById('dynamicFormContainer');
            container.innerHTML = '';

            if (type.includes('overtime')) {
                const nightCheck = data.night_allowance ? '<i class="fa-regular fa-square-check" style="color:#16a34a;"></i> Night Allowance' : '<i class="fa-regular fa-square" style="color:#cbd5e1;"></i> Night Allowance';
                const mealCheck = data.meal_allowance ? '<i class="fa-regular fa-square-check" style="color:#16a34a;"></i> Meal Allowance' : '<i class="fa-regular fa-square" style="color:#cbd5e1;"></i> Meal Allowance';

                container.innerHTML = `
                    <div class="form-grid-2">
                        <div>
                            <div class="form-group">
                                <label>OT Date</label>
                                <div class="form-control-static">${data.ot_date || '—'}</div>
                            </div>
                            <div class="form-group">
                                <label>Period / Duration</label>
                                <div class="form-control-static">${data.period || '—'}</div>
                            </div>
                            <div class="form-group">
                                <label>Day Type</label>
                                <div class="form-control-static">${data.day_type || '—'}</div>
                            </div>
                            <div class="form-grid-2">
                                <div class="form-group">
                                    <label>OT Allowance</label>
                                    <div class="form-control-static">RM ${parseFloat(data.ot_allowance || 0).toFixed(2)}</div>
                                </div>
                                <div class="form-group">
                                    <label>OT Multiplier Rate</label>
                                    <div class="form-control-static">${data.ot_rate || '1.0'}</div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <div class="form-grid-2">
                                <div class="form-group">
                                    <label>Start Time</label>
                                    <div class="form-control-static">${data.start_time || '—'}</div>
                                </div>
                                <div class="form-group">
                                    <label>End Time</label>
                                    <div class="form-control-static">${data.end_time || '—'}</div>
                                </div>
                            </div>
                            <div class="checkbox-row">
                                <div class="checkbox-item">${nightCheck}</div>
                                <div class="checkbox-item">${mealCheck}</div>
                            </div>
                        </div>
                    </div>

                    <div class="form-grid-2" style="margin-top: 10px;">
                        <div class="summary-card-yellow">
                            <div class="title">Overtime Claim Breakdown</div>
                            <div class="summary-row total">
                                <span>Total Claimed Amount</span>
                                <strong>RM ${parseFloat(data.total_claim || 0).toFixed(2)}</strong>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Reason / Description</label>
                            <div class="form-control-static" style="min-height: 90px; align-items: flex-start; padding-top: 10px;">${data.reason || 'No justification provided.'}</div>
                        </div>
                    </div>
                `;
            } else if (type.includes('leave')) {
                container.innerHTML = `
                    <div class="form-grid-2">
                        <div class="form-group"><label>Leave Type</label><div class="form-control-static">${data['Leave Type'] || data.leave_type || '—'}</div></div>
                        <div class="form-group"><label>Day Type</label><div class="form-control-static">${data['Day type'] || data.day_type || 'Full Day'}</div></div>
                    </div>
                    <div class="form-grid-2">
                        <div class="form-group"><label>Start Date</label><div class="form-control-static">${data['Start Date'] ? data['Start Date'].split('T')[0] : '—'}</div></div>
                        <div class="form-group"><label>End Date</label><div class="form-control-static">${data['End Date'] ? data['End Date'].split('T')[0] : '—'}</div></div>
                    </div>
                    <div class="form-grid-2">
                        <div class="form-group"><label>Total Applied Days</label><div class="form-control-static">${data['No of Days'] || '1'} Day(s)</div></div>
                        <div class="form-group"><label>Reason</label><div class="form-control-static">${data.Reason || data.reason || 'N/A'}</div></div>
                    </div>
                `;
            } else if (type.includes('disbursement')) {
                let itemsTableHtml = '';
                if (Array.isArray(data.items) && data.items.length > 0) {
                    let rows = data.items.map(it => `
                        <tr>
                            <td>${it.invoice_date || '—'}</td>
                            <td>${it.invoice_no || '—'}</td>
                            <td>${it.supplier_name || '—'}</td>
                            <td>${it.description || '—'}</td>
                            <td style="font-weight: 700;">RM ${parseFloat(it.amount || 0).toFixed(2)}</td>
                        </tr>
                    `).join('');

                    itemsTableHtml = `
                        <div style="margin-top: 16px;">
                            <label style="font-size: 12px; font-weight: 700; color: #334155; display: block; margin-bottom: 6px;">Itemized Expense Lines</label>
                            <table class="details-table">
                                <thead>
                                    <tr>
                                        <th>INVOICE DATE</th>
                                        <th>INVOICE NO</th>
                                        <th>SUPPLIER</th>
                                        <th>DESCRIPTION</th>
                                        <th>AMOUNT</th>
                                    </tr>
                                </thead>
                                <tbody>${rows}</tbody>
                            </table>
                        </div>
                    `;
                }

                container.innerHTML = `
                    <div class="form-grid-2">
                        <div class="form-group"><label>Total Expense Claim</label><div class="form-control-static" style="font-weight: 800; color: #15803d;">RM ${parseFloat(data.total_amount || 0).toFixed(2)}</div></div>
                        <div class="form-group"><label>Department</label><div class="form-control-static">${data.department || '—'}</div></div>
                    </div>
                    ${itemsTableHtml}
                `;
            } else if (type.includes('travel')) {
                container.innerHTML = `
                    <div class="form-grid-2">
                        <div class="form-group"><label>Allowance Type / Destination</label><div class="form-control-static">${data.allowance_type || data.travel_destination || '—'}</div></div>
                        <div class="form-group"><label>Travel Mode</label><div class="form-control-static">${data.travel_mode || '—'}</div></div>
                    </div>
                    <div class="form-grid-2">
                        <div class="form-group"><label>Expected Departure</label><div class="form-control-static">${data.expected_departure_date || '—'}</div></div>
                        <div class="form-group"><label>Expected Arrival / Return</label><div class="form-control-static">${data.expected_arrival_date || data.estimated_return_date || '—'}</div></div>
                    </div>
                    <div class="form-grid-2">
                        <div class="form-group"><label>Total Estimated Cost</label><div class="form-control-static" style="font-weight: 800; color: #15803d;">RM ${parseFloat(data.total_amount || 0).toFixed(2)}</div></div>
                        <div class="form-group"><label>Accommodation Required</label><div class="form-control-static">${data.required_accommodation || 'Yes'}</div></div>
                    </div>
                    <div class="form-group"><label>Reason / Venue Address</label><div class="form-control-static">${data.reason || '—'}</div></div>
                `;
            } else if (type.includes('loan')) {
                container.innerHTML = `
                    <div class="form-grid-2">
                        <div class="form-group"><label>Loan Type</label><div class="form-control-static">${data.loan_type || '—'}</div></div>
                        <div class="form-group"><label>Repayment Period</label><div class="form-control-static">${data.repayment_period || '—'} Months</div></div>
                    </div>
                    <div class="form-grid-2">
                        <div class="form-group"><label>Amount Requested</label><div class="form-control-static" style="font-weight: 800; color: #1d4ed8;">RM ${parseFloat(data.amount_requested || 0).toFixed(2)}</div></div>
                        <div class="form-group"><label>Disbursement Method</label><div class="form-control-static">${data.disbursement_method || 'Bank Transfer'}</div></div>
                    </div>
                    <div class="form-grid-2">
                        <div class="form-group"><label>Account Holder</label><div class="form-control-static">${data.account_holder || '—'}</div></div>
                        <div class="form-group"><label>Account Number & Bank</label><div class="form-control-static">${data.account_number || ''} (${data.bank_details || '—'})</div></div>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div class="form-group"><label>Request Details</label><div class="form-control-static">${data.details || 'General Request Details'}</div></div>
                `;
            }
        }
    });
