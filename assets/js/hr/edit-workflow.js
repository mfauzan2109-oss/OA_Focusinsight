document.addEventListener('DOMContentLoaded', function() {
        const username = sessionStorage.getItem('username') || '';
        const initials = username
            ? username.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
            : '';
        document.getElementById('topAvatar').textContent = initials || '—';

        const urlParams = new URLSearchParams(window.location.search);
        const workflowType = (urlParams.get('type') || urlParams.get('workflow') || 'leave').toLowerCase();

        const stepsWrapper = document.getElementById('stepsWrapper');
        let currentSteps = [];
        let currentWorkflowName = '';

        const roleOptions = [
            'Employee',
            'Supervisor',
            'Manager',
            'Head of Department',
            'Project Manager',
            'HR Staff',
            'HR Executive',
            'HR / Finance',
            'Finance / HR',
            'CEO'
        ];

        function renderSteps() {
            stepsWrapper.innerHTML = '';
            currentSteps.forEach((step, index) => {
                const stepCard = document.createElement('div');
                stepCard.className = 'step-card';

                const optionsHtml = roleOptions.map(role =>
                    `<option value="${role}" ${role === step.value ? 'selected' : ''}>${role}</option>`
                ).join('');

                stepCard.innerHTML = `
                    <div class="step-card-header">
                        <span class="step-badge-pill">Step ${index + 1}</span>
                        <span class="step-label-title">${step.label}</span>
                    </div>
                    ${index > 0 ? `<button type="button" class="btn-remove-step" onclick="removeStep(${index})" title="Remove Step"><i class="fa-solid fa-trash-can"></i></button>` : ''}
                    <select class="step-select-dropdown" onchange="updateStepValue(${index}, this.value)">
                        ${optionsHtml}
                    </select>
                `;
                stepsWrapper.appendChild(stepCard);
            });
        }

        window.updateStepValue = function(index, value) {
            currentSteps[index].value = value;
        };

        window.removeStep = function(index) {
            currentSteps.splice(index, 1);
            renderSteps();
        };

        document.getElementById('addStepBtn').addEventListener('click', function() {
            const nextStepNum = currentSteps.length + 1;
            currentSteps.push({
                label: `Approver Step ${nextStepNum}`,
                value: 'Head of Department'
            });
            renderSteps();
        });

        async function loadWorkflow() {
            try {
                const response = await fetch(`/api/workflows/${encodeURIComponent(workflowType)}`);
                const result = await response.json();

                if (!result.success) {
                    alert(result.message || 'Workflow not found.');
                    window.location.href = 'workflow-settings.html';
                    return;
                }

                currentWorkflowName = result.workflow_name;
                currentSteps = result.steps;
                document.getElementById('workflowPageTitle').textContent = `Edit Workflow : ${currentWorkflowName}`;
                renderSteps();
            } catch (err) {
                console.error('Error loading workflow:', err);
                alert('Failed to connect to server. Ensure Node.js server is running.');
            }
        }

        document.getElementById('workflowForm').addEventListener('submit', async function(e) {
            e.preventDefault();

            if (currentSteps.length === 0) {
                alert('A workflow must have at least one step.');
                return;
            }

            const saveBtn = document.querySelector('.btn-action-save');
            const originalText = saveBtn.textContent;
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

            try {
                const response = await fetch(`/api/workflows/${encodeURIComponent(workflowType)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        workflow_name: currentWorkflowName,
                        steps: currentSteps
                    })
                });

                const result = await response.json();

                if (result.success) {
                    alert(`Approval workflow for ${currentWorkflowName} saved successfully!`);
                    window.location.href = 'workflow-settings.html';
                } else {
                    alert(result.message || 'Failed to save workflow.');
                    saveBtn.disabled = false;
                    saveBtn.textContent = originalText;
                }
            } catch (err) {
                console.error('Error saving workflow:', err);
                alert('Error connecting to server. Please try again.');
                saveBtn.disabled = false;
                saveBtn.textContent = originalText;
            }
        });

        loadWorkflow();
    });
