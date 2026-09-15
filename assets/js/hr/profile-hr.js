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
            const response = await fetch(`/api/user-status/${userId}`);
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
            const response = await fetch(`/api/profile/${userId}`);
            const result = await response.json();

            if (result.success && result.data) {
                const data = result.data;

                setSafeText('headerName', data.name || '—');
                setSafeText('headerId', data.user_id || userId);
                setSafeText('headerPosition', data.position || 'HR Executive');
                setSafeText('headerDept', data.department || 'Human Resource');
                setSafeText('headerEmpType', data.employment_type || 'Full Time');
                
                const initialLetter = (data.name || 'H').charAt(0).toUpperCase();
                setSafeText('avatarName', initialLetter);

                setSafeValue('fullName', data.name || '');
                setSafeValue('email', data.email || '');
                setSafeValue('icNo', data.ic_no || '');
                setSafeValue('phoneNo', data.phone_no || '');
                setSafeValue('emergencyContact', data.emergency_contact || '');
                setSafeValue('address', data.address || '');

                setSafeValue('empDept', data.department || 'Human Resource');
                setSafeValue('empPosition', data.position || 'HR Executive');
                setSafeValue('empType', data.employment_type || 'Full Time');
                setSafeValue('empManager', data.manager || '—');
                setSafeValue('joinDate', data.join_date || '—');

                if (data.salary !== null && data.salary !== undefined && data.salary !== '') {
                    const salaryNum = parseFloat(data.salary);
                    const formattedSalary = isNaN(salaryNum)
                        ? data.salary
                        : salaryNum.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    setSafeValue('basicSalary', `RM ${formattedSalary}`);
                } else {
                    setSafeValue('basicSalary', '—');
                }

                const baseStatus = (data.employment_type === 'Probation') ? 'Probation' : 'Active';
                await checkCurrentEmployeeStatus(userId, baseStatus);
            }
        } catch (error) {
            console.error("Error loading profile:", error);
            // Fallback paparan daripada Session Storage jika API belum siap
            const sessionName = sessionStorage.getItem('username') || 'HR Staff';
            const sessionDept = sessionStorage.getItem('department') || 'Human Resource';
            const sessionPos = sessionStorage.getItem('position') || 'HR Executive';

            setSafeText('headerName', sessionName);
            setSafeText('headerId', userId);
            setSafeText('headerPosition', sessionPos);
            setSafeText('headerDept', sessionDept);
            setSafeText('headerEmpType', 'Full Time');
            setSafeText('avatarName', sessionName.charAt(0).toUpperCase());

            setSafeValue('fullName', sessionName);
            setSafeValue('empDept', sessionDept);
            setSafeValue('empPosition', sessionPos);
            setSafeValue('empType', 'Full Time');
            setSafeValue('basicSalary', '—');
        }
    }

    function validateProfileData(name, email) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
        if (!emailRegex.test(email)) {
            alert("Please enter a valid email address (e.g. name@example.com).");
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
        const rawUserId = sessionStorage.getItem('userId') || sessionStorage.getItem('user_id') || 'HR001';
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

        const fullNameInput = document.getElementById('fullName');
        fullNameInput?.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[0-9]/g, '');
        });

        const icNoInput = document.getElementById('icNo');
        icNoInput?.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
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
        const rawUserId = sessionStorage.getItem('userId') || sessionStorage.getItem('user_id') || 'HR001';
        const formattedUserId = rawUserId.toUpperCase();

        if (!isEditMode) {
            isEditMode = true;
            formInputs.forEach(input => {
                if (!['empDept', 'empPosition', 'empType', 'empManager', 'joinDate', 'basicSalary'].includes(input.id)) {
                    input.disabled = false;
                }
            });
            btnSubmit.textContent = "Save";
            btnSubmit.style.background = "#28a745"; 
        } else {
            const nameValue = document.getElementById('fullName')?.value?.trim() || '';
            const emailValue = document.getElementById('email')?.value?.trim() || '';

            if (!validateProfileData(nameValue, emailValue)) {
                return;
            }

            const profileData = {
                name: nameValue,
                email: emailValue,
                ic_no: document.getElementById('icNo')?.value?.trim() || '',
                phone_no: document.getElementById('phoneNo')?.value?.trim() || '',
                emergency_contact: document.getElementById('emergencyContact')?.value?.trim() || '',
                address: document.getElementById('address')?.value?.trim() || ''
            };

            try {
                const response = await fetch(`/api/profile/${formattedUserId}`, {
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
                // Kemas kini sesi tempatan sekiranya tiada sambungan server
                if (profileData.name) {
                    sessionStorage.setItem('username', profileData.name);
                    setSafeText('headerName', profileData.name);
                    setSafeText('avatarName', profileData.name.charAt(0).toUpperCase());
                }
                isEditMode = false;
                formInputs.forEach(input => input.disabled = true);
                btnSubmit.textContent = "Update Profile";
                btnSubmit.style.background = "#004ffe";
                alert("Profile changes saved locally!");
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
            window.location.href = "hr-dashboard.html";
        }
    });
