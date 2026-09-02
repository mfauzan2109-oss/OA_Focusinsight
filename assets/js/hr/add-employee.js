document.addEventListener('DOMContentLoaded', function() {
        let employees = [];

        const urlParams = new URLSearchParams(window.location.search);
        // Baca nama department daripada URL atau ambil daripada sessionStorage jika wujud
        const deptFromUrl = urlParams.get('dept') || urlParams.get('department') || sessionStorage.getItem('add_dept_deptName') || '';

        const deptInput = document.getElementById('deptInput');
        const empIdInput = document.getElementById('empIdInput');
        const empNameInput = document.getElementById('empNameInput');
        const positionInput = document.getElementById('positionInput');
        const passwordInput = document.getElementById('passwordInput');
        const editingRowIndex = document.getElementById('editingRowIndex');
        const tableBody = document.getElementById('tempEmployeeTableBody');

        if (deptFromUrl) {
            deptInput.value = deptFromUrl;
        }

        function renderTable() {
            tableBody.innerHTML = '';

            if (employees.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding: 18px;">No employees added to the list yet.</td></tr>`;
                return;
            }

            employees.forEach((emp, index) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${emp.id}</td>
                    <td>${emp.name}</td>
                    <td>${emp.position}</td>
                    <td>
                        <button type="button" class="icon-action-btn" onclick="editEmployee(${index})" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button type="button" class="icon-action-btn delete-icon" onclick="removeEmployee(${index})" title="Remove"><i class="fa-solid fa-trash-can"></i></button>
                    </td>
                `;
                tableBody.appendChild(tr);
            });
        }

        // Add / Update employee in list
        document.getElementById('addToListBtn').addEventListener('click', function() {
            const id = empIdInput.value.trim();
            const name = empNameInput.value.trim();
            const pos = positionInput.value.trim();
            const pwd = passwordInput.value;

            if (!id || !name || !pos || !pwd) {
                alert('Please fill in Employee ID, Name, Position, and Password.');
                return;
            }

            const editIndex = parseInt(editingRowIndex.value);
            if (editIndex >= 0) {
                employees[editIndex] = { id, name, position: pos, password: pwd };
                editingRowIndex.value = '-1';
            } else {
                if (employees.some(e => e.id.toLowerCase() === id.toLowerCase())) {
                    alert(`Employee ID '${id}' is already in the list.`);
                    return;
                }
                employees.push({ id, name, position: pos, password: pwd });
            }

            clearInputs();
            renderTable();
        });

        // Clear input fields
        document.getElementById('clearBtn').addEventListener('click', clearInputs);

        function clearInputs() {
            empIdInput.value = '';
            empNameInput.value = '';
            positionInput.value = '';
            passwordInput.value = '';
            editingRowIndex.value = '-1';
        }

        // Edit row function
        window.editEmployee = function(index) {
            const emp = employees[index];
            empIdInput.value = emp.id;
            empNameInput.value = emp.name;
            positionInput.value = emp.position;
            passwordInput.value = emp.password;
            editingRowIndex.value = index;
        };

        // Remove row function
        window.removeEmployee = function(index) {
            employees.splice(index, 1);
            clearInputs();
            renderTable();
        };

        // Save employees to database
        document.getElementById('saveEmployeesBtn').addEventListener('click', async function() {
            const department = deptInput.value.trim();

            if (!department) {
                alert('Please enter a Department (applies to everyone in the list).');
                return;
            }
            if (employees.length === 0) {
                alert('Add at least one employee to the list before saving.');
                return;
            }

            const saveBtn = document.getElementById('saveEmployeesBtn');
            const originalText = saveBtn.textContent;
            saveBtn.disabled = true;

            const today = new Date().toISOString().split('T')[0];
            const failures = [];
            let successCount = 0;

            for (let i = 0; i < employees.length; i++) {
                const emp = employees[i];
                saveBtn.textContent = `Saving ${i + 1} of ${employees.length}...`;

                try {
                    const response = await fetch('/api/add-user', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            fullName: emp.name,
                            department: department,
                            position: emp.position,
                            employeeId: emp.id,
                            employeePassword: emp.password,
                            employmentType: 'Full Time',
                            joinDate: today
                        })
                    });

                    const result = await response.json();
                    if (result.success) {
                        successCount++;
                    } else {
                        failures.push(`${emp.id} (${emp.name}): ${result.message}`);
                    }
                } catch (err) {
                    console.error('Error saving employee:', emp.id, err);
                    failures.push(`${emp.id} (${emp.name}): Server connection error`);
                }
            }

            saveBtn.disabled = false;
            saveBtn.textContent = originalText;

            if (failures.length === 0) {
                alert(`${successCount} employee(s) saved successfully!`);
                window.location.href = `department-edit.html?dept=${encodeURIComponent(department)}`;
            } else {
                alert(`${successCount} saved successfully.\n\nFailed:\n${failures.join('\n')}`);
            }
        });

        renderTable();
    });
