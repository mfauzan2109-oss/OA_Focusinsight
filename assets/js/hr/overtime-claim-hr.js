document.addEventListener('DOMContentLoaded', async function() {
        const API_BASE = (window.location.port === '3000') ? '' : 'http://localhost:3000';

        const userId = sessionStorage.getItem('userId') || sessionStorage.getItem('user_id') || 'HR4001';
        const username = sessionStorage.getItem('username') || 'Chen Jun';
        const department = sessionStorage.getItem('department') || 'Human Resources';
        const position = sessionStorage.getItem('position') || sessionStorage.getItem('userPosition') || '';

        document.getElementById('empId').value = userId;
        document.getElementById('empName').value = username;
        document.getElementById('empDept').value = department;

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

        let baseHourlyRate = 15.00;

        try {
            const res = await fetch(`/api/profile/${userId}`);
            const resData = await res.json();
            if (resData.success && resData.data && resData.data.basic_salary) {
                const salary = parseFloat(resData.data.basic_salary) || 3500;
                baseHourlyRate = (salary / 26 / 8);
            }
        } catch (e) {
            console.warn('Hourly rate fallback active.');
        }

        const startTimeInput = document.getElementById('startTime');
        const endTimeInput = document.getElementById('endTime');
        const periodInput = document.getElementById('period');
        const dayTypeSelect = document.getElementById('dayType');
        const nightCheck = document.getElementById('nightCheck');
        const mealCheck = document.getElementById('mealCheck');

        const sumTotalHours = document.getElementById('sumTotalHours');
        const sumHourlyRate = document.getElementById('sumHourlyRate');
        const sumMultiplier = document.getElementById('sumMultiplier');
        const sumOtPayment = document.getElementById('sumOtPayment');
        const sumMealAllowance = document.getElementById('sumMealAllowance');
        const sumNightAllowance = document.getElementById('sumNightAllowance');
        const sumTotalClaim = document.getElementById('sumTotalClaim');
        const otAllowanceInput = document.getElementById('otAllowanceInput');

        function calculateOT() {
            const startVal = startTimeInput.value;
            const endVal = endTimeInput.value;

            let hours = 0;
            if (startVal && endVal) {
                const [sH, sM] = startVal.split(':').map(Number);
                const [eH, eM] = endVal.split(':').map(Number);

                let startMins = sH * 60 + sM;
                let endMins = eH * 60 + eM;

                if (endMins < startMins) {
                    endMins += 24 * 60;
                }

                hours = (endMins - startMins) / 60;
            }

            periodInput.value = `${hours.toFixed(1)} hrs`;
            sumTotalHours.textContent = `${hours.toFixed(1)}h`;
            sumHourlyRate.textContent = `RM ${baseHourlyRate.toFixed(2)}`;

            const isPublicHol = dayTypeSelect.value.includes('Sunday');
            const multiplier = isPublicHol ? 2.0 : 1.5;
            sumMultiplier.textContent = `x ${multiplier.toFixed(1)}`;

            const otPayment = hours * baseHourlyRate * multiplier;
            const mealAllow = mealCheck.checked ? 5.00 : 0.00;
            const nightAllow = nightCheck.checked ? 50.00 : 0.00;

            const totalClaim = otPayment + mealAllow + nightAllow;

            sumOtPayment.textContent = `RM ${otPayment.toFixed(2)}`;
            sumMealAllowance.textContent = `RM ${mealAllow.toFixed(2)}`;
            sumNightAllowance.textContent = `RM ${nightAllow.toFixed(2)}`;
            sumTotalClaim.textContent = `RM ${totalClaim.toFixed(2)}`;

            otAllowanceInput.value = otPayment.toFixed(2);
        }

        startTimeInput.addEventListener('change', calculateOT);
        endTimeInput.addEventListener('change', calculateOT);
        dayTypeSelect.addEventListener('change', calculateOT);
        nightCheck.addEventListener('change', calculateOT);
        mealCheck.addEventListener('change', calculateOT);

        document.getElementById('cancelBtn').addEventListener('click', () => {
            window.location.href = 'hr-dashboard.html';
        });

        const form = document.getElementById('hrOvertimeForm');
        const submitBtn = document.getElementById('submitBtn');
        const errorBanner = document.getElementById('errorBanner');

        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            errorBanner.style.display = 'none';
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';

            const payload = {
                employee_id: userId,
                employee_name: username,
                department: department,
                ot_date: document.getElementById('otDate').value,
                start_time: startTimeInput.value,
                end_time: endTimeInput.value,
                period: periodInput.value,
                day_type: dayTypeSelect.value,
                ot_allowance: otAllowanceInput.value,
                ot_rate: `RM ${baseHourlyRate.toFixed(2)}/hr`,
                night_allowance_check: nightCheck.checked ? 1 : 0,
                meal_allowance_check: mealCheck.checked ? 1 : 0,
                total_claim: sumTotalClaim.textContent.replace('RM ', ''),
                reason: document.getElementById('reason').value
            };

            try {
                const response = await fetch('/api/submit-overtime', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                if (result.success) {
                    alert('Overtime Claim submitted successfully!');
                    window.location.href = 'my-request.html';
                } else {
                    errorBanner.textContent = 'Submission error: ' + (result.message || 'Server error.');
                    errorBanner.style.display = 'block';
                }
            } catch (err) {
                console.error('Error submitting overtime claim:', err);
                errorBanner.textContent = 'Failed to submit form. Please verify server connection.';
                errorBanner.style.display = 'block';
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit';
            }
        });
    });
