document.addEventListener('DOMContentLoaded', async function() {
        const urlParams = new URLSearchParams(window.location.search);
        const deptParam = urlParams.get('dept');

        if (!deptParam) {
            alert('No department specified.');
            window.location.href = 'departments.html';
            return;
        }

        let allEmployees = [];
        let currentPage = 1;
        const PAGE_SIZE = 5;
        let originalDeptName = deptParam;

        document.getElementById('addEmployeeBtn').href = `add-employee.html?department=${encodeURIComponent(deptParam)}`;

        function renderEmployeePage() {
            const tbody = document.getElementById('employeeTableBody');
            const showingText = document.getElementById('showingText');
            const paginationControls = document.getElementById('paginationControls');

            if (allEmployees.length === 0) {
                tbody.innerHTML = `<tr><td colspan="3" style="color: #94a3b8; padding: 18px;">No employees assigned to this department.</td></tr>`;
                showingText.textContent = 'Showing 0 records';
                paginationControls.innerHTML = '';
                return;
            }

            const totalPages = Math.ceil(allEmployees.length / PAGE_SIZE);
            currentPage = Math.min(currentPage, totalPages);
            const start = (currentPage - 1) * PAGE_SIZE;
            const pageItems = allEmployees.slice(start, start + PAGE_SIZE);

            tbody.innerHTML = pageItems.map(emp => `
                <tr>
                    <td>${emp.user_id}</td>
                    <td>${emp.name}</td>
                    <td>${emp.position || 'Employee'}</td>
                </tr>
            `).join('');

            showingText.textContent = `Showing ${start + 1}-${Math.min(start + PAGE_SIZE, allEmployees.length)} of ${allEmployees.length} records`;

            let pagHtml = `<button type="button" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>&lt;</button>`;
            for (let p = 1; p <= totalPages; p++) {
                pagHtml += `<button type="button" data-page="${p}" class="${p === currentPage ? 'active' : ''}">${p}</button>`;
            }
            pagHtml += `<button type="button" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>&gt;</button>`;
            paginationControls.innerHTML = pagHtml;

            paginationControls.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', function() {
                    const page = parseInt(this.dataset.page, 10);
                    if (page >= 1 && page <= totalPages) {
                        currentPage = page;
                        renderEmployeePage();
                    }
                });
            });
        }

        async function loadDepartmentDetails() {
            try {
                const response = await fetch(`/api/departments/details/${encodeURIComponent(deptParam)}`);
                const result = await response.json();

                if (!result.success) {
                    alert(result.message || 'Department not found.');
                    window.location.href = 'departments.html';
                    return;
                }

                originalDeptName = result.department;
                document.getElementById('deptName').value = result.department;
                document.getElementById('deptHead').value = (result.hod && result.hod !== 'Unassigned') ? result.hod : '';
                document.getElementById('dateCreated').value = result.date_created;
                document.getElementById('deptDesc').value = result.description || '';

                allEmployees = result.employees || [];
                currentPage = 1;
                renderEmployeePage();
            } catch (err) {
                console.error('Error loading department details:', err);
                alert('Failed to connect to server. Ensure Node.js server is running.');
            }
        }

        document.getElementById('editDepartmentForm').addEventListener('submit', async function(e) {
            e.preventDefault();

            const newDeptName = document.getElementById('deptName').value.trim();
            const headOfDept = document.getElementById('deptHead').value.trim();
            const description = document.getElementById('deptDesc').value.trim();

            if (!newDeptName) {
                alert('Please enter a department name.');
                return;
            }

            const saveBtn = document.getElementById('saveBtn');
            const originalText = saveBtn.textContent;
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

            try {
                const response = await fetch(`/api/departments/details/${encodeURIComponent(originalDeptName)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        newDeptName: newDeptName,
                        head_of_department: headOfDept,
                        description: description
                    })
                });

                const result = await response.json();

                if (result.success) {
                    alert(result.message || 'Department updated successfully!');
                    window.location.href = 'departments.html';
                } else {
                    alert(result.message || 'Failed to update department.');
                    saveBtn.disabled = false;
                    saveBtn.textContent = originalText;
                }
            } catch (err) {
                console.error('Error updating department:', err);
                alert('Error connecting to server. Please try again.');
                saveBtn.disabled = false;
                saveBtn.textContent = originalText;
            }
        });

        loadDepartmentDetails();
    });
