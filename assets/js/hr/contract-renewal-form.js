document.addEventListener('DOMContentLoaded', function() {
        let selectedFile = null;

        const username = sessionStorage.getItem('username');
        const userId = sessionStorage.getItem('userId');
        const position = sessionStorage.getItem('position');
        const department = sessionStorage.getItem('department');

        if (!username || !position) {
            alert("Access Denied! Please log in first.");
            window.location.href = "index.html";
            return;
        }

        // -------- Sidebar / Top bar initialization --------
        document.getElementById('sidebarName').textContent = username;
        document.getElementById('sidebarMeta').textContent = `${userId ? userId.toUpperCase() : ''} . ${department || ''}`;

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
        function setSafeValue(id, val) { const el = document.getElementById(id); if (el) el.value = val; }

        // -------- Request Information --------
        async function loadRequesterInfo() {
            if (!formattedUserId) return;
            try {
                const res = await fetch(`/api/profile/${formattedUserId}`);
                const result = await res.json();
                if (result.success && result.data) {
                    const data = result.data;
                    setSafeValue('requestedBy', `${data.name || username} (${data.user_id || formattedUserId})`);
                    setSafeValue('requesterPosition', data.position || position || '—');
                    setSafeValue('requesterDept', data.department || department || '—');
                }
            } catch (err) {
                console.error('Error loading requester profile:', err);
                setSafeValue('requestedBy', `${username} (${formattedUserId})`);
                setSafeValue('requesterPosition', position || '—');
                setSafeValue('requesterDept', department || '—');
            }
            setSafeValue('requestDate', new Date().toISOString().split('T')[0]);
        }

        // -------- Employee Lookup Logic --------
        let lookupTimer = null;
        function clearEmployeeFields() {
            setSafeValue('employeeName', '');
            setSafeValue('employeeDept', '');
            setSafeValue('employeePosition', '');
        }

        async function lookupEmployee(rawId) {
            const statusEl = document.getElementById('employeeLookupStatus');
            const empId = (rawId || '').trim().toUpperCase();
            clearEmployeeFields();

            if (!empId) { statusEl.textContent = ''; return; }

            statusEl.textContent = 'Looking up employee...';
            statusEl.style.color = '#94a3b8';

            try {
                const res = await fetch(`/api/profile/${empId}`);
                const result = await res.json();

                if (result.success && result.data) {
                    const data = result.data;
                    setSafeValue('employeeName', data.name || '');
                    setSafeValue('employeeDept', data.department || '');
                    setSafeValue('employeePosition', data.position || '');

                    statusEl.textContent = 'Employee found.';
                    statusEl.style.color = '#16a34a';
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

        // -------- Drag & Drop File Upload --------
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
            const fileInput = document.getElementById('attachmentInput');
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

        // -------- Form Submission --------
        async function handleSubmit(e) {
            e.preventDefault();

            const employeeId = document.getElementById('employeeId').value.trim();
            const employeeName = document.getElementById('employeeName').value.trim();

            const currentStartDate = document.getElementById('currentStartDate').value;
            const currentEndDate = document.getElementById('currentEndDate').value;
            const currentDuration = document.getElementById('currentDuration').value.trim();
            const currentSalary = document.getElementById('currentSalary').value;

            const proposedStartDate = document.getElementById('proposedStartDate').value;
            const proposedEndDate = document.getElementById('proposedEndDate').value;
            const proposedDuration = document.getElementById('proposedDuration').value.trim();
            const proposedSalary = document.getElementById('proposedSalary').value;
            const reasonForRenewal = document.getElementById('reasonForRenewal').value.trim();

            const performanceSummary = document.getElementById('performanceSummary').value.trim();
            const attendanceStatus = document.getElementById('attendanceStatus').value;
            const employeeRemarks = document.getElementById('employeeRemarks').value.trim();
            const disciplineStatus = document.getElementById('disciplineStatus').value;
            const renewalRecommendation = document.getElementById('renewalRecommendation').value;
            const supervisorRecommendation = document.getElementById('supervisorRecommendation').value.trim();

            if (!employeeId || !employeeName) { alert('Please enter a valid Employee ID and wait for auto-fill.'); return; }
            if (!currentStartDate || !currentEndDate || !currentDuration || !currentSalary) {
                alert('Please complete all Current Contract Details fields.'); return;
            }
            if (!proposedStartDate || !proposedEndDate || !proposedDuration || !proposedSalary || !reasonForRenewal) {
                alert('Please complete all Proposed Renewal Details fields.'); return;
            }
            if (!performanceSummary || !attendanceStatus || !disciplineStatus || !renewalRecommendation || !supervisorRecommendation) {
                alert('Please complete all required Employee Assessment fields.'); return;
            }

            const btnSubmit = document.getElementById('btnSubmit');
            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Submitting...';

            const formData = new FormData();
            formData.append('requested_by', formattedUserId);
            formData.append('requester_position', document.getElementById('requesterPosition').value);
            formData.append('request_date', document.getElementById('requestDate').value);
            formData.append('department', document.getElementById('requesterDept').value);
            formData.append('employee_id', employeeId);
            formData.append('employee_name', employeeName);
            formData.append('employee_department', document.getElementById('employeeDept').value);
            formData.append('position', document.getElementById('employeePosition').value);
            formData.append('current_start_date', currentStartDate);
            formData.append('current_end_date', currentEndDate);
            formData.append('current_duration', currentDuration);
            formData.append('current_salary', currentSalary);
            formData.append('proposed_start_date', proposedStartDate);
            formData.append('proposed_end_date', proposedEndDate);
            formData.append('proposed_duration', proposedDuration);
            formData.append('proposed_salary', proposedSalary);
            formData.append('reason_for_renewal', reasonForRenewal);
            formData.append('performance_summary', performanceSummary);
            formData.append('attendance_status', attendanceStatus);
            formData.append('employee_remarks', employeeRemarks);
            formData.append('discipline_status', disciplineStatus);
            formData.append('renewal_recommendation', renewalRecommendation);
            formData.append('supervisor_recommendation', supervisorRecommendation);
            if (selectedFile) formData.append('attachment', selectedFile);

            try {
                const res = await fetch('/api/submit-contract-renewal', { method: 'POST', body: formData });
                const result = await res.json();

                if (result.success) {
                    alert('Contract renewal form submitted successfully!');
                    window.location.href = 'hr-operation.html';
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
        document.getElementById('contractRenewalForm').addEventListener('submit', handleSubmit);
        document.getElementById('btnCancel').addEventListener('click', () => { window.location.href = 'hr-operation.html'; });
    });