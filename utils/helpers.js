// ==========================================================================
// GENERAL PURPOSE HELPERS
// ==========================================================================
function normalizeFilePath(filePath) {
    if (!filePath) return null;
    let cleanPath = filePath.replace(/\\/g, '/');
    if (cleanPath.startsWith('/')) cleanPath = cleanPath.substring(1);
    return cleanPath;
}

function safeVal(val, maxLength = 255) {
    if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return null;
    }
    const str = String(val).trim();
    return maxLength ? str.substring(0, maxLength) : str;
}

function safeNum(val) {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0.00 : parsed;
}

function getAnnualEntitlement(years) {
    if (years <= 1) return 12;
    if (years === 2) return 14;
    if (years === 3) return 16;
    if (years === 4) return 18;
    if (years === 5) return 20;
    return 22;
}

function getSickEntitlement(years) {
    if (years < 2) return 14;
    if (years >= 2 && years < 5) return 18;
    return 22;
}

// ==========================================================================
// LEAVE HELPERS: WEEKEND-AWARE DAY COUNTING
// ==========================================================================
function isWeekend(dateObj) {
    const day = dateObj.getDay();
    return day === 0 || day === 6;
}

function countBusinessDays(startDateStr, endDateStr) {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
        return 0;
    }

    let count = 0;
    const cursor = new Date(start);
    while (cursor <= end) {
        if (!isWeekend(cursor)) count++;
        cursor.setDate(cursor.getDate() + 1);
    }
    return count;
}

module.exports = {
    normalizeFilePath,
    safeVal,
    safeNum,
    getAnnualEntitlement,
    getSickEntitlement,
    isWeekend,
    countBusinessDays
};
