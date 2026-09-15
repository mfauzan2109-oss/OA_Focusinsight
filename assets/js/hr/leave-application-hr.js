document.addEventListener('DOMContentLoaded', function() {
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

        /* ==============================================================
           FORM LOGIC
           ============================================================== */
        const leaveTypeSelect = document.getElementById('leaveType');
        const specifyGroup = document.getElementById('specifyGroup');
        const leaveTypeOthers = document.getElementById('leaveTypeOthers');

        leaveTypeSelect.addEventListener('change', function() {
            if (this.value === 'others') {
                specifyGroup.style.display = 'flex';
                leaveTypeOthers.required = true;
            } else {
                specifyGroup.style.display = 'none';
                leaveTypeOthers.required = false;
                leaveTypeOthers.value = '';
            }
        });

        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        const numDaysInput = document.getElementById('numDays');
        const dayTypeSelect = document.getElementById('dayType');

        // Weekends excluded: Saturday (6) and Sunday (0) don't count as leave days
        function isWeekend(date) {
            const day = date.getDay();
            return day === 0 || day === 6;
        }

        function countBusinessDays(start, end) {
            let count = 0;
            const cursor = new Date(start);
            cursor.setHours(0, 0, 0, 0);
            const endClamped = new Date(end);
            endClamped.setHours(0, 0, 0, 0);
            while (cursor <= endClamped) {
                if (!isWeekend(cursor)) count++;
                cursor.setDate(cursor.getDate() + 1);
            }
            return count;
        }

        // Sekat calendar picker daripada pilih tarikh kurang dari 3 hari notis (UX level)
        (function setMinStartDate() {
            const minDate = new Date();
            minDate.setDate(minDate.getDate() + 3);
            const yyyy = minDate.getFullYear();
            const mm = String(minDate.getMonth() + 1).padStart(2, '0');
            const dd = String(minDate.getDate()).padStart(2, '0');
            startDateInput.min = `${yyyy}-${mm}-${dd}`;
        })();

        function calculateDays() {
            const start = startDateInput.value;
            const end = endDateInput.value;

            if (start && end) {
                const sDate = new Date(start);
                const eDate = new Date(end);

                if (eDate >= sDate) {
                    let diffDays = countBusinessDays(sDate, eDate);

                    if (dayTypeSelect.value.includes('Half Day')) {
                        diffDays = 0.5;
                    }
                    numDaysInput.value = diffDays;
                } else {
                    numDaysInput.value = '0';
                }
            }
        }

        startDateInput.addEventListener('change', () => {
            if (startDateInput.value) {
                const start = new Date(startDateInput.value);
                if (isWeekend(start)) {
                    alert('Weekends are excluded from leave. Please choose a Start Date that falls on a weekday (Mon–Fri).');
                    startDateInput.value = '';
                    numDaysInput.value = '';
                    return;
                }
            }
            endDateInput.min = startDateInput.value;
            calculateDays();
        });
        endDateInput.addEventListener('change', () => {
            if (endDateInput.value) {
                const end = new Date(endDateInput.value);
                if (isWeekend(end)) {
                    alert('Weekends are excluded from leave. Please choose an End Date that falls on a weekday (Mon–Fri).');
                    endDateInput.value = '';
                    numDaysInput.value = '';
                    return;
                }
            }
            calculateDays();
        });
        dayTypeSelect.addEventListener('change', calculateDays);

        function isAtLeast3DaysAdvance(startDateValue) {
            if (!startDateValue) return false;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const start = new Date(startDateValue);
            start.setHours(0, 0, 0, 0);
            const diffDays = Math.round((start - today) / (1000 * 60 * 60 * 24));
            return diffDays >= 3;
        }

        async function hasOverlappingLeave(startVal, endVal) {
            try {
                const response = await fetch(`${API_BASE}/api/my-requests?employee_id=${encodeURIComponent(userId)}`);
                const result = await response.json();
                if (!result.success || !Array.isArray(result.data)) return false;

                const newStart = new Date(startVal);
                const newEnd = new Date(endVal);

                return result.data.some(row => {
                    const sameUser = row.employee_id && row.employee_id.toString().trim().toLowerCase() === userId.toString().trim().toLowerCase();
                    const isLeave = (row.request_type || '').toLowerCase() === 'leave';
                    const status = (row.status || '').toLowerCase();
                    const isActive = status.includes('pending') || status === 'approved';
                    if (!sameUser || !isLeave || !isActive || !row.start_date || !row.end_date) return false;

                    const existingStart = new Date(row.start_date);
                    const existingEnd = new Date(row.end_date);
                    return newStart <= existingEnd && newEnd >= existingStart;
                });
            } catch (err) {
                console.error('Overlap pre-check failed:', err);
                return false;
            }
        }

        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('attachment');
        const browseBtn = document.getElementById('browseBtn');
        const fileSelectedName = document.getElementById('fileSelectedName');

        browseBtn.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                fileSelectedName.textContent = `Selected: ${fileInput.files[0].name}`;
            }
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '#2563eb';
            dropZone.style.backgroundColor = '#f0f9ff';
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.style.borderColor = '#cbd5e1';
            dropZone.style.backgroundColor = '#fafafa';
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '#cbd5e1';
            dropZone.style.backgroundColor = '#fafafa';

            if (e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
                fileSelectedName.textContent = `Selected: ${fileInput.files[0].name}`;
            }
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            window.location.href = 'hr-dashboard.html';
        });

        const form = document.getElementById('hrLeaveForm');
        const submitBtn = document.getElementById('submitBtn');
        const errorBanner = document.getElementById('errorBanner');

        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            errorBanner.style.display = 'none';

            if (!isAtLeast3DaysAdvance(startDateInput.value)) {
                alert('Leave must be submitted at least 3 days in advance. Please choose a Start Date at least 3 days from today.');
                return;
            }

            if (isWeekend(new Date(startDateInput.value)) || isWeekend(new Date(endDateInput.value))) {
                alert('Weekends are excluded from leave. Please select weekday dates only.');
                return;
            }

            if (await hasOverlappingLeave(startDateInput.value, endDateInput.value)) {
                alert('This employee already has a pending or approved leave request that overlaps with these dates. Duplicate leave applications are not allowed.');
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';

            const formData = new FormData(form);

            try {
                const response = await fetch(`${API_BASE}/api/submit-leave`, {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();

                if (result.success) {
                    alert('Leave Application submitted successfully!');
                    window.location.href = 'my-request-hr.html';
                } else {
                    errorBanner.textContent = 'Submission error: ' + (result.message || 'Server error.');
                    errorBanner.style.display = 'block';
                }
            } catch (err) {
                console.error('Error submitting leave application:', err);
                errorBanner.textContent = 'Failed to submit form. Please verify server connection.';
                errorBanner.style.display = 'block';
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit';
            }
        });
    });