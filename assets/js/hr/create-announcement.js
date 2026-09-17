document.addEventListener('DOMContentLoaded', function() {
    const username = sessionStorage.getItem('username');
    const userId = sessionStorage.getItem('userId') || sessionStorage.getItem('user_id');
    const position = sessionStorage.getItem('position');
    const department = sessionStorage.getItem('department');

    if (!username || !position) {
        alert('Access Denied! Please log in first.');
        window.location.href = '../index.html';
        return;
    }

    // -------- Sidebar / Top bar initialization --------
    document.getElementById('sidebarName').textContent = username;
    document.getElementById('sidebarMeta').textContent = `${userId ? userId.toUpperCase() : ''} . ${department || ''}`;

    const initials = username.split(' ').map(name => name.charAt(0)).join('').substring(0, 2).toUpperCase();
    const topAvatarEl = document.getElementById('topAvatar');
    const sidebarAvatarEl = document.getElementById('sidebarAvatarContainer');
    if (topAvatarEl) topAvatarEl.textContent = initials;

    function updateAvatarDisplay(avatarBase64) {
        if (avatarBase64) {
            const imgHTML = `<img src="${avatarBase64}" alt="Profile Picture" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
            if (sidebarAvatarEl) sidebarAvatarEl.innerHTML = imgHTML;
            if (topAvatarEl) topAvatarEl.innerHTML = imgHTML;
        }
    }
    const formattedUserId = (userId || '').toUpperCase();
    const savedAvatar = localStorage.getItem(`userAvatar_${formattedUserId}`);
    updateAvatarDisplay(savedAvatar);

    if (document.getElementById('logoutBtn')) {
        document.getElementById('logoutBtn').addEventListener('click', function() {
            sessionStorage.clear();
        });
    }

    // Default Publish Date to today, and keep Expiry Date from being set before it
    const todayStr = new Date().toISOString().split('T')[0];
    const publishDateEl = document.getElementById('annPublishDate');
    const expiryDateEl = document.getElementById('annExpiryDate');
    publishDateEl.value = todayStr;
    expiryDateEl.min = todayStr;

    publishDateEl.addEventListener('change', function() {
        expiryDateEl.min = publishDateEl.value;
        if (expiryDateEl.value && expiryDateEl.value < publishDateEl.value) {
            expiryDateEl.value = publishDateEl.value;
        }
    });

    // -------- Form submission --------
    document.getElementById('createAnnouncementForm').addEventListener('submit', async function(e) {
        e.preventDefault();

        const payload = {
            title: document.getElementById('annTitle').value.trim(),
            message: document.getElementById('annMessage').value.trim(),
            targetAudience: document.getElementById('annAudience').value,
            publishDate: publishDateEl.value,
            expiryDate: expiryDateEl.value,
            user_id: userId
        };

        if (!payload.title || !payload.message || !payload.targetAudience || !payload.publishDate || !payload.expiryDate) {
            alert('Please fill in all required fields.');
            return;
        }

        const submitBtn = document.querySelector('.btn-action-submit');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        try {
            const response = await fetch(`/api/announcements?user_id=${encodeURIComponent(formattedUserId)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (result.success) {
                alert(result.message || 'Announcement created successfully!');
                window.location.href = 'hr-operation.html';
            } else {
                alert('Error: ' + result.message);
            }
        } catch (err) {
            console.error('Submission error:', err);
            alert('Server connection error. Please try again.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
});
