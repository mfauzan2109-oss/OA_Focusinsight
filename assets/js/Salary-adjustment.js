document.addEventListener('DOMContentLoaded', function() {
        let selectedFile = null;
        let currentSalaryValue = 0;

        const username = sessionStorage.getItem('username');
        const userId = sessionStorage.getItem('userId');
        const position = sessionStorage.getItem('position');
        const department = sessionStorage.getItem('department');

        if (!username || !position) {
            alert("Access Denied! Please log in first.");
            window.location.href = "index.html";
            return;
        }

        // -------- Sidebar / top bar, same pattern as dashboard.html --------
        document.getElementById('sidebarName').textContent = username;
        document.getElementById('sidebarMeta').textContent = `${userId ? userId.toUpperCase() : ''} . ${department || ''}`;

        const isManager = (userId && userId.toUpperCase().startsWith('MGR')) ||
                          (position && position.toLowerCase().includes('manager'));
        if (isManager) {
            const approvalQueueItem = document.getElementById('approvalQueueItem');
            if (approvalQueueItem) approvalQueueItem.style.display = 'flex';
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
        const savedAvatar = localStorage.getItem(`userAvatar_${formattedUserId}`);
        updateAvatarDisplay(savedAvatar);

        // -------- Form helpers --------
        function setSafeText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
        function setSafeValue(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
        function formatMoney(num) {
            return `RM ${parseFloat(num || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }

        // -------- Request Information: auto-filled from the logged-in requester --------
        async function loadRequesterInfo() {
            if (!formattedUserId) return;
            try {
                const res = await fetch(`http://localhost:3000/api/profile/${formattedUserId}`);
                const result = await res.json();
                if (result.success && result.data) {
                    const data = result.data;
                    setSafeValue('requestedBy', `${data.name || username} (${data.user_id || formattedUserId})`);
                    setSafeValue('requesterDept', data.department || department || '—');
                }
            } catch (err) {
                console.error('Error loading requester profile:', err);
                setSafeValue('requestedBy', `${username} (${formattedUserId})`);
                setSafeValue('requesterDept', department || '—');
            }
            setSafeValue('requestDate', new Date().toISOString().split('T')[0]);
        }

        // -------- Employee Information: auto-filled once Employee ID is entered --------
        let lookupTimer = null;
        function clearEmployeeFields() {
            setSafeValue('employeeName', '');
            setSafeValue('employeeDept', '');
            setSafeValue('employeePosition', '');
            setSafeValue('employmentType', '');
            setSafeValue('employmentDate', '');
            setSafeValue('currentSalary', '');
            currentSalaryValue = 0;
            recalcAdjustment();
        }

        async function lookupEmployee(rawId) {
            const statusEl = document.getElementById('employeeLookupStatus');
            const empId = (rawId || '').trim().toUpperCase();
            clearEmployeeFields();

            if (!empId) { statusEl.textContent = ''; return; }

            statusEl.textContent = 'Looking up employee...';
            statusEl.style.color = '#94a3b8';

            try {
                const res = await fetch(`http://localhost:3000/api/profile/${empId}`);
                const result = await res.json();

                if (result.success && result.data) {
                    const data = result.data;
                    setSafeValue('employeeName', data.name || '');
                    setSafeValue('employeeDept', data.department || '');
                    setSafeValue('employeePosition', data.position || '');
                    setSafeValue('employmentType', data.employment_type || '');
                    setSafeValue('employmentDate', data.join_date || '—');

                    currentSalaryValue = parseFloat(data.salary) || 0;
                    setSafeValue('currentSalary', formatMoney(currentSalaryValue));

                    statusEl.textContent = 'Employee found.';
                    statusEl.style.color = '#16a34a';
                    recalcAdjustment();
                } else {
                    statusEl.textContent = 'Employee ID not found.';
                    statusEl.style.color = '#ef4444';
                }
            } catch (err) {
                console.error('Employee lookup failed:', err);
                statusEl.textContent = 'Could not reach the server.';
                statusEl.style.color = '#ef4444';
            }
        }

        // -------- Adjustment Amount / Percentage auto-calculate --------
        function recalcAdjustment() {
            const proposed = parseFloat(document.getElementById('proposedSalary').value) || 0;
            const amount = proposed - currentSalaryValue;
            const percentage = currentSalaryValue > 0 ? (amount / currentSalaryValue) * 100 : 0;

            setSafeValue('adjustmentAmount', proposed ? formatMoney(amount) : '');
            setSafeValue('adjustmentPercentage', proposed ? `${percentage.toFixed(2)}%` : '');
        }

        // -------- Drag & drop / file picker --------
        function handleFileSelected(file) {
            if (!file) return;
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
            if (!allowedTypes.includes(file.type)) { alert('Only PDF, JPG, or PNG files are allowed.'); return; }
            if (file.size > 5 * 1024 * 1024) { alert('File size must be 5MB or under.'); return; }

            selectedFile = file;
            document.getElementById('fileNameText').textContent = file.name;
            document.getElementById('filePreview').style.display = 'flex';
        }

        function setupDropzone() {
            const dropzone = document.getElementById('dropzone');
            const fileInput = document.getElementById('salaryAttachmentInput');
            const browseLink = document.getElementById('browseFilesLink');
            const removeLink = document.getElementById('removeFileLink');

            browseLink.addEventListener('click', (e) => { e.preventDefault(); fileInput.click(); });
            dropzone.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => handleFileSelected(e.target.files[0]));

            ['dragenter', 'dragover'].forEach(evt => {
                dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
            });
            ['dragleave', 'drop'].forEach(evt => {
                dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); });
            });
            dropzone.addEventListener('drop', (e) => handleFileSelected(e.dataTransfer.files[0]));

            removeLink.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                selectedFile = null;
                fileInput.value = '';
                document.getElementById('filePreview').style.display = 'none';
            });
        }

        // -------- Submit --------
        async function handleSubmit(e) {
            e.preventDefault();

            const employeeId = document.getElementById('employeeId').value.trim();
            const employeeName = document.getElementById('employeeName').value.trim();
            const adjustmentType = document.getElementById('adjustmentType').value;
            const proposedSalary = document.getElementById('proposedSalary').value;
            const effectiveDate = document.getElementById('effectiveDate').value;
            const justification = document.getElementById('justification').value.trim();

            if (!employeeId || !employeeName) { alert('Please enter a valid Employee ID and wait for it to auto-fill.'); return; }
            if (!adjustmentType) { alert('Please select an Adjustment Type.'); return; }
            if (!proposedSalary || parseFloat(proposedSalary) <= 0) { alert('Please enter a valid Proposed Basic Salary.'); return; }
            if (!effectiveDate) { alert('Please select an Effective Date.'); return; }
            if (!justification) { alert('Please provide a justification for this request.'); return; }

            const btnSubmit = document.getElementById('btnSubmit');
            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Submitting...';

            const formData = new FormData();
            formData.append('requested_by', formattedUserId);
            formData.append('request_date', document.getElementById('requestDate').value);
            formData.append('department', document.getElementById('requesterDept').value);
            formData.append('employee_id', employeeId);
            formData.append('employee_name', employeeName);
            formData.append('employee_department', document.getElementById('employeeDept').value);
            formData.append('position', document.getElementById('employeePosition').value);
            formData.append('employment_type', document.getElementById('employmentType').value);
            formData.append('employment_date', document.getElementById('employmentDate').value);
            formData.append('current_basic_salary', currentSalaryValue);
            formData.append('adjustment_type', adjustmentType);
            formData.append('proposed_basic_salary', proposedSalary);
            formData.append('effective_date', effectiveDate);
            formData.append('justification', justification);
            if (selectedFile) formData.append('attachment', selectedFile);

            try {
                const res = await fetch('http://localhost:3000/api/submit-salary-adjustment', { method: 'POST', body: formData });
                const result = await res.json();

                if (result.success) {
                    alert('Salary adjustment request submitted successfully!');
                    window.location.href = 'my-request.html';
                } else {
                    alert('Error submitting request: ' + (result.message || 'Unknown error.'));
                }
            } catch (err) {
                console.error('Submit failed:', err);
                alert('Client error: ' + err.message);
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Submit';
            }
        }

        loadRequesterInfo();
        setupDropzone();

        document.getElementById('employeeId').addEventListener('input', (e) => {
            clearTimeout(lookupTimer);
            lookupTimer = setTimeout(() => lookupEmployee(e.target.value), 500);
        });
        document.getElementById('proposedSalary').addEventListener('input', recalcAdjustment);
        document.getElementById('salaryAdjustmentForm').addEventListener('submit', handleSubmit);
        document.getElementById('btnCancel').addEventListener('click', () => { window.location.href = 'dashboard.html'; });
    });
