document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault(); // Stop page refresh

        const user_id = document.getElementById('employee-id').value.trim();
        const password = document.getElementById('password').value;
        const errorMsg = document.getElementById('errorMsg');

        try {
            // Post login credentials directly to your live Node.js/MySQL backend
            const response = await fetch('http://localhost:3000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id, password })
            });

            const data = await response.json();

            if (data.success) {
                if (errorMsg) errorMsg.style.display = 'none';

                // Save dynamic database records into session storage variables
                // Uses fallback to user_id if backend doesn't explicitly return user_id
                sessionStorage.setItem('userId', data.user_id || user_id);
                sessionStorage.setItem('username', data.name);
                sessionStorage.setItem('position', data.position);
                sessionStorage.setItem('department', data.department);
                
                // Show login success confirmation alert popup
                alert(`Welcome back, ${data.name} (${data.position}) - ${data.department}!`);
                
                // REDIRECT EVERYONE DYNAMICALLY TO THE SAME SMART DASHBOARD FILE
                window.location.href = 'dashboard.html';
                
            } else {
                // Show validation errors returned from the live MySQL check
                if (errorMsg) {
                    errorMsg.textContent = data.message;
                    errorMsg.style.display = 'block';
                } else {
                    alert(data.message);
                }
            }
        } catch (error) {
            console.error('Error:', error);
            const msg = 'Server unreachable. Ensure node server.js is running.';
            if (errorMsg) {
                errorMsg.textContent = msg;
                errorMsg.style.display = 'block';
            } else {
                alert(msg);
            }
        }
    });
});