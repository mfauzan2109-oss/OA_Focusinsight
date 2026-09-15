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

        // -------- Employee Lookup (optional auto-fill of payee name) --------
        let lookupTimer = null;
        async function lookupEmployee(rawId) {
            const statusEl = document.getElementById('employeeLookupStatus');
            const empId = (rawId || '').trim().toUpperCase();
            if (!empId) { statusEl.textContent = ''; return; }

            statusEl.textContent = 'Looking up employee...';
            statusEl.style.color = '#94a3b8';

            try {
                const res = await fetch(`/api/profile/${empId}`);
                const result = await res.json();
                if (result.success && result.data) {
                    const data = result.data;
                    const payeeField = document.getElementById('payeeName');
                    if (payeeField && !payeeField.value.trim()) payeeField.value = data.name || '';
                    statusEl.textContent = 'Employee found.';
                    statusEl.style.color = '#16a34a';
                } else {
                    statusEl.textContent = 'Employee ID not found — you can still enter the payee name manually.';
                    statusEl.style.color = '#d97706';
                }
            } catch (err) {
                console.error('Employee lookup failed:', err);
                statusEl.textContent = 'Could not reach the server.';
                statusEl.style.color = '#ef4444';
            }
        }

        // -------- Payment Summary (simplified statutory approximations) --------
        // NOTE: EPF/SOCSO/EIS here use flat-rate approximations for a live preview
        // only. They are not the official bracket-table figures. Tax/PCB is left
        // as a manual entry since it depends on factors this form doesn't capture.
        function fmtRM(n) {
            return 'RM ' + (isNaN(n) ? '0.00' : n.toFixed(2));
        }

        function recalcSummary() {
            const gross = parseFloat(document.getElementById('grossAmount').value) || 0;
            const tax = parseFloat(document.getElementById('taxAmount').value) || 0;

            const epf = Math.round(gross * 0.11 * 100) / 100;
            const socso = Math.round(gross * 0.005 * 100) / 100;
            const eis = Math.round(gross * 0.002 * 100) / 100;
            const netPay = Math.round((gross - epf - socso - eis - tax) * 100) / 100;

            document.getElementById('sumGross').textContent = fmtRM(gross);
            document.getElementById('sumEpf').textContent = fmtRM(epf);
            document.getElementById('sumSocso').textContent = fmtRM(socso);
            document.getElementById('sumEis').textContent = fmtRM(eis);
            document.getElementById('sumNetPay').textContent = fmtRM(netPay);
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

            const paymentType = document.getElementById('paymentType').value;
            const paymentPeriod = document.getElementById('paymentPeriod').value;
            const payeeName = document.getElementById('payeeName').value.trim();
            const employeeId = document.getElementById('employeeId').value.trim();
            const grossAmount = document.getElementById('grossAmount').value;
            const paymentDescription = document.getElementById('paymentDescription').value.trim();
            const bankName = document.getElementById('bankName').value.trim();
            const bankAccountNumber = document.getElementById('bankAccountNumber').value.trim();
            const requestedPaymentDate = document.getElementById('requestedPaymentDate').value;
            const costCenter = document.getElementById('costCenter').value.trim();

            if (!paymentType || !paymentPeriod || !payeeName || !employeeId) {
                alert('Please complete all Payment Details fields.'); return;
            }
            if (!grossAmount || parseFloat(grossAmount) <= 0) {
                alert('Please enter a valid Amount (RM).'); return;
            }
            if (!paymentDescription) { alert('Please enter a Payment Description.'); return; }
            if (!bankName || !bankAccountNumber || !requestedPaymentDate || !costCenter) {
                alert('Please complete all Bank & Payment Information fields.'); return;
            }

            const btnSubmit = document.getElementById('btnSubmit');
            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Submitting...';

            const formData = new FormData();
            formData.append('requested_by', formattedUserId);
            formData.append('requester_position', document.getElementById('requesterPosition').value);
            formData.append('request_date', document.getElementById('requestDate').value);
            formData.append('department', document.getElementById('requesterDept').value);
            formData.append('payment_type', paymentType);
            formData.append('payment_period', paymentPeriod);
            formData.append('payee_name', payeeName);
            formData.append('employee_id', employeeId);
            formData.append('gross_amount', grossAmount);
            formData.append('payment_description', paymentDescription);
            formData.append('bank_name', bankName);
            formData.append('bank_account_number', bankAccountNumber);
            formData.append('requested_payment_date', requestedPaymentDate);
            formData.append('cost_center', costCenter);
            formData.append('tax_amount', document.getElementById('taxAmount').value || '0');
            formData.append('remarks', document.getElementById('remarks').value.trim());
            if (selectedFile) formData.append('attachment', selectedFile);

            try {
                const res = await fetch('/api/submit-payroll-payment', { method: 'POST', body: formData });
                const result = await res.json();

                if (result.success) {
                    alert('Payroll payment request submitted successfully!');
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
        recalcSummary();

        document.getElementById('employeeId').addEventListener('input', (e) => {
            clearTimeout(lookupTimer);
            lookupTimer = setTimeout(() => lookupEmployee(e.target.value), 500);
        });
        document.getElementById('grossAmount').addEventListener('input', recalcSummary);
        document.getElementById('taxAmount').addEventListener('input', recalcSummary);

        document.getElementById('payrollPaymentForm').addEventListener('submit', handleSubmit);
        document.getElementById('btnCancel').addEventListener('click', () => { window.location.href = 'hr-operation.html'; });
    });