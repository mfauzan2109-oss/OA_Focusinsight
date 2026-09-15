document.addEventListener('DOMContentLoaded', async function() {
        const urlParams = new URLSearchParams(window.location.search);
        const deptParam = urlParams.get('dept') || 'Electrical Engineering';

        document.getElementById('editDeptBtn').href = `department-edit.html?dept=${encodeURIComponent(deptParam)}`;

        try {
            const response = await fetch(`/api/departments/details/${encodeURIComponent(deptParam)}`);
            const result = await response.json();

            if (result.success) {
                document.getElementById('pageTitle').textContent = `${result.department} Department`;
                document.getElementById('deptName').value = result.department;
                document.getElementById('deptHead').value = result.hod;
                document.getElementById('dateCreated').value = result.date_created;

                const empTable = document.getElementById('employeeTableBody');
                const empList = result.employees || [];

                document.getElementById('showingText').textContent = `Showing ${empList.length} record${empList.length !== 1 ? 's' : ''}`;

                if (empList.length === 0) {
                    empTable.innerHTML = `<tr><td colspan="3" style="color: #94a3b8; padding: 18px;">No active employees assigned to this department.</td></tr>`;
                } else {
                    empTable.innerHTML = empList.map(emp => `
                        <tr>
                            <td>${emp.user_id}</td>
                            <td>${emp.name}</td>
                            <td>${emp.position || 'Employee'}</td>
                        </tr>
                    `).join('');
                }
            } else {
                alert(result.message || 'Department details not found.');
            }
        } catch (err) {
            console.error('Error fetching department details:', err);
            document.getElementById('employeeTableBody').innerHTML = `<tr><td colspan="3" style="color: #ef4444; padding: 18px;">Failed to load data from server.</td></tr>`;
        }
    });
