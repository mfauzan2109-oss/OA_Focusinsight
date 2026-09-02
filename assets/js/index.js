document.getElementById('loginForm').addEventListener('submit', async function(e) {
            e.preventDefault(); // Stop standard form submission refresh

            const user_id = document.getElementById('employee-id').value.trim();
            const password = document.getElementById('password').value;
            const errorMsg = document.getElementById('errorMsg');

            try {
                // Post credentials directly to your live Node.js server
                const response = await fetch('http://localhost:3000/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id, password })
                });

                const data = await response.json();

                if (data.success) {
                    errorMsg.style.display = 'none';

                    // Save context variables into browser memory for dashboard populating & route restriction
                    sessionStorage.setItem('userId', data.user_id || user_id);
                    sessionStorage.setItem('username', data.name);
                    sessionStorage.setItem('position', data.position);
                    sessionStorage.setItem('department', data.department);
                    
                    const dept = (data.department || '').toLowerCase();
                    const pos = (data.position || '').toLowerCase();

                    // Check if user belongs to HR
                    const isHR = dept.includes('hr') || 
                                 dept.includes('human resources') || 
                                 pos.includes('hr');

                    // Route user to appropriate module
                    if (isHR) {
                        window.location.href = 'hr/hr-dashboard.html'; // Main landing page for HR
                    } else if (data.position === 'CEO') {
                        window.location.href = 'dashboard-ceo.html';
                    } else if (data.position === 'Manager') {
                        window.location.href = 'dashboard-manager.html';
                    } else if (data.position === 'Supervisor') {
                        window.location.href = 'dashboard-supervisor.html';
                    } else {
                        window.location.href = 'dashboard.html'; // Default Employee dashboard
                    }
                } else {
                    // Show validation denial reasons from your database records
                    errorMsg.textContent = data.message;
                    errorMsg.style.display = 'block';
                }
            } catch (error) {
                console.error('Error:', error);
                errorMsg.textContent = 'Server unreachable. Ensure node server.js is running.';
                errorMsg.style.display = 'block';
            }
        });
