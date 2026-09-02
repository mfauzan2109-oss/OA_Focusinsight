document.addEventListener('DOMContentLoaded', function() {
        const fields = ['deptName', 'deptHead', 'dateCreated', 'deptDesc'];
        const btnAddEmp = document.getElementById('btnAddEmp');
        const employeeTableBody = document.getElementById('employeeTableBody');

        // 1. PULIHKAN DATA BORANG DARIPADA SESSIONSTORAGE (JIKA WUJUD)
        fields.forEach(fieldId => {
            const inputEl = document.getElementById(fieldId);
            if (inputEl) {
                const savedValue = sessionStorage.getItem(`add_dept_${fieldId}`);
                if (savedValue !== null) {
                    inputEl.value = savedValue;
                }

                // SIMPAN AUTOMATIK APABILA PENGGUNA TAIP
                inputEl.addEventListener('input', function() {
                    sessionStorage.setItem(`add_dept_${fieldId}`, this.value);
                    updateAddEmpLink();
                });
            }
        });

        // Kemaskini URL pautan "+ Add Employee" supaya menyertakan nama department
        function updateAddEmpLink() {
            const currentDeptName = document.getElementById('deptName').value.trim();
            if (currentDeptName) {
                btnAddEmp.href = `add-employee.html?dept=${encodeURIComponent(currentDeptName)}`;
            } else {
                btnAddEmp.href = `add-employee.html`;
            }
        }
        updateAddEmpLink();

        // 1b. PAPARKAN SENARAI STAFF YANG DI-STAGE DARI add-employee.html
        function getStagedEmployees() {
            try {
                const stored = sessionStorage.getItem('add_dept_employees');
                return stored ? JSON.parse(stored) : [];
            } catch (e) {
                console.error('Failed to parse staged employees:', e);
                return [];
            }
        }

        function renderStagedEmployees() {
            const employees = getStagedEmployees();

            if (employees.length === 0) {
                employeeTableBody.innerHTML = `
                    <tr><td colspan="3" style="text-align:center; color:#94a3b8; padding: 18px;">No employees added yet. Click "+ Add Employee" above.</td></tr>
                `;
                return;
            }

            employeeTableBody.innerHTML = employees.map(emp => `
                <tr>
                    <td>${emp.id}</td>
                    <td>${emp.name}</td>
                    <td>${emp.position}</td>
                </tr>
            `).join('');
        }
        renderStagedEmployees();

        // 2. SUBMIT FORM: CIPTA DEPARTMENT + SEMUA STAFF YANG DI-STAGE SEKALI GUS
        document.getElementById('addDepartmentForm').addEventListener('submit', async function(e) {
            e.preventDefault();

            const deptName = document.getElementById('deptName').value.trim();
            const deptHead = document.getElementById('deptHead').value.trim();
            const deptDesc = document.getElementById('deptDesc').value.trim();
            const stagedEmployees = getStagedEmployees();

            if (!deptName) {
                alert('Please enter a department name.');
                return;
            }

            const saveBtn = document.querySelector('.btn-action-save');
            const originalText = saveBtn.textContent;
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

            try {
                // Step 1: create the department itself
                const response = await fetch('/api/departments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        department_name: deptName,
                        head_of_department: deptHead,
                        description: deptDesc
                    })
                });

                const result = await response.json();

                if (!result.success) {
                    alert(result.message || 'Failed to create department.');
                    saveBtn.disabled = false;
                    saveBtn.textContent = originalText;
                    return;
                }

                // Step 2: create every staged employee under this department
                const today = new Date().toISOString().split('T')[0];
                const failures = [];
                let successCount = 0;

                for (let i = 0; i < stagedEmployees.length; i++) {
                    const emp = stagedEmployees[i];
                    saveBtn.textContent = `Saving employee ${i + 1} of ${stagedEmployees.length}...`;

                    try {
                        const empRes = await fetch('/api/add-user', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                fullName: emp.name,
                                department: deptName,
                                position: emp.position,
                                employeeId: emp.id,
                                employeePassword: emp.password,
                                employmentType: 'Full Time',
                                joinDate: today
                            })
                        });
                        const empResult = await empRes.json();
                        if (empResult.success) {
                            successCount++;
                        } else {
                            failures.push(`${emp.id} (${emp.name}): ${empResult.message}`);
                        }
                    } catch (empErr) {
                        console.error('Error saving employee:', emp.id, empErr);
                        failures.push(`${emp.id} (${emp.name}): Server connection error`);
                    }
                }

                // CLEAR SESSIONSTORAGE APABILA BERJAYA DISIMPAN
                fields.forEach(fieldId => sessionStorage.removeItem(`add_dept_${fieldId}`));
                sessionStorage.removeItem('add_dept_employees');

                if (failures.length === 0) {
                    alert(`Department created successfully!${stagedEmployees.length > 0 ? `\n${successCount} employee(s) added.` : ''}`);
                } else {
                    alert(`Department created, but some employees failed to save:\n${failures.join('\n')}`);
                }
                window.location.href = 'departments.html';

            } catch (err) {
                console.error('Error creating department:', err);
                alert('Error connecting to server. Please try again.');
                saveBtn.disabled = false;
                saveBtn.textContent = originalText;
            }
        });
    });
