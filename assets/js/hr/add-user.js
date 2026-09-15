document.addEventListener('DOMContentLoaded', function() {
        async function fetchNextEmployeeId() {
            try {
                const res = await fetch('/api/next-employee-id');
                const data = await res.json();
                if (data.success && data.nextEmployeeId) {
                    document.getElementById('employeeId').value = data.nextEmployeeId;
                } else {
                    document.getElementById('employeeId').value = 'EMP001';
                }
            } catch (err) {
                console.error('Failed to fetch next Employee ID:', err);
                document.getElementById('employeeId').value = 'EMP001';
            }
        }

        const today = new Date().toISOString().split('T')[0];
        document.getElementById('joinDate').value = today;

        fetchNextEmployeeId();

        document.getElementById('addUserForm').addEventListener('submit', async function(e) {
            e.preventDefault();

            const payload = {
                fullName: document.getElementById('fullName').value.trim(),
                email: document.getElementById('email').value.trim(),
                icPassport: document.getElementById('icPassport').value.trim(),
                phoneNo: document.getElementById('phoneNo').value.trim(),
                emergencyContact: document.getElementById('emergencyContact').value.trim(),
                address: document.getElementById('address').value.trim(),
                department: document.getElementById('department').value.trim(),
                position: document.getElementById('position').value.trim(),
                employmentType: document.getElementById('employmentType').value.trim() || 'Full Time',
                supervisor: document.getElementById('supervisor').value.trim(),
                joinDate: document.getElementById('joinDate').value,
                employeeId: document.getElementById('employeeId').value.trim(),
                employeePassword: document.getElementById('employeePassword').value
            };

            try {
                const response = await fetch('/api/add-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();
                if (result.success) {
                    alert(result.message || 'New employee added successfully!');
                    window.location.href = 'departments.html';
                } else {
                    alert('Error: ' + result.message);
                }
            } catch (err) {
                console.error('Submission error:', err);
                alert('Server connection error. Ensure Node server is running on port 3000.');
            }
        });
    });
