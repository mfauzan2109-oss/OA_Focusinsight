const API_BASE_URL = 'http://localhost:3000/api';
        let selectedItem = { id: null, table: null, type: null, isTravelBooking: false };

        document.addEventListener("DOMContentLoaded", function() {
            loadLists();

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
                const topAvatar = document.getElementById('topAvatarContainer');
                if (!sidebarAvatar && !topAvatar) return;

                function renderSidebarAvatar(base64Image) {
                    const imgHtml = `<img src="${base64Image}" alt="Profile Picture" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
                    if (sidebarAvatar) sidebarAvatar.innerHTML = imgHtml;
                    if (topAvatar) topAvatar.innerHTML = imgHtml;
                }

                const savedAvatar = localStorage.getItem(avatarKey);
                if (savedAvatar) renderSidebarAvatar(savedAvatar);

                window.addEventListener('storage', (e) => {
                    if (e.key === avatarKey && e.newValue) renderSidebarAvatar(e.newValue);
                });
            })();

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

        // 1. Load pending approval & booking lists
        async function loadLists() {
            const userId = sessionStorage.getItem('userId') || 'HR4001';

            try {
                const response = await fetch(`${API_BASE_URL}/hr/processing-lists?user_id=${userId}`);
                const data = await response.json();

                if (data.success) {
                    renderItems('approvalListContainer', data.pending_approvals, 'approvalCount', false);
                    renderItems('bookingListContainer', data.pending_bookings, 'bookingCount', true);
                } else {
                    alert(data.message || 'Access Denied');
                    window.location.href = '../index.html';
                }
            } catch (err) {
                console.error("Error fetching HR lists:", err);
            }
        }

        // Render request cards with Bell Icon & Reminder subtext if present
        function renderItems(containerId, items, countId, isBookingList) {
            document.getElementById(countId).innerText = `${items.length} Request awaiting action`;
            const container = document.getElementById(containerId);

            if (!items || items.length === 0) {
                container.innerHTML = '<div style="padding:12px; font-size:12px; color:#94a3b8;">No pending items</div>';
                return;
            }

            container.innerHTML = items.map(item => {
                const reminderHTML = item.has_reminder ? `
                    <div class="reminder-text-sub">
                        ${item.reminder_text || 'Reminder sent recently.'}
                    </div>
                ` : '';

                const bellIconHTML = item.has_reminder ? `
                    <i class="fa-solid fa-bell reminder-bell-icon" title="Reminder received from requester"></i>
                ` : '';

                return `
                    <div class="request-item" onclick="selectRequest('${item.source_table}', '${item.request_type}', ${item.id}, this, ${isBookingList})">
                        <div>
                            <h4 style="font-size: 13px; font-weight: 700; color: #1e293b;">${item.employee_name}</h4>
                            <p style="font-size: 11px; color:#64748b;">${item.request_type} | ${item.formatted_id}</p>
                            ${reminderHTML}
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            ${bellIconHTML}
                            <div style="color: #94a3b8; font-weight: bold; font-size: 16px;">&rsaquo;</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // 2. Select Request & Dynamically Bind Database Payload
        async function selectRequest(table, type, id, el, isBookingList = false) {
            selectedItem = { id, table, type, isTravelBooking: isBookingList || type.toLowerCase().includes('travel') };
            document.querySelectorAll('.request-item').forEach(e => e.classList.remove('selected'));
            if(el) el.classList.add('selected');

            try {
                const res = await fetch(`${API_BASE_URL}/request-details?id=${id}&type=${encodeURIComponent(type)}`);
                const result = await res.json();

                if (result.success) {
                    const req = result.data;
                    document.getElementById('detailViewContainer').style.display = 'flex';

                    if (selectedItem.isTravelBooking) {
                        document.getElementById('standardDetailsSection').style.display = 'none';
                        document.getElementById('travelDetailsSection').style.display = 'flex';

                        // Render employee list dynamically from req.employees array
                        const empList = req.employees || [];
                        const empTbody = document.getElementById('empTableBody');

                        if (empList.length > 0) {
                            empTbody.innerHTML = empList.map(emp => `
                                <tr>
                                    <td>${emp.employee_id}</td>
                                    <td>${emp.name}</td>
                                    <td>${emp.phone_no || '—'}</td>
                                    <td>${emp.email || '—'}</td>
                                    <td>${emp.purpose_of_travel || 'Business trip'}</td>
                                </tr>
                            `).join('');
                            document.getElementById('empTableCount').innerText = `showing ${empList.length} of ${empList.length} records`;
                        } else {
                            empTbody.innerHTML = `<tr><td colspan="5" style="padding: 12px; text-align: center;">No employees assigned to this trip</td></tr>`;
                            document.getElementById('empTableCount').innerText = `showing 0 records`;
                        }

                        // Trip Details
                        document.getElementById('trvDestination').value = req.travel_destination || req.allowance_type || req.reason || 'N/A';
                        document.getElementById('trvMode').value = req.travel_mode || 'Flight';
                        document.getElementById('trvDepDest').value = req.departure_destination || 'Penang International Airport (PEN), Malaysia';
                        document.getElementById('trvArrDest').value = req.arrival_destination || 'Changzhou Benniu International Airport (CZX), China';
                        document.getElementById('trvDepDate').value = req.expected_departure_date || req.claim_month || '—';
                        document.getElementById('trvArrDate').value = req.expected_arrival_date || req.claim_month || '—';
                        document.getElementById('trvRetDate').value = req.estimated_return_date || '—';
                        document.getElementById('trvMileage').value = req.mileage || '-';
                        document.getElementById('trvAccommodation').value = req.required_accommodation || 'Yes';

                        // Oversea Contacts
                        document.getElementById('trvContactName').value = req.primary_contact || req.employee_name || '—';
                        document.getElementById('trvContactPhone').value = req.contact_phone || req.phone_no || '—';
                        document.getElementById('trvVenueAddress').value = req.venue_address || req.reason || '—';

                        // Flight (Departure)
                        document.getElementById('fltDepChannel').value = req.departure_channel || 'N/A';
                        document.getElementById('fltDepFrom').value = req.departure_destination || 'PEN, Malaysia';
                        document.getElementById('fltDepTo').value = req.arrival_destination || 'CZX, China';
                        document.getElementById('fltDepDate').value = req.departure_date || req.expected_departure_date || '—';
                        document.getElementById('fltDepTime').value = req.departure_time || '08:45 AM';
                        document.getElementById('fltArrDate').value = req.arrival_date || req.expected_arrival_date || '—';
                        document.getElementById('fltArrTime').value = req.arrival_time || '02:15 PM';
                        document.getElementById('fltAirline').value = req.airline || 'AirAsia';
                        document.getElementById('fltType').value = req.flight_type || 'Direct flight';
                        document.getElementById('fltBaggage').value = req.checked_baggage || '25kg';
                        document.getElementById('fltEstPrice').value = req.flight_cost ? `RM ${parseFloat(req.flight_cost).toFixed(2)}` : 'RM 1,250.00';

                        // Flight (Return)
                        document.getElementById('fltRetChannel').value = req.return_channel || 'N/A';
                        document.getElementById('fltRetFrom').value = req.arrival_destination || 'CZX, China';
                        document.getElementById('fltRetTo').value = req.departure_destination || 'PEN, Malaysia';
                        document.getElementById('fltRetDepDate').value = req.return_departure_date || req.estimated_return_date || '—';
                        document.getElementById('fltRetDepTime').value = req.return_departure_time || '02:30 PM';
                        document.getElementById('fltRetArrDate').value = req.return_arrival_date || req.estimated_return_date || '—';
                        document.getElementById('fltRetArrTime').value = req.return_arrival_time || '09:05 PM';
                        document.getElementById('fltRetAirline').value = req.return_airline || req.airline || 'AirAsia';
                        document.getElementById('fltRetType').value = req.return_flight_type || 'Direct flight';
                        document.getElementById('fltRetBaggage').value = req.return_checked_baggage || '25kg';
                        document.getElementById('fltRetEstPrice').value = req.return_flight_cost ? `RM ${parseFloat(req.return_flight_cost).toFixed(2)}` : 'RM 1,250.00';

                        // Hotel
                        document.getElementById('htlChannel').value = req.hotel_channel || 'N/A';
                        document.getElementById('htlName').value = req.hotel_name || 'Hilton Garden Inn';
                        document.getElementById('htlDuration').value = req.hotel_duration || '14 days';
                        document.getElementById('htlNights').value = req.hotel_nights || '13 days';
                        document.getElementById('htlPrice').value = req.hotel_cost ? `RM ${parseFloat(req.hotel_cost).toFixed(2)}` : 'RM 1,250.00';

                        // Attachment Box
                        const attName = document.getElementById('empAttachmentName');
                        if (req.supporting_document) {
                            attName.innerHTML = `<a href="http://localhost:3000/${req.supporting_document}" target="_blank" style="color:#0284c7;">📄 View Uploaded Document</a>`;
                        } else {
                            attName.innerText = 'No File Uploaded';
                        }

                        // Approval Timeline
                        const timeline = document.getElementById('timelineContainer');
                        const statusVal = req.status || 'Pending';
                        timeline.innerHTML = `
                            <div class="timeline-step">
                                <div class="step-icon-circle done"><i class="fa-solid fa-check"></i></div>
                                <div class="step-info">
                                    <h5>Dato Hj. Kamaruddin</h5>
                                    <p>Head of Department - Stage 1</p>
                                </div>
                                <div class="step-time">Approved</div>
                            </div>
                            <div class="timeline-step">
                                <div class="step-icon-circle ${statusVal !== 'Pending' ? 'done' : 'pending'}"><i class="fa-solid fa-${statusVal !== 'Pending' ? 'check' : 'user'}"></i></div>
                                <div class="step-info">
                                    <h5>Chen Jun</h5>
                                    <p>Project Management / HR - Stage 2</p>
                                </div>
                                <div class="step-time">${statusVal}</div>
                            </div>
                            <div class="timeline-step">
                                <div class="step-icon-circle pending"><i class="fa-solid fa-user"></i></div>
                                <div class="step-info">
                                    <h5 style="color: #ef4444;">Michael Cao</h5>
                                    <p>Chief Executive Officer - Stage 3</p>
                                </div>
                            </div>
                        `;

                        // Cost Summary Calculations
                        const fltVal = parseFloat(req.flight_cost || 1250);
                        const htlVal = parseFloat(req.hotel_cost || 1250);
                        const totalVal = parseFloat(req.total_amount || 4600);
                        const allowanceVal = Math.max(0, totalVal - (fltVal + htlVal));

                        document.getElementById('summaryFlightCost').innerText = `RM ${fltVal.toFixed(2)}`;
                        document.getElementById('summaryHotelCost').innerText = `RM ${htlVal.toFixed(2)}`;
                        document.getElementById('summaryAllowance').innerText = `RM ${allowanceVal.toFixed(2)}`;
                        document.getElementById('totalEstimatedCost').innerText = `RM ${totalVal.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
                        document.getElementById('summaryDurationText').innerText = `${req.hotel_duration || '14 travel days'} . ${req.travel_mode || 'International'}`;

                    } else {
                        document.getElementById('standardDetailsSection').style.display = 'block';
                        document.getElementById('travelDetailsSection').style.display = 'none';

                        const tbody = document.getElementById('itemsTableBody');
                        if (req.items && req.items.length > 0) {
                            tbody.innerHTML = req.items.map(i => `
                                <tr>
                                    <td>${i.invoice_date}</td>
                                    <td>${i.invoice_no}</td>
                                    <td>${i.supplier_name}</td>
                                    <td>${i.description}</td>
                                    <td>RM ${parseFloat(i.amount).toFixed(2)}</td>
                                    <td>${i.remark || '-'}</td>
                                </tr>
                            `).join('');
                        } else {
                            tbody.innerHTML = `<tr><td colspan="6" style="padding: 12px; text-align: center;">${req.reason || 'No itemized breakdown'}</td></tr>`;
                        }

                        const amountVal = req.total_amount || req.amount_requested || 0;
                        document.getElementById('totalClaimAmount').innerText = `TOTAL: RM ${parseFloat(amountVal).toLocaleString('en-US', {minimumFractionDigits: 2})}`;
                    }

                    document.getElementById('detailViewContainer').scrollIntoView({ behavior: 'smooth' });
                }
            } catch (err) {
                console.error("Error fetching request details:", err);
            }
        }

        async function submitDecision(action) {
            if (!selectedItem.id || !selectedItem.table) return;

            const userId = sessionStorage.getItem('userId') || 'HR4001';

            try {
                const res = await fetch(`${API_BASE_URL}/hr/process-action`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: userId,
                        id: selectedItem.id,
                        table: selectedItem.table,
                        action: action
                    })
                });

                const data = await res.json();
                if (data.success) {
                    alert(data.message);
                    document.getElementById('detailViewContainer').style.display = 'none';
                    loadLists();
                } else {
                    alert("Error: " + data.message);
                }
            } catch (err) {
                console.error("Error submitting action:", err);
            }
        }

        async function submitToCEO() {
            if (!selectedItem.id) return;

            const userId = sessionStorage.getItem('userId') || 'HR4001';
            const formData = new FormData();
            formData.append('user_id', userId);
            formData.append('request_id', selectedItem.id);
            formData.append('action', 'Submit_To_CEO');

            const fileInput = document.getElementById('fileUpload');
            if (fileInput && fileInput.files[0]) {
                formData.append('quotation_file', fileInput.files[0]);
            }

            try {
                const res = await fetch(`${API_BASE_URL}/hr/submit-booking-to-ceo`, {
                    method: 'POST',
                    body: formData
                });

                const data = await res.json();
                if (data.success) {
                    alert("Booking details successfully verified and forwarded to CEO for final approval.");
                    document.getElementById('detailViewContainer').style.display = 'none';
                    loadLists();
                } else {
                    alert("Error submitting to CEO: " + data.message);
                }
            } catch (err) {
                console.error("Error forwarding booking to CEO:", err);
                alert("Failed to submit booking details to CEO.");
            }
        }
