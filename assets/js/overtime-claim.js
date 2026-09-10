const notiBellBtn = document.getElementById('notiBellBtn');
    const notiDropdown = document.getElementById('notiDropdown');
    const notiList = document.getElementById('notiList');
    const notiBadge = document.getElementById('notiBadge');
    const refreshNotiBtn = document.getElementById('refreshNotiBtn');

    if (notiBellBtn && notiDropdown) {
        notiBellBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = notiDropdown.style.display === 'block';
            notiDropdown.style.display = isVisible ? 'none' : 'block';
            
            // Stop shake animation when dropdown is opened
            notiBellBtn.classList.remove('noti-bell-shake');

            if (!isVisible) {
                fetchNotifications();
            }
        });

        document.addEventListener('click', () => {
            if (notiDropdown) notiDropdown.style.display = 'none';
        });

        notiDropdown.addEventListener('click', (e) => e.stopPropagation());
    }

    let previousNotiState = {};

    function getStatusInfo(item) {
        if (item.is_reminder) {
            return { cardClass: 'status-reminder', badgeBg: '#fee2e2', badgeColor: '#b91c1c' };
        }
        const s = (item.status || '').toLowerCase();
        if (s.includes('approve') || s === 'completed' || s === 'processed') {
            return { cardClass: 'status-approved', badgeBg: '#dcfce7', badgeColor: '#15803d' };
        }
        if (s.includes('reject')) {
            return { cardClass: 'status-rejected', badgeBg: '#fee2e2', badgeColor: '#b91c1c' };
        }
        if (s.includes('revision') || s.includes('review')) {
            return { cardClass: 'status-review', badgeBg: '#dbeafe', badgeColor: '#1d4ed8' };
        }
        return { cardClass: 'status-pending', badgeBg: '#fef3c7', badgeColor: '#b45309' };
    }

    async function fetchNotifications() {
        const userId = sessionStorage.getItem('userId') || sessionStorage.getItem('user_id') || 'EMP001';
        const department = sessionStorage.getItem('department') || '';
        const position = sessionStorage.getItem('position') || '';
        const formattedUserId = userId.toUpperCase();

        const urlParams = new URLSearchParams(window.location.search);
        const highlightId = urlParams.get('highlight_id');

        try {
            const response = await fetch(`http://localhost:3000/api/notifications?employee_id=${encodeURIComponent(formattedUserId)}&department=${encodeURIComponent(department)}&position=${encodeURIComponent(position)}`);
            const data = await response.json();

            if (data.success && data.notifications && data.notifications.length > 0) {
                const unreadNotifications = data.notifications.filter(item => 
                    item.is_reminder || (item.status || '').toLowerCase().includes('pending')
                );
                const unreadCount = unreadNotifications.length;

                notiList.innerHTML = '';
                let hasNewOrChanged = false;
                const nextState = {};

                data.notifications.forEach(item => {
                    const statusLower = (item.status || '').toLowerCase();
                    const { cardClass, badgeBg, badgeColor } = getStatusInfo(item);

                    let statusTitle = `${item.type || 'Overtime'} Pending Review`;
                    if (item.is_reminder) {
                        statusTitle = item.message || `🔔 Reminder: ${item.type || 'Overtime'} Claim Pending`;
                    } else if (statusLower.includes('approve') || statusLower === 'completed') {
                        statusTitle = `${item.type || 'Overtime'} Approved`;
                    } else if (statusLower.includes('reject')) {
                        statusTitle = `${item.type || 'Overtime'} Rejected`;
                    } else if (statusLower.includes('revision')) {
                        statusTitle = `${item.type || 'Overtime'} Revision Required`;
                    }

                    const isHighlighted = highlightId && item.id.toString() === highlightId.toString();

                    const itemKey = `${item.type || 'Overtime'}-${item.form_no || item.id}-${item.is_reminder ? 'rem' : statusLower}`;
                    const isChanged = previousNotiState[itemKey] !== undefined && previousNotiState[itemKey] !== statusLower;
                    const isBrandNew = previousNotiState[itemKey] === undefined && Object.keys(previousNotiState).length > 0;
                    if (isChanged || isBrandNew) hasNewOrChanged = true;
                    nextState[itemKey] = statusLower;

                    const notiItem = document.createElement('a');
                    notiItem.href = `request-details.html?id=${item.id}&type=${encodeURIComponent(item.type || 'Overtime')}`;
                    notiItem.className = `noti-card ${cardClass} ${(isChanged || isBrandNew || isHighlighted) ? 'noti-new' : ''}`;

                    notiItem.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div>
                                <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">${statusTitle}</div>
                                <div style="font-size: 13px; font-weight: 600; color: #475569;">Form No: ${item.form_no || ''}</div>
                                <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">${item.time || ''}</div>
                            </div>
                            <span style="font-size: 10px; padding: 3px 10px; border-radius: 12px; background: ${badgeBg}; color: ${badgeColor}; font-weight: 700; text-transform: uppercase;">
                                ${item.is_reminder ? 'Reminder' : (item.status || 'Pending')}
                            </span>
                        </div>
                    `;
                    notiList.appendChild(notiItem);
                });

                previousNotiState = nextState;

                const viewAllBtn = document.createElement('a');
                viewAllBtn.href = 'my-request.html';
                viewAllBtn.style.cssText = 'display: block; padding: 12px; text-align: center; color: #2563eb; font-weight: 600; font-size: 14px; text-decoration: none; border-top: 1px solid #f1f5f9; background: #ffffff; margin-top: 4px;';
                viewAllBtn.textContent = 'View all requests';
                notiList.appendChild(viewAllBtn);

                if (notiBadge) {
                    if (unreadCount > 0) {
                        notiBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                        notiBadge.style.display = 'flex';
                        if (notiBellBtn) {
                            notiBellBtn.classList.add('noti-bell-shake');
                        }
                    } else {
                        notiBadge.style.display = 'none';
                        notiBadge.textContent = '0';
                        if (notiBellBtn) {
                            notiBellBtn.classList.remove('noti-bell-shake');
                        }
                    }

                    if (hasNewOrChanged) {
                        notiBadge.classList.remove('noti-badge-pop');
                        void notiBadge.offsetWidth;
                        notiBadge.classList.add('noti-badge-pop');
                    }
                }

            } else {
                if (notiBadge) {
                    notiBadge.style.display = 'none';
                    notiBadge.textContent = '0';
                }
                if (notiBellBtn) {
                    notiBellBtn.classList.remove('noti-bell-shake');
                }
                notiList.innerHTML = `<div style="padding: 16px; text-align: center; color: #94a3b8; font-size: 13px;">No requested forms found.</div>`;
                previousNotiState = {};
            }
        } catch (err) {
            console.error('Error fetching notifications:', err);
            if (notiBadge) notiBadge.style.display = 'none';
            if (notiBellBtn) notiBellBtn.classList.remove('noti-bell-shake');
            notiList.innerHTML = `<div style="padding: 16px; text-align: center; color: #ef4444; font-size: 13px;">Error fetching requested forms.</div>`;
        }
    }

    if (refreshNotiBtn) {
        refreshNotiBtn.addEventListener('click', fetchNotifications);
    }

    setInterval(fetchNotifications, 5000);

    function saveFormDraft(formId, userId) {
        if (!userId) return;
        const storageKey = `draft_${userId}_${formId}`;
        const form = document.getElementById(formId);
        if (!form) return;

        const draftData = {};
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if ((input.id || input.name) && input.type !== 'file' && input.type !== 'password' && !input.readOnly) {
                const key = input.id || input.name;
                if (input.type === 'checkbox') {
                    draftData[key] = input.checked;
                } else {
                    draftData[key] = input.value;
                }
            }
        });

        localStorage.setItem(storageKey, JSON.stringify(draftData));
    }

    function loadFormDraft(formId, userId) {
        if (!userId) return false;
        const storageKey = `draft_${userId}_${formId}`;
        const rawData = localStorage.getItem(storageKey);
        if (!rawData) return false;

        try {
            const draftData = JSON.parse(rawData);
            let restored = false;

            Object.keys(draftData).forEach(key => {
                const element = document.getElementById(key) || document.querySelector(`[name="${key}"]`);
                if (element && !element.readOnly) {
                    if (element.type === 'checkbox') {
                        element.checked = draftData[key];
                    } else {
                        element.value = draftData[key];
                    }
                    if (draftData[key] !== "" && draftData[key] !== false) restored = true;
                }
            });

            return restored;
        } catch (e) {
            console.error("Failed to load form draft:", e);
            return false;
        }
    }

    function clearFormDraft(formId, userId) {
        if (!userId) return;
        const storageKey = `draft_${userId}_${formId}`;
        localStorage.removeItem(storageKey);
    }

    document.addEventListener('DOMContentLoaded', async function() {
        const username = sessionStorage.getItem('username') || 'Employee';
        const userId = sessionStorage.getItem('userId') || sessionStorage.getItem('user_id') || 'EMP001';
        const position = sessionStorage.getItem('position') || '';
        const department = sessionStorage.getItem('department') || 'Engineering';

        await fetchNotifications();

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
                                const rawStatus = (row.status || '').toString().trim().toLowerCase();

                                let badgeBg = '#fef3c7';
                                let badgeColor = '#d97706';
                                if (rawStatus.includes('approve') || rawStatus === 'completed' || rawStatus === 'processed') {
                                    badgeBg = '#dcfce7';
                                    badgeColor = '#15803d';
                                } else if (rawStatus.includes('reject')) {
                                    badgeBg = '#fee2e2';
                                    badgeColor = '#b91c1c';
                                } else if (rawStatus.includes('revision') || rawStatus === 'in review') {
                                    badgeBg = '#fef3c7';
                                    badgeColor = '#b45309';
                                }

                                const itemLink = document.createElement('a');
                                itemLink.href = `request-details.html?id=${row.id}&type=${encodeURIComponent(reqType)}`;
                                itemLink.style.cssText = 'display: block; padding: 10px 14px; border-bottom: 1px solid #f1f5f9; text-decoration: none; color: inherit; transition: background 0.2s;';
                                itemLink.onmouseover = () => itemLink.style.background = '#f8fafc';
                                itemLink.onmouseout = () => itemLink.style.background = 'transparent';

                                itemLink.innerHTML = `
                                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                        <div>
                                            <div style="font-size: 13px; font-weight: 700; color: #0f172a;">REQ-${reqType.toUpperCase()}-${row.id}</div>
                                            <div style="font-size: 12px; color: #64748b; margin-top: 1px;">${reqType} (${row.details || row.reason || 'N/A'})</div>
                                        </div>
                                        <span style="font-size: 10px; padding: 2px 8px; border-radius: 10px; background: ${badgeBg}; color: ${badgeColor}; font-weight: 600; text-transform: capitalize;">
                                            ${row.status || 'Pending'}
                                        </span>
                                    </div>
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

        let userBasicSalary = 0.00;
        let shortOtRateCode = "1.5x";

        const startTimeInput = document.getElementById('startTime');
        const endTimeInput = document.getElementById('endTime');
        const dayTypeSelect = document.getElementById('dayType');
        const nightCheck = document.getElementById('nightAllowanceCheck');
        const mealCheck = document.getElementById('mealAllowanceCheck');
        const mealWarning = document.getElementById('mealWarning');

        const periodInput = document.getElementById('period');
        const otRateInput = document.getElementById('otRate');
        const otAllowanceInput = document.getElementById('otAllowance');

        const sumTotalHours = document.getElementById('sumTotalHours');
        const sumHourlyRate = document.getElementById('sumHourlyRate');
        const sumOtPayment = document.getElementById('sumOtPayment');
        const sumMealAllowance = document.getElementById('sumMealAllowance');
        const sumNightAllowance = document.getElementById('sumNightAllowance');
        const sumTotalClaim = document.getElementById('sumTotalClaim');
        const form = document.getElementById('overtimeForm');
        const submitBtn = document.getElementById('submitBtn');
        const errorBanner = document.getElementById('errorBanner');

        document.getElementById('empId').value = userId;
        document.getElementById('empName').value = username;
        document.getElementById('empDept').value = department;

        if (username) {
            document.getElementById('sidebarName').textContent = username;
            document.getElementById('sidebarMeta').textContent = `${userId.toUpperCase()} • ${department}`;
            const initials = username.split(' ').map(n => n.charAt(0)).join('').substring(0, 2).toUpperCase();
            document.getElementById('topAvatar').textContent = initials;
        }

        const formattedUserIdForAvatar = (userId || '').toUpperCase();
        const specificAvatarKey = `userAvatar_${formattedUserIdForAvatar}`;
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

        const otDateInput = document.getElementById('otDate');
        if (otDateInput && !otDateInput.value) {
            otDateInput.value = new Date().toISOString().split('T')[0];
        }

        function calculateOvertime() {
            const start = startTimeInput.value;
            const end = endTimeInput.value;
            let totalHours = 0;

            if (start && end) {
                const startTime = new Date(`1970-01-01T${start}:00`);
                let endTime = new Date(`1970-01-01T${end}:00`);
                if (endTime < startTime) endTime.setDate(endTime.getDate() + 1);
                
                totalHours = (endTime - startTime) / (1000 * 60 * 60);
            }

            const isHoliday = dayTypeSelect.value === 'holiday';
            let hourlyRate = 0;

            if (userBasicSalary > 0) {
                if (userBasicSalary <= 3999.99) {
                    const ORP = userBasicSalary / 26 / 8;
                    const multiplier = isHoliday ? 2.0 : 1.5;
                    hourlyRate = ORP * multiplier;
                    otRateInput.value = `${multiplier.toFixed(1)}x ORP (ORP: RM ${ORP.toFixed(2)})`;
                    shortOtRateCode = `${multiplier.toFixed(1)}x`;
                } else {
                    hourlyRate = isHoliday ? 20.00 : 15.00;
                    otRateInput.value = isHoliday ? "Fixed RM 20.00/hr" : "Fixed RM 15.00/hr";
                    shortOtRateCode = isHoliday ? "Fixed RM20" : "Fixed RM15";
                }
            } else {
                const multiplier = isHoliday ? 2.0 : 1.5;
                shortOtRateCode = `${multiplier.toFixed(1)}x`;
                otRateInput.value = isHoliday ? "2.0x Rate" : "1.5x Rate";
            }

            const otPayment = totalHours * hourlyRate;

            let mealAllowance = 0.00;
            if (mealCheck.checked) {
                if (totalHours >= 3.0) {
                    mealAllowance = 5.00;
                    mealWarning.style.display = 'none';
                } else {
                    mealWarning.style.display = 'block';
                }
            } else {
                mealWarning.style.display = 'none';
            }

            const nightAllowance = nightCheck.checked ? 50.00 : 0.00;
            const totalClaim = otPayment + mealAllowance + nightAllowance;

            periodInput.value = `${totalHours.toFixed(1)} hrs`;
            sumTotalHours.textContent = `${totalHours.toFixed(1)}h`;
            sumHourlyRate.textContent = `RM ${hourlyRate.toFixed(2)}/h`;
            sumOtPayment.textContent = `RM ${otPayment.toFixed(2)}`;
            sumMealAllowance.textContent = `RM ${mealAllowance.toFixed(2)}`;
            sumNightAllowance.textContent = `RM ${nightAllowance.toFixed(2)}`;
            sumTotalClaim.textContent = `RM ${totalClaim.toFixed(2)}`;
            otAllowanceInput.value = `RM ${otPayment.toFixed(2)}`;

            return {
                totalHours,
                otPayment,
                mealAllowance,
                nightAllowance,
                totalClaim
            };
        }

        if (userId) {
            try {
                const response = await fetch(`http://localhost:3000/api/profile/${userId}`);
                const resData = await response.json();
                
                if (resData.success && resData.data) {
                    userBasicSalary = parseFloat(resData.data.salary) || 0.00;
                    document.getElementById('basicSalary').value = `RM ${userBasicSalary.toFixed(2)}`;
                } else {
                    document.getElementById('basicSalary').value = 'RM 0.00';
                }
            } catch (err) {
                console.error('Failed to load basic salary from database:', err);
                document.getElementById('basicSalary').value = 'RM 0.00';
            }
        }

        const draftRestored = loadFormDraft('overtimeForm', userId);
        if (draftRestored) {
            document.getElementById('draftNotice').style.display = 'flex';
        }
        calculateOvertime();

        if (position) {
            const posLower = position.toLowerCase();
            if (posLower.includes('manager') || posLower.includes('executive') || posLower.includes('lead') || posLower.includes('head')) {
                alert("Notice: Exempt employees (Managerial / Professional staff) are not eligible for overtime claims.");
            }
        }

        const isManager = (userId && userId.toUpperCase().startsWith('MGR')) || (position && position.toLowerCase().includes('manager'));
        if (isManager) {
            const approvalQueueItem = document.getElementById('approvalQueueItem');
            if (approvalQueueItem) approvalQueueItem.style.display = 'flex';
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

        const triggers = [startTimeInput, endTimeInput, dayTypeSelect, nightCheck, mealCheck];
        triggers.forEach(elem => {
            elem.addEventListener('change', () => {
                calculateOvertime();
                saveFormDraft('overtimeForm', userId);
            });
        });

        form.addEventListener('input', () => saveFormDraft('overtimeForm', userId));

        document.getElementById('cancelBtn').addEventListener('click', function() {
            clearFormDraft('overtimeForm', userId);
            window.location.href = 'dashboard.html';
        });

        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            if (errorBanner) {
                errorBanner.style.display = 'none';
                errorBanner.textContent = '';
            }

            const calc = calculateOvertime();

            if (calc.totalHours <= 0) {
                alert("Please select valid Start and End times.");
                return;
            }

            const currentEmpId = document.getElementById('empId').value.trim() || userId || 'EMP001';
            const currentEmpName = document.getElementById('empName').value.trim() || username || 'Employee';

            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';

            const cleanOtRate = shortOtRateCode.substring(0, 10);

            const payload = {
                employee_id: currentEmpId,
                employee_name: currentEmpName,
                department: document.getElementById('empDept').value || 'Engineering',
                ot_date: otDateInput.value,
                start_time: startTimeInput.value,
                end_time: endTimeInput.value,
                period: `${calc.totalHours.toFixed(1)} hrs`,
                day_type: dayTypeSelect.value,
                ot_allowance: calc.otPayment.toFixed(2),
                ot_rate: cleanOtRate,
                night_allowance_check: nightCheck.checked ? 1 : 0,
                meal_allowance_check: mealCheck.checked ? 1 : 0,
                total_claim: calc.totalClaim.toFixed(2),
                reason: document.getElementById('reason').value
            };

            try {
                const response = await fetch('http://localhost:3000/api/submit-overtime', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                if (result.success) {
                    clearFormDraft('overtimeForm', userId);
                    alert(result.message || 'Overtime Claim submitted successfully!');
                    await fetchNotifications();
                    const newId = result.id || '';
                    window.location.href = `overtime-claim.html${newId ? '?highlight_id=' + newId : ''}`;
                } else {
                    if (errorBanner) {
                        errorBanner.textContent = 'Submission error: ' + (result.message || 'Database rejected the request.');
                        errorBanner.style.display = 'block';
                    } else {
                        alert('Submission failed: ' + result.message);
                    }
                }
            } catch (error) {
                console.error('Error submitting overtime claim:', error);
                if (errorBanner) {
                    errorBanner.textContent = 'Failed to submit claim. Make sure the server is reachable.';
                    errorBanner.style.display = 'block';
                } else {
                    alert('An error occurred while submitting the claim.');
                }
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit';
            }
        });
    });