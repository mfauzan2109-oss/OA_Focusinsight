document.addEventListener('DOMContentLoaded', function() {
        const username = sessionStorage.getItem('username') || 'Chen Jun';
        const initials = username.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        document.getElementById('topAvatar').textContent = initials || 'CJ';

        const stepsWrapper = document.getElementById('stepsWrapper');

        const roleStepTypes = [
            'Requester',
            'Verification',
            'First Approver',
            'Second Approver',
            'HR review',
            'Finance review',
            'Payroll',
            'Final Authorization'
        ];

        const userPositionOptions = [
            'Select user / position',
            'Employee',
            'Supervisor',
            'Manager',
            'Head of Department',
            'Project Manager',
            'HR Staff',
            'HR Executive',
            'Finance / HR',
            'CEO'
        ];

        // Initial default steps array
        let currentSteps = [
            { role: 'Requester', position: 'Employee' }
        ];

        function renderSteps() {
            stepsWrapper.innerHTML = '';
            currentSteps.forEach((step, index) => {
                const stepCard = document.createElement('div');
                stepCard.className = 'step-card';

                const roleOptionsHtml = roleStepTypes.map(r => 
                    `<option value="${r}" ${r === step.role ? 'selected' : ''}>${r}</option>`
                ).join('');

                const posOptionsHtml = userPositionOptions.map(pos => 
                    `<option value="${pos}" ${pos === step.position ? 'selected' : ''}>${pos}</option>`
                ).join('');

                stepCard.innerHTML = `
                    <div class="step-card-header">
                        <span class="step-badge-pill">Step ${index + 1}</span>
                        <select class="step-role-select" onchange="updateStepRole(${index}, this.value)">
                            ${roleOptionsHtml}
                        </select>
                    </div>
                    ${index > 0 ? `<button type="button" class="btn-remove-step" onclick="removeStep(${index})" title="Remove Step"><i class="fa-solid fa-trash-can"></i></button>` : ''}
                    <select class="step-user-position-select" onchange="updateStepPosition(${index}, this.value)">
                        ${posOptionsHtml}
                    </select>
                `;
                stepsWrapper.appendChild(stepCard);
            });
        }

        window.updateStepRole = function(index, value) {
            currentSteps[index].role = value;
        };

        window.updateStepPosition = function(index, value) {
            currentSteps[index].position = value;
        };

        window.removeStep = function(index) {
            currentSteps.splice(index, 1);
            renderSteps();
        };

        document.getElementById('addStepBtn').addEventListener('click', function() {
            currentSteps.push({
                role: 'First Approver',
                position: 'Head of Department'
            });
            renderSteps();
        });

        document.getElementById('newWorkflowForm').addEventListener('submit', async function(e) {
            e.preventDefault();

            const payload = {
                workflowName: document.getElementById('workflowNameInput').value,
                steps: currentSteps
            };

            try {
                const response = await fetch('submit_workflow_hr.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();
                if (result.success) {
                    alert(result.message || 'Workflow configuration saved successfully!');
                    window.location.href = 'workflow-settings.html';
                } else {
                    alert('Error: ' + result.message);
                }
            } catch (err) {
                alert('Connection Error. Ensure Apache and MySQL are running in XAMPP.');
            }
        });

        renderSteps();
    });
