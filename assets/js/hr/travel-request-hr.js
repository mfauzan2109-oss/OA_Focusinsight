document.addEventListener('DOMContentLoaded', async function() {
        const API_BASE = (window.location.port === '3000') ? '' : 'http://localhost:3000';

        const userId = sessionStorage.getItem('userId') || sessionStorage.getItem('user_id') || 'HR4001';
        const username = sessionStorage.getItem('username') || 'Chen Jun';
        const department = sessionStorage.getItem('department') || 'Human Resources';
        const position = sessionStorage.getItem('position') || sessionStorage.getItem('userPosition') || '';

        document.getElementById('sidebarName').textContent = username;
        document.getElementById('sidebarMeta').textContent = `${userId} . ${department}`;
        
        const initials = username.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        document.getElementById('topAvatar').textContent = initials || 'HR';

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

        /* ==============================================================
           NOTIFICATION DROPDOWN LOGIC
           ============================================================== */
        const notiDropdown = document.getElementById('notiDropdown');
        const notiList     = document.getElementById('notiList');
        const notiBadge    = document.getElementById('notiBadge');
        const notiBellBtn  = document.getElementById('notiBellBtn');
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
                const response = await fetch(`${API_BASE}/api/notifications?employee_id=${encodeURIComponent(userId)}&department=${encodeURIComponent(department)}&position=${encodeURIComponent(position)}`);
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
                if (notiList) {
                    notiList.innerHTML = `<div style="padding: 16px; text-align: center; color: #94a3b8; font-size: 13px;">Unable to load notifications.</div>`;
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

        const companyInput = document.getElementById('company');

        async function fetchUserCompany() {
            try {
                const res = await fetch(`/api/profile/${userId}`);
                const resData = await res.json();
                if (resData.success && resData.data && resData.data.company_name) {
                    companyInput.value = resData.data.company_name;
                } else {
                    companyInput.value = 'FocusInsight';
                }
            } catch (err) {
                companyInput.value = 'FocusInsight';
            }
        }
        fetchUserCompany();

        const travelMode = document.getElementById('travelMode');
        const travelModeOthers = document.getElementById('travelModeOthers');
        const overseaSection = document.getElementById('overseaContactSection');
        const flightDepSection = document.getElementById('flightDepSection');
        const flightRetSection = document.getElementById('flightRetSection');
        const hotelSection = document.getElementById('hotelSection');

        travelMode.addEventListener('change', function() {
            const val = this.value;
            if (val === 'others') {
                travelModeOthers.disabled = false;
                travelModeOthers.required = true;
            } else {
                travelModeOthers.disabled = true;
                travelModeOthers.required = false;
                travelModeOthers.value = '';
            }

            if (val === 'car' || val === 'others') {
                overseaSection.style.display = 'none';
                flightDepSection.style.display = 'none';
                flightRetSection.style.display = 'none';
                hotelSection.style.display = 'none';
            } else {
                overseaSection.style.display = 'block';
                flightDepSection.style.display = 'block';
                flightRetSection.style.display = 'block';
                hotelSection.style.display = 'block';
            }
        });

        const addEmpBtn = document.getElementById('addEmpBtn');
        const empTableBody = document.getElementById('empTableBody');

        function addEmployeeRow(empIdVal = '', empNameVal = '') {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="text" class="table-input emp-id" value="${empIdVal}" placeholder="ID" required></td>
                <td><input type="text" class="table-input emp-name" value="${empNameVal}" placeholder="Full Name" required></td>
                <td><input type="tel" class="table-input emp-phone" placeholder="Contact No" required></td>
                <td><input type="email" class="table-input emp-email" placeholder="Email" required></td>
                <td>
                    <select class="table-input emp-purpose" required>
                        <option value="Business">Business</option>
                        <option value="Training">Training</option>
                    </select>
                </td>
                <td><button type="button" class="btn-remove-row"><i class="fa-solid fa-trash"></i></button></td>
            `;

            tr.querySelector('.btn-remove-row').addEventListener('click', () => {
                tr.remove();
                calculateAllowance();
            });

            empTableBody.appendChild(tr);
            calculateAllowance();
        }

        addEmployeeRow(userId, username);
        addEmpBtn.addEventListener('click', () => addEmployeeRow());

        const expDeparture = document.getElementById('expDeparture');
        const returnDate = document.getElementById('returnDate');
        const hotelNights = document.getElementById('hotelNights');

        function calculateAllowance() {
            const depVal = expDeparture.value;
            const retVal = returnDate.value;
            const empCount = empTableBody.querySelectorAll('tr').length || 1;
            const nights = parseInt(hotelNights.value) || 0;

            let days = 0;
            if (depVal && retVal) {
                const dep = new Date(depVal);
                const ret = new Date(retVal);
                if (ret >= dep) {
                    days = Math.ceil((ret - dep) / (1000 * 60 * 60 * 24)) + 1;
                }
            }

            const travelTotal = days * 150 * empCount;
            const transTotal = days * 300 * empCount;
            const mealTotal = days * 10 * empCount;
            const accTotal = nights * 300 * empCount;

            document.getElementById('travelAllowanceVal').textContent = `Allowance: RM ${(150 * days).toFixed(2)}`;
            document.getElementById('travelTotalVal').textContent = `Est. Total: RM ${travelTotal.toFixed(2)}`;

            document.getElementById('transAllowanceVal').textContent = `Allowance: RM ${(300 * days).toFixed(2)}`;
            document.getElementById('transTotalVal').textContent = `Est. Total: RM ${transTotal.toFixed(2)}`;

            document.getElementById('mealAllowanceVal').textContent = `Allowance: RM ${(10 * days).toFixed(2)}`;
            document.getElementById('mealTotalVal').textContent = `Est. Total: RM ${mealTotal.toFixed(2)}`;

            document.getElementById('accAllowanceVal').textContent = `Allowance: RM ${(300 * nights).toFixed(2)}`;
            document.getElementById('accTotalVal').textContent = `Est. Total: RM ${accTotal.toFixed(2)}`;
        }

        expDeparture.addEventListener('change', calculateAllowance);
        returnDate.addEventListener('change', calculateAllowance);
        hotelNights.addEventListener('input', calculateAllowance);

        document.getElementById('cancelBtn').addEventListener('click', () => {
            window.location.href = 'hr-dashboard.html';
        });

        const form = document.getElementById('hrTravelForm');
        const submitBtn = document.getElementById('submitBtn');
        const errorBanner = document.getElementById('errorBanner');

        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            errorBanner.style.display = 'none';
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';

            const formData = new FormData(form);
            formData.append('employee_id', userId);
            formData.append('employee_name', username);
            formData.append('department', department);

            try {
                const response = await fetch('/api/submit-travel', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();

                if (result.success) {
                    alert('Travel Request submitted successfully!');
                    window.location.href = 'my-request.html';
                } else {
                    errorBanner.textContent = 'Submission error: ' + (result.message || 'Server error.');
                    errorBanner.style.display = 'block';
                }
            } catch (err) {
                console.error('Error submitting travel request:', err);
                errorBanner.textContent = 'Failed to submit travel form. Please verify server connection.';
                errorBanner.style.display = 'block';
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit';
            }
        });
    });
