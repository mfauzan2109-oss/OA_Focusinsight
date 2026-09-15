document.addEventListener('DOMContentLoaded', async function() {
        const urlParams = new URLSearchParams(window.location.search);
        const empIdParam = urlParams.get('id') || 'EMP001';

        // Load profile data from MySQL via API
        async function loadProfileData() {
            try {
                const response = await fetch(`/api/profile/${encodeURIComponent(empIdParam)}`);
                const result = await response.json();

                if (result.success && result.data) {
                    const u = result.data;

                    // Update Title & Summary Card
                    document.getElementById('profileHeading').textContent = `${(u.name || 'USER').toUpperCase()} (${u.user_id})`;
                    document.getElementById('summaryName').textContent = u.name || 'N/A';
                    document.getElementById('summaryId').textContent = u.user_id || 'N/A';
                    document.getElementById('summaryPos').textContent = u.position || 'N/A';
                    document.getElementById('summaryDept').textContent = u.department || 'N/A';
                    document.getElementById('summaryType').textContent = u.employment_type || 'Full Time';

                    // Populate Input Fields
                    document.getElementById('fullName').value = u.name || '';
                    document.getElementById('email').value = u.email || '';
                    document.getElementById('icPassport').value = u.ic_no || '';
                    document.getElementById('phoneNo').value = u.phone_no || '';
                    document.getElementById('emergencyContact').value = u.emergency_contact || '';
                    document.getElementById('address').value = u.address || '';
                    document.getElementById('dept').value = u.department || '';
                    document.getElementById('position').value = u.position || '';
                    document.getElementById('supervisor').value = u.manager || '';
                    
                    if (u.join_date) {
                        try {
                            const formattedDate = new Date(u.join_date).toISOString().split('T')[0];
                            document.getElementById('joinDate').value = formattedDate;
                        } catch(e) {
                            document.getElementById('joinDate').value = '';
                        }
                    }

                    document.getElementById('empId').value = u.user_id || '';
                } else {
                    alert('Error loading user profile: ' + (result.message || 'User not found.'));
                }
            } catch (err) {
                console.error('Fetch profile error:', err);
                alert('Database connection error. Ensure your Node.js server is running.');
            }
        }

        await loadProfileData();

        // Submit profile updates to MySQL database
        document.getElementById('employeeEditForm').addEventListener('submit', async function(e) {
            e.preventDefault();

            const payload = {
                name: document.getElementById('fullName').value.trim(),
                email: document.getElementById('email').value.trim(),
                ic_no: document.getElementById('icPassport').value.trim(),
                phone_no: document.getElementById('phoneNo').value.trim(),
                emergency_contact: document.getElementById('emergencyContact').value.trim(),
                address: document.getElementById('address').value.trim(),
                department: document.getElementById('dept').value.trim(),
                position: document.getElementById('position').value.trim(),
                manager: document.getElementById('supervisor').value.trim(),
                join_date: document.getElementById('joinDate').value
            };

            try {
                const response = await fetch(`/api/profile/${encodeURIComponent(empIdParam)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();
                if (result.success) {
                    alert(result.message || 'Employee profile updated successfully!');
                    window.location.href = 'user-management.html';
                } else {
                    alert('Update failed: ' + result.message);
                }
            } catch (err) {
                console.error('Save profile error:', err);
                alert('Failed to connect to server. Ensure Node.js server is running.');
            }
        });
    });
