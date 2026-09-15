let isEditMode = false;

    function triggerProfileAvatarUpload() {
        document.getElementById('profileAvatarInput')?.click();
    }

    function renderAvatarImage(base64Image) {
        const container = document.getElementById('avatarContainer');
        if (container) {
            container.innerHTML = `<img src="${base64Image}" alt="Profile Picture" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        }
    }

    function loadSavedProfileAvatar(formattedUserId) {
        if (!formattedUserId) return;
        const savedAvatar = localStorage.getItem(`userAvatar_${formattedUserId}`);
        if (savedAvatar) {
            renderAvatarImage(savedAvatar);
        }
    }

    function setSafeText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function setSafeValue(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val;
    }

    function updateStatusBadge(statusText) {
        const badge = document.getElementById('statusBadge');
        if (!badge) return;

        badge.className = 'status-badge';
        badge.textContent = statusText;

        const status = statusText.toLowerCase();
        if (status.includes('leave')) {
            badge.classList.add('status-leave');
        } else if (status.includes('trip') || status.includes('travel')) {
            badge.classList.add('status-trip');
        } else if (status.includes('probation')) {
            badge.classList.add('status-probation');
        } else {
            badge.classList.add('status-active');
        }
    }

    async function checkCurrentEmployeeStatus(userId, defaultStatus = 'Active') {
        try {
            const response = await fetch(`http://localhost:3000/api/user-status/${userId}`);
            const result = await response.json();

            if (result.success && result.currentStatus) {
                updateStatusBadge(result.currentStatus);
                return;
            }
        } catch (error) {
            console.warn("Could not fetch current dynamic status:", error);
        }

        updateStatusBadge(defaultStatus);
    }

    async function loadUserProfile(userId) {
        try {
            const response = await fetch(`http://localhost:3000/api/profile/${userId}`);
            const result = await response.json();

            if (result.success && result.data) {
                const data = result.data;

                setSafeText('headerName', data.name || '—');
                setSafeText('headerId', data.user_id || userId);
                setSafeText('headerPosition', data.position || '—');
                setSafeText('headerDept', data.department || '—');
                setSafeText('headerEmpType', data.employment_type || 'Full Time');
                
                const initialLetter = (data.name || 'W').charAt(0).toUpperCase();
                setSafeText('avatarName', initialLetter);

                setSafeValue('fullName', data.name || '');
                setSafeValue('email', data.email || '');
                setSafeValue('icNo', data.ic_no || '');
                setSafeValue('phoneNo', data.phone_no || '');
                setSafeValue('emergencyContact', data.emergency_contact || '');
                setSafeValue('address', data.address || '');

                setSafeValue('empDept', data.department || '');
                setSafeValue('empPosition', data.position || '');
                setSafeValue('empType', data.employment_type || 'Full Time');
                setSafeValue('empManager', data.manager || '—');
                setSafeValue('joinDate', data.join_date || '—');
                
                // Salary — uses 'salary' from API (COALESCE of salary / basic_salary columns)
                const salaryVal = data.salary || data.basic_salary;
                if (salaryVal !== null && salaryVal !== undefined && salaryVal !== '' && parseFloat(salaryVal) > 0) {
                    const formatted = parseFloat(salaryVal).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    setSafeValue('salary', `RM ${formatted}`);
                } else {
                    setSafeValue('salary', '—');
                }

                const baseStatus = (data.employment_type === 'Probation') ? 'Probation' : 'Active';
                await checkCurrentEmployeeStatus(userId, baseStatus);
            }
        } catch (error) {
            console.error("Error loading profile:", error);
        }
    }

    function validateProfileData(name, email, icNo) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
        if (!emailRegex.test(email)) {
            alert("Please enter a valid email address (e.g. name@example.com).");
            return false;
        }

        if (icNo && !/^[0-9]{12}$/.test(icNo)) {
            alert("IC number must be exactly 12 digits (numbers only).");
            return false;
        }

        const mashRegex = /(.)\1{3,}/; 
        if (mashRegex.test(name) || mashRegex.test(email)) {
            alert("The name or email appears to contain invalid consecutive repeated characters.");
            return false;
        }

        if (name.length < 3) {
            alert("Please enter a valid full name (at least 3 characters).");
            return false;
        }

        return true;
    }

    document.addEventListener("DOMContentLoaded", () => {
        const rawUserId = sessionStorage.getItem('userId') || sessionStorage.getItem('user_id') || 'EMP001';
        const formattedUserId = rawUserId.toUpperCase();

        loadUserProfile(formattedUserId);
        loadSavedProfileAvatar(formattedUserId);

        const fileInput = document.getElementById('profileAvatarInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        const base64Data = event.target.result;
                        const specificKey = `userAvatar_${formattedUserId}`;
                        
                        localStorage.setItem(specificKey, base64Data);
                        renderAvatarImage(base64Data);
                        
                        window.dispatchEvent(new StorageEvent('storage', {
                            key: specificKey,
                            newValue: base64Data
                        }));
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        const emailInput = document.getElementById('email');
        emailInput?.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^a-zA-Z0-9._%+-@]/g, '');
        });

        const fullNameInput = document.getElementById('fullName');
        fullNameInput?.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[0-9]/g, '');
        });

        const icNoInput = document.getElementById('icNo');
        icNoInput?.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 12);
        });

        const emergencyContactInput = document.getElementById('emergencyContact');
        emergencyContactInput?.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9+ ]/g, '');
        });

        const phoneNoInput = document.getElementById('phoneNo');
        phoneNoInput?.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9+ ]/g, '');
        });
    });

    const btnSubmit = document.getElementById('btnSubmit');
    const btnBack = document.getElementById('btnBack');
    const formInputs = document.querySelectorAll('#profileForm input, #profileForm textarea');

    btnSubmit?.addEventListener('click', async () => {
        const rawUserId = sessionStorage.getItem('userId') || sessionStorage.getItem('user_id') || 'EMP001';
        const formattedUserId = rawUserId.toUpperCase();

        if (!isEditMode) {
            isEditMode = true;
            formInputs.forEach(input => {
                if (!['empDept', 'empPosition', 'empType', 'empManager', 'joinDate', 'salary'].includes(input.id)) {
                    input.disabled = false;
                }
            });
            btnSubmit.textContent = "Save";
            btnSubmit.style.background = "#28a745"; 
        } else {
            const nameValue = document.getElementById('fullName')?.value?.trim() || '';
            const emailValue = document.getElementById('email')?.value?.trim() || '';
            const icNoValue = document.getElementById('icNo')?.value?.trim() || '';

            if (!validateProfileData(nameValue, emailValue, icNoValue)) {
                return;
            }

            const profileData = {
                name: nameValue,
                email: emailValue,
                ic_no: icNoValue,
                phone_no: document.getElementById('phoneNo')?.value?.trim() || '',
                emergency_contact: document.getElementById('emergencyContact')?.value?.trim() || '',
                address: document.getElementById('address')?.value?.trim() || ''
            };

            try {
                const response = await fetch(`http://localhost:3000/api/profile/${formattedUserId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(profileData)
                });

                const result = await response.json();

                if (result.success) {
                    isEditMode = false;
                    formInputs.forEach(input => input.disabled = true);
                    btnSubmit.textContent = "Update Profile";
                    btnSubmit.style.background = "#004ffe";

                    if (profileData.name) {
                        sessionStorage.setItem('username', profileData.name);
                        setSafeText('headerName', profileData.name);
                        setSafeText('avatarName', profileData.name.charAt(0).toUpperCase());
                    }

                    alert("Profile changes saved successfully!");
                } else {
                    alert("Error saving profile: " + result.message);
                }
            } catch (err) {
                console.error("Save profile request failed:", err);
                alert("Client error: " + err.message);
            }
        }
    });

    btnBack?.addEventListener('click', () => {
        if (isEditMode) {
            isEditMode = false;
            formInputs.forEach(input => input.disabled = true);
            btnSubmit.textContent = "Update Profile";
            btnSubmit.style.background = "#004ffe";
        } else {
            window.location.href = "dashboard.html";
        }
    });
