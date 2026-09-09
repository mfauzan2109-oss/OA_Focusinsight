(function enforceHRAccessOnly() {
    // 1. Dapatkan data sesi pengguna secara dinamik
    const userId = sessionStorage.getItem('userId') 
                || sessionStorage.getItem('user_id') 
                || sessionStorage.getItem('employee_id');

    const department = (
        sessionStorage.getItem('department') || 
        sessionStorage.getItem('dept') || 
        ''
    ).toLowerCase();

    const position = (
        sessionStorage.getItem('position') || 
        sessionStorage.getItem('pos') || 
        sessionStorage.getItem('userRole') || 
        sessionStorage.getItem('role') || 
        ''
    ).toLowerCase();

    // 2. Semak status HR secara dinamik
    const isHR = department.includes('hr') || 
                 department.includes('human resources') || 
                 position.includes('hr') ||
                 position === 'hr manager' ||
                 position === 'hr officer';

    // 3. Sekat akses sekiranya bukan akaun HR
    if (!userId || userId === 'null' || userId === 'undefined' || !isHR) {
        alert('Access Denied: Only HR accounts can access this page.');
        
        // Tentukan laluan balik ke index.html berdasarkan struktur folder
        const currentPath = window.location.pathname;
        const rootRedirect = currentPath.includes('/hr/') ? '../index.html' : 'index.html';
        window.location.href = rootRedirect;
    }
})();