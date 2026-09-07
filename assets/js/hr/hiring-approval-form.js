document.addEventListener('DOMContentLoaded', function() {
    let selectedFile = null;
    let allEmployees = [];
    let selectedReplacement = null;

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
                setSafeValue('requesterDept', data.department || department || '—');
            }
        } catch (err) {
            console.error('Error loading requester profile:', err);
            setSafeValue('requestedBy', `${username} (${formattedUserId})`);
            setSafeValue('requesterDept', department || '—');
        }
        setSafeValue('requestDate', new Date().toISOString().split('T')[0]);
    }

    // -------- "Employee being replaced" searchable combobox --------
    // Only meaningful when Hiring type = Replacement, so it stays disabled otherwise.
    const hiringTypeEl = document.getElementById('hiringType');
    const replacedSearchEl = document.getElementById('employeeReplacedSearch');
    const replacedIdEl = document.getElementById('employeeReplacedId');
    const replacedDropdown = document.getElementById('employeeReplacedDropdown');
    const replacedHelperText = document.getElementById('replacedHelperText');

    async function loadEmployeeDirectory() {
        try {
            const res = await fetch('/api/users');
            const result = await res.json();
            if (result.success && Array.isArray(result.data)) {
                allEmployees = result.data;
            }
        } catch (err) {
            console.error('Could not load employee directory:', err);
        }
    }

    function renderReplacedDropdown(matches) {
        replacedDropdown.innerHTML = '';
        if (!matches.length) {
            replacedDropdown.innerHTML = '<div class="search-dropdown-empty">No matching employees.</div>';
        } else {
            matches.slice(0, 8).forEach(emp => {
                const item = document.createElement('div');
                item.className = 'search-dropdown-item';
                item.innerHTML = `${emp.name || emp.user_id}<small>${emp.user_id} . ${emp.department || '—'} . ${emp.position || '—'}</small>`;
                item.addEventListener('click', () => {
                    selectedReplacement = emp;
                    replacedSearchEl.value = `${emp.name} (${emp.user_id})`;
                    replacedIdEl.value = emp.user_id;
                    setSafeValue('employeeName', emp.name || '');
                    setSafeValue('employeeId', emp.user_id || '');
                    replacedDropdown.classList.remove('open');
                });
                replacedDropdown.appendChild(item);
            });
        }
        replacedDropdown.classList.add('open');
    }

    replacedSearchEl.addEventListener('input', () => {
        selectedReplacement = null;
        replacedIdEl.value = '';
        const term = replacedSearchEl.value.trim().toLowerCase();
        if (!term) { replacedDropdown.classList.remove('open'); return; }
        const matches = allEmployees.filter(emp =>
            (emp.name || '').toLowerCase().includes(term) ||
            (emp.user_id || '').toLowerCase().includes(term)
        );
        renderReplacedDropdown(matches);
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-select-wrapper')) {
            replacedDropdown.classList.remove('open');
        }
    });

    function applyHiringTypeRules() {
        const isReplacement = hiringTypeEl.value === 'Replacement';
        replacedSearchEl.disabled = !isReplacement;
        if (!isReplacement) {
            selectedReplacement = null;
            replacedSearchEl.value = '';
            replacedIdEl.value = '';
            replacedDropdown.classList.remove('open');
            replacedHelperText.textContent = 'Only applicable for Replacement hiring type.';
        } else {
            replacedHelperText.textContent = 'Search by name or employee ID, then select a match.';
        }
    }
    hiringTypeEl.addEventListener('change', applyHiringTypeRules);

    // -------- Employment Type -> Period field --------
    const employmentTypeEl = document.getElementById('employmentType');
    const employmentPeriodGroup = document.getElementById('employmentPeriodGroup');
    const employmentPeriodEl = document.getElementById('employmentPeriod');
    const PERIOD_REQUIRED_TYPES = ['Contract', 'Intern', 'Probation'];

    function applyEmploymentTypeRules() {
        const needsPeriod = PERIOD_REQUIRED_TYPES.includes(employmentTypeEl.value);
        employmentPeriodGroup.style.display = needsPeriod ? 'flex' : 'none';
        employmentPeriodEl.required = needsPeriod;
        if (!needsPeriod) employmentPeriodEl.value = '';
    }
    employmentTypeEl.addEventListener('change', applyEmploymentTypeRules);

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

        const employeeName = document.getElementById('employeeName').value.trim();
        const employeeId = document.getElementById('employeeId').value.trim();
        const hiringType = hiringTypeEl.value;
        const numberOfVacancy = document.getElementById('numberOfVacancy').value;
        const employmentType = document.getElementById('employmentType').value;
        const employmentPeriod = employmentPeriodEl.value.trim();
        const workLocation = document.getElementById('workLocation').value.trim();
        const requiredStartDate = document.getElementById('requiredStartDate').value;
        const reasonForHiring = document.getElementById('reasonForHiring').value.trim();
        const jobDescription = document.getElementById('jobDescription').value.trim();
        const keyResponsibilities = document.getElementById('keyResponsibilities').value.trim();
        const minimumQualification = document.getElementById('minimumQualification').value.trim();
        const requiredSkills = document.getElementById('requiredSkills').value.trim();
        const requiredExperience = document.getElementById('requiredExperience').value.trim();
        const salaryRange = document.getElementById('salaryRange').value.trim();
        const budgetCostCenter = document.getElementById('budgetCostCenter').value.trim();
        const hiringPriority = document.getElementById('hiringPriority').value;

        if (!employeeName || !employeeId) { alert('Please fill in Employee Name and Employee ID.'); return; }
        if (!hiringType) { alert('Please select a Hiring type.'); return; }
        if (hiringType === 'Replacement' && !replacedIdEl.value) { alert('Please search and select the Employee being replaced.'); return; }
        if (!numberOfVacancy || Number(numberOfVacancy) < 1) { alert('Please enter a valid Number of Vacancy.'); return; }
        if (!employmentType) { alert('Please select an Employment Type.'); return; }
        if (PERIOD_REQUIRED_TYPES.includes(employmentType) && !employmentPeriod) { alert('Please fill in the Period for the selected Employment Type.'); return; }
        if (!workLocation) { alert('Please enter the Work Location.'); return; }
        if (!requiredStartDate) { alert('Please select the Required Start Date.'); return; }
        if (!reasonForHiring) { alert('Please provide the Reason for Hiring.'); return; }
        if (!jobDescription || !keyResponsibilities || !minimumQualification || !requiredSkills || !requiredExperience) {
            alert('Please complete all fields in the Job Requirement section.');
            return;
        }
        if (!salaryRange || !budgetCostCenter || !hiringPriority) {
            alert('Please complete all fields in the Compensation & Budget section.');
            return;
        }

        const btnSubmit = document.getElementById('btnSubmit');
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Submitting...';

        const formData = new FormData();
        formData.append('requested_by', formattedUserId);
        formData.append('request_date', document.getElementById('requestDate').value);
        formData.append('department', document.getElementById('requesterDept').value);
        formData.append('employee_name', employeeName);
        formData.append('employee_id', employeeId);
        formData.append('hiring_type', hiringType);
        formData.append('employee_replaced_id', replacedIdEl.value || '');
        formData.append('number_of_vacancy', numberOfVacancy);
        formData.append('employment_type', employmentType);
        formData.append('employment_period', employmentPeriod);
        formData.append('work_location', workLocation);
        formData.append('required_start_date', requiredStartDate);
        formData.append('reason_for_hiring', reasonForHiring);
        formData.append('job_description', jobDescription);
        formData.append('key_responsibilities', keyResponsibilities);
        formData.append('minimum_qualification', minimumQualification);
        formData.append('required_skills', requiredSkills);
        formData.append('required_experience', requiredExperience);
        formData.append('salary_range', salaryRange);
        formData.append('budget_cost_center', budgetCostCenter);
        formData.append('hiring_priority', hiringPriority);
        if (selectedFile) formData.append('attachment', selectedFile);

        try {
            const res = await fetch('/api/submit-hiring-approval', { method: 'POST', body: formData });
            const result = await res.json();

            if (result.success) {
                alert('Hiring approval form submitted successfully!');
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
    loadEmployeeDirectory();
    setupDropzone();
    applyHiringTypeRules();
    applyEmploymentTypeRules();

    document.getElementById('hiringForm').addEventListener('submit', handleSubmit);
    document.getElementById('btnCancel').addEventListener('click', () => { window.location.href = 'hr-operation.html'; });
});