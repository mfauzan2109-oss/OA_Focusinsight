document.addEventListener('DOMContentLoaded', function() {
      const username = sessionStorage.getItem('username');
      const userId = sessionStorage.getItem('userId');
      const position = sessionStorage.getItem('position');
      const department = sessionStorage.getItem('department');

      if (!username || !userId) {
        alert("Access Denied! Please log in first.");
        window.location.href = "index.html";
        return;
      }

      const formattedUserId = userId.toUpperCase();

      document.getElementById('sidebarName').textContent = username;
      document.getElementById('sidebarMeta').textContent = `${formattedUserId} • ${department || 'General'}`;

      const initials = username.split(' ').map(n => n.charAt(0)).join('').substring(0, 2).toUpperCase();
      const topAvatarEl = document.getElementById('topAvatar');
      if (topAvatarEl) topAvatarEl.textContent = initials;

      // 1. AVATAR DISPLAY
      const specificAvatarKey = `userAvatar_${formattedUserId}`;
      function updateAvatarDisplay(avatarBase64) {
        if (!avatarBase64) return;
        const imgHTML = `<img src="${avatarBase64}" alt="Profile Picture" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        const sidebarAvatar = document.getElementById('sidebarAvatarContainer');
        if (sidebarAvatar) sidebarAvatar.innerHTML = imgHTML;
        if (topAvatarEl) topAvatarEl.innerHTML = imgHTML;
      }

      const savedAvatar = localStorage.getItem(specificAvatarKey);
      updateAvatarDisplay(savedAvatar);

      window.addEventListener('storage', function(e) {
        if (e.key === specificAvatarKey) updateAvatarDisplay(e.newValue);
      });

      // Indicator badge di sebelah "Approval Queue"
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
            const pendingApprovalCount = data.data.filter(i => (i.status || '').toLowerCase() === 'pending').length;
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

      let selectedRawId = null;
      let selectedType = null;
      let allRequestsData = [];

      // ==========================================
      // 2. NOTIFICATION SYSTEM 
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
              const response = await fetch(`http://localhost:3000/api/notifications?employee_id=${encodeURIComponent(formattedUserId)}&department=${encodeURIComponent(department || '')}&position=${encodeURIComponent(position || '')}`);
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

      fetchNotifications();
      setInterval(fetchNotifications, 5000);

      // 3. SEARCH BAR DROPDOWN
      const searchInput = document.getElementById('searchInput');
      const searchDropdown = document.getElementById('searchDropdown');

      if (searchInput && searchDropdown) {
        searchInput.addEventListener('input', (e) => {
          const query = e.target.value.toLowerCase().trim();

          document.querySelectorAll('.request-card').forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(query) ? 'block' : 'none';
          });

          document.querySelectorAll('#completedTableBody tr').forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(query) ? '' : 'none';
          });

          if (query === '') {
            searchDropdown.classList.remove('active');
            return;
          }

          const filtered = allRequestsData.filter(item => {
            const type = (item.request_type || '').toLowerCase();
            const empName = (item.employee_name || '').toLowerCase();
            const formNo = `REQ-2026-${String(item.id).padStart(3, '0')}`.toLowerCase();
            const status = (item.status || '').toLowerCase();
            return type.includes(query) || empName.includes(query) || formNo.includes(query) || status.includes(query);
          });

          searchDropdown.innerHTML = '';

          if (filtered.length > 0) {
            filtered.forEach(item => {
              const formattedId = `REQ-2026-${String(item.id).padStart(3, '0')}`;
              const searchItem = document.createElement('div');
              searchItem.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #ffffff; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background 0.2s;";
              searchItem.onmouseover = () => searchItem.style.background = '#f8fafc';
              searchItem.onmouseout = () => searchItem.style.background = '#ffffff';

              searchItem.innerHTML = `
                <div>
                  <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">${formattedId}</div>
                  <div style="font-size: 13px; color: #64748b;">${item.request_type || 'General'}</div>
                </div>
                <span style="font-size: 11px; padding: 4px 12px; border-radius: 12px; background: #dcfce7; color: #15803d; font-weight: 600; text-transform: capitalize;">
                  ${item.status || 'Pending'}
                </span>
              `;

              searchItem.addEventListener('click', () => {
                searchDropdown.classList.remove('active');
                window.location.href = `request-details.html?id=${item.id}&type=${encodeURIComponent(item.request_type || 'General')}`;
              });

              searchDropdown.appendChild(searchItem);
            });
          } else {
            searchDropdown.innerHTML = `<div style="padding: 16px; text-align: center; color: #94a3b8; font-size: 13px;">No matching requests found.</div>`;
          }

          searchDropdown.classList.add('active');
        });

        document.addEventListener('click', (e) => {
          if (!searchDropdown.contains(e.target) && !searchInput.contains(e.target)) {
            searchDropdown.classList.remove('active');
          }
        });
      }

      function timeAgo(dateStr) {
        if (!dateStr) return '';
        const then = new Date(dateStr);
        const now = new Date();
        const diffMs = now - then;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
      }

      // =========================================================================
      // 4. MEMUATKAN MAKLUMAT TERPERINCI BORANG DARI DATABASE VIA API /api/request-details
      // =========================================================================
      async function loadFullFormDetails(reqId, reqType) {
        const container = document.getElementById('dynamicFormContainer');
        container.innerHTML = `<div style="padding: 12px; color: #2563eb; font-weight: 600;"><i class='bx bx-loader-alt bx-spin'></i> Fetching complete record from database...</div>`;

        try {
          const res = await fetch(`http://localhost:3000/api/request-details?id=${encodeURIComponent(reqId)}&type=${encodeURIComponent(reqType)}`);
          const result = await res.json();

          if (!result.success || !result.data) {
            container.innerHTML = `<div style="padding: 12px; color: #ef4444;">Failed to load details from database.</div>`;
            return;
          }

          const data = result.data;
          
          document.getElementById('detailEmployeeId').textContent = data.employee_id || data['Employee ID'] || '—';
          document.getElementById('detailEmployee').textContent = data.employee_name || data['Employee Name'] || '—';
          document.getElementById('detailDepartment').textContent = data.department || data['Department'] || '—';
          document.getElementById('detailPhone').textContent = data.phone_no || '—';
          document.getElementById('detailEmail').textContent = data.email || '—';

          const rawDate = data.created_at || data['Created At'] || data['Start Date'] || '—';
          let formattedSubmittedDate = '—';
          if (rawDate !== '—') {
            try { formattedSubmittedDate = new Date(rawDate).toISOString().split('T')[0]; } catch(e) {}
          }
          document.getElementById('detailSubmitted').textContent = formattedSubmittedDate;

          const docPath = data.supporting_document || data['Supporting Documen'];
          const docHTML = docPath 
            ? `<a href="http://localhost:3000/${docPath}" target="_blank" class="doc-link-btn"><i class='bx bx-file'></i> View Attachment</a>` 
            : `<span style="color: #94a3b8;">No Attachment</span>`;

          const lowerType = reqType.toLowerCase();
          let htmlFields = '';

          // A. LEAVE APPLICATION DETAILS
          if (lowerType.includes('leave')) {
            htmlFields = `
              <div class="detail-fields-grid">
                <div class="detail-field"><label>Leave Type</label><div class="field-box">${data['Leave Type'] || data.leave_type || '—'}</div></div>
                <div class="detail-field"><label>Day Type</label><div class="field-box">${data['Day type'] || data.day_type || 'Full Day'}</div></div>
                <div class="detail-field"><label>No. of Days</label><div class="field-box">${data['No of Days'] || data.no_of_days || '1'}</div></div>
                <div class="detail-field"><label>Start Date</label><div class="field-box">${data['Start Date'] ? new Date(data['Start Date']).toISOString().split('T')[0] : '—'}</div></div>
                <div class="detail-field"><label>End Date</label><div class="field-box">${data['End Date'] ? new Date(data['End Date']).toISOString().split('T')[0] : '—'}</div></div>
                <div class="detail-field"><label>Supporting Document</label><div class="field-box" style="background:transparent; border:none; padding:0;">${docHTML}</div></div>
              </div>
              <div class="detail-field" style="margin-top: 14px;">
                <label>Reason / Remarks</label>
                <div class="field-box">${data['Reason'] || data.reason || 'N/A'}</div>
              </div>
            `;
          } 
          // B. DISBURSEMENT FORM DETAILS
          else if (lowerType.includes('disbursement')) {
            let itemsTableHTML = '';
            if (data.items && data.items.length > 0) {
              let rowsHTML = '';
              data.items.forEach((item, idx) => {
                rowsHTML += `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>${item.invoice_date ? new Date(item.invoice_date).toISOString().split('T')[0] : '—'}</td>
                    <td>${item.invoice_no || '—'}</td>
                    <td>${item.supplier_name || '—'}</td>
                    <td>${item.description || '—'}</td>
                    <td>RM ${parseFloat(item.amount || 0).toFixed(2)}</td>
                    <td>${item.remark || '—'}</td>
                  </tr>
                `;
              });

              itemsTableHTML = `
                <div style="margin-top: 14px;">
                  <label style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Itemized Claims</label>
                  <table class="sub-data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Invoice Date</th>
                        <th>Invoice No</th>
                        <th>Supplier Name</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Remark</th>
                      </tr>
                    </thead>
                    <tbody>${rowsHTML}</tbody>
                  </table>
                </div>
              `;
            }

            htmlFields = `
              <div class="detail-fields-grid">
                <div class="detail-field"><label>Total Claim Amount</label><div class="field-box">RM ${parseFloat(data.total_amount || 0).toFixed(2)}</div></div>
                <div class="detail-field"><label>Supporting Document</label><div class="field-box" style="background:transparent; border:none; padding:0;">${docHTML}</div></div>
              </div>
              ${itemsTableHTML}
            `;
          } 
          // C. TRAVEL REQUEST DETAILS
          else if (lowerType.includes('travel')) {
            let employeesTableHTML = '';
            if (data.employees && data.employees.length > 0) {
              let empRows = '';
              data.employees.forEach((emp, idx) => {
                empRows += `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>${emp.employee_id || '—'}</td>
                    <td>${emp.name || '—'}</td>
                    <td>${emp.phone_no || '—'}</td>
                    <td>${emp.email || '—'}</td>
                    <td>${emp.purpose_of_travel || 'Business trip'}</td>
                  </tr>
                `;
              });

              employeesTableHTML = `
                <div style="margin-top: 14px;">
                  <label style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Assigned Employees</label>
                  <table class="sub-data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Email</th>
                        <th>Purpose</th>
                      </tr>
                    </thead>
                    <tbody>${empRows}</tbody>
                  </table>
                </div>
              `;
            }

            htmlFields = `
              <div class="detail-fields-grid">
                <div class="detail-field"><label>Allowance / Destination</label><div class="field-box">${data.allowance_type || '—'}</div></div>
                <div class="detail-field"><label>Company Name</label><div class="field-box">${data.company_name || '—'}</div></div>
                <div class="detail-field"><label>Travel Destination</label><div class="field-box">${data.travel_destination || '—'}</div></div>
                <div class="detail-field"><label>Travel Mode</label><div class="field-box">${data.travel_mode || '—'}</div></div>
                <div class="detail-field"><label>Total Estimated Cost</label><div class="field-box">RM ${parseFloat(data.total_amount || 0).toFixed(2)}</div></div>
                <div class="detail-field"><label>Departure Date</label><div class="field-box">${data.expected_departure_date || '—'}</div></div>
                <div class="detail-field"><label>Arrival Date</label><div class="field-box">${data.expected_arrival_date || '—'}</div></div>
                <div class="detail-field"><label>Primary Contact</label><div class="field-box">${data.primary_contact || '—'} (${data.contact_phone || '—'})</div></div>
                <div class="detail-field"><label>Supporting Document</label><div class="field-box" style="background:transparent; border:none; padding:0;">${docHTML}</div></div>
              </div>
              <div class="detail-field" style="margin-top: 12px;">
                <label>Venue Address & Reason</label>
                <div class="field-box">${data.reason || 'N/A'}</div>
              </div>
              ${employeesTableHTML}
            `;
          } 
          // D. OVERTIME CLAIM DETAILS
          else if (lowerType.includes('overtime')) {
            htmlFields = `
              <div class="detail-fields-grid">
                <div class="detail-field"><label>OT Date</label><div class="field-box">${data.ot_date ? new Date(data.ot_date).toISOString().split('T')[0] : '—'}</div></div>
                <div class="detail-field"><label>Time Period</label><div class="field-box">${data.start_time || '—'} to ${data.end_time || '—'} (${data.period || '0'} hrs)</div></div>
                <div class="detail-field"><label>Day Type</label><div class="field-box">${data.day_type || 'Normal Work Day'}</div></div>
                <div class="detail-field"><label>OT Rate Multiplier</label><div class="field-box">${data.ot_rate || '1.5'}x</div></div>
                <div class="detail-field"><label>Night Allowance</label><div class="field-box">${data.night_allowance ? 'Yes' : 'No'}</div></div>
                <div class="detail-field"><label>Meal Allowance</label><div class="field-box">${data.meal_allowance ? 'Yes' : 'No'}</div></div>
                <div class="detail-field"><label>Total Overtime Claim</label><div class="field-box">RM ${parseFloat(data.total_claim || 0).toFixed(2)}</div></div>
              </div>
              <div class="detail-field" style="margin-top: 12px;">
                <label>Reason / Remarks</label>
                <div class="field-box">${data.reason || 'N/A'}</div>
              </div>
            `;
          } 
          // E. LOAN APPLICATION DETAILS
          else if (lowerType.includes('loan')) {
            htmlFields = `
              <div class="detail-fields-grid">
                <div class="detail-field"><label>Loan Type</label><div class="field-box">${data.loan_type || '—'}</div></div>
                <div class="detail-field"><label>Amount Requested</label><div class="field-box">RM ${parseFloat(data.amount_requested || 0).toFixed(2)}</div></div>
                <div class="detail-field"><label>Repayment Period</label><div class="field-box">${data.repayment_period || '—'} Months</div></div>
                <div class="detail-field"><label>Monthly Basic Salary</label><div class="field-box">RM ${parseFloat(data.monthly_salary || 0).toFixed(2)}</div></div>
                <div class="detail-field"><label>Disbursement Method</label><div class="field-box">${data.disbursement_method || 'Bank Transfer'}</div></div>
                <div class="detail-field"><label>Bank Details</label><div class="field-box">${data.bank_details || '—'} (Acc: ${data.account_number || '—'})</div></div>
                <div class="detail-field"><label>Account Holder Name</label><div class="field-box">${data.account_holder || '—'}</div></div>
                <div class="detail-field"><label>Supporting Document</label><div class="field-box" style="background:transparent; border:none; padding:0;">${docHTML}</div></div>
              </div>
            `;
          }

          container.innerHTML = htmlFields;

        } catch (err) {
          console.error("Load full form details error:", err);
          container.innerHTML = `<div style="padding: 12px; color: #ef4444;">Error fetching detailed form data.</div>`;
        }
      }

      // 5. MEMUATKAN SENARAI APPROVAL QUEUE
      async function fetchApprovalQueue() {
        try {
          const queryParams = new URLSearchParams({
            user_id: userId || '',
            department: department || '',
            position: position || ''
          });

          const res = await fetch(`http://localhost:3000/api/approval-queue?${queryParams.toString()}`);
          const result = await res.json();

          const queueList = document.getElementById('queueList');
          const completedBody = document.getElementById('completedTableBody');
          
          queueList.innerHTML = '';
          completedBody.innerHTML = '';

          if (result.success && Array.isArray(result.data)) {
            allRequestsData = result.data;

            const pendingItems = allRequestsData.filter(item => {
              const s = (item.status || '').trim().toLowerCase();
              return s === 'pending' || s === 'in review' || s === 'submitted';
            });

            pendingItems.sort((a, b) => {
              const aHasReminder = !!a.last_reminder_sent;
              const bHasReminder = !!b.last_reminder_sent;
              if (aHasReminder && !bHasReminder) return -1;
              if (!aHasReminder && bHasReminder) return 1;
              if (aHasReminder && bHasReminder) {
                return new Date(b.last_reminder_sent) - new Date(a.last_reminder_sent);
              }
              return 0;
            });

            const completedItems = allRequestsData.filter(item => {
              const s = (item.status || '').trim().toLowerCase();
              return s !== 'pending' && s !== 'in review' && s !== 'submitted';
            });

            const cardColors = ['card-color-0', 'card-color-1', 'card-color-2', 'card-color-3', 'card-color-4', 'card-color-5'];

            if (pendingItems.length > 0) {
              pendingItems.forEach((item, index) => {
                const formattedId = `REQ-2026-${String(item.id).padStart(3, '0')}`;
                const dateStr = item.date_submitted ? new Date(item.date_submitted).toISOString().split('T')[0] : '—';

                const div = document.createElement('div');
                div.className = `request-card ${cardColors[index % cardColors.length]} ${index === 0 ? 'active' : ''}`;
                div.dataset.rawId = item.id;
                div.dataset.id = formattedId;
                div.dataset.type = item.request_type;
                div.dataset.employee = item.employee_name;
                div.dataset.empId = item.employee_id;
                div.dataset.dept = item.department;
                div.dataset.date = dateStr;
                div.dataset.amount = item.amount || '—';
                div.dataset.status = item.status;

                const reminderTag = item.last_reminder_sent
                  ? `<span class="reminder-tag">🔔 Reminder sent ${timeAgo(item.last_reminder_sent)}</span>`
                  : '';

                div.innerHTML = `
                  <h4>${item.employee_name}</h4>
                  <p>${item.request_type} Application</p>
                  <small>${formattedId}</small>
                  ${reminderTag}
                `;

                div.addEventListener('click', function() {
                  document.querySelectorAll('.request-card').forEach(i => i.classList.remove('active'));
                  this.classList.add('active');

                  selectedRawId = this.dataset.rawId;
                  selectedType = this.dataset.type;

                  document.getElementById('detailType').textContent = `${this.dataset.type} Application`;
                  document.getElementById('detailReqId').textContent = this.dataset.id;
                  document.getElementById('detailSectionTitle').textContent = `${this.dataset.type} Details`;

                  const statusPill = document.getElementById('detailStatus');
                  statusPill.textContent = this.dataset.status;
                  statusPill.className = `status-pill status-${this.dataset.status.toLowerCase().replace(/\s+/g, '-')}`;

                  loadFullFormDetails(selectedRawId, selectedType);
                });

                queueList.appendChild(div);
              });

              queueList.querySelector('.request-card')?.click();
            } else {
              queueList.innerHTML = `<div style="padding: 20px; text-align: center; color: #64748b;">No pending requests for ${department || 'this'} department.</div>`;
              resetDetailCard();
            }

            if (completedItems.length > 0) {
              completedItems.forEach(item => {
                const formattedId = `REQ-2026-${String(item.id).padStart(3, '0')}`;
                const dateStr = item.date_submitted ? new Date(item.date_submitted).toISOString().split('T')[0] : '—';
                
                let statusClass = 'approved';
                const lowerStatus = (item.status || '').toLowerCase();
                if (lowerStatus.includes('reject')) {
                  statusClass = 'rejected';
                } else if (lowerStatus.includes('revision')) {
                  statusClass = 'revision';
                }

                const reqType = item.request_type || 'General';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                  <td><strong>${formattedId}</strong></td>
                  <td>${reqType}</td>
                  <td>${item.employee_name} (${item.department})</td>
                  <td>${item.amount || '—'}</td>
                  <td>${dateStr}</td>
                  <td><span class="table-badge ${statusClass}">${item.status}</span></td>
                  <td><a href="request-details.html?id=${item.id}&type=${encodeURIComponent(reqType)}" class="view-action-link">View</a></td>
                `;
                completedBody.appendChild(tr);
              });
              document.getElementById('paginationInfo').textContent = `Showing ${completedItems.length} of ${completedItems.length} entries`;
            } else {
              completedBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 20px;">No completed approval records found.</td></tr>`;
              document.getElementById('paginationInfo').textContent = `Showing 0 of 0 entries`;
            }

          } else {
            queueList.innerHTML = `<div style="padding: 20px; text-align: center; color: #64748b;">No requests found.</div>`;
            completedBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 20px;">No entries available.</td></tr>`;
          }
        } catch (err) {
          console.error("Queue Fetch Error:", err);
        }
      }

      function resetDetailCard() {
        selectedRawId = null;
        selectedType = null;
        document.getElementById('detailType').textContent = 'Select a Request';
        document.getElementById('detailReqId').textContent = '—';
        document.getElementById('detailEmployeeId').textContent = '—';
        document.getElementById('detailEmployee').textContent = '—';
        document.getElementById('detailDepartment').textContent = '—';
        document.getElementById('detailPhone').textContent = '—';
        document.getElementById('detailEmail').textContent = '—';
        document.getElementById('detailSubmitted').textContent = '—';
        document.getElementById('detailSectionTitle').textContent = 'Request Details';
        document.getElementById('dynamicFormContainer').innerHTML = `<div style="color: #64748b; font-size: 13px;">Select a request card above.</div>`;
        document.getElementById('detailStatus').textContent = '—';
        document.getElementById('detailStatus').className = 'status-pill status-pending';
      }

      async function updateRequestStatus(actionStatus) {
        if (!selectedRawId || !selectedType) {
          alert("Please select a pending request first.");
          return;
        }

        const commentText = document.getElementById('comment').value.trim();

        try {
          const response = await fetch(`http://localhost:3000/api/approval-queue/${encodeURIComponent(selectedType)}/${selectedRawId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              status: actionStatus,
              comment: commentText 
            })
          });

          const result = await response.json();

          if (result.success) {
            alert(`Request marked as '${actionStatus}'!`);
            document.getElementById('comment').value = '';
            fetchApprovalQueue();
            fetchNotifications();
          } else {
            alert(`Error: ${result.message || 'Failed to update request.'}`);
          }
        } catch (error) {
          console.error("API Error:", error);
          alert("Failed to update status on server.");
        }
      }

      document.getElementById('approveBtn')?.addEventListener('click', () => updateRequestStatus('Approved'));
      document.getElementById('revisionBtn')?.addEventListener('click', () => updateRequestStatus('Revision'));
      document.getElementById('rejectBtn')?.addEventListener('click', () => updateRequestStatus('Rejected'));

      document.getElementById('logoutBtn')?.addEventListener('click', () => {
        sessionStorage.clear();
      });

      document.getElementById('carouselPrevBtn')?.addEventListener('click', () => {
        document.getElementById('queueList')?.scrollBy({ left: -220, behavior: 'smooth' });
      });
      document.getElementById('carouselNextBtn')?.addEventListener('click', () => {
        document.getElementById('queueList')?.scrollBy({ left: 220, behavior: 'smooth' });
      });

      fetchApprovalQueue();
    });
